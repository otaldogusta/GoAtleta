import type { CourtPoint } from "./visual-court";
import type { CourtTrajectoryHeights } from "./court-arrow-trajectory";

/** Shared authored drawing data, independent of editor commands and geometry. */
export type DrawingKind = "arrow" | "curve" | "pen" | "area" | "text" | "ball" | "cone" | "target" | "ladder";
export type CourtDrawing = { id: string; kind: DrawingKind; points: CourtPoint[]; curveMode?: "through-point"; startBallId?: string; trajectoryHeights?: CourtTrajectoryHeights; elevation?: number; color: string; text?: string; dashed?: boolean; size: number; rotation: number; locked?: boolean; hidden?: boolean; motion?: CourtPoint[] };
