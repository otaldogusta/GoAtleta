// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import ExercisesScreen from "../exercises";

export default function ProfessorExercisesRoute() {
  return <ExercisesScreen />;
}
