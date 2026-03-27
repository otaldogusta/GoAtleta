import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordinationClassesTab = createLazyRoute(
  () => import("../classes"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando turmas..." />
);

export default CoordinationClassesTab;
