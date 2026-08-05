import { useCallback, useEffect, useState } from "react";

import {
  getNotifications,
  subscribeNotifications,
  type AppNotification,
} from "../notificationsInbox";
import { countUnreadNotifications } from "./unread-notification-count";

export function useUnreadNotificationCount(
  organizationId?: string | null,
  enabled = true
) {
  const [unreadCount, setUnreadCount] = useState(0);

  const applyNotifications = useCallback((notifications: AppNotification[]) => {
    setUnreadCount(countUnreadNotifications(notifications));
  }, []);

  const refresh = useCallback(async () => {
    const notifications = await getNotifications();
    applyNotifications(notifications);
  }, [applyNotifications]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const applyIfActive = (notifications: AppNotification[]) => {
      if (active) applyNotifications(notifications);
    };
    const refreshIfActive = async () => {
      const notifications = await getNotifications();
      applyIfActive(notifications);
    };
    const unsubscribe = subscribeNotifications(applyIfActive);
    const scheduledRefresh = setTimeout(() => {
      void refreshIfActive();
    }, 0);
    const handleFocus = () => {
      void refreshIfActive();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshIfActive();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      active = false;
      clearTimeout(scheduledRefresh);
      unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [applyNotifications, enabled, organizationId]);

  return { unreadCount: enabled ? unreadCount : 0, refresh };
}
