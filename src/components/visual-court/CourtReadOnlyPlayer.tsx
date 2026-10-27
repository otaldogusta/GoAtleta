import type { CourtVisualPayload } from '../../core/visual-court';
import { CourtWorkspaceView } from './CourtWorkspaceView';
import { useCourtReadOnlyController } from './useCourtReadOnlyController';

export function CourtReadOnlyPlayer({ payload, onClose }: { payload: CourtVisualPayload; onClose: () => void }) {
  const editor = useCourtReadOnlyController(payload);
  return <CourtWorkspaceView classId="" editor={editor} readOnly onBack={onClose} />;
}
