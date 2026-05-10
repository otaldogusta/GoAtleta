import type { ExerciseMediaAsset } from "../exercise-media.types";

export type ExerciseMediaAssetRow = {
  id: string;
  organization_id: string | null;
  exercise_key: string;
  title: string;
  kind: ExerciseMediaAsset["kind"];
  source: ExerciseMediaAsset["source"];
  status: ExerciseMediaAsset["status"];
  uri: string;
  thumbnail_uri: string | null;
  qr_uri: string | null;
  modality: string | null;
  sport: string | null;
  age_band: string | null;
  level: string | null;
  tags: unknown;
  approved_by: string | null;
  approval_note: string | null;
  approved_at: string | null;
  archived_by: string | null;
  archive_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
};

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export function toExerciseMediaAssetRow(
  asset: ExerciseMediaAsset,
): ExerciseMediaAssetRow {
  return {
    id: asset.id,
    organization_id: null,
    exercise_key: asset.exerciseKey,
    title: asset.title,
    kind: asset.kind,
    source: asset.source,
    status: asset.status,
    uri: asset.uri,
    thumbnail_uri: asset.thumbnailUri ?? null,
    qr_uri: asset.qrUri ?? null,
    modality: asset.modality ?? null,
    sport: asset.sport ?? null,
    age_band: asset.ageBand ?? null,
    level: asset.level ?? null,
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    approved_by: asset.approvedBy ?? null,
    approval_note: asset.approvalNote ?? null,
    approved_at: asset.approvedAt ?? null,
    archived_by: asset.archivedBy ?? null,
    archive_note: asset.archiveNote ?? null,
    archived_at: asset.archivedAt ?? null,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt ?? null,
  };
}

export function fromExerciseMediaAssetRow(
  row: ExerciseMediaAssetRow,
): ExerciseMediaAsset {
  return {
    id: row.id,
    exerciseKey: row.exercise_key,
    title: row.title,
    kind: row.kind,
    source: row.source,
    status: row.status,
    uri: row.uri,
    thumbnailUri: row.thumbnail_uri ?? undefined,
    qrUri: row.qr_uri ?? undefined,
    modality: row.modality ?? undefined,
    sport: row.sport ?? undefined,
    ageBand: row.age_band ?? undefined,
    level: row.level ?? undefined,
    tags: normalizeTags(row.tags),
    approvedBy: row.approved_by ?? undefined,
    approvalNote: row.approval_note ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    archiveNote: row.archive_note ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}
