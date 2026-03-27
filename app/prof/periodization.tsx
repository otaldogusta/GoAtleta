import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfPeriodizationRoute = createLazyRoute(
  () => import("../periodization"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando periodização..." />
);

export default ProfPeriodizationRoute;
