import { resolveCourtLayers, setCourtLayerHidden, setCourtLayerLocked } from "../court-layers";
import { deleteSelection, duplicateStep, editableCourtSelection, frameDrawings, moveSelection, newCourtBoard, parseEditorImport } from "../visual-court-editor";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { buildCourtPerspectiveFrame } from "../visual-court-perspective";
import { displayCourtDrawings } from "../court-simulation-display";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { publishableCourt } from "../court-sharing";

function board() {
  const payload = newCourtBoard();
  payload.editor!.drawings[payload.timeline.steps[0].id] = [{ id: "note", kind: "text", text: "Nota", points: [{ x: .4, y: .5 }], color: "#abcdef", size: 32, rotation: 0 }];
  return payload;
}
const note = { kind: "drawing" as const, id: "note" };

describe("individual court layer visibility and locks", () => {
  it("keeps hidden layers recoverable in the same stack without mutating geometry or existing metadata", () => {
    const source = board(), before = JSON.stringify(source), actor = { kind: "actor" as const, id: source.actors[0].id };
    const locked = setCourtLayerLocked(source, 0, actor, true);
    const hidden = setCourtLayerHidden(setCourtLayerHidden(locked, 0, actor, true), 0, note, true);
    expect(hidden.editor!.actorMeta[actor.id]).toMatchObject({ team: "A", locked: true, hidden: true });
    expect(resolveCourtLayers(hidden, 0)).toEqual(resolveCourtLayers(source, 0));
    expect(hidden.timeline).toBe(source.timeline);
    expect(hidden.actors).toBe(source.actors);
    expect(frameDrawings(hidden, 0)[0].points).toBe(frameDrawings(source, 0)[0].points);
    expect(setCourtLayerHidden(hidden, 0, actor, true)).toBe(hidden);
    expect(setCourtLayerLocked(hidden, 0, actor, true)).toBe(hidden);
    expect(setCourtLayerHidden(hidden, 99, actor, false)).toBe(hidden);
    expect(setCourtLayerLocked(hidden, 0, { kind: "drawing", id: "absent" }, true)).toBe(hidden);
    const restored = setCourtLayerLocked(setCourtLayerHidden(hidden, 0, actor, false), 0, actor, false);
    expect(restored.editor!.actorMeta[actor.id]).toMatchObject({ hidden: false, locked: false });
    expect(JSON.stringify(source)).toBe(before);
  });

  it("shares actor flags between steps while retaining individual drawing state on a copied step", () => {
    const source = board(), actor = { kind: "actor" as const, id: source.actors[0].id };
    const flags = setCourtLayerHidden(setCourtLayerLocked(setCourtLayerHidden(source, 0, note, true), 0, note, true), 0, actor, true);
    const copy = duplicateStep(flags, 0).payload, clone = frameDrawings(copy, 1)[0];
    expect(clone).toMatchObject({ hidden: true, locked: true });
    const next = setCourtLayerHidden(copy, 1, { kind: "drawing", id: clone.id }, false);
    expect(frameDrawings(next, 0)[0].hidden).toBe(true);
    expect(frameDrawings(next, 1)[0].hidden).toBe(false);
    expect(buildCourtPerspectiveFrame(next, 1, 0).actors.some(item => item.id === actor.id)).toBe(false);
    expect(setCourtLayerHidden(next, 1, actor, false).editor!.actorMeta[actor.id].hidden).toBe(false);
  });

  it.each(["hidden", "locked"] as const)("ignores stale protected selections (%s) for movement and deletion", flag => {
    const source = board(), actor = { kind: "actor" as const, id: source.actors[0].id };
    const set = flag === "hidden" ? setCourtLayerHidden : setCourtLayerLocked;
    const protectedBoard = set(set(source, 0, actor, true), 0, note, true);
    const ids = [actor.id, note.id];
    expect(editableCourtSelection(protectedBoard, 0, ids)).toEqual([]);
    expect(moveSelection(protectedBoard, 0, ids, { x: .1, y: .1 }, false)).toBe(protectedBoard);
    expect(moveSelection(protectedBoard, 0, ids, { x: .1, y: .1 }, true)).toBe(protectedBoard);
    expect(deleteSelection(protectedBoard, 0, ids)).toBe(protectedBoard);
    const free = source.actors[1].id;
    const mixed = moveSelection(protectedBoard, 0, [...ids, free], { x: .1, y: 0 }, false);
    expect(mixed.timeline.steps[0].actorPositions[actor.id]).toEqual(source.timeline.steps[0].actorPositions[actor.id]);
    expect(mixed.timeline.steps[0].actorPositions[free].x).toBeCloseTo(source.timeline.steps[0].actorPositions[free].x + .1);
    expect(frameDrawings(mixed, 0)).toEqual(frameDrawings(protectedBoard, 0));
  });

  it.each([true, false])("round-trips boolean hidden=%s and locks through storage, import and sanitized sharing", hidden => {
    const source = board(), id = source.actors[0].id;
    source.editor!.actorMeta[id] = { ...source.editor!.actorMeta[id], hidden, locked: true, studentId: "private-link" };
    frameDrawings(source, 0)[0] = { ...frameDrawings(source, 0)[0], hidden, locked: true };
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: source }));
    for (const next of [imported, parseCourtVisualPayload(serializeCourtVisualPayload(source)), publishableCourt(source)]) {
      expect(next.editor!.actorMeta[id]).toMatchObject({ hidden, locked: true });
      expect(frameDrawings(next, 0)[0]).toMatchObject({ hidden, locked: true });
    }
    expect(publishableCourt(source).editor!.actorMeta[id].studentId).toBeUndefined();
  });

  it("ignores malformed visibility flags and retains compatibility with documents lacking flags", () => {
    const source = board(), id = source.actors[0].id;
    source.editor!.actorMeta[id].hidden = "false" as never;
    frameDrawings(source, 0)[0].hidden = 1 as never;
    const imported = publishableCourt(source);
    expect(imported.editor!.actorMeta[id].hidden).toBeUndefined();
    expect(frameDrawings(imported, 0)[0].hidden).toBeUndefined();
    expect(buildCourtPerspectiveFrame(imported, 0, 0).actors).toHaveLength(source.actors.length);
    expect(displayCourtDrawings(imported, 0)).toHaveLength(1);
  });

  it("hides simulated objects only in presentation while retaining physics, guides and authoring references", () => {
    const source = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack" });
    const simulation = sampleCourtSimulation(source, 0, 0)!;
    const actor = { kind: "actor" as const, id: simulation.config.actorIds[3] }, ball = { kind: "drawing" as const, id: simulation.ballId };
    const hidden = setCourtLayerHidden(setCourtLayerHidden(source, 0, actor, true), 0, ball, true);
    expect(hidden.timeline).toBe(source.timeline);
    expect(resolveCourtLayers(hidden, 0)).toEqual(resolveCourtLayers(source, 0));
    for (const progress of [0, .5, 1]) {
      expect(sampleCourtSimulation(hidden, 0, progress)).toEqual(sampleCourtSimulation(source, 0, progress));
      expect(displayCourtDrawings(hidden, 0, progress).some(item => item.id === ball.id)).toBe(false);
      const frame = buildCourtPerspectiveFrame(hidden, 0, progress, [actor.id, ball.id]);
      expect(frame.actors.some(item => item.id === actor.id)).toBe(false);
      expect(frame.drawings.some(item => item.id === ball.id)).toBe(false);
      expect(frame.selected).toEqual([]);
      expect(frame.simulation).toEqual(buildCourtPerspectiveFrame(source, 0, progress).simulation);
    }
  });
});
