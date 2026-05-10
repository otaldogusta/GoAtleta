import {
  listExerciseMediaAssets,
  persistExerciseMediaAsset,
} from "../exercise-media/exercise-media-registry";
import type { ExerciseMediaAsset } from "../exercise-media/exercise-media.types";
import type { MediaGenerationProvider } from "./media-generation-provider";
import type { MediaGenerationResult } from "./media-generation.types";
import type { MediaGenerationJob } from "./queue/media-generation-job.types";
import { processMediaGenerationJob } from "./queue/process-media-generation-job";

function isExerciseMediaAsset(value: unknown): value is ExerciseMediaAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const asset = value as Partial<ExerciseMediaAsset>;
  return (
    typeof asset.id === "string" &&
    typeof asset.exerciseKey === "string" &&
    typeof asset.title === "string" &&
    (asset.kind === "video" || asset.kind === "image" || asset.kind === "thumbnail" || asset.kind === "qr") &&
    typeof asset.uri === "string"
  );
}

function normalizeDraftAsset(asset: ExerciseMediaAsset): ExerciseMediaAsset {
  const createdAt = String(asset.createdAt ?? "").trim() || new Date().toISOString();

  return {
    ...asset,
    status: "draft",
    source: asset.source ?? "higgsfield",
    createdAt,
    updatedAt: asset.updatedAt ?? createdAt,
  };
}

export function extractExerciseMediaAssetsFromResult(
  result: MediaGenerationResult,
): ExerciseMediaAsset[] {
  if (result.status !== "completed" || !isExerciseMediaAsset(result.asset)) {
    return [];
  }

  return [normalizeDraftAsset(result.asset)];
}

export async function registerGeneratedMediaAssetsFromJob(
  job: MediaGenerationJob,
): Promise<ExerciseMediaAsset[]> {
  if (job.status !== "completed" || !job.result) {
    return [];
  }

  const assets = extractExerciseMediaAssetsFromResult(job.result);
  if (assets.length === 0) {
    return [];
  }

  return Promise.all(assets.map(async (asset) => {
    const normalized = normalizeDraftAsset(asset);
    const existing = listExerciseMediaAssets().find((entry) => entry.id === normalized.id);

    if (existing?.status === "approved") {
      return existing;
    }

    if (
      existing &&
      existing.status === normalized.status &&
      existing.uri === normalized.uri &&
      existing.exerciseKey === normalized.exerciseKey
    ) {
      return existing;
    }

    return persistExerciseMediaAsset(normalized);
  }));
}

export async function processAndRegisterGeneratedMediaJob(
  id: string,
  provider: MediaGenerationProvider,
): Promise<{ job: MediaGenerationJob | null; registeredAssets: ExerciseMediaAsset[] }> {
  const job = await processMediaGenerationJob(id, provider);

  if (!job || job.status !== "completed") {
    return {
      job,
      registeredAssets: [],
    };
  }

  return {
    job,
    registeredAssets: await registerGeneratedMediaAssetsFromJob(job),
  };
}
