// perf-check: ignore-render -- compatibility redirect to the unified agenda.
// perf-check: ignore-measure -- redirect has no data reads.
import { Redirect } from "expo-router";
export default function CoordinationEventsRoute() {
  return <Redirect href="/coord/calendar" />;
}
