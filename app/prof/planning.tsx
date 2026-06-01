import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfPlanningTab = createLazyRoute(
  () => import("../training"),
  createLoadingFallback("Carregando planejamento...")
);

export default ProfPlanningTab;
