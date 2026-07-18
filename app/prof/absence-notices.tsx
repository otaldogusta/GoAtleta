import { ptBR } from "../../src/constants/copy/pt-br";
import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfAbsenceNoticesScreen = createLazyRoute(
  () => import("../absence-notices"),
  createLoadingFallback(ptBR.loading.routes.absenceNotices)
);

function ProfAbsenceNoticesRoute() {
  return (
    <MemberPermissionBoundary permissionKey="absence_notices" redirectTo="/prof/home">
      <ProfAbsenceNoticesScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfAbsenceNoticesRoute;
