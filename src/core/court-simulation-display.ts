import type { CourtPoint, CourtVisualPayload } from "./visual-court";
import { drawingAtProgress, frameDrawings, resolveCourtDrawingAnchors, type CourtDrawing } from "./visual-court-editor";
import { sampleCourtSimulation } from "./court-simulation";
import type { CourtSimulationSample } from "./court-simulation-model";

/** The 2D floor projection of the very same sampled 3D action. */
export const simulationFloorPoint = (point: readonly number[]): CourtPoint => ({ x: point[0] / 9 + 0.5, y: point[2] / 18 + 0.5 });

export type DisplayedCourtDrawing = CourtDrawing & { traceProgress?: number };

export function isDefenseAttackAlternative(drawing: CourtDrawing, context: Pick<CourtSimulationSample, "mode" | "ballId"> | null | undefined): boolean {
  return context?.mode === "defense" && drawing.startBallId === context.ballId && (drawing.kind === "arrow" || drawing.kind === "curve");
}

/** Negative before contact, zero at the ball, one for the complete authored trace. */
export function courtDrawingTraceProgress(drawing: CourtDrawing, sample: CourtSimulationSample | null): number {
  if (!sample || !isDefenseAttackAlternative(drawing, sample)) return 1;
  const contact = sample.attackContact ?? 1;
  if (sample.progress < contact) return -1;
  return sample.progress === 1 ? 1 : (sample.progress - contact) / (1 - contact);
}

export function displayCourtDrawings(payload: CourtVisualPayload, index: number, progress = 0): DisplayedCourtDrawing[] {
  const sample = sampleCourtSimulation(payload, index, progress);
  const drawBall = (drawing: CourtDrawing, point: readonly number[]) => ({ ...drawing, points: [simulationFloorPoint(point)], motion: undefined });
  const drawings = resolveCourtDrawingAnchors(frameDrawings(payload, index).filter(drawing => courtDrawingTraceProgress(drawing, sample) >= 0).map(drawing => sample && drawing.id === sample.ballId
    ? drawBall(drawing, sample.defenseContact ?? sample.ball)
    : drawingAtProgress(drawing, progress)));
  return drawings.filter(drawing => !drawing.hidden && !(sample && drawing.id === sample.ballId && !sample.visible))
    .map(drawing => {
      if (sample?.defenseContact && drawing.id === sample.ballId) return drawBall(drawing, sample.ball);
      const traceProgress = courtDrawingTraceProgress(drawing, sample);
      return traceProgress < 1 ? { ...drawing, traceProgress } : drawing;
    });
}
