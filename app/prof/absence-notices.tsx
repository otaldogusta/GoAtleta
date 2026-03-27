import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfAbsenceNoticesRoute = createLazyRoute(
  () => import("../absence-notices"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando avisos..." />
);

export default ProfAbsenceNoticesRoute;
