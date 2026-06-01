import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfAssistantRoute = createLazyRoute(
  () => import("../assistant"),
  createLoadingFallback("Carregando assistente...")
);

export default ProfAssistantRoute;
