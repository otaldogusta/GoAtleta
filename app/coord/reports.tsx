import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordinationReportsTab = createLazyRoute(
  () => import("../reports"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando relatórios..." />
);

export default CoordinationReportsTab;
