import * as Sentry from "@sentry/react-native";
import { loadSession, type AuthSession } from "../auth/session";
import type { PedagogicalDimensionsConfig } from "../config/pedagogical-dimensions-config";
import { smartSync } from "../core/smart-sync";
import { flushPendingWrites } from "../db/seed";
import { initDb } from "../db/sqlite";
import { loadPedagogicalConfig } from "./pedagogical-config-loader";

export type BootstrapResult = {
  session?: AuthSession | null;
  pedagogicalConfig?: PedagogicalDimensionsConfig | null;
};

export async function bootstrapApp(): Promise<BootstrapResult> {
  const timeoutMs = 30000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Bootstrap timeout")), timeoutMs);
  });

  const started = Date.now();
  const result = await Promise.race([
    (async () => {
      const sessionStart = Date.now();
      const session = await loadSession();
      const sessionMs = Date.now() - sessionStart;
      if (__DEV__) {
        console.log(`[bootstrap] loadSession: ${sessionMs}ms`);
        try {
          // expose minimal bootstrap progress for web dev debugging
          // Avoid logging sensitive session contents.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).__BOOTSTRAP_LOGS = (globalThis as any).__BOOTSTRAP_LOGS || [];
          (globalThis as any).__BOOTSTRAP_LOGS.push(`loadSession:${sessionMs}ms`);
        } catch {}
      }
      Sentry.addBreadcrumb({
        category: "bootstrap",
        message: `loadSession: ${sessionMs}ms`,
        level: "info",
      });

      const dbStart = Date.now();
      await initDb();
      const dbMs = Date.now() - dbStart;
      if (__DEV__) {
        console.log(`[bootstrap] initDb: ${dbMs}ms`);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).__BOOTSTRAP_LOGS = (globalThis as any).__BOOTSTRAP_LOGS || [];
          (globalThis as any).__BOOTSTRAP_LOGS.push(`initDb:${dbMs}ms`);
        } catch {}
      }
      Sentry.addBreadcrumb({
        category: "bootstrap",
        message: `initDb: ${dbMs}ms`,
        level: "info",
      });

      const configStart = Date.now();
      const { config: pedagogicalConfig, error: configError } = await loadPedagogicalConfig();
      const configMs = Date.now() - configStart;
      if (__DEV__) {
        console.log(
          `[bootstrap] loadPedagogicalConfig: ${configMs}ms${configError ? " (with fallback)" : ""}`
        );
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).__BOOTSTRAP_LOGS = (globalThis as any).__BOOTSTRAP_LOGS || [];
          (globalThis as any).__BOOTSTRAP_LOGS.push(`loadPedagogicalConfig:${configMs}ms${configError?':fallback':''}`);
        } catch {}
      }
      if (configError) {
        Sentry.addBreadcrumb({
          category: "bootstrap",
          message: `loadPedagogicalConfig fallback: ${configError.message}`,
          level: "warning",
        });
      }

      void (async () => {
        try {
          await flushPendingWrites();
        } catch (error) {
          Sentry.captureException(error);
        } finally {
          // Initialize smart sync service after the critical bootstrap path completes.
          smartSync.init();
        }
      })();

      return { session, pedagogicalConfig };
    })(),
    timeout,
  ]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  });
  const totalMs = Date.now() - started;
  if (__DEV__) {
    console.log(`[bootstrap] total: ${totalMs}ms`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__BOOTSTRAP_LOGS = (globalThis as any).__BOOTSTRAP_LOGS || [];
      (globalThis as any).__BOOTSTRAP_LOGS.push(`total:${totalMs}ms`);
    } catch {}
  }
  Sentry.addBreadcrumb({
    category: "bootstrap",
    message: `total: ${totalMs}ms`,
    level: "info",
  });
  return result;
}
