import RegulationHistoryScreen from "./regulation-history";
import { markRender } from "../src/observability/perf";

export default function RegulationSourcesAliasScreen() {
  markRender("screen.regulationSources.render.alias");
  // perf-check: ignore-measure - alias fino, carga real medida em regulation-history.
  return <RegulationHistoryScreen />;
}
