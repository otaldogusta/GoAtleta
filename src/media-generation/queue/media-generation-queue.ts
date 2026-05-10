import type { MediaGenerationRequest } from "../media-generation.types";
import type {
  EnqueueMediaGenerationJobInput,
  MediaGenerationJob,
} from "./media-generation-job.types";

const DEFAULT_PROVIDER_ID = "higgsfield-mock";

const mediaGenerationJobs: MediaGenerationJob[] = [];

function now(): string {
  return new Date().toISOString();
}

function cloneRequest(request: MediaGenerationRequest): MediaGenerationRequest {
  return {
    ...request,
    notes: request.notes ? [...request.notes] : undefined,
    referenceUris: request.referenceUris ? [...request.referenceUris] : undefined,
    metadata: request.metadata ? { ...request.metadata } : undefined,
  };
}

function cloneJob(job: MediaGenerationJob): MediaGenerationJob {
  return {
    ...job,
    request: cloneRequest(job.request),
    result: job.result
      ? {
          ...job.result,
          asset: job.result.asset ? { ...job.result.asset } : null,
          metadata: job.result.metadata ? { ...job.result.metadata } : undefined,
        }
      : undefined,
  };
}

function buildJobId(input: EnqueueMediaGenerationJobInput): string {
  const seed = String(
    input.request.requestId ??
      input.request.exerciseKey ??
      input.request.exerciseName ??
      input.request.campaignKey ??
      input.request.coachId ??
      input.request.kind ??
      "job",
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `media-job-${seed || "request"}-${mediaGenerationJobs.length + 1}`;
}

export function enqueueMediaGenerationJob(
  input: EnqueueMediaGenerationJobInput,
): MediaGenerationJob {
  const timestamp = now();
  const job: MediaGenerationJob = {
    id: buildJobId(input),
    request: cloneRequest(input.request),
    status: "queued",
    providerId: String(input.providerId ?? DEFAULT_PROVIDER_ID).trim() || DEFAULT_PROVIDER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  mediaGenerationJobs.push(job);
  return cloneJob(job);
}

export function listMediaGenerationJobs(): MediaGenerationJob[] {
  return mediaGenerationJobs.map(cloneJob);
}

export function getMediaGenerationJob(id: string): MediaGenerationJob | null {
  const job = mediaGenerationJobs.find((entry) => entry.id === id);
  return job ? cloneJob(job) : null;
}

export function resetMediaGenerationQueue(): void {
  mediaGenerationJobs.splice(0, mediaGenerationJobs.length);
}

export function cancelMediaGenerationJob(id: string): MediaGenerationJob | null {
  const job = mediaGenerationJobs.find((entry) => entry.id === id);
  if (!job) {
    return null;
  }

  if (job.status !== "queued") {
    return cloneJob(job);
  }

  job.status = "cancelled";
  job.updatedAt = now();
  job.completedAt = job.updatedAt;
  return cloneJob(job);
}

export function updateMediaGenerationJob(
  id: string,
  updater: (job: MediaGenerationJob) => void,
): MediaGenerationJob | null {
  const job = mediaGenerationJobs.find((entry) => entry.id === id);
  if (!job) {
    return null;
  }

  updater(job);
  return cloneJob(job);
}
