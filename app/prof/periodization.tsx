import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfPeriodizationRoute = createLazyRoute(
  () => import("../periodization"),
  createLoadingFallback(ptBR.loading.routes.periodization)
);

export default ProfPeriodizationRoute;
