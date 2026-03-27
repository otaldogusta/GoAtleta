import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordPeriodizationRoute = createLazyRoute(
  () => import("../periodization"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando periodização..." />
);

export default CoordPeriodizationRoute;
