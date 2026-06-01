import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfPlanningTab = createLazyRoute(
  () => import("../training"),
  createLoadingFallback(ptBR.loading.routes.planning)
);

export default ProfPlanningTab;
