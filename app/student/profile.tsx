import { markRender } from "../../src/observability/perf";
import ProfileScreen from "../profile";

export default function StudentProfileTab() {
  markRender("screen.studentProfile.render.root");
  // perf-check: ignore-measure - wrapper fino; a tela compartilhada mede seu carregamento.
  return <ProfileScreen />;
}
