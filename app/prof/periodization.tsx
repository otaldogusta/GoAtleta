import { ptBR } from "../../src/constants/copy/pt-br";
import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfPeriodizationScreen = createLazyRoute(
  () => import("../periodization"),
  createLoadingFallback(ptBR.loading.routes.periodization)
);

function ProfPeriodizationRoute() {
  return (
    <MemberPermissionBoundary permissionKey="periodization" redirectTo="/prof/home">
      <ProfPeriodizationScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfPeriodizationRoute;
