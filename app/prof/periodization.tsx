import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfPeriodizationRoute = createLazyRoute(
  () => import("../periodization"),
  createLoadingFallback("Carregando periodização...")
);

export default ProfPeriodizationRoute;
