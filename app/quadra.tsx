import { useRouter } from "expo-router";
import { MemberPermissionBoundary } from "../src/auth/MemberPermissionBoundary";
import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import { FullscreenLoadingState } from "../src/components/ui/FullscreenLoadingState";
import { CourtWorkspaceView } from "../src/components/visual-court/CourtWorkspaceView";
import { useStandaloneCourt } from "../src/components/visual-court/useStandaloneCourt";
import { markRender } from "../src/observability/perf";

// perf-check: ignore-measure — this route has no asynchronous data loading.
export default function StandaloneCourtRoute() {
  markRender("screen.standaloneCourt.render.root");
  const { session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  if (authLoading || roleLoading || !session || role !== "trainer") return <FullscreenLoadingState />;
  return <MemberPermissionBoundary permissionKey="training" redirectTo="/prof/home">
    <StandaloneCourt key={session.user.id} />
  </MemberPermissionBoundary>;
}

function StandaloneCourt() {
  const router = useRouter();
  const editor = useStandaloneCourt();
  return <CourtWorkspaceView classId="" standalone editor={editor} onBack={() => {
    if (router.canGoBack()) router.back();
    else router.replace("/prof/home");
  }} />;
}
