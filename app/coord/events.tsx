// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import EventsScreen from "../events";

export default function CoordinationEventsRoute() {
  return <EventsScreen />;
}
