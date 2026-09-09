import { useLocalSearchParams, useRouter } from "expo-router";
import { CourtEditorWorkspace } from "../../../src/components/visual-court/CourtEditorWorkspace";
import { markRender } from "../../../src/observability/perf";

// perf-check: ignore-measure — data loading is measured in useCourtEditor, not this route adapter.

export default function ClassVisualTechRoute() {
  markRender("screen.visualCourt.render.root");
  const { id, visual, date, plan } = useLocalSearchParams<{ id: string; visual?: string; date?: string; plan?: string }>();
  const router = useRouter();
  const classId = typeof id === "string" ? id : "";
  return <CourtEditorWorkspace
    classId={classId}
    documentId={typeof visual === "string" ? visual : undefined}
    lessonDate={typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
    planId={typeof plan === "string" ? plan : undefined}
    onBack={() => router.replace({ pathname: "/class/[id]", params: { id: classId, ...(typeof date === "string" ? { date } : {}) } })}
  />;
}
