import { markRender } from "../../src/observability/perf";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentHomeScreen = createLazyRoute(
  () => import("../student-home"),
  createLoadingFallback("Carregando painel...")
);

export default function StudentHomeTab() {
  markRender("screen.studentHome.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <StudentHomeScreen />;
}
