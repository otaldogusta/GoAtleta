import { CourtEditorCanvas } from "./CourtEditorCanvas";
import type { CourtPerspectiveCanvasProps } from "./CourtPerspectiveCanvas.types";
import { courtPointToWorld } from "../../core/visual-court-perspective";

// The current 3D renderer uses WebGL in the web workspace. Native keeps its editor.
export function CourtPerspectiveCanvas(props: CourtPerspectiveCanvasProps) {
  return <CourtEditorCanvas {...props} onSimulationHandle={props.onSimulationHandle ? edit => {
    if (edit.point) props.onSimulationHandle?.({ ...edit, point: courtPointToWorld(edit.point) });
  } : undefined} />;
}
