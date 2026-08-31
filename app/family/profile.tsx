// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen has no async load.
import { FamilyProfileScreen } from "../../src/screens/family/FamilyProfileScreen";

export default function FamilyProfileRoute() {
  return <FamilyProfileScreen />;
}
