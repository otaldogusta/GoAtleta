import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfPlanningTab = createLazyRoute(
  () => import("../training"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando planejamento..." />
);

export default ProfPlanningTab;
