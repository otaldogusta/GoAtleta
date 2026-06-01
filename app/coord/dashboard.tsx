import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationDashboardTab = createLazyRoute(
  () =>
    import("../../src/screens/home/HomeAdmin").then((module) => ({
      default: module.default,
    })),
  createLoadingFallback("Carregando painel...")
);

export default CoordinationDashboardTab;
