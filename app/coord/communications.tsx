import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordCommunicationsRoute = createLazyRoute(
  () => import("../communications"),
  createLoadingFallback("Carregando comunicação...")
);

export default CoordCommunicationsRoute;
