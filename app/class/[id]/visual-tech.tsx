import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Platform } from "react-native";
import { CourtEditorWorkspace } from "../../../src/components/visual-court/CourtEditorWorkspace";
import { requestPendingEditsNavigation } from "../../../src/navigation/pending-edits-navigation";
import { markRender } from "../../../src/observability/perf";

// perf-check: ignore-measure — data loading is measured in useCourtEditor, not this route adapter.

export default function ClassVisualTechRoute() {
  markRender("screen.visualCourt.render.root");
  const { id, visual, date, plan } = useLocalSearchParams<{ id: string; visual?: string; date?: string; plan?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const classId = typeof id === "string" ? id : "";
  const onBack = () => {
    const navigate = () => {
      if (Platform.OS === "web") {
        const state = navigation.getState();
        const previous = state?.routes[(state.index ?? 0) - 1];
        const previousClassId = (previous?.params as { id?: unknown } | undefined)?.id;
        if (previous?.name === "class/[id]" && previousClassId === classId) {
          router.back();
          return;
        }
      }
      router.replace({ pathname: "/class/[id]", params: { id: classId, ...(typeof date === "string" ? { date } : {}) } });
    };
    if (Platform.OS === "web") requestPendingEditsNavigation(navigate);
    else navigate();
  };
  return <CourtEditorWorkspace
    classId={classId}
    documentId={typeof visual === "string" ? visual : undefined}
    lessonDate={typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
    planId={typeof plan === "string" ? plan : undefined}
    onBack={onBack}
  />;
}
