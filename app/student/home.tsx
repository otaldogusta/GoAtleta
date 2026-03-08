import { markRender } from "../../src/observability/perf";
import StudentHomeScreen from "../student-home";

export default function StudentHomeTab() {
  markRender("screen.studentHome.render.root");
  // perf-check: ignore-measure - wrapper fino, carga delegada para a tela legada.
  return <StudentHomeScreen />;
}
