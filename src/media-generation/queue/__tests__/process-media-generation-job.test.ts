import { HiggsfieldMockProvider } from "../../providers/higgsfield/higgsfield-provider.mock";
import {
  enqueueMediaGenerationJob,
  getMediaGenerationJob,
  resetMediaGenerationQueue,
} from "../media-generation-queue";
import {
  processMediaGenerationJob,
  processNextMediaGenerationJob,
} from "../process-media-generation-job";

describe("processMediaGenerationJob", () => {
  const provider = new HiggsfieldMockProvider({
    now: () => "2026-05-08T00:00:00.000Z",
  });

  beforeEach(() => {
    resetMediaGenerationQueue();
  });

  it("processes queued jobs with the mock provider", async () => {
    const job = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    const processed = await processMediaGenerationJob(job.id, provider);

    expect(processed?.status).toBe("completed");
    expect(processed?.result).toBeDefined();
  });

  it("marks invalid requests as failed", async () => {
    const job = enqueueMediaGenerationJob({
      request: {
        kind: "marketing_card",
      },
    });

    const processed = await processMediaGenerationJob(job.id, provider);

    expect(processed?.status).toBe("failed");
    expect(processed?.errorMessage).toContain("campaignKey is required");
  });

  it("does not reprocess completed jobs", async () => {
    const job = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const first = await processMediaGenerationJob(job.id, provider);
    const second = await processMediaGenerationJob(job.id, provider);

    expect(first?.status).toBe("completed");
    expect(second?.status).toBe("completed");
    expect(getMediaGenerationJob(job.id)?.status).toBe("completed");
  });

  it("processNext picks the first queued job", async () => {
    const first = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const processed = await processNextMediaGenerationJob(provider);
    expect(processed?.id).toBe(first.id);
    expect(processed?.status).toBe("completed");
  });

  it("returns null when there is no queued job", async () => {
    await expect(processNextMediaGenerationJob(provider)).resolves.toBeNull();
  });

  it("returns null for missing jobs", async () => {
    await expect(processMediaGenerationJob("missing-job", provider)).resolves.toBeNull();
  });
});
