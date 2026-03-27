import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const StudentAgendaTab = createLazyRoute(
  () => import("../agenda"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando agenda..." />
);

export default StudentAgendaTab;
