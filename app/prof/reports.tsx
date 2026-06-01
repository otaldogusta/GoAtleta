import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfReportsTab = createLazyRoute(
  () => import("../reports"),
  createLoadingFallback(ptBR.loading.routes.reports)
);

export default ProfReportsTab;
