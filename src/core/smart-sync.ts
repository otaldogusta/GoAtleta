import * as Sentry from "@sentry/react-native";
import { AppState, AppStateStatus } from "react-native";
import { flushPendingWrites, getPendingWritesCount } from "../db/seed";

type SyncListener = (status: SyncStatus) => void;

export type SyncStatus = {
  syncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
};

class SmartSyncService {
  private listeners: SyncListener[] = [];
  private status: SyncStatus = {
    syncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  };

  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private isInitialized = false;
  private appStateSubscription: any = null;

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
    // Don't sync if already syncing
    if (this.status.syncing) {
      return { flushed: 0, remaining: this.status.pendingCount };
    }

    try {
      // Update status: syncing started
      this.updateStatus({ syncing: true, lastError: null });

      Sentry.addBreadcrumb({
        category: "sync",
        message: `Sync started: ${reason}`,
        level: "info",
      });

      const result = await flushPendingWrites();

      // Reset retry count on success (when queue is empty)
      if (result.remaining === 0) {
        this.retryCount = 0;
      }

      this.updateStatus({
        syncing: false,
        pendingCount: result.remaining,
        lastSyncAt: Date.now(),
        lastError: null,
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
      this.retryCount++;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.updateStatus({
        syncing: false,
        lastError: errorMessage,
      });

      Sentry.captureException(error);

      // Schedule retry with exponential backoff if under max retries
      if (this.retryCount < this.maxRetries) {
        this.scheduleNextSyncWithBackoff();
      }

      return { flushed: 0, remaining: await getPendingWritesCount() };
    }
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
