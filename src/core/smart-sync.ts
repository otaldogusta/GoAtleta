import * as Sentry from "@sentry/react-native";
import { AppState, AppStateStatus } from "react-native";
import { flushPendingWrites, getPendingWritesCount } from "../db/seed";

const isSyncPausedError = (message: string) =>
  message.startsWith("SYNC_PAUSED_AUTH") || message.startsWith("SYNC_PAUSED_PERMISSION");

const getSyncPauseReason = (message: string): SyncPausedReason => {
  if (message.startsWith("SYNC_PAUSED_AUTH")) return "auth";
  if (message.startsWith("SYNC_PAUSED_PERMISSION")) return "permission";
  if (message.startsWith("SYNC_PAUSED_ORG_SWITCH")) return "org_switch";
  return null;
};

export type SyncPausedReason = "auth" | "permission" | "org_switch" | null;

type SyncListener = (status: SyncStatus) => void;

export type SyncStatus = {
  syncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncPausedReason: SyncPausedReason;
  lastFlushMs: number | null;
  lastFlushBatchSize: number;
  lastFlushedCount: number;
};

class SmartSyncService {
  private listeners: SyncListener[] = [];
  private status: SyncStatus = {
    syncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    syncPausedReason: null,
    lastFlushMs: null,
    lastFlushBatchSize: 0,
    lastFlushedCount: 0,
  };

  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSync: Promise<{ flushed: number; remaining: number }> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private isInitialized = false;
  private appStateSubscription: any = null;
  private syncGeneration = 0;

  /**
   * Initialize smart sync: listen to app state changes
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Refresh pending count immediately on init
    void this.refreshPendingCount();

    // Listen to app state changes (foreground/background)
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );

    // Initial sync after init
    this.scheduleSyncSoon("app_init");

    Sentry.addBreadcrumb({
      category: "sync",
      message: "SmartSync initialized",
      level: "info",
    });
  }

  /**
   * Cleanup listeners
   */
  destroy() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isInitialized = false;
  }

  /**
   * Subscribe to sync status updates
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    listener(this.status); // Emit current status immediately
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Manually trigger sync (used by "Sync Now" button)
   */
  async syncNow(): Promise<{ flushed: number; remaining: number }> {
    return this.performSync("manual");
  }

  resumeSync() {
    this.retryCount = 0;
    this.updateStatus({ syncPausedReason: null, lastError: null });
    this.scheduleSyncSoon("resume_manual");
  }

  handleOrganizationSwitch() {
    this.syncGeneration += 1;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.updateStatus({
      syncing: false,
      syncPausedReason: "org_switch",
      lastError: "SYNC_PAUSED_ORG_SWITCH",
    });
  }

  /**
   * Schedule sync after a successful write (debounced)
   */
  scheduleSyncAfterWrite() {
    this.scheduleSyncSoon("after_write");
  }

  /**
   * Handle app state change (foreground/background)
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === "active") {
      this.scheduleSyncSoon("app_foreground");
    }
  };

  /**
   * Schedule a sync attempt soon (with debounce)
   */
  private scheduleSyncSoon(reason: string) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Debounce: wait 2s before syncing
    this.syncTimer = setTimeout(() => {
      void this.performSync(reason);
    }, 2000);
  }

  /**
   * Perform the actual sync with backoff retry logic
   */
  private async performSync(
    reason: string
  ): Promise<{ flushed: number; remaining: number }> {
    if (this.status.syncPausedReason === "org_switch") {
      return { flushed: 0, remaining: await getPendingWritesCount() };
    }

    if (this.inFlightSync) {
      return this.inFlightSync;
    }

    const generationAtStart = this.syncGeneration;
    this.inFlightSync = (async () => {
      try {
        const startedAt = Date.now();
        // Update status: syncing started
        this.updateStatus({
          syncing: true,
          lastError: null,
          syncPausedReason: this.status.syncPausedReason === "org_switch" ? null : this.status.syncPausedReason,
        });

        Sentry.addBreadcrumb({
          category: "sync",
          message: `Sync started: ${reason}`,
          level: "info",
        });

        const result = await flushPendingWrites();
        const elapsedMs = Date.now() - startedAt;

        if (generationAtStart !== this.syncGeneration) {
          return { flushed: 0, remaining: await getPendingWritesCount() };
        }

        // Reset retry count on success (when queue is empty)
        if (result.remaining === 0) {
          this.retryCount = 0;
        }

        this.updateStatus({
          syncing: false,
          pendingCount: result.remaining,
          lastSyncAt: Date.now(),
          lastError: null,
          syncPausedReason: null,
          lastFlushMs: elapsedMs,
          lastFlushBatchSize: result.flushed + result.remaining,
          lastFlushedCount: result.flushed,
        });

        Sentry.addBreadcrumb({
          category: "sync",
          message: `Sync completed: ${result.flushed} flushed, ${result.remaining} remaining`,
          level: "info",
        });

        // Schedule next sync if there are remaining items (with backoff)
        if (result.remaining > 0) {
          this.scheduleNextSyncWithBackoff();
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const paused = isSyncPausedError(errorMessage);

        if (generationAtStart !== this.syncGeneration) {
          return { flushed: 0, remaining: await getPendingWritesCount() };
        }

        if (!paused) {
          this.retryCount++;
        }

        this.updateStatus({
          syncing: false,
          lastError: paused
            ? "Sync pausado: verifique sessão/permissões e tente novamente."
            : errorMessage,
          syncPausedReason: paused ? getSyncPauseReason(errorMessage) : null,
        });

        Sentry.captureException(error);

        Sentry.addBreadcrumb({
          category: "sync",
          message: paused ? "Sync paused" : "Sync failed",
          level: paused ? "warning" : "error",
          data: {
            paused,
            pauseReason: getSyncPauseReason(errorMessage) ?? undefined,
            retryCount: this.retryCount,
          },
        });

        // Schedule retry with exponential backoff if under max retries
        if (!paused && this.retryCount < this.maxRetries) {
          this.scheduleNextSyncWithBackoff();
        }

        return { flushed: 0, remaining: await getPendingWritesCount() };
      } finally {
        this.inFlightSync = null;
      }
    })();

    return this.inFlightSync;
  }

  /**
   * Schedule next sync with exponential backoff
   */
  private scheduleNextSyncWithBackoff() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Exponential backoff: 5s, 10s, 20s, 40s, 80s...
    const baseDelay = 5000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.retryCount),
      5 * 60 * 1000 // Max 5 minutes
    );
    const jitteredDelay = Math.round(delay * (0.85 + Math.random() * 0.3));

    this.syncTimer = setTimeout(() => {
      void this.performSync("backoff_retry");
    }, jitteredDelay);

    Sentry.addBreadcrumb({
      category: "sync",
      message: `Next sync scheduled in ${jitteredDelay}ms (retry ${this.retryCount}, base ${delay}ms)`,
      level: "info",
    });
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(updates: Partial<SyncStatus>) {
    this.status = { ...this.status, ...updates };
    this.listeners.forEach((listener) => listener(this.status));
  }

  /**
   * Refresh pending count (called periodically)
   */
  async refreshPendingCount() {
    const count = await getPendingWritesCount();
    this.updateStatus({ pendingCount: count });
    return count;
  }
}

// Singleton instance
export const smartSync = new SmartSyncService();
