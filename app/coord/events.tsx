import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordEventsRoute = createLazyRoute(
  () => import("../events"),
  createLoadingFallback(ptBR.loading.routes.events)
);

export default CoordEventsRoute;
