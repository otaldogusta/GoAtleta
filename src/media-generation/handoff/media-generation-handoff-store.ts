import type {
  HydratableMediaGenerationHandoffStore,
  MediaGenerationHandoffJob,
  MediaGenerationHandoffStore,
  MediaGenerationHandoffStoreKind,
} from "./media-generation-handoff.types";
import { InMemoryMediaGenerationHandoffStore } from "./stores/in-memory-media-generation-handoff-store";

let handoffStore: MediaGenerationHandoffStore = new InMemoryMediaGenerationHandoffStore();

export function getMediaGenerationHandoffStore(): MediaGenerationHandoffStore {
  return handoffStore;
}

export function getMediaGenerationHandoffStoreKind(): MediaGenerationHandoffStoreKind {
  return handoffStore.kind;
}

export function setMediaGenerationHandoffStore(
  store: MediaGenerationHandoffStore,
): MediaGenerationHandoffStore {
  handoffStore = store;
  return handoffStore;
}

export function createInMemoryMediaGenerationHandoffStore(
  initialJobs: MediaGenerationHandoffJob[] = [],
): MediaGenerationHandoffStore {
  return new InMemoryMediaGenerationHandoffStore(initialJobs);
}

export function isHydratableMediaGenerationHandoffStore(
  store: MediaGenerationHandoffStore,
): store is HydratableMediaGenerationHandoffStore {
  return (
    typeof (store as Partial<HydratableMediaGenerationHandoffStore>).hydrate === "function" &&
    typeof (store as Partial<HydratableMediaGenerationHandoffStore>).persistUpsert === "function" &&
    typeof (store as Partial<HydratableMediaGenerationHandoffStore>).persistUpdate === "function"
  );
}
