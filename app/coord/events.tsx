import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordEventsRoute = createLazyRoute(
  () => import("../events"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando eventos..." />
);

export default CoordEventsRoute;
