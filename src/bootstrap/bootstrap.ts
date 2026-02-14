import * as Sentry from "@sentry/react-native";
import type { AuthSession } from "../auth/session";
import { loadSession } from "../auth/session";
import { smartSync } from "../core/smart-sync";
import { flushPendingWrites } from "../db/seed";
import { initDb } from "../db/sqlite";

export type BootstrapResult = {
  session: AuthSession | null;
};

export async function bootstrapApp(): Promise<BootstrapResult> {
  const timeoutMs = 12000;
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Bootstrap timeout")), timeoutMs);
  });

  const started = Date.now();
  const result = await Promise.race([
    (async () => {
      const dbStart = Date.now();
      await initDb();
      const dbMs = Date.now() - dbStart;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[bootstrap] initDb: ${dbMs}ms`);
      }
      Sentry.addBreadcrumb({
        category: "bootstrap",
        message: `initDb: ${dbMs}ms`,
        level: "info",
      });

      const sessionStart = Date.now();
      const session = await loadSession();
      const sessionMs = Date.now() - sessionStart;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[bootstrap] loadSession: ${sessionMs}ms`);
      }
      Sentry.addBreadcrumb({
        category: "bootstrap",
        message: `loadSession: ${sessionMs}ms`,
        level: "info",
      });

      try {
        await flushPendingWrites();
      } catch (error) {
        Sentry.captureException(error);
      }

      // Initialize smart sync service
      smartSync.init();

      return { session } as BootstrapResult;
    })(),
    timeout,
  ]);
  const totalMs = Date.now() - started;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] total: ${totalMs}ms`);
  }
  Sentry.addBreadcrumb({
    category: "bootstrap",
    message: `total: ${totalMs}ms`,
    level: "info",
  });
  return result;
}
