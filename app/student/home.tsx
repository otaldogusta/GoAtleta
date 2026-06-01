import { markRender } from "../../src/observability/perf";
import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentHomeScreen = createLazyRoute(
  () => import("../student-home"),
  createLoadingFallback(ptBR.loading.routes.dashboard)
);

export default function StudentHomeTab() {
  markRender("screen.studentHome.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <StudentHomeScreen />;
}
