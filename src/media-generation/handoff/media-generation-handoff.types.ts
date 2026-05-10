import type { MediaGenerationRequest } from "../media-generation.types";

export type MediaGenerationHandoffJobStatus =
  | "pending_agent"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type MediaGenerationHandoffJob = {
  id: string;
  organizationId?: string | null;
  providerId: string;
  status: MediaGenerationHandoffJobStatus;
  request: MediaGenerationRequest;
  prompt: string;
  errorMessage?: string;
  resultAssetUri?: string;
  resultThumbnailUri?: string;
  resultPayload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type MediaGenerationHandoffJobUpdater = (
  job: MediaGenerationHandoffJob,
) => MediaGenerationHandoffJob;

export type MediaGenerationHandoffStoreKind = "memory" | "supabase";

export interface MediaGenerationHandoffStore {
  kind: MediaGenerationHandoffStoreKind;
  list(): MediaGenerationHandoffJob[];
  getById(id: string): MediaGenerationHandoffJob | null;
  upsert(job: MediaGenerationHandoffJob): MediaGenerationHandoffJob;
  update(
    id: string,
    updater: MediaGenerationHandoffJobUpdater,
  ): MediaGenerationHandoffJob | null;
  reset(): void;
}

export interface HydratableMediaGenerationHandoffStore
  extends MediaGenerationHandoffStore {
  hydrate(): Promise<void>;
  persistUpsert(job: MediaGenerationHandoffJob): Promise<MediaGenerationHandoffJob>;
  persistUpdate(
    id: string,
    updater: MediaGenerationHandoffJobUpdater,
  ): Promise<MediaGenerationHandoffJob | null>;
}
