// perf-check: ignore-render -- route-only wrapper; shared screen owns render instrumentation.
// perf-check: ignore-measure -- route-only wrapper; shared screen owns data-loading instrumentation.
import NfcAttendanceScreen from "../nfc-attendance";

export default function CoordinationNfcAttendanceRoute() {
  return <NfcAttendanceScreen />;
}
