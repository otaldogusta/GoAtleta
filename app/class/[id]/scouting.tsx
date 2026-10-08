import { useLocalSearchParams } from "expo-router";
import { ScoutingScreen } from "../../../src/screens/scouting/ScoutingScreen";
import { markRender } from "../../../src/observability/perf";

// perf-check: ignore-measure -- the route only passes params; ScoutingScreen measures overview loading.

export default function ClassScoutingRoute() {
  markRender("screen.class.scouting.render.route");
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScoutingScreen classId={String(id ?? "")} />;
}
