import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfExercisesRoute = createLazyRoute(
  () => import("../exercises"),
  createLoadingFallback(ptBR.loading.routes.exercises)
);

export default ProfExercisesRoute;
