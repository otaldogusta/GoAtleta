import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfCalendarRoute = createLazyRoute(
  () => import("../calendar"),
  createLoadingFallback(ptBR.loading.routes.calendar)
);

export default ProfCalendarRoute;
