import { listDraftMediaAssets } from "../../../exercise-media/exercise-media-approval";
import { resetExerciseMediaRegistry, listExerciseMediaAssets } from "../../../exercise-media/exercise-media-registry";
import type { MediaGenerationProvider } from "../../../media-generation/media-generation-provider";
import { HiggsfieldMockProvider } from "../../../media-generation/providers/higgsfield/higgsfield-provider.mock";
import { enqueueMediaGenerationJob, resetMediaGenerationQueue } from "../../../media-generation/queue/media-generation-queue";
import { processAndRegisterGeneratedMediaJob } from "../../../media-generation/register-generated-media-assets";
import {
  cancelExerciseMediaGenerationJobForReview,
  listExerciseMediaGenerationJobsForReview,
  retryExerciseMediaGenerationJobForReview,
} from "../exercise-media-generation-job-actions";

describe("exercise media generation job actions", () => {
  beforeEach(() => {
    resetMediaGenerationQueue();
    resetExerciseMediaRegistry();
  });

  it("lists jobs ordered by most recent first", () => {
    enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Primeiro" },
    });
    enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Segundo" },
    });

    const jobs = listExerciseMediaGenerationJobsForReview();
    expect(jobs.map((job) => job.request.exerciseName)).toEqual(["Segundo", "Primeiro"]);
  });

  it("cancels queued jobs", () => {
    const job = enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Stiff" },
    });

    const cancelled = cancelExerciseMediaGenerationJobForReview(job.id);
    expect(cancelled?.status).toBe("cancelled");
  });

  it("does not cancel completed jobs", async () => {
    const provider = new HiggsfieldMockProvider({
      now: () => "2026-05-08T00:00:00.000Z",
    });
    const job = enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Stiff" },
    });
    await processAndRegisterGeneratedMediaJob(job.id, provider);

    const cancelled = cancelExerciseMediaGenerationJobForReview(job.id);
    expect(cancelled?.status).toBe("completed");
  });

  it("retry on failed creates a new job", async () => {
    const failingProvider: MediaGenerationProvider = {
      name: "failing-provider",
      isConfigured: () => true,
      generate: async () => ({
        requestId: "req-failed",
        providerName: "failing-provider",
        kind: "exercise_video",
        status: "failed",
        prompt: "prompt",
        asset: null,
        error: "provider failed",
        completedAt: "2026-05-08T00:00:00.000Z",
      }),
    };

    const failedJob = enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Stiff" },
      providerId: "failing-provider",
    });
    await processAndRegisterGeneratedMediaJob(failedJob.id, failingProvider);

    const retried = await retryExerciseMediaGenerationJobForReview(failedJob.id, {
      createProvider: () =>
        new HiggsfieldMockProvider({
          now: () => "2026-05-08T00:00:00.000Z",
        }),
      bootstrapStore: async () => {},
    });

    expect(retried.ok).toBe(true);
    expect(retried.job).not.toBeNull();
    expect(retried.job?.id).not.toBe(failedJob.id);
  });

  it("retry does not approve automatically", async () => {
    const failingProvider: MediaGenerationProvider = {
      name: "failing-provider",
      isConfigured: () => true,
      generate: async () => ({
        requestId: "req-failed",
        providerName: "failing-provider",
        kind: "exercise_video",
        status: "failed",
        prompt: "prompt",
        asset: null,
        error: "provider failed",
        completedAt: "2026-05-08T00:00:00.000Z",
      }),
    };

    const failedJob = enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Stiff" },
      providerId: "failing-provider",
    });
    await processAndRegisterGeneratedMediaJob(failedJob.id, failingProvider);

    await retryExerciseMediaGenerationJobForReview(failedJob.id, {
      createProvider: () =>
        new HiggsfieldMockProvider({
          now: () => "2026-05-08T00:00:00.000Z",
        }),
      bootstrapStore: async () => {},
    });

    expect(listDraftMediaAssets()).toHaveLength(1);
    expect(listExerciseMediaAssets().every((asset) => asset.status === "draft")).toBe(true);
  });

  it("completed media stays draft until approval", async () => {
    const provider = new HiggsfieldMockProvider({
      now: () => "2026-05-08T00:00:00.000Z",
    });
    const job = enqueueMediaGenerationJob({
      request: { kind: "exercise_video", exerciseName: "Stiff" },
    });

    await processAndRegisterGeneratedMediaJob(job.id, provider);

    expect(listDraftMediaAssets()).toHaveLength(1);
    expect(listExerciseMediaAssets()[0]?.status).toBe("draft");
  });
});
