import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordCommunicationsRoute = createLazyRoute(
  () => import("../communications"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando comunicação..." />
);

export default CoordCommunicationsRoute;
