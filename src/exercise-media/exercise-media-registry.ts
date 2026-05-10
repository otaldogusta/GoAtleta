import {
  createInMemoryExerciseMediaStore,
  getExerciseMediaStore,
  isHydratableExerciseMediaStore,
  setExerciseMediaStore,
} from "./exercise-media-store";
import type { ExerciseMediaAsset } from "./exercise-media.types";

export const seedExerciseMediaAssets: ExerciseMediaAsset[] = [];

setExerciseMediaStore(createInMemoryExerciseMediaStore(seedExerciseMediaAssets));

export function registerExerciseMediaAsset(
  asset: ExerciseMediaAsset
): ExerciseMediaAsset {
  return getExerciseMediaStore().upsert(asset);
}

export function getExerciseMediaAssetById(id: string): ExerciseMediaAsset | null {
  return getExerciseMediaStore().getById(id);
}

export function updateExerciseMediaAsset(
  id: string,
  updater: (asset: ExerciseMediaAsset) => ExerciseMediaAsset
): ExerciseMediaAsset | null {
  return getExerciseMediaStore().update(id, updater);
}

export function listExerciseMediaAssets(): ExerciseMediaAsset[] {
  return getExerciseMediaStore().list();
}

export function resetExerciseMediaRegistry(): void {
  setExerciseMediaStore(createInMemoryExerciseMediaStore(seedExerciseMediaAssets));
}

export async function persistExerciseMediaAsset(
  asset: ExerciseMediaAsset,
): Promise<ExerciseMediaAsset> {
  const store = getExerciseMediaStore();
  if (isHydratableExerciseMediaStore(store)) {
    return store.persistUpsert(asset);
  }

  return registerExerciseMediaAsset(asset);
}

export async function persistUpdatedExerciseMediaAsset(
  id: string,
  updater: (asset: ExerciseMediaAsset) => ExerciseMediaAsset,
): Promise<ExerciseMediaAsset | null> {
  const store = getExerciseMediaStore();
  if (isHydratableExerciseMediaStore(store)) {
    return store.persistUpdate(id, updater);
  }

  return updateExerciseMediaAsset(id, updater);
}
