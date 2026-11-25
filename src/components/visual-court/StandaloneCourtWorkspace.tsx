import { useCallback, useState, type ComponentProps } from "react";
import { useAuth } from "../../auth/auth";
import type { CourtVisualPayload } from "../../core/visual-court";
import { useOptionalOrganization } from "../../providers/organization-context";
import { CourtShareClassPicker } from "./CourtShareClassPicker";
import { CourtSharing } from "./CourtSharing";
import { CourtWorkspaceView } from "./CourtWorkspaceView";
import { exportCourt } from "./court-export";
import { useStandaloneCourt } from "./useStandaloneCourt";

type ShareRequest = {
  payload: CourtVisualPayload;
  key: string;
  userId?: string;
  org: string | null;
  classId?: string;
};

export function StandaloneCourtWorkspace(props: Pick<ComponentProps<typeof CourtWorkspaceView>, "documentId" | "initialView" | "onBack">) {
  const editor = useStandaloneCourt();
  const userId = useAuth().session?.user.id;
  const org = useOptionalOrganization()?.activeOrganizationId ?? null;
  const [request, setRequest] = useState<ShareRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);
  const current = request?.userId === userId && request?.org === org ? request : null;
  if (request && !current) setRequest(null);

  const open = () => setRequest({ payload: editor.payload, key: editor.shareKey, userId, org });
  const selectClass = (target: { org: string; classId: string }) => {
    if (!current || !userId || target.org !== org) return;
    setRequest({ ...current, classId: target.classId });
  };
  const download = async () => {
    if (!current) return;
    close();
    try {
      await exportCourt(current.payload, 0, "json");
    } catch {
      editor.setError("Não foi possível baixar a jogada.");
    }
  };

  return <>
    <CourtWorkspaceView {...props} standalone classId="" editor={editor} onShare={open} suspended={Boolean(current)} />
    {current && (current.org && current.classId
      ? <CourtSharing payload={current.payload} scope={{ org: current.org, classId: current.classId, key: current.key }} onClose={close} />
      : <CourtShareClassPicker onSelect={selectClass} onClose={close} onDownload={download} />)}
  </>;
}
