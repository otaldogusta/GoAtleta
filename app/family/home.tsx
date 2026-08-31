// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns data loading.
import { FamilyHomeScreen } from "../../src/screens/family/FamilyHomeScreen";

export default function FamilyHomeRoute() {
  return <FamilyHomeScreen />;
}
