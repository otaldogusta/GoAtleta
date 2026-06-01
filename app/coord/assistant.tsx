import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordAssistantRoute = createLazyRoute(
  () => import("../assistant"),
  createLoadingFallback("Carregando assistente...")
);

export default CoordAssistantRoute;
