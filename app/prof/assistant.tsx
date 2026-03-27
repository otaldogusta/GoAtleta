import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfAssistantRoute = createLazyRoute(
  () => import("../assistant"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando assistente..." />
);

export default ProfAssistantRoute;
