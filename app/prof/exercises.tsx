import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfExercisesRoute = createLazyRoute(
  () => import("../exercises"),
  createLoadingFallback("Carregando exercícios...")
);

export default ProfExercisesRoute;
