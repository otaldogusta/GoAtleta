import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfReportsTab = createLazyRoute(
  () => import("../reports"),
  createLoadingFallback("Carregando relatórios...")
);

export default ProfReportsTab;
