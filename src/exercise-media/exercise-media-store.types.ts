import type { ExerciseMediaAsset } from "./exercise-media.types";

export type ExerciseMediaStoreKind = "memory" | "supabase";

export type ExerciseMediaAssetUpdater = (
  asset: ExerciseMediaAsset,
) => ExerciseMediaAsset;

export interface ExerciseMediaStore {
  kind: ExerciseMediaStoreKind;
  list(): ExerciseMediaAsset[];
  getById(id: string): ExerciseMediaAsset | null;
  upsert(asset: ExerciseMediaAsset): ExerciseMediaAsset;
  update(
    id: string,
    updater: ExerciseMediaAssetUpdater,
  ): ExerciseMediaAsset | null;
  remove?(id: string): boolean;
  reset(): void;
}

export interface HydratableExerciseMediaStore extends ExerciseMediaStore {
  hydrate(): Promise<void>;
  persistUpsert(asset: ExerciseMediaAsset): Promise<ExerciseMediaAsset>;
  persistUpdate(
    id: string,
    updater: ExerciseMediaAssetUpdater,
  ): Promise<ExerciseMediaAsset | null>;
}
