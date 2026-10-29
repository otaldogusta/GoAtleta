// perf-check: ignore-render -- compatibility route; shared agenda owns instrumentation.
// perf-check: ignore-measure -- compatibility route has no data reads.
import { Redirect } from "expo-router";
import { useTrainerRouteScope } from "../../src/navigation/use-trainer-route-scope";
export default function EventsRoute() {
  const { scope } = useTrainerRouteScope();
  return <Redirect href={scope === "coord" ? "/coord/calendar" : "/prof/calendar"} />;
}
