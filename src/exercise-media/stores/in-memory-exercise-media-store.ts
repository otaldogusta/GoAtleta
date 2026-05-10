import type {
  ExerciseMediaAssetUpdater,
  ExerciseMediaStore,
} from "../exercise-media-store.types";
import type { ExerciseMediaAsset } from "../exercise-media.types";

function cloneAssets(assets: ExerciseMediaAsset[]): ExerciseMediaAsset[] {
  return assets.map((asset) => ({ ...asset }));
}

export class InMemoryExerciseMediaStore implements ExerciseMediaStore {
  readonly kind = "memory" as const;

  private readonly initialAssets: ExerciseMediaAsset[];

  private assets: ExerciseMediaAsset[];

  constructor(initialAssets: ExerciseMediaAsset[] = []) {
    this.initialAssets = cloneAssets(initialAssets);
    this.assets = cloneAssets(initialAssets);
  }

  list(): ExerciseMediaAsset[] {
    return cloneAssets(this.assets);
  }

  getById(id: string): ExerciseMediaAsset | null {
    const asset = this.assets.find((entry) => entry.id === id);
    return asset ? { ...asset } : null;
  }

  upsert(asset: ExerciseMediaAsset): ExerciseMediaAsset {
    const existingIndex = this.assets.findIndex((entry) => entry.id === asset.id);
    if (existingIndex < 0) {
      this.assets = [...this.assets, { ...asset }];
      return { ...asset };
    }

    const existing = this.assets[existingIndex];
    if (existing.status === "approved" && asset.status === "draft") {
      return { ...existing };
    }

    this.assets[existingIndex] = { ...asset };
    return { ...this.assets[existingIndex] };
  }

  update(
    id: string,
    updater: ExerciseMediaAssetUpdater,
  ): ExerciseMediaAsset | null {
    const existingIndex = this.assets.findIndex((entry) => entry.id === id);
    if (existingIndex < 0) {
      return null;
    }

    const next = updater({ ...this.assets[existingIndex] });
    this.assets[existingIndex] = { ...next };
    return { ...this.assets[existingIndex] };
  }

  remove(id: string): boolean {
    const next = this.assets.filter((asset) => asset.id !== id);
    const removed = next.length !== this.assets.length;
    this.assets = next;
    return removed;
  }

  reset(): void {
    this.assets = cloneAssets(this.initialAssets);
  }
}
