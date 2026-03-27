import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordinationManagementTab = createLazyRoute(
  () => import("../coordination"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando gestão..." />
);

export default CoordinationManagementTab;
