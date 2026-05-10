import { isSupabaseConfigured } from "../../api/config";
import { getValidAccessToken } from "../../auth/session";
import {
  createInMemoryMediaGenerationHandoffStore,
  getMediaGenerationHandoffStoreKind,
  setMediaGenerationHandoffStore,
} from "./media-generation-handoff-store";
import { SupabaseMediaGenerationHandoffStore } from "./stores/supabase-media-generation-handoff-store";

type BootstrapMediaGenerationHandoffStoreOptions = {
  logger?: Pick<Console, "warn">;
};

let bootstrapPromise: Promise<"memory" | "supabase"> | null = null;

export async function bootstrapMediaGenerationHandoffStore(
  options: BootstrapMediaGenerationHandoffStoreOptions = {},
): Promise<"memory" | "supabase"> {
  if (getMediaGenerationHandoffStoreKind() === "supabase") {
    return "supabase";
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    if (!isSupabaseConfigured) {
      if (getMediaGenerationHandoffStoreKind() !== "memory") {
        setMediaGenerationHandoffStore(createInMemoryMediaGenerationHandoffStore());
      }
      return "memory";
    }

    try {
      const token = await getValidAccessToken();
      if (!token) {
        if (getMediaGenerationHandoffStoreKind() !== "memory") {
          setMediaGenerationHandoffStore(createInMemoryMediaGenerationHandoffStore());
        }
        return "memory";
      }

      const store = new SupabaseMediaGenerationHandoffStore();
      await store.hydrate();
      setMediaGenerationHandoffStore(store);
      return "supabase";
    } catch (error) {
      if (getMediaGenerationHandoffStoreKind() !== "memory") {
        setMediaGenerationHandoffStore(createInMemoryMediaGenerationHandoffStore());
      }
      if (__DEV__) {
        options.logger?.warn?.(
          `[media-generation-handoff] fallback para memória: ${
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

export function resetMediaGenerationHandoffStoreBootstrapForTests(): void {
  bootstrapPromise = null;
}
