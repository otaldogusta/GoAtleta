import { Stack } from "expo-router";

// perf-check: ignore-render -- route-only layout.
// perf-check: ignore-measure -- no data loading in the profile stack.
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
