import { bootstrapExerciseMediaStore } from "../../exercise-media/bootstrap-exercise-media-store";
import { createHiggsfieldProvider } from "../../media-generation/providers/higgsfield/higgsfield-provider-factory";
import type { MediaGenerationProvider } from "../../media-generation/media-generation-provider";
import {
  cancelMediaGenerationJob,
  enqueueMediaGenerationJob,
  getMediaGenerationJob,
  listMediaGenerationJobs,
} from "../../media-generation/queue/media-generation-queue";
import type { MediaGenerationJob } from "../../media-generation/queue/media-generation-job.types";
import { processAndRegisterGeneratedMediaJob } from "../../media-generation/register-generated-media-assets";

type GenerationJobDeps = {
  createProvider?: () => MediaGenerationProvider;
  bootstrapStore?: () => Promise<void>;
};

function sortJobsNewestFirst(left: MediaGenerationJob, right: MediaGenerationJob): number {
  const rightKey = right.updatedAt || right.createdAt;
  const leftKey = left.updatedAt || left.createdAt;
  return rightKey.localeCompare(leftKey);
}

export function listExerciseMediaGenerationJobsForReview(): MediaGenerationJob[] {
  return listMediaGenerationJobs().sort(sortJobsNewestFirst);
}

export function cancelExerciseMediaGenerationJobForReview(id: string): MediaGenerationJob | null {
  const job = getMediaGenerationJob(id);
  if (!job || job.status !== "queued") {
    return job;
  }

  return cancelMediaGenerationJob(id);
}

export async function retryExerciseMediaGenerationJobForReview(
  id: string,
  deps: GenerationJobDeps = {},
): Promise<{
  job: MediaGenerationJob | null;
  ok: boolean;
  message: string;
}> {
  const existing = getMediaGenerationJob(id);
  if (!existing) {
    return {
      job: null,
      ok: false,
      message: "A geração não está mais disponível.",
    };
  }

  if (existing.status !== "failed") {
    return {
      job: existing,
      ok: false,
      message: "Só é possível tentar novamente uma geração que falhou.",
    };
  }

  try {
    const bootstrapStore = deps.bootstrapStore ?? bootstrapExerciseMediaStore;
    await bootstrapStore();

    const provider = (deps.createProvider ?? createHiggsfieldProvider)();
    const newJob = enqueueMediaGenerationJob({
      request: existing.request,
      providerId: provider.name,
    });

    const { job } = await processAndRegisterGeneratedMediaJob(newJob.id, provider);
    if (!job) {
      return {
        job: null,
        ok: false,
        message: "Não foi possível tentar novamente.",
      };
    }

    if (job.status === "completed") {
      return {
        job,
        ok: true,
        message: "Nova geração concluída como rascunho.",
      };
    }

    return {
      job,
      ok: false,
      message: job.errorMessage ?? job.result?.error ?? "Não foi possível tentar novamente.",
    };
  } catch (error) {
    return {
      job: null,
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível tentar novamente.",
    };
  }
}
