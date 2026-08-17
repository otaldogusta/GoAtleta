import { markRender } from "../../src/observability/perf";
import StudentHomeScreen from "../student-home";

export default function StudentHomeTab() {
  markRender("screen.studentHome.render.root");
  // perf-check: ignore-measure - wrapper fino; a tela compartilhada mede seu carregamento.
  return <StudentHomeScreen />;
}
