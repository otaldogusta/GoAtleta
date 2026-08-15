import { Redirect } from "expo-router";

// perf-check: ignore-render -- redirect-only route does not render its own screen.
// perf-check: ignore-measure -- redirect-only route does not load screen data.
export default function ImportTrainingRoute() {
  return <Redirect href="/training?import=spreadsheet" />;
}
