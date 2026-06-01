import { markRender } from "../../src/observability/perf";
import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfileScreen = createLazyRoute(
  () => import("../profile"),
  createLoadingFallback(ptBR.loading.routes.profile)
);

export default function StudentProfileTab() {
  markRender("screen.studentProfile.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <ProfileScreen />;
}
