import { useEffect, useState } from "react";
import { smartSync, type SyncStatus } from "./smart-sync";

/**
 * Hook to access smart sync status
 */
export function useSmartSync() {
  const [status, setStatus] = useState<SyncStatus>(smartSync.getStatus());

  useEffect(() => {
    const unsubscribe = smartSync.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return {
    ...status,
    syncNow: () => smartSync.syncNow(),
    refreshPendingCount: () => smartSync.refreshPendingCount(),
    resumeSync: () => smartSync.resumeSync(),
  };
}
