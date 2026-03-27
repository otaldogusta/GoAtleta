import { markRender } from "../../src/observability/perf";
import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfileScreen = createLazyRoute(
  () => import("../profile"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando perfil..." />
);

export default function StudentProfileTab() {
  markRender("screen.studentProfile.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <ProfileScreen />;
}
