import { configureCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { displayCourtDrawings, simulationFloorPoint } from "../court-simulation-display";
import { changeDrawings, frameDrawings, newCourtBoard, pointAlong, type CourtDrawing } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";

describe("the shared simulation's 2D floor projection", () => {
  it.each(["receive", "attack"] as const)("keeps the %s ball at the same court location and time in both views", mode => {
    const board = configureCourtSimulation(newCourtBoard(), 0, { mode, blockers: 3, layers: { attack: true, pass: true, block: true } });
    const snapshot = JSON.stringify(board);
    for (const progress of [0, 0.103, 0.118, 0.364, 0.62, 0.758, 0.82, 1]) {
      const sample = sampleCourtSimulation(board, 0, progress)!;
      const flat = displayCourtDrawings(board, 0, progress).find(item => item.id === sample.ballId)!;
      const perspective = buildCourtPerspectiveFrame(board, 0, progress);
      const elevated = perspective.drawings.find(item => item.id === sample.ballId)!;
      expect(flat.points[0]).toEqual(simulationFloorPoint(sample.ball));
      expect(flat.points[0]).toEqual(worldToCourtPoint(elevated.points[0]));
      expect(elevated.points[0]).toEqual({ x: sample.ball[0], y: sample.ball[1], z: sample.ball[2] });
      for (const player of sample.actors.filter(actor => actor.visible)) {
        const samePlayer = perspective.actors.find(actor => actor.id === player.id)!;
        expect(worldToCourtPoint(samePlayer.position)).toEqual(simulationFloorPoint(player.position));
      }
    }
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("preserves a teacher-authored second ball and its full motion while displaying the simulation", () => {
    let board = configureCourtSimulation(newCourtBoard(), 0, { mode: "attack" });
    const authored: CourtDrawing = { id: "coach-second-ball", kind: "ball", points: [{ x: 0.2, y: 0.8 }], motion: [{ x: 0.2, y: 0.8 }, { x: 0.4, y: 0.65 }, { x: 0.7, y: 0.4 }], color: "#123456", size: 40, rotation: 15, locked: true };
    board = changeDrawings(board, 0, [...frameDrawings(board, 0), authored]);
    const snapshot = JSON.stringify(board);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const flat = displayCourtDrawings(board, 0, progress).find(item => item.id === authored.id)!;
      expect(flat).toEqual({ ...authored, points: [pointAlong(authored.motion!, progress)] });
      expect(flat.motion).toEqual(authored.motion);
      const elevated = buildCourtPerspectiveFrame(board, 0, progress).drawings.find(item => item.id === authored.id)!;
      expect(worldToCourtPoint(elevated.points[0]).x).toBeCloseTo(flat.points[0].x);
      expect(worldToCourtPoint(elevated.points[0]).y).toBeCloseTo(flat.points[0].y);
      expect(elevated.simulated).toBeUndefined();
    }
    expect(frameDrawings(board, 0).find(item => item.id === authored.id)).toBe(authored);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("leaves a free authored ball's path and metadata intact when no simulation is enabled", () => {
    const authored: CourtDrawing = { id: "free-ball", kind: "ball", points: [{ x: 0.7, y: 0.3 }], motion: [{ x: 0.2, y: 0.7 }, { x: 0.7, y: 0.3 }], color: "#ffdc53", size: 32, rotation: 25 };
    const board = changeDrawings(newCourtBoard(), 0, [authored]);
    const snapshot = JSON.stringify(board);
    expect(displayCourtDrawings(board, 0, 0.5)).toEqual([{ ...authored, points: [pointAlong(authored.motion!, 0.5)] }]);
    expect(JSON.stringify(board)).toBe(snapshot);
    expect(frameDrawings(board, 0)[0]).toBe(authored);
  });

  it("does not clamp off-court positions merely to change representation", () => {
    expect(simulationFloorPoint([-7, 3, -12])).toEqual({ x: -7 / 9 + 0.5, y: -12 / 18 + 0.5 });
    expect(simulationFloorPoint([6, 0, 11])).toEqual({ x: 6 / 9 + 0.5, y: 11 / 18 + 0.5 });
  });
});
