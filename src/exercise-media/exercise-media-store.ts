import type { ExerciseMediaAsset } from "./exercise-media.types";
import type {
  ExerciseMediaStore,
  ExerciseMediaStoreKind,
  HydratableExerciseMediaStore,
} from "./exercise-media-store.types";
import { InMemoryExerciseMediaStore } from "./stores/in-memory-exercise-media-store";

let exerciseMediaStore: ExerciseMediaStore = new InMemoryExerciseMediaStore();

export function getExerciseMediaStore(): ExerciseMediaStore {
  return exerciseMediaStore;
}

export function getExerciseMediaStoreKind(): ExerciseMediaStoreKind {
  return exerciseMediaStore.kind;
}

export function setExerciseMediaStore(store: ExerciseMediaStore): ExerciseMediaStore {
  exerciseMediaStore = store;
  return exerciseMediaStore;
}

export function createInMemoryExerciseMediaStore(
  initialAssets: ExerciseMediaAsset[] = [],
): ExerciseMediaStore {
  return new InMemoryExerciseMediaStore(initialAssets);
}

export function isHydratableExerciseMediaStore(
  store: ExerciseMediaStore,
): store is HydratableExerciseMediaStore {
  return (
    typeof (store as Partial<HydratableExerciseMediaStore>).hydrate === "function" &&
    typeof (store as Partial<HydratableExerciseMediaStore>).persistUpsert === "function" &&
    typeof (store as Partial<HydratableExerciseMediaStore>).persistUpdate === "function"
  );
}
