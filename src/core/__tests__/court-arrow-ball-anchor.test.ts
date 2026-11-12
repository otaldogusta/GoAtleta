import { publishableCourt } from "../court-sharing";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { displayCourtDrawings, simulationFloorPoint } from "../court-simulation-display";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { addBlankStep, changeDrawings, continueStepFromEnd, copyStepSelection, deleteSelection, duplicateSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, resetStepAnimation, resolveCourtDrawingAnchors, type CourtDrawing } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";

const ball = (extra: Partial<CourtDrawing> = {}): CourtDrawing => ({ id: "ball", kind: "ball", points: [{ x: .3, y: .6 }], color: "#ffdc53", size: 32, rotation: 0, ...extra });
const arrow = (extra: Partial<CourtDrawing> = {}): CourtDrawing => ({ id: "arrow", kind: "arrow", startBallId: "ball", points: [{ x: .3, y: .6 }, { x: .8, y: .2 }], color: "#19c87b", size: 32, rotation: 0, ...extra });
const curve = (): CourtDrawing => arrow({ kind: "curve", curveMode: "through-point", points: [{ x: .3, y: .6 }, { x: .6, y: .6 }, { x: .8, y: .2 }] });
const board = (items = [ball(), arrow()]) => changeDrawings(newCourtBoard(), 0, items);
const find = (p: ReturnType<typeof board>, id = "arrow", index = 0) => frameDrawings(p, index).find(d => d.id === id)!;
const control = (d: CourtDrawing) => ({ x: 2 * d.points[1].x - (d.points[0].x + d.points[2].x) / 2, y: 2 * d.points[1].y - (d.points[0].y + d.points[2].y) / 2 });
const importBoard = (p: ReturnType<typeof board>) => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: p }));

describe("arrow origins anchored to balls", () => {
  it("moves all origins, keeps tips and curve control, and does not mutate the document", () => {
    const curved = curve(), source = board([ball(), arrow(), { ...curved, id: "curve", locked: true }]), before = JSON.stringify(source);
    const moved = moveSelection(source, 0, ["ball"], { x: .2, y: -.1 }, false);
    for (const id of ["arrow", "curve"]) expect(find(moved, id).points[0]).toEqual(find(moved, "ball").points[0]);
    expect(find(moved).points[1]).toEqual(arrow().points[1]);
    expect(find(moved, "curve").points[2]).toEqual(curved.points[2]);
    expect(control(find(moved, "curve")).x).toBeCloseTo(control(curved).x);
    expect(control(find(moved, "curve")).y).toBeCloseTo(control(curved).y);
    expect(moveSelection(source, 0, ["curve"], { x: .1, y: 0 }, false)).toBe(source);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("moves a group once and detaches a separately translated arrow", () => {
    const source = board(), delta = { x: .1, y: .1 };
    const group = moveSelection(source, 0, ["ball", "arrow"], delta, false);
    expect(find(group).startBallId).toBe("ball");
    expect(find(group).points).toEqual(arrow().points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y })));
    const alone = moveSelection(source, 0, ["arrow"], delta, false);
    expect(find(alone).startBallId).toBeUndefined();
    expect(find(alone).points).toEqual(find(group).points);
    expect(find(alone, "ball")).toEqual(ball());
  });

  it("keeps a curve midpoint within document bounds so importing cannot change its geometry", () => {
    const source = board([ball(), curve()]);
    const extreme = changeDrawings(source, 0, [ball({ points: [{ x: 1.2, y: 1.15 }] }), { ...curve(), points: [curve().points[0], { x: 1.2, y: 1.15 }, curve().points[2]] }]);
    expect(find(extreme).points[1]).toEqual({ x: 1.2, y: 1.15 });
    expect(find(importBoard(extreme)).points).toEqual(find(extreme).points);
  });

  it("freezes the sampled origin when deleting its animated ball, including a locked arrow", () => {
    const source = board([ball({ motion: [{ x: .1, y: .2 }, { x: .7, y: .8 }] }), arrow({ locked: true })]);
    const visible = displayCourtDrawings(source, 0, .5).find(d => d.id === "arrow")!;
    const deleted = deleteSelection(source, 0, ["ball"], .5);
    expect(find(deleted).startBallId).toBeUndefined();
    expect(find(deleted).points).toEqual(visible.points);
    expect(frameDrawings(deleted, 0)).toHaveLength(1);
    expect(find(source).startBallId).toBe("ball");
  });

  it("freezes the resolved fallback when changeDrawings removes the target directly", () => {
    const source = board([ball(), arrow({ points: [{ x: .1, y: .1 }, { x: .8, y: .2 }] })]);
    const removed = changeDrawings(source, 0, frameDrawings(source, 0).filter(d => d.id !== "ball"));
    expect(find(removed).points[0]).toEqual(ball().points[0]);
    expect(find(removed).startBallId).toBeUndefined();
  });

  it("resolves animated and hidden balls consistently in 2D and 3D", () => {
    const source = board([ball({ hidden: true, locked: true, motion: [{ x: .1, y: .2 }, { x: .7, y: .8 }] }), curve()]);
    for (const progress of [0, .25, .5, 1]) {
      const flat = displayCourtDrawings(source, 0, progress), elevated = buildCourtPerspectiveFrame(source, 0, progress).drawings;
      expect(flat).toHaveLength(1); expect(elevated).toHaveLength(1);
      expect(flat[0].points[0].x).toBeCloseTo(.1 + .6 * progress);
      flat[0].points.forEach((p, i) => { const world = worldToCourtPoint(elevated[0].points[i]); expect(world.x).toBeCloseTo(p.x); expect(world.y).toBeCloseTo(p.y); });
      expect(control(flat[0]).x).toBeCloseTo(control(curve()).x);
      expect(control(flat[0]).y).toBeCloseTo(control(curve()).y);
    }
  });

  it.each(["receive", "attack"] as const)("follows the canonical %s simulation and freezes its visible point on delete", mode => {
    let source = configureCourtSimulation(newCourtBoard(), 0, { mode });
    const ballId = sampleCourtSimulation(source, 0, .4)!.ballId;
    source = changeDrawings(source, 0, [...frameDrawings(source, 0), arrow({ startBallId: ballId })]);
    const sample = sampleCourtSimulation(source, 0, .4)!, visible = displayCourtDrawings(source, 0, .4).find(d => d.id === "arrow")!;
    expect(visible.points[0]).toEqual(simulationFloorPoint(sample.ball));
    const projected = buildCourtPerspectiveFrame(source, 0, .4).drawings.find(d => d.id === "arrow")!;
    expect(worldToCourtPoint(projected.points[0]).x).toBeCloseTo(visible.points[0].x);
    expect(worldToCourtPoint(projected.points[0]).y).toBeCloseTo(visible.points[0].y);
    const deleted = deleteSelection(source, 0, [ballId], .4);
    expect(find(deleted).points).toEqual(visible.points);
    expect(find(deleted).startBallId).toBeUndefined();
  });

  it("remaps duplicated ball/arrow pairs and keeps an arrow-only duplicate on its original ball", () => {
    const source = board(), together = duplicateSelection(source, 0, ["arrow", "ball"]);
    const clones = frameDrawings(together.payload, 0).filter(d => together.selected.includes(d.id));
    const copiedBall = clones.find(d => d.kind === "ball")!, copiedArrow = clones.find(d => d.kind === "arrow")!;
    expect(copiedArrow.startBallId).toBe(copiedBall.id); expect(copiedArrow.points[0]).toEqual(copiedBall.points[0]);
    const alone = duplicateSelection(source, 0, ["arrow"]), copiedAlone = find(alone.payload, alone.selected[0]);
    expect(copiedAlone.startBallId).toBe("ball"); expect(copiedAlone.points[0]).toEqual(ball().points[0]);
    expect(copiedAlone.points[1]).not.toEqual(arrow().points[1]);
  });

  it("remaps step copies and resolves the motion end before creating a continuation", () => {
    const source = board([ball({ motion: [{ x: .1, y: .2 }, { x: .7, y: .8 }] }), curve()]);
    for (const result of [duplicateStep(source, 0), continueStepFromEnd(source, 0)]) {
      const items = frameDrawings(result.payload, result.stepIndex), copiedBall = items.find(d => d.kind === "ball")!, copiedArrow = items.find(d => d.kind === "curve")!;
      expect(copiedArrow.startBallId).toBe(copiedBall.id); expect(copiedBall.id).not.toBe("ball");
      expect(copiedArrow.points[0]).toEqual(copiedBall.points[0]);
      if (!copiedBall.motion) expect(copiedBall.points[0]).toEqual({ x: .7, y: .8 });
    }
    expect(find(resetStepAnimation(source, 0)).points[0]).toEqual({ x: .1, y: .2 });
  });

  it("copies isolated arrows at the visible point and only preserves links when the target is copied", () => {
    const source = board([ball({ motion: [{ x: .1, y: .2 }, { x: .7, y: .8 }] }), curve()]);
    const target = addBlankStep(source, 0), isolated = copyStepSelection(source, 0, ["arrow"], .5);
    expect(isolated.drawings[0].startBallId).toBeUndefined();
    expect(isolated.drawings[0].points).toEqual(displayCourtDrawings(source, 0, .5).find(d => d.id === "arrow")!.points);
    const pair = pasteStepSelection(target.payload, 1, copyStepSelection(source, 0, ["ball", "arrow"], .5));
    const objects = frameDrawings(pair.payload, 1), copiedBall = objects.find(d => d.kind === "ball")!, copiedArrow = objects.find(d => d.kind === "curve")!;
    expect(copiedArrow.startBallId).toBe(copiedBall.id); expect(copiedArrow.points[0]).toEqual(copiedBall.points[0]);
    const pasted = pasteStepSelection(target.payload, 1, isolated);
    expect(frameDrawings(pasted.payload, 1)[0].points).toEqual(isolated.drawings[0].points);
    expect(frameDrawings(pasted.payload, 1)[0].startBallId).toBeUndefined();
  });

  it("retains valid links through storage, import and share, without rewriting unlinked legacy drawings", () => {
    const source = board([ball(), curve(), arrow({ id: "legacy", startBallId: undefined })]);
    for (const restored of [importBoard(source), parseCourtVisualPayload(serializeCourtVisualPayload(source)), publishableCourt(source)]) {
      expect(find(restored).startBallId).toBe("ball"); expect(find(restored).points).toEqual(find(source).points);
      expect(find(restored, "legacy").startBallId).toBeUndefined(); expect(find(restored, "legacy").points).toEqual(arrow().points);
    }
  });

  it.each([undefined, "missing", "arrow", 32, { id: "ball" }, "b".repeat(121)])("drops invalid anchor %j at import without changing fallback geometry", value => {
    const source = board(); find(source).startBallId = value as string;
    const restored = importBoard(source);
    expect(find(restored).startBallId).toBeUndefined(); expect(find(restored).points).toEqual(arrow().points);
  });

  it("rejects links on materials, short arrows or balls in a different step", () => {
    const source = board(), added = addBlankStep(source, 0);
    const stepId = added.payload.timeline.steps[1].id;
    added.payload.editor!.drawings[stepId] = [arrow({ id: "foreign" }), arrow({ id: "short", points: [{ x: .5, y: .5 }] })];
    find(added.payload, "ball").startBallId = "ball";
    const restored = importBoard(added.payload);
    expect(find(restored, "ball").startBallId).toBeUndefined();
    expect(frameDrawings(restored, 1).every(d => d.startBallId === undefined)).toBe(true);
    const legacy = arrow({ startBallId: undefined }); expect(resolveCourtDrawingAnchors([legacy])[0]).toBe(legacy);
  });
});
