import type { CourtEditorCanvasProps } from "./CourtEditorCanvas";
import type { CourtPerspectiveShortcut, CourtPerspectiveHandleEdit } from "./court-perspective-bridge";
import type { CourtTrajectoryHandleKind } from "../../core/court-arrow-trajectory";
import type { CourtWorldPoint } from "../../core/visual-court-perspective";
import type { CourtPoint } from "../../core/visual-court";

export type { CourtPerspectiveShortcut } from "./court-perspective-bridge";
export type { CourtPerspectiveHandleEdit } from "./court-perspective-bridge";
export type CourtPerspectiveCanvasProps = Omit<CourtEditorCanvasProps, "onSimulationHandle"> & {
  active: boolean;
  cameraView: "front" | "side" | "orbit";
  cameraReset: number;
  onShortcut: (key: CourtPerspectiveShortcut, shift?: boolean) => void;
  onOpenProperties: () => void;
  /** One completed handle gesture is one canonical history edit. */
  onSimulationHandle?: (edit: CourtPerspectiveHandleEdit) => void;
  onElevation?: (id: string, value: number) => void;
  onTrajectoryHeight?: (id: string, handle: CourtTrajectoryHandleKind, value: number) => void;
  onTrajectoryPoint?: (id: string, handle: CourtTrajectoryHandleKind, point: CourtWorldPoint) => void;
  onAreaVertex?: (id: string, vertex: number, point: CourtPoint) => void;
};
