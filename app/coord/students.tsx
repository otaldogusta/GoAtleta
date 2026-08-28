import { Redirect } from "expo-router";

// perf-check: ignore-render -- compatibility redirect to the canonical management route.
// perf-check: ignore-measure -- compatibility redirect; no data is loaded here.
export default function CoordinationStudentsRedirect() {
  return <Redirect href={"/coord/management/athletes" as never} />;
}
