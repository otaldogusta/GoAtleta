import type {
  MediaGenerationRequest,
  MediaGenerationResult,
} from "../media-generation.types";

export type MediaGenerationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type MediaGenerationJob = {
  id: string;
  request: MediaGenerationRequest;
  status: MediaGenerationJobStatus;
  providerId: string;
  result?: MediaGenerationResult;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type EnqueueMediaGenerationJobInput = {
  request: MediaGenerationRequest;
  providerId?: string;
};
