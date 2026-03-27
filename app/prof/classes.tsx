import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfClassesTab = createLazyRoute(
  () => import("../classes"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando turmas..." />
);

export default ProfClassesTab;
