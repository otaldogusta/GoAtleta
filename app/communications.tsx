// perf-check: ignore-render -- delegated to app/absence-notices.tsx.
// perf-check: ignore-measure -- data loading is instrumented by the same screen owner.
import { usePathname } from "expo-router";

import { NotificationsCenterScreen } from "./absence-notices";
import { AppShell } from "../src/ui/AppShell";

export default function CommunicationsScreen() {
  const pathname = usePathname();
  const fallbackRoute = pathname.startsWith("/coord") ? "/coord/dashboard" : "/student/home";

  const screen = <NotificationsCenterScreen fallbackRoute={fallbackRoute} />;
  return pathname.startsWith("/coord/") ? screen : <AppShell role="student">{screen}</AppShell>;
}
