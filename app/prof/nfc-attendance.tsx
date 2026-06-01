import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfNfcAttendanceRoute = createLazyRoute(
  () => import("../nfc-attendance"),
  createLoadingFallback(ptBR.loading.routes.nfc)
);

export default ProfNfcAttendanceRoute;
