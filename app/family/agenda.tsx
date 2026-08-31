// perf-check: ignore-render -- route-only wrapper; screen owns rendering.
// perf-check: ignore-measure -- route-only wrapper; screen owns data loading.
import { FamilyAgendaScreen } from "../../src/screens/family/FamilyAgendaScreen";

export default function FamilyAgendaRoute() {
  return <FamilyAgendaScreen />;
}
