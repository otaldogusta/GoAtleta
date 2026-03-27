import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfReportsTab = createLazyRoute(
  () => import("../reports"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando relatórios..." />
);

export default ProfReportsTab;
