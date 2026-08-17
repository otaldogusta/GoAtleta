// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import StudentAgendaScreen from "../agenda";

export default function StudentAgendaRoute() {
  return <StudentAgendaScreen />;
}
