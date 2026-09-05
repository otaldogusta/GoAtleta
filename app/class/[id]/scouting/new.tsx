// perf-check: ignore-render -- pure redirect; the destination owns screen rendering.
// perf-check: ignore-measure -- no data operation before navigation.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function NewClassScoutingRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Redirect
      href={{
        pathname: "/class/[id]/scouting",
        params: { id },
      }}
    />
  );
}
