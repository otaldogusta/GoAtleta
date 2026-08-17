import { markRender } from "../../src/observability/perf";
import RegulationHistoryScreen from "../regulation-history";

export default function ProfessorRegulationHistoryTab() {
  markRender("screen.profRegulationHistory.render.root");
  // perf-check: ignore-measure - wrapper fino; a tela compartilhada mede seu carregamento.
  return <RegulationHistoryScreen />;
}
