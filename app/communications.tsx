// perf-check: ignore-render -- delegated to app/absence-notices.tsx.
// perf-check: ignore-measure -- data loading is instrumented by the same screen owner.
import { usePathname } from "expo-router";

import { NotificationsCenterScreen } from "./absence-notices";

export default function CommunicationsScreen() {
  const pathname = usePathname();
  const fallbackRoute = pathname.startsWith("/coord") ? "/coord/dashboard" : "/student/home";

  return <NotificationsCenterScreen fallbackRoute={fallbackRoute} />;
}
