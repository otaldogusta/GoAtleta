// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns async work.
import CoordinationTuitionSetup from "../../../src/screens/finance/CoordinationTuitionSetup";

export default function CoordinationTuitionSetupRoute() {
  return <CoordinationTuitionSetup />;
}
