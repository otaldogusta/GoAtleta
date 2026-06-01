import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfAbsenceNoticesRoute = createLazyRoute(
  () => import("../absence-notices"),
  createLoadingFallback("Carregando avisos...")
);

export default ProfAbsenceNoticesRoute;
