import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfStudentsTab = createLazyRoute(
  () => import("../students"),
  createLoadingFallback(ptBR.loading.routes.students)
);

export default ProfStudentsTab;
