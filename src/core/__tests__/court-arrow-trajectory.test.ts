import { courtTrajectoryHeightAt, parseCourtTrajectoryHeights } from "../court-arrow-trajectory";
import { publishableCourt } from "../court-sharing";
import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { displayCourtDrawings } from "../court-simulation-display";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { changeDrawings, copyStepSelection, courtTrajectoryHeightTargets, deleteSelection, duplicateSelection, duplicateStep, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, setCourtSelectionElevation, setCourtTrajectoryHeight, setCourtTrajectoryPoint, type CourtDrawing } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, courtPointToWorld, worldToCourtPoint } from "../visual-court-perspective";
import { courtArrowHandles } from "../court-arrow-geometry";

const ball = (extra: Partial<CourtDrawing> = {}): CourtDrawing => ({ id: "ball", kind: "ball", points: [{ x: .3, y: .7 }], elevation: 2, color: "#ffdc53", size: 32, rotation: 0, ...extra });
const arrow = (extra: Partial<CourtDrawing> = {}): CourtDrawing => ({ id: "arrow", kind: "arrow", startBallId: "ball", points: [{ x: .3, y: .7 }, { x: .7, y: .2 }], color: "#19c87b", size: 32, rotation: 0, ...extra });
const board = (items = [ball(), arrow()]) => changeDrawings(newCourtBoard(), 0, items);
const find = (p: ReturnType<typeof board>, id = "arrow", index = 0) => frameDrawings(p, index).find(d => d.id === id)!;
const projected = (p: ReturnType<typeof board>, id = "arrow", progress = 0) => buildCourtPerspectiveFrame(p, 0, progress).drawings.find(d => d.id === id)!;
const imported = (p: ReturnType<typeof board>) => parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: p }));

describe("authored trajectory lateral grip edits", () => {
  it("does not create a revision when a straight middle stays on its unchanged segment", () => {
    const source = board(), value = courtTrajectoryHeightTargets(source, 0, "arrow")[1].value;
    const point = courtPointToWorld({ x: .4, y: .575 }, value);
    expect(setCourtTrajectoryPoint(source, 0, "arrow", "middle", point)).toBe(source);
    const raised = setCourtTrajectoryPoint(source, 0, "arrow", "middle", { ...point, y: value + 1 });
    expect(raised).not.toBe(source); expect(find(raised).kind).toBe("arrow");
    expect(find(raised).trajectoryHeights?.middle).toBeCloseTo(value + 1);
  });
  it("moves the on-curve middle in X/Z while retaining a dynamic absent height profile", () => {
    const source = board(), value = courtTrajectoryHeightTargets(source, 0, "arrow")[1].value;
    const next = setCourtTrajectoryPoint(source, 0, "arrow", "middle", courtPointToWorld({ x: .6, y: .5 }, value));
    expect(find(next)).toMatchObject({ kind: "curve", curveMode: "through-point", points: [{ x: .3, y: .7 }, { x: .6, y: .5 }, { x: .7, y: .2 }] });
    expect(find(next).trajectoryHeights).toBeUndefined();
    const raised = setCourtSelectionElevation(next, 0, ["ball"], 4);
    expect(projected(raised).trajectoryHandles![1].value).toBeCloseTo((4.12 + .025) / 2);
  });

  it("applies diagonal edits atomically and keeps other authored heights and source immutable", () => {
    let source = setCourtTrajectoryHeight(board(), 0, "arrow", "middle", 3);
    source = setCourtTrajectoryHeight(source, 0, "arrow", "end", .5);
    const before = JSON.stringify(source), next = setCourtTrajectoryPoint(source, 0, "arrow", "middle", { x: .9, y: 4, z: .9 });
    expect(find(next).points[1].x).toBeCloseTo(.6); expect(find(next).points[1].y).toBeCloseTo(.55);
    expect(find(next).trajectoryHeights).toEqual({ start: 2.12, middle: 4, end: .5 });
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([false, true])("retains the legacy bend on lateral endpoint edit, landscape %j", landscape => {
    const source = board([arrow({ startBallId: undefined, kind: "curve" })]);
    const next = setCourtTrajectoryPoint(source, 0, "arrow", "end", courtPointToWorld({ x: .8, y: .3 }, .025), landscape);
    const curve = find(next), midpoint = curve.points[1];
    expect(curve.curveMode).toBe("through-point"); expect(curve.trajectoryHeights).toBeUndefined();
    const control = { x: 2 * midpoint.x - (curve.points[0].x + curve.points[2].x) / 2, y: 2 * midpoint.y - (curve.points[0].y + curve.points[2].y) / 2 };
    expect(control.x).toBeCloseTo(.5 + (landscape ? -65 : 65) / 900);
    expect(control.y).toBeCloseTo(.45 - 65 / 1800);
  });

  it.each([false, true])("pure height and tiny projection noise retain legacy geometry, landscape %j", landscape => {
    const source = board([arrow({ startBallId: undefined, kind: "curve" })]), shape = find(source);
    const grip = courtArrowHandles(shape, landscape)[1].point;
    const point = courtPointToWorld({ x: grip.x + 1e-10, y: grip.y - 1e-10 }, 3);
    const next = setCourtTrajectoryPoint(source, 0, "arrow", "middle", point, landscape);
    expect(find(next).points).toEqual(shape.points); expect(find(next).curveMode).toBeUndefined();
    expect(find(next).kind).toBe("curve"); expect(find(next).trajectoryHeights?.middle).toBe(3);
  });

  it("moves a linked ball from its sampled motion and keeps every start linked in XYZ", () => {
    const source = board([ball({ motion: [{ x: .3, y: .7 }, { x: .5, y: .5 }] }), arrow(), arrow({ id: "other", kind: "curve", curveMode: "through-point", points: [{ x: .3, y: .7 }, { x: .5, y: .55 }, { x: .7, y: .2 }] })]);
    const next = setCourtTrajectoryPoint(source, 0, "arrow", "start", courtPointToWorld({ x: .6, y: .4 }, 3.12), false, .5);
    expect(find(next, "ball").points[0].x).toBeCloseTo(.6); expect(find(next, "ball").points[0].y).toBeCloseTo(.4);
    expect(find(next, "ball").motion).toBeUndefined(); expect(find(next, "ball").elevation).toBeCloseTo(3);
    for (const id of ["arrow", "other"]) {
      expect(find(next, id).startBallId).toBe("ball"); expect(find(next, id).trajectoryHeights).toBeUndefined();
      expect(projected(next, id).points[0]).toEqual(projected(next, "ball").points[0]);
    }
    expect(find(next, "other").points[1].x).toBeCloseTo(.575); expect(find(next, "other").points[1].y).toBeCloseTo(.475);
  });

  it("rejects invalid points and protects linked or hidden objects without editing", () => {
    const source = board(), valid = { x: 0, y: 2, z: 0 };
    for (const point of [{ ...valid, x: 6.31 }, { ...valid, z: -11.71 }, { ...valid, y: 8.13 }, { ...valid, x: NaN }, { ...valid, y: -1 }]) expect(setCourtTrajectoryPoint(source, 0, "arrow", "middle", point)).toBe(source);
    for (const fields of [{ locked: true }, { hidden: true }]) {
      const protectedBall = board([ball(fields), arrow()]);
      expect(setCourtTrajectoryPoint(protectedBall, 0, "arrow", "start", valid)).toBe(protectedBall);
      const protectedArrow = board([ball(), arrow(fields)]);
      expect(setCourtTrajectoryPoint(protectedArrow, 0, "arrow", "middle", valid)).toBe(protectedArrow);
    }
    expect(setCourtTrajectoryPoint(source, 99, "arrow", "middle", valid)).toBe(source);
    expect(setCourtTrajectoryPoint(source, 0, "arrow", "start", { ...valid, y: .11 })).toBe(source);
  });

  it("edits the visible middle at simulated progress while protecting the engine-owned start", () => {
    let source = configureCourtSimulation(board(), 0, { mode: "attack" });
    const sample = sampleCourtSimulation(source, 0, .4)!;
    source = changeDrawings(source, 0, [...frameDrawings(source, 0).filter(d => d.id !== "arrow"), arrow({ startBallId: sample.ballId })]);
    const shown = projected(source, "arrow", .4), start = shown.points[0], end = shown.points.at(-1)!;
    const point = { x: (start.x + end.x) / 2 + .9, y: shown.trajectoryHandles![1].value, z: (start.z + end.z) / 2 };
    expect(setCourtTrajectoryPoint(source, 0, "arrow", "start", point, false, .4)).toBe(source);
    const next = setCourtTrajectoryPoint(source, 0, "arrow", "middle", point, false, .4), after = projected(next, "arrow", .4);
    expect(find(next).trajectoryHeights).toBeUndefined(); expect(after.points[0]).toEqual(start);
    expect(after.points[1].x).toBeCloseTo(point.x); expect(after.points[1].z).toBeCloseTo(point.z);
    expect(after.trajectoryHandles![1].value).toBeCloseTo(point.y);
  });
});

describe("authored trajectory world heights", () => {
  it("retains legacy linear profiles until a grip changes them", () => {
    const source = board(), shown = projected(source);
    expect(find(source).trajectoryHeights).toBeUndefined(); expect(shown.trajectoryHeights).toBeUndefined();
    expect(shown.points.map(point => point.y)).toEqual([2.12, .025]);
    expect(shown.trajectoryHandles?.map(handle => handle.value)).toEqual([2.12, (2.12 + .025) / 2, .025]);
    const changed = setCourtTrajectoryHeight(source, 0, "arrow", "start", 3.12);
    expect(find(changed, "ball").elevation).toBe(3); expect(find(changed).trajectoryHeights).toBeUndefined();
    expect(projected(changed).trajectoryHandles?.[1].value).toBe((3.12 + .025) / 2);
  });

  it("writes one immutable profile while leaving X/Z and 2D geometry untouched", () => {
    const source = board(), before = JSON.stringify(source), flat = displayCourtDrawings(source, 0).map(d => d.points);
    const raised = setCourtTrajectoryHeight(source, 0, "arrow", "middle", 4);
    expect(find(raised).trajectoryHeights).toEqual({ start: 2.12, middle: 4, end: .025 });
    expect(displayCourtDrawings(raised, 0).map(d => d.points)).toEqual(flat);
    expect(projected(raised).points.map(worldToCourtPoint)).toEqual(projected(source).points.map(worldToCourtPoint));
    expect(setCourtTrajectoryHeight(raised, 0, "arrow", "middle", 4)).toBe(raised);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("retains explicit middle and end while its linked ball rises and moves", () => {
    let source = setCourtTrajectoryHeight(board(), 0, "arrow", "middle", 3.5);
    source = setCourtTrajectoryHeight(source, 0, "arrow", "end", .4);
    const raised = setCourtTrajectoryHeight(source, 0, "arrow", "start", 5.12);
    const moved = moveSelection(raised, 0, ["ball"], { x: .1, y: -.1 }, false);
    expect(projected(moved).trajectoryHeights).toEqual({ start: 5.12, middle: 3.5, end: .4 });
    expect(projected(moved).points[0]).toEqual(projected(moved, "ball").points[0]);
    expect(find(source, "ball").elevation).toBe(2);
  });

  it("accepts the linked start range and independent unlinked endpoints", () => {
    expect(setCourtTrajectoryHeight(board(), 0, "arrow", "start", 0)).toBeDefined();
    const source = board(), unlinked = board([arrow({ startBallId: undefined })]);
    expect(setCourtTrajectoryHeight(source, 0, "arrow", "start", 0)).toBe(source);
    expect(find(setCourtTrajectoryHeight(source, 0, "arrow", "start", 8.12), "ball").elevation).toBeCloseTo(8);
    const changed = setCourtTrajectoryHeight(unlinked, 0, "arrow", "start", 0);
    expect(projected(changed).points[0].y).toBe(0);
    expect(projected(setCourtTrajectoryHeight(changed, 0, "arrow", "end", 8.12)).points.at(-1)?.y).toBe(8.12);
  });

  it.each([NaN, Infinity, -1, 8.13, "3", null])("rejects invalid height %j without editing", value => {
    const source = board(); expect(setCourtTrajectoryHeight(source, 0, "arrow", "middle", value as number)).toBe(source);
  });

  it("respects arrow and linked-ball visibility, locking and simulation ownership", () => {
    for (const fields of [{ locked: true }, { hidden: true }]) {
      const source = board([ball(fields), arrow()]);
      expect(courtTrajectoryHeightTargets(source, 0, "arrow").map(handle => handle.editable)).toEqual([false, true, true]);
      expect(setCourtTrajectoryHeight(source, 0, "arrow", "start", 3)).toBe(source);
      const protectedArrow = board([ball(), arrow(fields)]);
      expect(setCourtTrajectoryHeight(protectedArrow, 0, "arrow", "middle", 3)).toBe(protectedArrow);
    }
    let simulated = configureCourtSimulation(board(), 0, { mode: "attack" });
    const sample = sampleCourtSimulation(simulated, 0, .5)!;
    simulated = changeDrawings(simulated, 0, [...frameDrawings(simulated, 0).filter(d => d.id !== "arrow"), arrow({ startBallId: sample.ballId })]);
    expect(courtTrajectoryHeightTargets(simulated, 0, "arrow")[0].editable).toBe(false);
    expect(setCourtTrajectoryHeight(simulated, 0, "arrow", "start", 3)).toBe(simulated);
    const hidden = board(); hidden.editor!.hiddenLayers = ["drawings"];
    expect(setCourtTrajectoryHeight(hidden, 0, "arrow", "middle", 3)).toBe(hidden);
    expect(setCourtTrajectoryHeight(hidden, 99, "arrow", "middle", 3)).toBe(hidden);
  });

  it.each([false, true])("freezes height when detaching or deleting the ball, explicit profile %j", explicit => {
    const source = explicit ? setCourtTrajectoryHeight(board(), 0, "arrow", "middle", 3.5) : board();
    const before = projected(source).trajectoryHandles!.map(handle => handle.value);
    const detached = [
      moveSelection(source, 0, ["arrow"], { x: .1, y: 0 }, false),
      deleteSelection(source, 0, ["ball"]),
      changeDrawings(source, 0, frameDrawings(source, 0).filter(d => d.id !== "ball")),
      changeDrawings(source, 0, frameDrawings(source, 0).map(d => d.id === "arrow" ? { ...d, startBallId: undefined } : d)),
    ];
    for (const result of detached) {
      expect(find(result).startBallId).toBeUndefined();
      expect(projected(result).trajectoryHandles?.map(handle => handle.value)).toEqual(before);
    }
  });

  it("freezes the sampled simulation height when deleting its ball", () => {
    let source = configureCourtSimulation(board(), 0, { mode: "attack" });
    const sample = sampleCourtSimulation(source, 0, .4)!;
    source = changeDrawings(source, 0, [...frameDrawings(source, 0).filter(d => d.id !== "arrow"), arrow({ startBallId: sample.ballId })]);
    const deleted = deleteSelection(source, 0, [sample.ballId], .4);
    expect(projected(deleted).points[0].y).toBeCloseTo(sample.ball[1]);
    expect(find(deleted).startBallId).toBeUndefined();
  });

  it("compares and preserves simulated anchor heights at the visible progress", () => {
    let source = configureCourtSimulation(board(), 0, { mode: "attack" });
    const sample = sampleCourtSimulation(source, 0, .4)!;
    source = changeDrawings(source, 0, [...frameDrawings(source, 0).filter(d => d.id !== "arrow"), arrow({ startBallId: sample.ballId })]);
    const current = projected(source, "arrow", .4).trajectoryHandles!.find(handle => handle.kind === "middle")!.value;
    expect(setCourtTrajectoryHeight(source, 0, "arrow", "middle", current, .4)).toBe(source);
    const oldValue = (.12 + (find(source, sample.ballId).elevation ?? 0) + .025) / 2;
    expect(Math.abs(oldValue - current)).toBeGreaterThan(.01);
    const changed = setCourtTrajectoryHeight(source, 0, "arrow", "middle", oldValue, .4);
    expect(changed).not.toBe(source); expect(projected(changed, "arrow", .4).trajectoryHeights?.middle).toBe(oldValue);
  });

  it("preserves profiles through import, public sanitization and storage", () => {
    const source = setCourtTrajectoryHeight(board(), 0, "arrow", "middle", 3.5);
    for (const restored of [imported(source), publishableCourt(source), parseCourtVisualPayload(serializeCourtVisualPayload(source))]) {
      expect(find(restored).trajectoryHeights).toEqual(find(source).trajectoryHeights);
      expect(projected(restored).trajectoryHandles).toEqual(projected(source).trajectoryHandles);
    }
  });

  it("remaps copied pairs, freezes isolated clipboard arrows, and edits copies independently", () => {
    const source = setCourtTrajectoryHeight(board(), 0, "arrow", "middle", 3.5), before = JSON.stringify(source);
    const copied = duplicateSelection(source, 0, ["ball", "arrow"]), copiedArrow = frameDrawings(copied.payload, 0).find(d => copied.selected.includes(d.id) && d.kind === "arrow")!;
    const changed = setCourtTrajectoryHeight(copied.payload, 0, copiedArrow.id, "middle", 5);
    expect(find(changed).trajectoryHeights?.middle).toBe(3.5);
    const clipboard = copyStepSelection(source, 0, ["arrow"]), pasted = pasteStepSelection(newCourtBoard(), 0, clipboard);
    expect(clipboard.drawings[0].startBallId).toBeUndefined(); expect(clipboard.drawings[0].trajectoryHeights?.start).toBe(2.12);
    expect(frameDrawings(pasted.payload, 0)[0].trajectoryHeights).toEqual(find(source).trajectoryHeights);
    const copiedStep = duplicateStep(source, 0);
    expect(frameDrawings(copiedStep.payload, 1).find(d => d.kind === "arrow")?.trajectoryHeights).toEqual(find(source).trajectoryHeights);
    expect(JSON.stringify(source)).toBe(before);
    const legacyPair = duplicateSelection(board(), 0, ["ball", "arrow"]);
    expect(frameDrawings(legacyPair.payload, 0).filter(d => d.kind === "arrow").every(d => !d.trajectoryHeights)).toBe(true);
  });

  it("rejects malformed profiles and leaves non-arrow materials unchanged at import", () => {
    for (const value of [{ start: 0, end: 1 }, { start: 0, middle: NaN, end: 1 }, { start: 0, middle: 9, end: 1 }, { start: 0, middle: 2, end: 1, extra: true }, [0, 1, 2]]) {
      expect(parseCourtTrajectoryHeights(value)).toBeUndefined();
      expect(find(imported(board([ball(), arrow({ trajectoryHeights: value as never })]))).trajectoryHeights).toBeUndefined();
    }
    const source = board([ball({ trajectoryHeights: { start: 1, middle: 2, end: 3 } }), arrow()]);
    expect(find(imported(source), "ball").trajectoryHeights).toBeUndefined();
  });

  it("samples all intermediate heights inside bounds while passing through the three grips", () => {
    for (const profile of [{ start: 0, middle: 0, end: 8.12 }, { start: 0, middle: 8.12, end: 8.12 }, { start: 1, middle: 5, end: .4 }]) {
      expect([0, .5, 1].map(u => courtTrajectoryHeightAt(profile, u))).toEqual([profile.start, profile.middle, profile.end]);
      for (let i = 0; i <= 100; i++) expect(courtTrajectoryHeightAt(profile, i / 100)).toBeGreaterThanOrEqual(0);
      for (let i = 0; i <= 100; i++) expect(courtTrajectoryHeightAt(profile, i / 100)).toBeLessThanOrEqual(8.12);
    }
  });

  it("preserves through-point curve X/Z when endpoint height follows the ball", () => {
    const source = board([ball(), arrow({ kind: "curve", curveMode: "through-point", points: [{ x: .3, y: .7 }, { x: .5, y: .55 }, { x: .7, y: .2 }] })]);
    const raised = setCourtTrajectoryHeight(source, 0, "arrow", "middle", 4);
    const higher = setCourtSelectionElevation(raised, 0, ["ball"], 5);
    expect(projected(higher).points.map(worldToCourtPoint)).toEqual(projected(source).points.map(worldToCourtPoint));
    expect(projected(higher).points.map(point => point.y)).toEqual([5.12, 4, .025]);
  });
});
