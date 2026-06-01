import { markRender } from "../../src/observability/perf";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfileScreen = createLazyRoute(
  () => import("../profile"),
  createLoadingFallback("Carregando perfil...")
);

export default function StudentProfileTab() {
  markRender("screen.studentProfile.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <ProfileScreen />;
}
