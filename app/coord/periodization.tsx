import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordPeriodizationRoute = createLazyRoute(
  () => import("../periodization"),
  createLoadingFallback("Carregando periodização...")
);

export default CoordPeriodizationRoute;
