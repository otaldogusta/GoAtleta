import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordAssistantRoute = createLazyRoute(
  () => import("../assistant"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando assistente..." />
);

export default CoordAssistantRoute;
