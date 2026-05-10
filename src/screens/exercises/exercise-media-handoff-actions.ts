import {
  buildMediaGenerationHandoffPayload,
  cancelMediaGenerationHandoffJob,
  listMediaGenerationHandoffJobs,
} from "../../media-generation/handoff/media-generation-handoff-service";
import type { MediaGenerationHandoffJob } from "../../media-generation/handoff/media-generation-handoff.types";

export function listExerciseMediaHandoffJobsForReview(): MediaGenerationHandoffJob[] {
  return listMediaGenerationHandoffJobs();
}

export async function cancelExerciseMediaHandoffJobForReview(
  id: string,
): Promise<MediaGenerationHandoffJob | null> {
  return cancelMediaGenerationHandoffJob(id);
}

export function getExerciseMediaHandoffPrompt(job: MediaGenerationHandoffJob): string {
  return job.prompt;
}

export function getExerciseMediaHandoffPayload(job: MediaGenerationHandoffJob): string {
  return buildMediaGenerationHandoffPayload(job);
}
