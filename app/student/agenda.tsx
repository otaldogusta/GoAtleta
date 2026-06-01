import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentAgendaTab = createLazyRoute(
  () => import("../agenda"),
  createLoadingFallback(ptBR.loading.routes.agenda)
);

export default StudentAgendaTab;
