import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordOrgMembersRoute = createLazyRoute(
  () => import("../org-members"),
  createLoadingFallback("Carregando membros...")
);

export default CoordOrgMembersRoute;
