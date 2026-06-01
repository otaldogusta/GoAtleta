import { createLazyRoute, createLoadingFallback } from "../../src/ui/lazy-screen";

const ProfNfcAttendanceRoute = createLazyRoute(
  () => import("../nfc-attendance"),
  createLoadingFallback("Carregando NFC...")
);

export default ProfNfcAttendanceRoute;
