export type ExerciseMediaKind = "image" | "video" | "thumbnail" | "qr";

export type ExerciseMediaSource =
  | "manual"
  | "upload"
  | "higgsfield"
  | "seed"
  | "external";

export type ExerciseMediaStatus = "draft" | "approved" | "archived";

export type ExerciseMediaAsset = {
  id: string;
  exerciseKey: string;
  title: string;
  kind: ExerciseMediaKind;
  source: ExerciseMediaSource;
  status: ExerciseMediaStatus;
  uri: string;
  thumbnailUri?: string;
  qrUri?: string;
  modality?: string;
  sport?: string;
  ageBand?: string;
  level?: "iniciante" | "intermediario" | "avancado" | string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvalNote?: string;
  approvedAt?: string;
  archivedBy?: string;
  archiveNote?: string;
  archivedAt?: string;
};

export type ExerciseMediaResolutionInput = {
  exerciseName: string;
  modality?: string;
  sport?: string;
  ageBand?: string;
  level?: string;
  preferredKind?: ExerciseMediaKind;
  tags?: string[];
};

export type ExerciseMediaResolutionReason =
  | "exact_match"
  | "normalized_name_match"
  | "tag_match"
  | "fallback_match"
  | "not_found";

export type ExerciseMediaResolutionResult = {
  asset: ExerciseMediaAsset | null;
  reason: ExerciseMediaResolutionReason;
  candidates: ExerciseMediaAsset[];
};
