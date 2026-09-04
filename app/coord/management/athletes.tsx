import { Redirect } from "expo-router";

// perf-check: ignore-render -- compatibility redirect to the canonical coordination route.
// perf-check: ignore-measure -- compatibility redirect; no data is loaded here.
export default function LegacyCoordinationAthletesRedirect() {
  return <Redirect href="/coord/students" />;
}
