import { useCallback, useEffect, useState } from "react";

import {
  getNotifications,
  subscribeNotifications,
  type AppNotification,
} from "../notificationsInbox";
import { countUnreadNotifications } from "./unread-notification-count";
import type { NotificationInboxScope } from "./inbox-scope";

export function useUnreadNotificationCount(
  organizationId?: string | null,
  enabled = true,
  inboxScope: NotificationInboxScope = "all",
) {
  const [unreadCount, setUnreadCount] = useState(0);

  const applyNotifications = useCallback((notifications: AppNotification[]) => {
    setUnreadCount(countUnreadNotifications(notifications));
  }, []);

  const refresh = useCallback(async () => {
    const notifications = await getNotifications(inboxScope, organizationId);
    applyNotifications(notifications);
  }, [applyNotifications, inboxScope, organizationId]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const applyIfActive = (notifications: AppNotification[]) => {
      if (active) applyNotifications(notifications);
    };
    const refreshIfActive = async () => {
      const notifications = await getNotifications(inboxScope, organizationId);
      applyIfActive(notifications);
    };
    const unsubscribe = subscribeNotifications(
      applyIfActive,
      inboxScope,
      organizationId,
    );
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
  }, [applyNotifications, enabled, inboxScope, organizationId]);

  return { unreadCount: enabled ? unreadCount : 0, refresh };
}
