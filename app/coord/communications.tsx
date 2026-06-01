import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordCommunicationsRoute = createLazyRoute(
  () => import("../communications"),
  createLoadingFallback(ptBR.loading.routes.communication)
);

export default CoordCommunicationsRoute;
