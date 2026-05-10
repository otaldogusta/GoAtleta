import { isSupabaseConfigured } from "../api/config";
import { getValidAccessToken } from "../auth/session";
import {
  createInMemoryExerciseMediaStore,
  getExerciseMediaStoreKind,
  setExerciseMediaStore,
} from "./exercise-media-store";
import { seedExerciseMediaAssets } from "./exercise-media-registry";
import { SupabaseExerciseMediaStore } from "./stores/supabase-exercise-media-store";

type BootstrapExerciseMediaStoreOptions = {
  logger?: Pick<Console, "warn">;
};

let bootstrapPromise: Promise<"memory" | "supabase"> | null = null;

export async function bootstrapExerciseMediaStore(
  options: BootstrapExerciseMediaStoreOptions = {},
): Promise<"memory" | "supabase"> {
  if (getExerciseMediaStoreKind() === "supabase") {
    return "supabase";
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    if (!isSupabaseConfigured) {
      if (getExerciseMediaStoreKind() !== "memory") {
        setExerciseMediaStore(createInMemoryExerciseMediaStore(seedExerciseMediaAssets));
      }
      return "memory";
    }

    try {
      const token = await getValidAccessToken();
      if (!token) {
        if (getExerciseMediaStoreKind() !== "memory") {
          setExerciseMediaStore(createInMemoryExerciseMediaStore(seedExerciseMediaAssets));
        }
        return "memory";
      }

      const store = new SupabaseExerciseMediaStore();
      await store.hydrate();
      setExerciseMediaStore(store);
      return "supabase";
    } catch (error) {
      if (getExerciseMediaStoreKind() !== "memory") {
        setExerciseMediaStore(createInMemoryExerciseMediaStore(seedExerciseMediaAssets));
      }
      if (__DEV__) {
        options.logger?.warn?.(
          `[exercise-media] fallback para memória: ${
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

export function resetExerciseMediaStoreBootstrapForTests(): void {
  bootstrapPromise = null;
}

export function isSupabaseExerciseMediaStoreActive(): boolean {
  return getExerciseMediaStoreKind() === "supabase";
}
