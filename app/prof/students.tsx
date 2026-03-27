import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfStudentsTab = createLazyRoute(
  () => import("../students"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando alunos..." />
);

export default ProfStudentsTab;
