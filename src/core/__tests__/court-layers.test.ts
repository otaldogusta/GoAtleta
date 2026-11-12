import { bringCourtLayersToFront, moveCourtLayer, normalizeCourtLayerOrder, resolveCourtLayers, type CourtLayerRef } from "../court-layers";
import { addBlankStep, changeDrawings, continueStepFromEnd, copyStepSelection, deleteSelection, duplicateSelection, duplicateStep, frameDrawings, newCourtBoard, parseEditorImport, pasteStepSelection, removeStep, type CourtDrawing } from "../visual-court-editor";
import { publishableCourt } from "../court-sharing";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { buildCourtPerspectiveFrame } from "../visual-court-perspective";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";

const actor = (id: string): CourtLayerRef => ({ kind: "actor", id });
const drawing = (id: string): CourtLayerRef => ({ kind: "drawing", id });
const object = (id: string): CourtDrawing => ({ id, kind: "cone", color: "#f97316", size: 32, rotation: 0, points: [{ x: .5, y: .5 }] });
function board() {
  const payload = newCourtBoard("Camadas");
  payload.actors = payload.actors.slice(0, 2).map((value, index) => ({ ...value, id: index ? "b" : "a" }));
  payload.timeline.steps[0].visibleActorIds = ["a", "b"];
  payload.timeline.steps[0].actorPositions = { a: { x: .4, y: .5 }, b: { x: .5, y: .5 } };
  payload.editor!.drawings[payload.timeline.steps[0].id] = [object("d1"), object("d2")];
  return payload;
}

describe("2D court object layers", () => {
  it("preserves the legacy stack and orders actors and objects together without mutating geometry", () => {
    const source = board(), before = JSON.stringify(source);
    expect(resolveCourtLayers(source, 0)).toEqual([drawing("d1"), drawing("d2"), actor("a"), actor("b")]);
    const changed = moveCourtLayer(source, 0, drawing("d1"), 3);
    expect(resolveCourtLayers(changed, 0)).toEqual([drawing("d2"), actor("a"), actor("b"), drawing("d1")]);
    expect(changed.timeline).toBe(source.timeline);
    expect(changed.actors).toBe(source.actors);
    expect(changed.editor!.drawings).toBe(source.editor!.drawings);
    expect(JSON.stringify(source)).toBe(before);
    expect(resolveCourtLayers(moveCourtLayer(changed, 0, actor("b"), 0), 0)).toEqual([actor("b"), drawing("d2"), actor("a"), drawing("d1")]);
  });

  it.each([-1, 4, NaN, 1.5])("ignores invalid destination %s without a history-worthy change", target => {
    const source = board();
    expect(moveCourtLayer(source, 0, actor("a"), target)).toBe(source);
  });
  it("ignores missing objects, steps and unchanged positions", () => {
    const source = board();
    expect(moveCourtLayer(source, 0, actor("missing"), 0)).toBe(source);
    expect(moveCourtLayer(source, 42, actor("a"), 0)).toBe(source);
    expect(moveCourtLayer(source, 0, actor("a"), 2)).toBe(source);
  });
  it("keeps locked actors and drawings in place", () => {
    const source = board();
    source.editor!.actorMeta.a = { locked: true };
    frameDrawings(source, 0)[0].locked = true;
    expect(moveCourtLayer(source, 0, actor("a"), 0)).toBe(source);
    expect(moveCourtLayer(source, 0, drawing("d1"), 3)).toBe(source);
  });

  it("resolves malformed in-memory references without confusing their kinds", () => {
    const source = board(), id = source.timeline.steps[0].id;
    source.editor!.drawings[id].push(object("a"));
    source.editor!.layerOrder = { [id]: [actor("b"), drawing("a"), actor("a"), actor("a"), drawing("missing")] };
    expect(resolveCourtLayers(source, 0)).toEqual([actor("b"), drawing("a"), actor("a"), drawing("d1"), drawing("d2")]);
    source.timeline.steps[0].visibleActorIds = ["a"];
    expect(resolveCourtLayers(source, 0)).not.toContainEqual(actor("b"));
  });
  it.each(["a", "d1"])("rejects imported drawing ID %s that collides with a player or another object", id => {
    const source = board();
    frameDrawings(source, 0).push(object(id));
    expect(() => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: source }))).toThrow("identificadores duplicados");
    expect(() => publishableCourt(source)).toThrow("identificadores duplicados");
  });

  it("places newly created objects above actors, then removes deleted refs without disturbing the rest", () => {
    const source = board();
    const next = changeDrawings(source, 0, [...frameDrawings(source, 0), object("new")]);
    expect(resolveCourtLayers(next, 0)).toEqual([...resolveCourtLayers(source, 0), drawing("new")]);
    const removed = deleteSelection(next, 0, ["d1", "a"]);
    expect(resolveCourtLayers(removed, 0)).toEqual([drawing("d2"), actor("b"), drawing("new")]);
    expect(removed.editor!.layerOrder![source.timeline.steps[0].id]).toEqual(resolveCourtLayers(removed, 0));
  });

  it.each([duplicateStep, continueStepFromEnd])("copies a step's stack with new drawing IDs and original actor identities", copy => {
    const source = moveCourtLayer(board(), 0, drawing("d1"), 3);
    const next = copy(source, 0).payload;
    const originals = frameDrawings(source, 0), copies = frameDrawings(next, 1);
    expect(resolveCourtLayers(next, 1)).toEqual([drawing(copies[1].id), actor("a"), actor("b"), drawing(copies[0].id)]);
    expect(copies.map(value => value.id)).not.toEqual(originals.map(value => value.id));
    expect(next.actors).toBe(source.actors);
    expect(resolveCourtLayers(next, 0)).toEqual(resolveCourtLayers(source, 0));
    const deleted = removeStep(next, 1).payload;
    expect(deleted.editor!.layerOrder![next.timeline.steps[1].id]).toBeUndefined();
    expect(resolveCourtLayers(deleted, 0)).toEqual(resolveCourtLayers(source, 0));
  });

  it("duplicates a mixed selection to the front in its relative order", () => {
    const source = moveCourtLayer(board(), 0, drawing("d1"), 3);
    const next = duplicateSelection(source, 0, ["d1", "a"]);
    expect(resolveCourtLayers(next.payload, 0)).toEqual([...resolveCourtLayers(source, 0), actor(next.selected[0]), drawing(next.selected[1])]);
  });

  it("pastes above existing layers preserving actor IDs and remapping drawings", () => {
    const source = moveCourtLayer(board(), 0, drawing("d1"), 3);
    const clipboard = copyStepSelection(source, 0, ["d1", "a"]);
    const blank = addBlankStep(source, 0).payload;
    const target = changeDrawings(blank, 1, [object("existing")]);
    const next = pasteStepSelection(target, 1, clipboard);
    expect(next.selected[0]).toBe("a");
    expect(next.selected[1]).not.toBe("d1");
    expect(resolveCourtLayers(next.payload, 1)).toEqual([drawing("existing"), actor("a"), drawing(next.selected[1])]);
    expect(resolveCourtLayers(next.payload, 0)).toEqual(resolveCourtLayers(source, 0));
  });

  it("imports and publishes only bounded valid layer references", () => {
    const source = board(), id = source.timeline.steps[0].id;
    const raw = { [id]: [{ ...actor("b"), private: "not allowed" }, { kind: "url", id: "secret" }, null, actor("b"), drawing("d1"), actor("a"), drawing("missing")], missing: [actor("a")] };
    source.editor!.layerOrder = raw as unknown as Record<string, CourtLayerRef[]>;
    const expected = { [id]: [actor("b"), drawing("d1"), actor("a"), drawing("d2")] };
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: source }));
    expect(imported.editor!.layerOrder).toEqual(expected);
    expect(parseCourtVisualPayload(serializeCourtVisualPayload(imported)).editor!.layerOrder).toEqual(expected);
    expect(publishableCourt(source).editor!.layerOrder).toEqual(expected);
    expect(normalizeCourtLayerOrder(source, { [id]: Array.from({ length: 1000 }, () => actor("b")) })).toEqual({ [id]: [actor("b"), drawing("d1"), drawing("d2"), actor("a")] });
    expect(normalizeCourtLayerOrder(source, "not-an-order")).toBeUndefined();
    expect(normalizeCourtLayerOrder(source, { missing: [] })).toBeUndefined();
  });

  it("does not change simulation, trajectories or physical 3D projection", () => {
    const source = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack" });
    const refs = resolveCourtLayers(source, 0);
    const next = bringCourtLayersToFront(source, 0, [refs[0]]);
    expect(next.timeline).toBe(source.timeline);
    for (const progress of [0, .25, .5, .75, 1]) {
      expect(sampleCourtSimulation(next, 0, progress)).toEqual(sampleCourtSimulation(source, 0, progress));
      expect(buildCourtPerspectiveFrame(next, 0, progress)).toEqual(buildCourtPerspectiveFrame(source, 0, progress));
    }
  });
});
