import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfExercisesRoute = createLazyRoute(
  () => import("../exercises"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando exercícios..." />
);

export default ProfExercisesRoute;
