// perf-check: ignore-render -- redirect-only route with no rendered workspace.
// perf-check: ignore-measure -- redirect-only route with no async loading.
import { Redirect } from "expo-router";

export default function FamilyIndexRoute() {
  return <Redirect href="/family/home" />;
}
