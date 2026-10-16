import type { CourtEditorCanvasProps } from "./CourtEditorCanvas";
import type { CourtPerspectiveShortcut, CourtPerspectiveHandleEdit } from "./court-perspective-bridge";

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
};
