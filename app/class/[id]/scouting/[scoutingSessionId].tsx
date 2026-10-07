import { useLocalSearchParams } from "expo-router";
import { ScoutingScreen } from "../../../../src/screens/scouting/ScoutingScreen";
import { markRender } from "../../../../src/observability/perf";

// perf-check: ignore-measure -- the route only passes params; useScoutingCollection measures detail loading.

export default function ScoutingDetailRoute() {
  markRender("screen.class.scouting.render.detail-route");
  const { id, scoutingSessionId } = useLocalSearchParams<{ id: string; scoutingSessionId: string }>();
  return <ScoutingScreen classId={String(id ?? "")} initialSessionId={String(scoutingSessionId ?? "")} />;
}
