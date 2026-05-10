import { approveExerciseMediaAsset } from "../../../exercise-media/exercise-media-approval";
import { resetExerciseMediaRegistry } from "../../../exercise-media/exercise-media-registry";
import {
  createInMemoryMediaGenerationHandoffStore,
  setMediaGenerationHandoffStore,
} from "../../../media-generation/handoff/media-generation-handoff-store";
import { listMediaGenerationHandoffJobs } from "../../../media-generation/handoff/media-generation-handoff-service";
import { resetMediaGenerationQueue } from "../../../media-generation/queue/media-generation-queue";
import type { MediaGenerationProvider } from "../../../media-generation/media-generation-provider";
import { HiggsfieldMcpProvider } from "../../../media-generation/providers/higgsfield/higgsfield-mcp-provider";
import { HiggsfieldMockProvider } from "../../../media-generation/providers/higgsfield/higgsfield-provider.mock";
import {
  generateExerciseMediaDraft,
  resolveGeneratedExerciseMedia,
} from "../exercise-media-generation-actions";

describe("exercise media generation actions", () => {
  beforeEach(() => {
    resetMediaGenerationQueue();
    resetExerciseMediaRegistry();
    setMediaGenerationHandoffStore(createInMemoryMediaGenerationHandoffStore());
  });

  it("returns error for empty exercise name", async () => {
    const result = await generateExerciseMediaDraft({
      exerciseName: "   ",
      mediaType: "video",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("nome do exercício");
  });

  it("creates an exercise_video request for video generation", async () => {
    const provider = new HiggsfieldMockProvider({
      now: () => "2026-05-08T00:00:00.000Z",
    });

    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Stiff",
        mediaType: "video",
      },
      {
        createProvider: () => provider,
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.job?.request.kind).toBe("exercise_video");
  });

  it("creates an exercise_image request for image generation", async () => {
    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Agachamento",
        mediaType: "image",
      },
      {
        createProvider: () =>
          new HiggsfieldMockProvider({
            now: () => "2026-05-08T00:00:00.000Z",
          }),
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.job?.request.kind).toBe("exercise_image");
  });

  it("registers a draft asset with the mock provider", async () => {
    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Stiff",
        mediaType: "video",
      },
      {
        createProvider: () =>
          new HiggsfieldMockProvider({
            now: () => "2026-05-08T00:00:00.000Z",
          }),
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.registeredAssets).toHaveLength(1);
    expect(result.registeredAssets[0]).toMatchObject({
      status: "draft",
      source: "higgsfield",
    });
  });

  it("generated asset does not appear in resolver before approval", async () => {
    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Stiff",
        mediaType: "video",
      },
      {
        createProvider: () =>
          new HiggsfieldMockProvider({
            now: () => "2026-05-08T00:00:00.000Z",
          }),
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(resolveGeneratedExerciseMedia("Stiff").asset).toBeNull();
  });

  it("generated asset appears in resolver after approval", async () => {
    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Stiff",
        mediaType: "video",
      },
      {
        createProvider: () =>
          new HiggsfieldMockProvider({
            now: () => "2026-05-08T00:00:00.000Z",
          }),
        bootstrapStore: async () => {},
      },
    );

    await approveExerciseMediaAsset(result.registeredAssets[0].id, { by: "local-dev" });

    expect(resolveGeneratedExerciseMedia("Stiff").asset).toMatchObject({
      status: "approved",
      exerciseKey: "stiff",
    });
  });

  it("returns ok false when the provider fails", async () => {
    const failingProvider: MediaGenerationProvider = {
      name: "failing-provider",
      isConfigured: () => true,
      generate: async () => ({
        requestId: "req-1",
        providerName: "failing-provider",
        kind: "exercise_video",
        status: "failed",
        prompt: "prompt",
        asset: null,
        error: "provider failed",
        completedAt: "2026-05-08T00:00:00.000Z",
      }),
    };

    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Stiff",
        mediaType: "video",
      },
      {
        createProvider: () => failingProvider,
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe("provider failed");
  });

  it("never creates approved assets automatically", async () => {
    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Core anti-rotação",
        mediaType: "video",
      },
      {
        createProvider: () =>
          new HiggsfieldMockProvider({
            now: () => "2026-05-08T00:00:00.000Z",
          }),
        bootstrapStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.registeredAssets.every((asset) => asset.status === "draft")).toBe(true);
  });

  it("creates a handoff job when MCP is configured but bridge is unavailable", async () => {
    const provider = new HiggsfieldMcpProvider({
      config: { enabled: true, serverUrl: "https://mcp.higgsfield.ai" },
      now: () => "2026-05-08T00:00:00.000Z",
    });

    const result = await generateExerciseMediaDraft(
      {
        exerciseName: "Leg Press 45°",
        mediaType: "video",
      },
      {
        createProvider: () => provider,
        bootstrapStore: async () => {},
        bootstrapHandoffStore: async () => {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain("aguardando Higgsfield");
    expect(result.registeredAssets).toHaveLength(0);
    expect(result.handoffJob).not.toBeNull();
    expect(listMediaGenerationHandoffJobs()).toHaveLength(1);
    expect(resolveGeneratedExerciseMedia("Leg Press 45°").asset).toBeNull();
  });
});
