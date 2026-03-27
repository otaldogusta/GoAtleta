import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const StudentAchievementsTab = createLazyRoute(
  () => import("../student-badges"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando conquistas..." />
);

export default StudentAchievementsTab;
