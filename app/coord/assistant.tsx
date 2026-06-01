import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordAssistantRoute = createLazyRoute(
  () => import("../assistant"),
  createLoadingFallback(ptBR.loading.routes.assistant)
);

export default CoordAssistantRoute;
