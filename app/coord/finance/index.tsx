// perf-check: ignore-render -- route-only wrapper; screen owns instrumentation.
// perf-check: ignore-measure -- route-only wrapper; screen owns data loading.
import CoordinationFinanceDashboard from "../../../src/screens/finance/CoordinationFinanceDashboard";

export default function CoordinationFinanceRoute() {
  return <CoordinationFinanceDashboard />;
}
