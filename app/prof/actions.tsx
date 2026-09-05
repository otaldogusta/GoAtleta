// perf-check: ignore-render -- pure redirect; the destination owns screen rendering.
// perf-check: ignore-measure -- no data operation before navigation.
import { Redirect } from "expo-router";

export default function ProfActionsTab() {
  return <Redirect href="/prof/assistant" />;
}
