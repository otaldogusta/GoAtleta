import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentAchievementsTab = createLazyRoute(
  () => import("../student-badges"),
  createLoadingFallback("Carregando conquistas...")
);

export default StudentAchievementsTab;
