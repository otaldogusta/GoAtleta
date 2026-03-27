import { RouteScreenFallback, createLazyRoute } from "../../src/ui/lazy-screen";

const ProfNfcAttendanceRoute = createLazyRoute(
  () => import("../nfc-attendance"),
  <RouteScreenFallback title="Carregando" subtitle="Carregando NFC..." />
);

export default ProfNfcAttendanceRoute;
