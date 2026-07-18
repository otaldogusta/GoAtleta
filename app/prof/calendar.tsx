import { ptBR } from "../../src/constants/copy/pt-br";
import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfCalendarScreen = createLazyRoute(
  () => import("../calendar"),
  createLoadingFallback(ptBR.loading.routes.calendar)
);

function ProfCalendarRoute() {
  return (
    <MemberPermissionBoundary permissionKey="calendar" redirectTo="/prof/home">
      <ProfCalendarScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfCalendarRoute;
