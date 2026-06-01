import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentAchievementsTab = createLazyRoute(
  () => import("../student-badges"),
  createLoadingFallback(ptBR.loading.routes.achievements)
);

export default StudentAchievementsTab;
