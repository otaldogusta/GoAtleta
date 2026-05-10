import {
  getExerciseMediaAssetById,
  listExerciseMediaAssets,
  persistUpdatedExerciseMediaAsset,
} from "./exercise-media-registry";
import type { ExerciseMediaAsset } from "./exercise-media.types";

type ApprovalOptions = {
  by?: string;
  note?: string;
  at?: string;
};

function now(): string {
  return new Date().toISOString();
}

function timestamp(options?: ApprovalOptions): string {
  return String(options?.at ?? "").trim() || now();
}

export function listDraftMediaAssets(): ExerciseMediaAsset[] {
  return listExerciseMediaAssets().filter((asset) => asset.status === "draft");
}

export function listApprovedMediaAssets(): ExerciseMediaAsset[] {
  return listExerciseMediaAssets().filter((asset) => asset.status === "approved");
}

export function listArchivedMediaAssets(): ExerciseMediaAsset[] {
  return listExerciseMediaAssets().filter((asset) => asset.status === "archived");
}

export { getExerciseMediaAssetById } from "./exercise-media-registry";

export async function approveExerciseMediaAsset(
  id: string,
  options?: ApprovalOptions,
): Promise<ExerciseMediaAsset | null> {
  const existing = getExerciseMediaAssetById(id);
  if (!existing) {
    return null;
  }

  if (existing.status === "approved") {
    return existing;
  }

  if (existing.status === "archived") {
    return null;
  }

  return persistUpdatedExerciseMediaAsset(id, (asset) => ({
    ...asset,
    status: "approved",
    approvedBy: options?.by ?? asset.approvedBy,
    approvalNote: options?.note ?? asset.approvalNote,
    approvedAt: timestamp(options),
    updatedAt: timestamp(options),
  }));
}

export async function archiveExerciseMediaAsset(
  id: string,
  options?: ApprovalOptions,
): Promise<ExerciseMediaAsset | null> {
  const existing = getExerciseMediaAssetById(id);
  if (!existing) {
    return null;
  }

  if (existing.status === "archived") {
    return existing;
  }

  return persistUpdatedExerciseMediaAsset(id, (asset) => ({
    ...asset,
    status: "archived",
    archivedBy: options?.by ?? asset.archivedBy,
    archiveNote: options?.note ?? asset.archiveNote,
    archivedAt: timestamp(options),
    updatedAt: timestamp(options),
  }));
}

export async function rejectExerciseMediaAsset(
  id: string,
  options?: ApprovalOptions,
): Promise<ExerciseMediaAsset | null> {
  return archiveExerciseMediaAsset(id, options);
}
