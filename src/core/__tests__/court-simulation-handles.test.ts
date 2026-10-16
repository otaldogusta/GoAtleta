import { configureCourtSimulation, sampleCourtSimulation, updateCourtSimulationHandle } from "../court-simulation";
import { boundCourtFloorHandle, getCourtFloorHandles } from "../court-simulation-handles";
import { newCourtBoard } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";

const attackBoard = (preset = "4") => configureCourtSimulation(newCourtBoard(), 0, { mode: "attack", preset, blockers: 3, layers: { attack: true, pass: true, block: true } });

describe("canonical attack handles on the 2D floor", () => {
  it.each(["hit", "target"] as const)("bounds %s gestures to the same world domain as the 3D handle", kind => {
    const lower = kind === "hit" ? { x: -4.43, z: .1 } : { x: -9, z: -12 };
    const upper = kind === "hit" ? { x: 4.43, z: 4.4 } : { x: 9, z: -.75 };
    expect(boundCourtFloorHandle(kind, { x: -10, y: -10 })).toEqual(worldToCourtPoint(lower));
    expect(boundCourtFloorHandle(kind, { x: 10, y: 10 })).toEqual(worldToCourtPoint(upper));
    const inside = worldToCourtPoint({ x: 1.2, z: kind === "hit" ? .65 : -6 });
    const bounded = boundCourtFloorHandle(kind, inside);
    expect(bounded.x).toBeCloseTo(inside.x, 12);
    expect(bounded.y).toBeCloseTo(inside.y, 12);
  });

  it("keeps finite fallback coordinates and does not apply the contact hand offset twice", () => {
    for (const kind of ["hit", "target"] as const) {
      const fallback = boundCourtFloorHandle(kind, { x: NaN, y: Infinity });
      expect(fallback).toEqual(worldToCourtPoint({ x: 0, z: kind === "hit" ? .1 : -.75 }));
      expect(Number.isFinite(fallback.x) && Number.isFinite(fallback.y)).toBe(true);
    }
    const contact = worldToCourtPoint({ x: -3.77, z: .55 });
    expect(boundCourtFloorHandle("hit", contact).x).toBeCloseTo(contact.x, 12);
    expect(boundCourtFloorHandle("hit", contact).y).toBeCloseTo(contact.y, 12);
  });

  it.each(["4", "5", "pipe"])("projects the exact 3D contact and target for preset %s", preset => {
    const board = attackBoard(preset), snapshot = JSON.stringify(board);
    const elevated = buildCourtPerspectiveFrame(board, 0, 0).simulation!.handles.filter(handle => handle.kind === "hit" || handle.kind === "target");
    const flat = getCourtFloorHandles(board, 0);
    expect(flat).toEqual(elevated.map(handle => ({ kind: handle.kind, point: worldToCourtPoint(handle.point), label: handle.kind === "hit" ? "Ponto de ataque" : "Destino da bola" })));
    expect(flat.map(handle => handle.kind)).toEqual(["hit", "target"]);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("matches 3D visibility: hidden movement guides remove both, attack off removes only the target", () => {
    const board = attackBoard();
    const hidden = { ...board, editor: { ...board.editor!, hiddenLayers: ["movements"] } };
    expect(getCourtFloorHandles(hidden, 0)).toEqual([]);
    expect(buildCourtPerspectiveFrame(hidden, 0, 0).simulation!.guidesVisible).toBe(false);
    const setOnly = configureCourtSimulation(board, 0, { layers: { attack: false, pass: false, block: false } });
    expect(getCourtFloorHandles(setOnly, 0).map(handle => handle.kind)).toEqual(["hit"]);
    expect(buildCourtPerspectiveFrame(setOnly, 0, 0).simulation!.handles.filter(handle => ["hit", "target"].includes(handle.kind)).map(handle => handle.kind)).toEqual(["hit"]);
    for (const layer of ["actors", "drawings", "labels"]) {
      const representationOnly = { ...board, editor: { ...board.editor!, hiddenLayers: [layer] } };
      expect(getCourtFloorHandles(representationOnly, 0)).toEqual(getCourtFloorHandles(board, 0));
    }
  });

  it("does not create handles for a free board, reception or a missing step", () => {
    expect(getCourtFloorHandles(newCourtBoard(), 0)).toEqual([]);
    expect(getCourtFloorHandles(configureCourtSimulation(newCourtBoard(), 0, { mode: "receive" }), 0)).toEqual([]);
    const board = attackBoard();
    for (const index of [-1, .5, 999, NaN]) expect(getCourtFloorHandles(board, index)).toEqual([]);
  });

  it("keeps off-court targets exact rather than clamping a change of representation", () => {
    const board = configureCourtSimulation(attackBoard(), 0, { attackSettings: { targetOverride: [9, -12] } });
    const point = getCourtFloorHandles(board, 0).find(handle => handle.kind === "target")!.point;
    expect(point).toEqual({ x: 1.5, y: -12 / 18 + .5 });
    expect(point.x).toBeGreaterThan(1.2);
  });

  it("returns detached points without modifying authored positions or cached 3D handles", () => {
    const board = attackBoard(), before = JSON.stringify(board);
    const elevatedBefore = JSON.stringify(buildCourtPerspectiveFrame(board, 0, 0).simulation!.handles);
    const first = getCourtFloorHandles(board, 0), original = { ...first[0].point };
    first[0].point.x += .25;
    expect(getCourtFloorHandles(board, 0)[0].point).toEqual(original);
    expect(JSON.stringify(buildCourtPerspectiveFrame(board, 0, 0).simulation!.handles)).toBe(elevatedBefore);
    expect(JSON.stringify(board)).toBe(before);
  });

  it("moves the contact independently from blocker bases, hands and outgoing target", () => {
    const board = configureCourtSimulation(attackBoard(), 0, { attackSettings: { manualBlockers: [1, 2, 5], blockAngles: { "1": 20, "2": -15 } } });
    const before = sampleCourtSimulation(board, 0, 0)!, handles = getCourtFloorHandles(board, 0);
    const hit = handles.find(handle => handle.kind === "hit")!, target = handles.find(handle => handle.kind === "target")!;
    const moved = updateCourtSimulationHandle(board, 0, { kind: "hit", point: { x: hit.point.x + .1, y: hit.point.y + .04 } });
    const after = sampleCourtSimulation(moved, 0, 0)!;
    const nextHit = getCourtFloorHandles(moved, 0).find(handle => handle.kind === "hit")!;
    expect(nextHit.point.x).toBeCloseTo(hit.point.x + .1, 10);
    expect(nextHit.point.y).toBeCloseTo(hit.point.y + .04, 10);
    for (const slot of [1, 2, 5]) expect(after.bases[slot]).toEqual(before.bases[slot]);
    expect(after.walls).toEqual(before.walls);
    expect(getCourtFloorHandles(moved, 0).find(handle => handle.kind === "target")).toEqual(target);
    const aimed = updateCourtSimulationHandle(moved, 0, { kind: "target", point: { x: target.point.x - .1, y: target.point.y - .02 } });
    expect(getCourtFloorHandles(aimed, 0).find(handle => handle.kind === "hit")).toEqual(nextHit);
    expect(sampleCourtSimulation(aimed, 0, 0)!.walls).toEqual(before.walls);
  });
});
