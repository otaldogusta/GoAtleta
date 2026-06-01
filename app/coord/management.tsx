import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordinationManagementTab = createLazyRoute(
  () => import("../coordination"),
  createLoadingFallback("Carregando gestão...")
);

export default CoordinationManagementTab;
