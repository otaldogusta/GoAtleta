import {
  supabaseGet,
  supabasePost,
} from "../../db/client";
import type {
  ExerciseMediaAssetUpdater,
  HydratableExerciseMediaStore,
} from "../exercise-media-store.types";
import type { ExerciseMediaAsset } from "../exercise-media.types";
import {
  fromExerciseMediaAssetRow,
  toExerciseMediaAssetRow,
  type ExerciseMediaAssetRow,
} from "./supabase-exercise-media-mappers";

function cloneAsset(asset: ExerciseMediaAsset): ExerciseMediaAsset {
  return { ...asset, tags: asset.tags ? [...asset.tags] : undefined };
}

function cloneAssets(assets: ExerciseMediaAsset[]): ExerciseMediaAsset[] {
  return assets.map(cloneAsset);
}

export class SupabaseExerciseMediaStore implements HydratableExerciseMediaStore {
  readonly kind = "supabase" as const;

  private assets: ExerciseMediaAsset[] = [];

  list(): ExerciseMediaAsset[] {
    return cloneAssets(this.assets);
  }

  getById(id: string): ExerciseMediaAsset | null {
    const asset = this.assets.find((entry) => entry.id === id);
    return asset ? cloneAsset(asset) : null;
  }

  upsert(asset: ExerciseMediaAsset): ExerciseMediaAsset {
    const existingIndex = this.assets.findIndex((entry) => entry.id === asset.id);
    if (existingIndex < 0) {
      this.assets = [...this.assets, cloneAsset(asset)];
      return cloneAsset(asset);
    }

    const existing = this.assets[existingIndex];
    if (existing.status === "approved" && asset.status === "draft") {
      return cloneAsset(existing);
    }

    this.assets[existingIndex] = cloneAsset(asset);
    return cloneAsset(this.assets[existingIndex]);
  }

  update(
    id: string,
    updater: ExerciseMediaAssetUpdater,
  ): ExerciseMediaAsset | null {
    const existingIndex = this.assets.findIndex((entry) => entry.id === id);
    if (existingIndex < 0) {
      return null;
    }

    const next = updater(cloneAsset(this.assets[existingIndex]));
    this.assets[existingIndex] = cloneAsset(next);
    return cloneAsset(this.assets[existingIndex]);
  }

  reset(): void {
    // Real data store: no destructive reset in runtime/tests.
  }

  async hydrate(): Promise<void> {
    const rows = await supabaseGet<ExerciseMediaAssetRow[]>(
      "/exercise_media_assets?select=*&order=created_at.desc",
    );
    this.assets = cloneAssets(rows.map(fromExerciseMediaAssetRow));
  }

  async persistUpsert(asset: ExerciseMediaAsset): Promise<ExerciseMediaAsset> {
    const existing = this.getById(asset.id);
    if (existing?.status === "approved" && asset.status === "draft") {
      return existing;
    }

    const rows = await supabasePost<ExerciseMediaAssetRow[]>(
      "/exercise_media_assets",
      [toExerciseMediaAssetRow(asset)],
      {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    );
    const persisted = fromExerciseMediaAssetRow(rows[0] ?? toExerciseMediaAssetRow(asset));
    return this.upsert(persisted);
  }

  async persistUpdate(
    id: string,
    updater: ExerciseMediaAssetUpdater,
  ): Promise<ExerciseMediaAsset | null> {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const next = updater(existing);
    return this.persistUpsert(next);
  }
}
