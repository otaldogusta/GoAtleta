import type { ExerciseMediaAsset } from "./exercise-media.types";
import {
  listExerciseMediaAssets,
  registerExerciseMediaAsset,
} from "./exercise-media-registry";

export const devExerciseMediaAssets: ExerciseMediaAsset[] = [
  {
    id: "dev-stiff-video",
    exerciseKey: "stiff",
    title: "Demonstração do stiff",
    kind: "video",
    source: "seed",
    status: "approved",
    uri: "https://example.com/stiff-demo.mp4",
    thumbnailUri: "https://example.com/stiff-thumb.png",
    tags: ["membros inferiores", "posterior", "academia"],
    createdAt: "2026-05-08T00:00:00.000Z",
  },
  {
    id: "dev-agachamento-video",
    exerciseKey: "agachamento",
    title: "Demonstração do agachamento",
    kind: "video",
    source: "seed",
    status: "approved",
    uri: "https://example.com/agachamento-demo.mp4",
    tags: ["membros inferiores", "força", "academia"],
    createdAt: "2026-05-08T00:00:00.000Z",
  },
  {
    id: "dev-core-anti-rotacao-video",
    exerciseKey: "core-anti-rotacao",
    title: "Demonstração do core anti-rotação",
    kind: "video",
    source: "seed",
    status: "approved",
    uri: "https://example.com/core-anti-rotacao-demo.mp4",
    tags: ["core", "prevenção", "academia"],
    createdAt: "2026-05-08T00:00:00.000Z",
  },
];

export function registerDevExerciseMediaAssets(): ExerciseMediaAsset[] {
  const existingIds = new Set(listExerciseMediaAssets().map((asset) => asset.id));

  for (const asset of devExerciseMediaAssets) {
    if (existingIds.has(asset.id)) {
      continue;
    }
    registerExerciseMediaAsset(asset);
    existingIds.add(asset.id);
  }

  return listExerciseMediaAssets();
}
