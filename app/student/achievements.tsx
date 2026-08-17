// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import StudentBadgesScreen from "../student-badges";

export default function StudentAchievementsRoute() {
  return <StudentBadgesScreen />;
}
