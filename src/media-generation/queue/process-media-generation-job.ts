import type { MediaGenerationProvider } from "../media-generation-provider";
import type { MediaGenerationJob } from "./media-generation-job.types";
import {
  getMediaGenerationJob,
  listMediaGenerationJobs,
  updateMediaGenerationJob,
} from "./media-generation-queue";

function now(): string {
  return new Date().toISOString();
}

export async function processMediaGenerationJob(
  id: string,
  provider: MediaGenerationProvider,
): Promise<MediaGenerationJob | null> {
  const existing = getMediaGenerationJob(id);
  if (!existing) {
    return null;
  }

  if (existing.status !== "queued") {
    return existing;
  }

  updateMediaGenerationJob(id, (job) => {
    job.status = "processing";
    job.updatedAt = now();
    job.errorMessage = undefined;
  });

  try {
    const result = await provider.generate(existing.request);

    return updateMediaGenerationJob(id, (job) => {
      job.result = result;
      job.updatedAt = now();
      job.completedAt = job.updatedAt;

      if (result.status === "completed") {
        job.status = "completed";
        job.errorMessage = undefined;
        return;
      }

      job.status = "failed";
      job.errorMessage = result.error ?? "Media generation failed";
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media generation failed";
    return updateMediaGenerationJob(id, (job) => {
      job.status = "failed";
      job.errorMessage = message;
      job.updatedAt = now();
      job.completedAt = job.updatedAt;
    });
  }
}

export async function processNextMediaGenerationJob(
  provider: MediaGenerationProvider,
): Promise<MediaGenerationJob | null> {
  const nextJob = listMediaGenerationJobs().find((job) => job.status === "queued");
  if (!nextJob) {
    return null;
  }

  return processMediaGenerationJob(nextJob.id, provider);
}
