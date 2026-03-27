import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfCalendarRoute = createLazyRoute(
  () => import("../calendar"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando calendário..." />
);

export default ProfCalendarRoute;
