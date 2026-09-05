// perf-check: ignore-render -- delegated to src/screens/home/HomeProfessor.tsx.
// perf-check: ignore-measure -- data loading is instrumented by the same screen owner.
import { HomeProfessorScreen } from "../../src/screens/home/HomeProfessor";

export default function ProfHomeTab() {
  return <HomeProfessorScreen />;
}
