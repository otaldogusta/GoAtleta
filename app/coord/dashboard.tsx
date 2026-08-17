// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import HomeAdminScreen from "../../src/screens/home/HomeAdmin";

export default function CoordinationDashboardRoute() {
  return <HomeAdminScreen />;
}
