import {
  listExerciseMediaAssets,
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../../exercise-media/exercise-media-registry";
import { resolveExerciseMedia } from "../../exercise-media/resolve-exercise-media";
import { HiggsfieldMockProvider } from "../providers/higgsfield/higgsfield-provider.mock";
import { enqueueMediaGenerationJob } from "../queue/media-generation-queue";
import {
  processMediaGenerationJob,
} from "../queue/process-media-generation-job";
import {
  extractExerciseMediaAssetsFromResult,
  processAndRegisterGeneratedMediaJob,
  registerGeneratedMediaAssetsFromJob,
} from "../register-generated-media-assets";

describe("registerGeneratedMediaAssets", () => {
  const provider = new HiggsfieldMockProvider({
    now: () => "2026-05-08T00:00:00.000Z",
  });

  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("extracts draft exercise assets from completed results", async () => {
    const result = await provider.generate({
      kind: "exercise_video",
      exerciseName: "Stiff",
    });

    const assets = extractExerciseMediaAssetsFromResult(result);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      exerciseKey: "stiff",
      kind: "video",
      status: "draft",
      source: "higgsfield",
    });
  });

  it("does not extract assets from failed results", async () => {
    const result = await provider.generate({
      kind: "exercise_video",
    } as any);

    expect(extractExerciseMediaAssetsFromResult(result)).toEqual([]);
  });

  it("registers draft assets from completed jobs", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    const completed = await processMediaGenerationJob(queued.id, provider);
    const registered = await registerGeneratedMediaAssetsFromJob(completed!);

    expect(registered).toHaveLength(1);
    expect(registered[0].status).toBe("draft");
    expect(listExerciseMediaAssets()).toHaveLength(1);
  });

  it("does not register anything for failed jobs", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
      } as any,
    });

    const failed = await processMediaGenerationJob(queued.id, provider);
    await expect(registerGeneratedMediaAssetsFromJob(failed!)).resolves.toEqual([]);
  });

  it("does not register anything for queued jobs", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    await expect(registerGeneratedMediaAssetsFromJob(queued)).resolves.toEqual([]);
  });

  it("never turns generated assets into approved automatically", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const { registeredAssets } = await processAndRegisterGeneratedMediaJob(queued.id, provider);
    expect(registeredAssets[0]?.status).toBe("draft");
    expect(listExerciseMediaAssets()[0]?.status).toBe("draft");
  });

  it("is idempotent by asset id", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Core anti-rotação",
      },
    });

    const completed = await processMediaGenerationJob(queued.id, provider);
    const first = await registerGeneratedMediaAssetsFromJob(completed!);
    const second = await registerGeneratedMediaAssetsFromJob(completed!);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(listExerciseMediaAssets()).toHaveLength(1);
  });

  it("resolveExerciseMedia continues ignoring draft assets", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    await processAndRegisterGeneratedMediaJob(queued.id, provider);

    const result = resolveExerciseMedia({
      exerciseName: "Stiff",
      preferredKind: "video",
    });

    expect(result.asset).toBeNull();
    expect(result.reason).toBe("not_found");
  });

  it("processAndRegisterGeneratedMediaJob processes and registers draft assets", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    const result = await processAndRegisterGeneratedMediaJob(queued.id, provider);

    expect(result.job?.status).toBe("completed");
    expect(result.registeredAssets).toHaveLength(1);
    expect(result.registeredAssets[0].status).toBe("draft");
  });

  it("processMediaGenerationJob alone does not register assets", async () => {
    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_image",
        exerciseName: "Agachamento",
      },
    });

    await processMediaGenerationJob(queued.id, provider);
    expect(listExerciseMediaAssets()).toHaveLength(0);
  });

  it("existing approved assets are not downgraded by duplicate draft registration", async () => {
    registerExerciseMediaAsset({
      id: "exercise_video-stiff",
      exerciseKey: "stiff",
      title: "Stiff aprovado",
      kind: "video",
      source: "manual",
      status: "approved",
      uri: "https://example.com/stiff-approved.mp4",
      createdAt: "2026-05-08T00:00:00.000Z",
    });

    const queued = enqueueMediaGenerationJob({
      request: {
        kind: "exercise_video",
        exerciseName: "Stiff",
      },
    });

    const completed = await processMediaGenerationJob(queued.id, provider);
    const registered = await registerGeneratedMediaAssetsFromJob(completed!);

    expect(registered).toHaveLength(1);
    expect(listExerciseMediaAssets()).toHaveLength(1);
    expect(listExerciseMediaAssets()[0].status).toBe("approved");
    expect(listExerciseMediaAssets()[0].source).toBe("manual");
  });
});
