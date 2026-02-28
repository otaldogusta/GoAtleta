import { HomeProfessorScreen } from "./HomeProfessor";
import { markRender } from "../../observability/perf";

export default function HomeAdmin() {
  // perf-check: ignore-measure - tela delega carregamento para HomeProfessorScreen.
  markRender("screen.homeAdmin.render.root");
  return <HomeProfessorScreen adminMode />;
}
