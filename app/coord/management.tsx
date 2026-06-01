import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationManagementTab = createLazyRoute(
  () => import("../coordination"),
  createLoadingFallback(ptBR.loading.routes.management)
);

export default CoordinationManagementTab;
