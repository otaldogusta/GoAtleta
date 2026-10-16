import type { CourtPoint, CourtVisualPayload } from "./visual-court";
import { drawingAtProgress, frameDrawings, type CourtDrawing } from "./visual-court-editor";
import { sampleCourtSimulation } from "./court-simulation";

/** The 2D floor projection of the very same sampled 3D action. */
export const simulationFloorPoint = (point: readonly number[]): CourtPoint => ({ x: point[0] / 9 + 0.5, y: point[2] / 18 + 0.5 });

export function displayCourtDrawings(payload: CourtVisualPayload, index: number, progress = 0): CourtDrawing[] {
  const sample = sampleCourtSimulation(payload, index, progress);
  return frameDrawings(payload, index).flatMap(drawing => {
    if (sample && drawing.id === sample.ballId) {
      if (!sample.visible) return [];
      return [{ ...drawing, points: [simulationFloorPoint(sample.ball)], motion: undefined }];
    }
    return [drawingAtProgress(drawing, progress)];
  });
}
