import { markRender } from "../../src/observability/perf";
import ProfileScreen from "../profile";

export default function ProfessorProfileTab() {
  markRender("screen.profProfile.render.root");
  // perf-check: ignore-measure - wrapper fino; a tela compartilhada mede seu carregamento.
  return <ProfileScreen />;
}
