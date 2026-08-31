// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns data loading.
import { FamilyPaymentsScreen } from "../../src/screens/family/FamilyPaymentsScreen";

export default function FamilyPaymentsRoute() {
  return <FamilyPaymentsScreen />;
}
