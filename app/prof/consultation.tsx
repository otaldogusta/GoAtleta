import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

// perf-check: ignore-render -- route-only wrapper; consultation screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; consultation screen owns data-loading instrumentation.
const ProfConsultationRoute = createLazyRoute(
  () =>
    import("../consultation").then((module) => ({
      default: module.ConsultationScreen,
    })),
  createLoadingFallback(ptBR.loading.routes.consultation)
);

export default ProfConsultationRoute;
