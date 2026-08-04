import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { smartSync, type SyncStatus } from "../core/smart-sync";

/**
 * Hook to access smart sync status.
 */
export function useSmartSync() {
  const [status, setStatus] = useState<SyncStatus>(smartSync.getStatus());

  useEffect(() => {
    const unsubscribe = smartSync.subscribe(setStatus);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          smartSync.syncOnAppForeground();
        }
      }
    );

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return {
    ...status,
    syncNow: () => smartSync.syncNow(),
    refreshPendingCount: () => smartSync.refreshPendingCount(),
    resumeSync: () => smartSync.resumeSync(),
  };
}
