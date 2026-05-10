import {
  cancelMediaGenerationJob,
  enqueueMediaGenerationJob,
  getMediaGenerationJob,
  listMediaGenerationJobs,
  resetMediaGenerationQueue,
  updateMediaGenerationJob,
} from "../media-generation-queue";

describe("mediaGenerationQueue", () => {
  beforeEach(() => {
    resetMediaGenerationQueue();
  });

  it("creates queued jobs on enqueue", () => {
    const job = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    expect(job.status).toBe("queued");
    expect(job.providerId).toBe("higgsfield-mock");
  });

  it("lists created jobs", () => {
    enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    expect(listMediaGenerationJobs()).toHaveLength(1);
  });

  it("gets jobs by id", () => {
    const created = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    expect(getMediaGenerationJob(created.id)?.id).toBe(created.id);
  });

  it("cancels only queued jobs", () => {
    const created = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const cancelled = cancelMediaGenerationJob(created.id);
    expect(cancelled?.status).toBe("cancelled");
  });

  it("does not cancel completed jobs", () => {
    const created = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    updateMediaGenerationJob(created.id, (job) => {
      job.status = "completed";
    });

    const unchanged = cancelMediaGenerationJob(created.id);
    expect(unchanged?.status).toBe("completed");
  });

  it("resets the queue", () => {
    enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Core anti-rotação",
      },
    });

    resetMediaGenerationQueue();
    expect(listMediaGenerationJobs()).toHaveLength(0);
  });
});
