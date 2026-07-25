import { useEffect, useState } from "react";

import { smartSync, type SyncStatus } from "../core/smart-sync";

/**
 * Hook to access smart sync status.
 */
export function useSmartSync() {
  const [status, setStatus] = useState<SyncStatus>(smartSync.getStatus());

  useEffect(() => {
    const unsubscribe = smartSync.subscribe(setStatus);
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      const { AppState } = await import("react-native");
      if (cancelled) return;
      subscription = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") {
          smartSync.syncOnAppForeground();
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      subscription?.remove();
    };
  }, []);

  return {
    ...status,
    syncNow: () => smartSync.syncNow(),
    refreshPendingCount: () => smartSync.refreshPendingCount(),
    resumeSync: () => smartSync.resumeSync(),
  };
}
