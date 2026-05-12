import { isSupabaseConfigured } from "../../api/config";
import { getValidAccessToken } from "../../auth/session";
import {
  createLocalScoutingActionStore,
  getScoutingActionStoreKind,
  setScoutingActionStore,
} from "./scouting-action-store";
import {
  createLocalScoutingSessionStore,
  getScoutingSessionStoreKind,
  setScoutingSessionStore,
} from "./scouting-session-store";
import { SupabaseScoutingActionStore } from "./stores/supabase-scouting-action-store";
import { SupabaseScoutingSessionStore } from "./stores/supabase-scouting-session-store";

type BootstrapScoutingStoresOptions = {
  logger?: Pick<Console, "warn">;
};

let bootstrapPromise: Promise<"memory" | "supabase"> | null = null;

export async function bootstrapScoutingStores(
  options: BootstrapScoutingStoresOptions = {},
): Promise<"memory" | "supabase"> {
  if (getScoutingSessionStoreKind() === "supabase" && getScoutingActionStoreKind() === "supabase") {
    return "supabase";
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    if (!isSupabaseConfigured) {
      setMemoryStores();
      return "memory";
    }

    try {
      const token = await getValidAccessToken();
      if (!token) {
        setMemoryStores();
        return "memory";
      }

      const sessionStore = new SupabaseScoutingSessionStore();
      const actionStore = new SupabaseScoutingActionStore();
      await Promise.all([sessionStore.hydrate(), actionStore.hydrate()]);
      setScoutingSessionStore(sessionStore);
      setScoutingActionStore(actionStore);
      return "supabase";
    } catch (error) {
      setMemoryStores();
      if (__DEV__) {
        options.logger?.warn?.(
          `[scouting] fallback para cache local: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return "memory";
    }
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export function resetScoutingStoresBootstrapForTests(): void {
  bootstrapPromise = null;
}

function setMemoryStores(): void {
  if (getScoutingSessionStoreKind() !== "memory") {
    setScoutingSessionStore(createLocalScoutingSessionStore());
  }
  if (getScoutingActionStoreKind() !== "memory") {
    setScoutingActionStore(createLocalScoutingActionStore());
  }
}
