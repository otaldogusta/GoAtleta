import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordinationDashboardTab = createLazyRoute(
  () =>
    import("../../src/screens/home/HomeAdmin").then((module) => ({
      default: module.default,
    })),
  <RouteScreenFallback title="Carregando" subtitle="Carregando painel..." />
);

export default CoordinationDashboardTab;
