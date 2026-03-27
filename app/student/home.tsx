import { markRender } from "../../src/observability/perf";
import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const StudentHomeScreen = createLazyRoute(
  () => import("../student-home"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando painel..." />
);

export default function StudentHomeTab() {
  markRender("screen.studentHome.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <StudentHomeScreen />;
}
