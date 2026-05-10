import {
  cancelMediaGenerationHandoffJob,
  createMediaGenerationHandoffJob,
  listMediaGenerationHandoffJobs,
} from "../media-generation-handoff-service";
import {
  createInMemoryMediaGenerationHandoffStore,
  setMediaGenerationHandoffStore,
} from "../media-generation-handoff-store";

describe("media generation handoff service", () => {
  beforeEach(() => {
    setMediaGenerationHandoffStore(createInMemoryMediaGenerationHandoffStore());
  });

  it("creates pending agent jobs ordered by most recent first", async () => {
    const older = await createMediaGenerationHandoffJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    const newer = await createMediaGenerationHandoffJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const jobs = listMediaGenerationHandoffJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).toBe(newer.id);
    expect(jobs[1].id).toBe(older.id);
    expect(jobs[0].status).toBe("pending_agent");
    expect(jobs[0].prompt).toContain("Agachamento");
  });

  it("cancels pending jobs without removing them", async () => {
    const job = await createMediaGenerationHandoffJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Core anti-rotação",
      },
    });

    const updated = await cancelMediaGenerationHandoffJob(job.id);

    expect(updated?.status).toBe("cancelled");
    expect(listMediaGenerationHandoffJobs()[0].status).toBe("cancelled");
  });
});
