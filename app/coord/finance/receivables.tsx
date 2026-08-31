// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns data loading.
import CoordinationReceivables from "../../../src/screens/finance/CoordinationReceivables";

export default function CoordinationReceivablesRoute() {
  return <CoordinationReceivables />;
}
