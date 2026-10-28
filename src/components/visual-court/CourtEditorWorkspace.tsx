import { useCallback, useState } from 'react';
import { CourtWorkspaceView, type CourtWorkspaceRouteProps } from './CourtWorkspaceView';
import { CourtSharing } from './CourtSharing';
import { useCourtEditor } from './useCourtEditor';
import type { CourtSharingProps } from './CourtSharing.types';

export function CourtEditorWorkspace(props: CourtWorkspaceRouteProps) {
  const [sharing, setSharing] = useState<Omit<CourtSharingProps, 'onClose'> | null>(null);
  const currentShare = sharing?.scope.classId === props.classId ? sharing : null;
  const editor = useCourtEditor(props.classId, { autosavePaused: Boolean(currentShare) });
  if (sharing && (!currentShare || (editor.cls && sharing.scope.org !== editor.cls.organizationId))) setSharing(null);
  const visibleShare = currentShare?.scope.org === editor.cls?.organizationId ? currentShare : null;
  const closeSharing = useCallback(() => setSharing(null), []);
  const openSharing = () => {
    if (!editor.cls?.organizationId) return;
    setSharing({ payload: editor.payload, scope: { org: editor.cls.organizationId, classId: props.classId, key: editor.activeDocumentId ?? editor.payload.timeline.steps[0].id } });
  };
  return <>
    <CourtWorkspaceView {...props} editor={editor} suspended={Boolean(visibleShare)} onShare={openSharing} />
    {visibleShare ? <CourtSharing key={visibleShare.scope.key} {...visibleShare} onClose={closeSharing} /> : null}
  </>;
}
