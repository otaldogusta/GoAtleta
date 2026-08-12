import { ptBR } from "../../src/constants/copy/pt-br";
import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const CoordNfcAttendanceRoute = createLazyRoute(
  () => import("../nfc-attendance"),
  createLoadingFallback(ptBR.loading.routes.nfc),
);

export default CoordNfcAttendanceRoute;
