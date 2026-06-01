import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfClassesTab = createLazyRoute(
  () => import("../classes"),
  createLoadingFallback("Carregando turmas...")
);

export default ProfClassesTab;
