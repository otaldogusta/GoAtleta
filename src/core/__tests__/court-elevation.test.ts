import { publishableCourt } from "../court-sharing";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { displayCourtDrawings } from "../court-simulation-display";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { addBlankStep, changeDrawings, continueStepFromEnd, copyStepSelection, courtSelectionElevation, deleteSelection, duplicateSelection, duplicateStep, editableCourtElevationSelection, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, resetStepAnimation, setCourtSelectionElevation, type CourtDrawing } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";

const material = (kind: CourtDrawing["kind"] = "ball", extra: Partial<CourtDrawing> = {}): CourtDrawing => ({ id: kind, kind, points: [{ x: .3, y: .6 }], color: "#19c87b", size: 32, rotation: 0, ...extra });
const source = () => changeDrawings(newCourtBoard(), 0, ["ball", "cone", "target", "ladder"].map(kind => material(kind as CourtDrawing["kind"])));
const drawing = (p: ReturnType<typeof source>, id = "ball", index = 0) => frameDrawings(p, index).find(item => item.id === id)!;
const imported = (p: ReturnType<typeof source>) => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: p }));

describe("authored 3D elevation", () => {
  it("keeps zero-height legacy positions and makes only authorship-capable objects eligible", () => {
    const p = source(), frame = buildCourtPerspectiveFrame(p, 0, 0);
    expect(frame.actors.every(actor => actor.elevation === 0 && actor.position.y === 0 && !actor.simulated)).toBe(true);
    expect(frame.drawings.map(d => d.points[0].y)).toEqual([.12, .025, .025, .025]);
    expect(frame.drawings.every(d => d.elevation === 0)).toBe(true);
    expect(setCourtSelectionElevation(p, 0, [p.actors[0].id, "ball"], 0)).toBe(p);
    expect(drawing(p)).not.toHaveProperty("elevation"); expect(p.timeline.steps[0]).not.toHaveProperty("actorElevations");
  });

  it("changes actor/material Y only, using one immutable command and keeping 2D points", () => {
    const p = source(), id = p.actors[0].id, before = JSON.stringify(p), points = displayCourtDrawings(p, 0).map(d => d.points);
    const raised = setCourtSelectionElevation(p, 0, [id, "ball", "cone", "target", "ladder"], 2);
    expect(raised.timeline.steps[0].actorElevations).toEqual({ [id]: 2 });
    expect(displayCourtDrawings(raised, 0).map(d => d.points)).toEqual(points);
    expect(raised.timeline.steps[0].actorPositions).toEqual(p.timeline.steps[0].actorPositions);
    const frame = buildCourtPerspectiveFrame(raised, 0, 0);
    expect(frame.actors.find(a => a.id === id)).toMatchObject({ elevation: 2, position: { y: 2 } });
    expect(frame.drawings.map(d => d.points[0].y)).toEqual([2.12, 2.025, 2.025, 2.025]);
    expect(setCourtSelectionElevation(raised, 0, [id, "ball"], 2)).toBe(raised);
    expect(JSON.stringify(p)).toBe(before);
    const lowered = setCourtSelectionElevation(raised, 0, [id, "ball"], 0);
    expect(lowered.timeline.steps[0]).not.toHaveProperty("actorElevations"); expect(drawing(lowered)).not.toHaveProperty("elevation");
  });

  it.each([NaN, Infinity, -Infinity, -.1, 8.001, "2", null])("rejects invalid height %j without an edit", value => {
    const p = source(); expect(setCourtSelectionElevation(p, 0, [p.actors[0].id, "ball"], value as number)).toBe(p);
  });

  it("supports the upper bound and ignores hidden, locked, missing, unsupported and off-step objects", () => {
    let p = source(); const [locked, hidden, offStep, active] = p.actors.map(a => a.id);
    p.editor!.actorMeta[locked].locked = true; p.editor!.actorMeta[hidden].hidden = true;
    p.timeline.steps[0].visibleActorIds = [locked, hidden, active];
    p = changeDrawings(p, 0, [...frameDrawings(p, 0).map(d => ({ ...d, locked: d.id === "ball", hidden: d.id === "cone" })), material("arrow", { points: [{ x: .2, y: .2 }, { x: .4, y: .4 }] }), material("text")]);
    const ids = [locked, hidden, offStep, active, "ball", "cone", "target", "ladder", "arrow", "text", "missing"];
    expect(editableCourtElevationSelection(p, 0, ids)).toEqual([active, "target", "ladder"]);
    const changed = setCourtSelectionElevation(p, 0, ids, 8);
    expect(courtSelectionElevation(changed, 0, active)).toBe(8); expect(drawing(changed, "target").elevation).toBe(8);
    expect(courtSelectionElevation(changed, 0, locked)).toBe(0); expect(drawing(changed).elevation).toBeUndefined();
    expect(setCourtSelectionElevation(p, 99, ids, 2)).toBe(p);
    const hiddenLayers = { ...p, editor: { ...p.editor!, hiddenLayers: ["actors", "drawings"] } };
    expect(editableCourtElevationSelection(hiddenLayers, 0, ids)).toEqual([]);
  });

  it.each(["receive", "attack"] as const)("keeps %s simulation heights authoritative and metadata dormant", mode => {
    let p = configureCourtSimulation(source(), 0, { mode });
    const sample = sampleCourtSimulation(p, 0, .4)!;
    p.timeline.steps[0].actorElevations = Object.fromEntries(sample.config.actorIds.map(id => [id, 7]));
    p = changeDrawings(p, 0, frameDrawings(p, 0).map(d => d.id === sample.ballId ? { ...d, elevation: 7 } : d));
    const ids = [...sample.config.actorIds, sample.ballId], before = JSON.stringify(p);
    expect(editableCourtElevationSelection(p, 0, ids)).toEqual([]);
    expect(setCourtSelectionElevation(p, 0, ids, 1)).toBe(p);
    const frame = buildCourtPerspectiveFrame(p, 0, .4);
    for (const actor of sample.actors.filter(a => a.visible)) {
      const shown = frame.actors.find(a => a.id === actor.id)!;
      expect(shown.simulated).toBe(true); expect(shown.elevation).toBeUndefined();
      expect(shown.position).toEqual({ x: actor.position[0], y: actor.position[1], z: actor.position[2] });
    }
    const shownBall = frame.drawings.find(d => d.id === sample.ballId)!;
    expect(shownBall.simulated).toBe(true); expect(shownBall.elevation).toBeUndefined(); expect(shownBall.points[0].y).toBe(sample.ball[1]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("keeps authored actor and ball trajectories at a constant vertical offset", () => {
    let p = source(); const id = p.actors[0].id;
    p = moveSelection(moveSelection(p, 0, [id], { x: .1, y: -.1 }, true), 0, ["ball"], { x: .2, y: -.2 }, true);
    p = setCourtSelectionElevation(p, 0, [id, "ball"], 3);
    for (const progress of [0, .5, 1]) {
      const frame = buildCourtPerspectiveFrame(p, 0, progress), actor = frame.actors.find(a => a.id === id)!, ball = frame.drawings.find(d => d.id === "ball")!;
      expect(actor.position.y).toBe(3); expect(actor.path.every(point => point.y === 3)).toBe(true);
      expect(ball.points[0].y).toBe(3.12); expect(ball.motion!.every(point => point.y === 3.12)).toBe(true);
      const flat = displayCourtDrawings(p, 0, progress).find(d => d.id === "ball")!.points[0], world = worldToCourtPoint(ball.points[0]);
      expect(world.x).toBeCloseTo(flat.x); expect(world.y).toBeCloseTo(flat.y);
    }
    expect(courtSelectionElevation(resetStepAnimation(p, 0), 0, id)).toBe(3);
  });

  it("preserves elevations through stage copies, continuation, duplication and clipboard remapping", () => {
    const initial = source(), id = initial.actors[0].id;
    const p = setCourtSelectionElevation(initial, 0, [id, "ball"], 1.75);
    for (const result of [duplicateStep(p, 0), continueStepFromEnd(p, 0)]) {
      expect(courtSelectionElevation(result.payload, result.stepIndex, id)).toBe(1.75);
      expect(frameDrawings(result.payload, result.stepIndex).find(d => d.kind === "ball")!.elevation).toBe(1.75);
    }
    const duplicate = duplicateSelection(p, 0, [id, "ball"]), copiedActor = duplicate.selected.find(key => duplicate.payload.actors.some(a => a.id === key))!;
    expect(courtSelectionElevation(duplicate.payload, 0, copiedActor)).toBe(1.75);
    const blank = addBlankStep(p, 0); expect(blank.payload.timeline.steps[1].actorElevations).toBeUndefined();
    const pasted = pasteStepSelection(blank.payload, 1, copyStepSelection(p, 0, [id, "ball"]));
    expect(courtSelectionElevation(pasted.payload, 1, id)).toBe(1.75); expect(frameDrawings(pasted.payload, 1)[0].elevation).toBe(1.75);
    const cleared = pasteStepSelection(pasted.payload, 1, copyStepSelection(initial, 0, [id]));
    expect(courtSelectionElevation(cleared.payload, 1, id)).toBe(0);
    const deleted = deleteSelection(pasted.payload, 1, [id]);
    expect(deleted.timeline.steps[1].actorElevations).toBeUndefined(); expect(courtSelectionElevation(deleted, 0, id)).toBe(1.75);
  });

  it("roundtrips heights through import, ordinary storage and sharing", () => {
    const initial = source(), id = initial.actors[0].id, p = setCourtSelectionElevation(initial, 0, [id, "ball", "target"], 2.5);
    for (const restored of [imported(p), parseCourtVisualPayload(serializeCourtVisualPayload(p)), publishableCourt(p)]) {
      expect(courtSelectionElevation(restored, 0, id)).toBe(2.5); expect(drawing(restored).elevation).toBe(2.5); expect(drawing(restored, "target").elevation).toBe(2.5);
    }
  });

  it("sanitizes unknown actor ids, wrong elevation types/ranges and unsupported drawing heights", () => {
    const p = source(), ids = p.actors.map(a => a.id);
    p.timeline.steps[0].actorElevations = { [ids[0]]: 2, [ids[1]]: 0, [ids[2]]: -1, [ids[3]]: 9, [ids[4]]: "3" as unknown as number, ghost: 4 };
    p.editor!.drawings[p.timeline.steps[0].id] = [material("ball", { elevation: 8 }), material("cone", { elevation: "4" as unknown as number }), material("target", { elevation: -1 }), material("ladder", { elevation: 10 }), material("text", { elevation: 3 }), material("arrow", { elevation: 2 })];
    const restored = imported(p);
    expect(restored.timeline.steps[0].actorElevations).toEqual({ [ids[0]]: 2 });
    expect(frameDrawings(restored, 0).map(d => d.elevation)).toEqual([8, undefined, undefined, undefined, undefined, undefined]);
    p.timeline.steps[0].actorElevations = [2] as unknown as Record<string, number>;
    expect(imported(p).timeline.steps[0].actorElevations).toBeUndefined();
  });

  it("anchors 3D arrow and curve origins at the actual raised ball and keeps their tips on the floor", () => {
    const arrow = material("arrow", { startBallId: "ball", points: [{ x: .3, y: .6 }, { x: .5, y: .4 }, { x: .7, y: .2 }] });
    const curve = { ...arrow, id: "curve", kind: "curve" as const, curveMode: "through-point" as const };
    const p = setCourtSelectionElevation(changeDrawings(source(), 0, [material("ball"), arrow, curve]), 0, ["ball"], 4);
    const frame = buildCourtPerspectiveFrame(p, 0, 0), ball = frame.drawings.find(d => d.id === "ball")!;
    for (const id of ["arrow", "curve"]) {
      const item = frame.drawings.find(d => d.id === id)!;
      expect(item.startBallId).toBe("ball"); expect(item.points[0]).toEqual(ball.points[0]);
      expect(item.points.at(-1)!.y).toBe(.025); expect(item.points[1].y).toBeCloseTo((ball.points[0].y + .025) / 2);
      expect(item.elevation).toBeUndefined();
    }
    expect(displayCourtDrawings(p, 0).find(d => d.id === "arrow")!.points).toEqual(arrow.points);
    const hidden = changeDrawings(p, 0, frameDrawings(p, 0).map(d => d.id === "ball" ? { ...d, hidden: true } : d));
    expect(buildCourtPerspectiveFrame(hidden, 0, 0).drawings[0].points[0].y).toBe(4.12);
  });

  it("anchors authorial arrows to an elevated simulated ball without altering the engine", () => {
    let p = configureCourtSimulation(source(), 0, { mode: "attack" });
    const sample = sampleCourtSimulation(p, 0, .45)!;
    const arrow = material("curve", { startBallId: sample.ballId, curveMode: "through-point", points: [{ x: .3, y: .6 }, { x: .6, y: .5 }, { x: .7, y: .2 }] });
    p = changeDrawings(p, 0, [...frameDrawings(p, 0), arrow]);
    const frame = buildCourtPerspectiveFrame(p, 0, .45), shown = frame.drawings.find(d => d.id === "curve")!;
    expect(shown.points[0].y).toBe(sample.ball[1]); expect(shown.points[1].y).toBe((sample.ball[1] + .025) / 2); expect(shown.points[2].y).toBe(.025);
    expect(sampleCourtSimulation(p, 0, .45)!.ball).toEqual(sample.ball);
  });
});
