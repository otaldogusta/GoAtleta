import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfClassesTab = createLazyRoute(
  () => import("../classes"),
  createLoadingFallback(ptBR.loading.routes.classes)
);

export default ProfClassesTab;
