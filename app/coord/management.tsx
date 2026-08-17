// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import CoordinationScreen from "../coordination";

export default function CoordinationManagementRoute() {
  return <CoordinationScreen />;
}
