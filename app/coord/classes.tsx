import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationClassesTab = createLazyRoute(
  () => import("../classes"),
  createLoadingFallback("Carregando turmas...")
);

export default CoordinationClassesTab;
