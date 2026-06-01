import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordEventsRoute = createLazyRoute(
  () => import("../events"),
  createLoadingFallback("Carregando eventos...")
);

export default CoordEventsRoute;
