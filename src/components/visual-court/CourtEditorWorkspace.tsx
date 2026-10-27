import { useCallback, useState } from 'react';
import { CourtWorkspaceView, type CourtWorkspaceRouteProps } from './CourtWorkspaceView';
import { CourtSharing } from './CourtSharing';
import { useCourtEditor } from './useCourtEditor';

export function CourtEditorWorkspace(props: CourtWorkspaceRouteProps) {
  const editor = useCourtEditor(props.classId);
  const [sharing, setSharing] = useState(false);
  const closeSharing = useCallback(() => setSharing(false), []);
  return <>
    <CourtWorkspaceView {...props} editor={editor} suspended={sharing} onShare={() => setSharing(true)} />
    {sharing && editor.cls?.organizationId ? <CourtSharing key={editor.activeDocumentId ?? editor.payload.timeline.steps[0].id} payload={editor.payload} scope={{ org: editor.cls.organizationId, classId: props.classId, key: editor.activeDocumentId ?? editor.payload.timeline.steps[0].id }} onClose={closeSharing} /> : null}
  </>;
}
