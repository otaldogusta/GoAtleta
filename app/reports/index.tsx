import { Redirect } from "expo-router";

// perf-check: ignore-render -- retired route only redirects to the management workspace.
// perf-check: ignore-measure -- redirect-only route does not load screen data.
export default function RetiredCoordinationDashboardRoute() {
  return <Redirect href="/coord/management" />;
}
