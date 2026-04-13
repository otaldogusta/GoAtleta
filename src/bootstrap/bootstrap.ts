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
  const timeoutMs = 12000;
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
      }
      if (configError) {
        Sentry.captureException(configError, {
          tags: { bootstrap_phase: "pedagogical-config" },
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
  }
  Sentry.addBreadcrumb({
    category: "bootstrap",
    message: `total: ${totalMs}ms`,
    level: "info",
  });
  return result;
}
