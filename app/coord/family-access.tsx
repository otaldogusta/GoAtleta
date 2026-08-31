// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns async work.
import CoordinationFamilyAccessScreen from "../../src/screens/family/CoordinationFamilyAccessScreen";

export default function CoordinationFamilyAccessRoute() {
  return <CoordinationFamilyAccessScreen />;
}
