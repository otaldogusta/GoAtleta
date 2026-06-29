import { markRender } from "../../src/observability/perf";
import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const RegulationHistoryScreen = createLazyRoute(
  () => import("../regulation-history"),
  createLoadingFallback(ptBR.loading.generic)
);

export default function CoordinationRegulationHistoryTab() {
  markRender("screen.coordRegulationHistory.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <RegulationHistoryScreen />;
}
