import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfStudentsTab = createLazyRoute(
  () => import("../students"),
  createLoadingFallback("Carregando alunos...")
);

export default ProfStudentsTab;
