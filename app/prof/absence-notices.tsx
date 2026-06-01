import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfAbsenceNoticesRoute = createLazyRoute(
  () => import("../absence-notices"),
  createLoadingFallback(ptBR.loading.routes.absenceNotices)
);

export default ProfAbsenceNoticesRoute;
