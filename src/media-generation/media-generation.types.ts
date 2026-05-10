import type { ExerciseMediaAsset } from "../exercise-media/exercise-media.types";

export type MediaAssetSource = "higgsfield" | "upload" | "manual" | "seed" | "external";
export type MediaAssetStatus = "draft" | "approved" | "archived";

export type MediaAsset = {
  id: string;
  name: string;
  source: MediaAssetSource;
  status: MediaAssetStatus;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
};

export type CoachAvatarAsset = MediaAsset & {
  coachId?: string;
  soulId?: string;
};

export type MarketingAsset = MediaAsset & {
  campaignKey?: string;
  surface?: "instagram" | "whatsapp" | "pdf" | "web";
};

export type MediaGenerationKind =
  | "exercise_video"
  | "exercise_image"
  | "coach_avatar"
  | "marketing_card";

export type MediaGenerationStatus = "queued" | "processing" | "completed" | "failed";

export type MediaGenerationMetadataValue = string | number | boolean | null;

export type MediaGenerationRequest = {
  requestId?: string;
  kind: MediaGenerationKind;
  title?: string;
  exerciseName?: string;
  exerciseKey?: string;
  modality?: string;
  sport?: string;
  ageBand?: string;
  level?: string;
  coachId?: string;
  campaignKey?: string;
  surface?: "instagram" | "whatsapp" | "pdf" | "web";
  prompt?: string;
  notes?: string[];
  referenceUris?: string[];
  requestedAt?: string;
  metadata?: Record<string, MediaGenerationMetadataValue>;
};

export type MediaGenerationOutputAsset =
  | ExerciseMediaAsset
  | CoachAvatarAsset
  | MarketingAsset
  | MediaAsset;

export type MediaGenerationResult = {
  requestId: string;
  providerName: string;
  kind: MediaGenerationKind;
  status: MediaGenerationStatus;
  prompt: string;
  asset: MediaGenerationOutputAsset | null;
  error?: string;
  completedAt?: string;
  metadata?: Record<string, MediaGenerationMetadataValue>;
};
