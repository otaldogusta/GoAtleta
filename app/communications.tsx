import { usePathname } from "expo-router";

import { NotificationsCenterScreen } from "./absence-notices";

export default function CommunicationsScreen() {
  const pathname = usePathname();
  const fallbackRoute = pathname.startsWith("/coord") ? "/coord/dashboard" : "/student/home";

  return <NotificationsCenterScreen fallbackRoute={fallbackRoute} />;
}
