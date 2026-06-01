import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordOrgMembersRoute = createLazyRoute(
  () => import("../org-members"),
  createLoadingFallback(ptBR.loading.routes.members)
);

export default CoordOrgMembersRoute;
