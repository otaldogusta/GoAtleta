import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationReportsTab = createLazyRoute(
  () => import("../reports"),
  createLoadingFallback("Carregando relatórios...")
);

export default CoordinationReportsTab;
