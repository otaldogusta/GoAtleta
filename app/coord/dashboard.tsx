import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationDashboardTab = createLazyRoute(
  () =>
    import("../../src/screens/home/HomeAdmin").then((module) => ({
      default: module.default,
    })),
  createLoadingFallback(ptBR.loading.routes.dashboard)
);

export default CoordinationDashboardTab;
