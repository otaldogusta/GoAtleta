// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen has no async load.
import CoordinationFinanceSettings from "../../../src/screens/finance/CoordinationFinanceSettings";

export default function CoordinationFinanceSettingsRoute() {
  return <CoordinationFinanceSettings />;
}
