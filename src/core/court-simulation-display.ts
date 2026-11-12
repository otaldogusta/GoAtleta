import type { CourtPoint, CourtVisualPayload } from "./visual-court";
import { drawingAtProgress, frameDrawings, resolveCourtDrawingAnchors, type CourtDrawing } from "./visual-court-editor";
import { sampleCourtSimulation } from "./court-simulation";

/** The 2D floor projection of the very same sampled 3D action. */
export const simulationFloorPoint = (point: readonly number[]): CourtPoint => ({ x: point[0] / 9 + 0.5, y: point[2] / 18 + 0.5 });

export function displayCourtDrawings(payload: CourtVisualPayload, index: number, progress = 0): CourtDrawing[] {
  const sample = sampleCourtSimulation(payload, index, progress);
  const drawings = frameDrawings(payload, index).map(drawing => {
    if (sample && drawing.id === sample.ballId) {
      return { ...drawing, points: [simulationFloorPoint(sample.ball)], motion: undefined };
    }
    return drawingAtProgress(drawing, progress);
  });
  return resolveCourtDrawingAnchors(drawings).filter(drawing => !drawing.hidden && !(sample && drawing.id === sample.ballId && !sample.visible));
}
