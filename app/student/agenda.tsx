import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const StudentAgendaTab = createLazyRoute(
  () => import("../agenda"),
  createLoadingFallback("Carregando agenda...")
);

export default StudentAgendaTab;
