import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const CoordOrgMembersRoute = createLazyRoute(
  () => import("../org-members"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando membros..." />
);

export default CoordOrgMembersRoute;
