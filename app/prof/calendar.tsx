import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfCalendarRoute = createLazyRoute(
  () => import("../calendar"),
  createLoadingFallback("Carregando calendário...")
);

export default ProfCalendarRoute;
