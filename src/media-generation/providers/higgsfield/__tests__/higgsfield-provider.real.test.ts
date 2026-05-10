import type { MediaGenerationRequest } from "../../../media-generation.types";
import { HiggsfieldMockProvider } from "../higgsfield-provider.mock";
import { createHiggsfieldProvider } from "../higgsfield-provider-factory";
import type { HiggsfieldClient } from "../higgsfield-client";
import type { HiggsfieldConfig } from "../higgsfield-config";
import { HiggsfieldRealProvider } from "../higgsfield-provider.real";

const CONFIG: HiggsfieldConfig = {
  apiKey: "test-key",
  baseUrl: "https://api.higgsfield.ai",
  timeoutMs: 45000,
  endpoints: {
    exerciseVideo: "/v1/media/exercise-video",
    exerciseImage: "/v1/media/exercise-image",
    coachAvatar: "/v1/media/coach-avatar",
    marketingCard: "/v1/media/marketing-card",
  },
};

function createClient(overrides: Partial<HiggsfieldClient> = {}): HiggsfieldClient {
  return {
    generateExerciseVideo: jest.fn().mockResolvedValue({
      id: "job-video-1",
      videoUrl: "https://cdn.example.com/stiff.mp4",
      thumbnailUrl: "https://cdn.example.com/stiff.png",
      model: "seedance",
    }),
    generateExerciseImage: jest.fn().mockResolvedValue({
      id: "job-image-1",
      imageUrl: "https://cdn.example.com/agachamento.png",
      model: "gpt-image-2",
    }),
    generateCoachAvatar: jest.fn().mockResolvedValue({
      id: "job-avatar-1",
      imageUrl: "https://cdn.example.com/avatar.png",
    }),
    generateMarketingCard: jest.fn().mockResolvedValue({
      id: "job-marketing-1",
      imageUrl: "https://cdn.example.com/card.png",
    }),
    ...overrides,
  };
}

describe("HiggsfieldRealProvider", () => {
  const now = () => "2026-05-08T00:00:00.000Z";

  it("isConfigured returns false without API key", () => {
    const provider = new HiggsfieldRealProvider({
      config: null,
      now,
    });

    expect(provider.isConfigured()).toBe(false);
  });

  it("returns failed without config", async () => {
    const provider = new HiggsfieldRealProvider({
      config: null,
      now,
    });

    const result = await provider.generate({
      kind: "exercise_video",
      exerciseName: "Stiff",
    });

    expect(result.status).toBe("failed");
    expect(result.asset).toBeNull();
    expect(result.error).toContain("HIGGSFIELD_API_KEY");
  });

  it("calls the client with the generated prompt", async () => {
    const client = createClient();
    const provider = new HiggsfieldRealProvider({
      config: CONFIG,
      client,
      now,
    });

    const request: MediaGenerationRequest = {
      kind: "exercise_video",
      exerciseName: "Stiff",
      title: "Demonstração do stiff",
    };

    await provider.generate(request);

    expect(client.generateExerciseVideo).toHaveBeenCalledTimes(1);
    expect(client.generateExerciseVideo).toHaveBeenCalledWith(
      request,
      expect.stringContaining("Gerar um video curto e claro"),
    );
  });

  it("returns a draft ExerciseMediaAsset for exercise_video", async () => {
    const provider = new HiggsfieldRealProvider({
      config: CONFIG,
      client: createClient(),
      now,
    });

    const result = await provider.generate({
      kind: "exercise_video",
      exerciseName: "Core anti-rotação",
      sport: "treino_resistido",
    });

    expect(result.status).toBe("completed");
    expect(result.asset).toMatchObject({
      exerciseKey: "core-anti-rotacao",
      kind: "video",
      source: "higgsfield",
      status: "draft",
    });
  });

  it("never returns approved automatically", async () => {
    const provider = new HiggsfieldRealProvider({
      config: CONFIG,
      client: createClient(),
      now,
    });

    const result = await provider.generate({
      kind: "exercise_image",
      exerciseName: "Agachamento",
    });

    expect(result.status).toBe("completed");
    expect(result.asset).toMatchObject({
      status: "draft",
    });
  });

  it("returns failed when the API client fails", async () => {
    const provider = new HiggsfieldRealProvider({
      config: CONFIG,
      client: createClient({
        generateExerciseVideo: jest.fn().mockRejectedValue(new Error("API down")),
      }),
      now,
    });

    const result = await provider.generate({
      kind: "exercise_video",
      exerciseName: "Stiff",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("API down");
  });
});

describe("createHiggsfieldProvider", () => {
  const previousApiKey = process.env.HIGGSFIELD_API_KEY;
  const previousExpoApiKey = process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY;

  afterEach(() => {
    if (previousApiKey) {
      process.env.HIGGSFIELD_API_KEY = previousApiKey;
    } else {
      delete process.env.HIGGSFIELD_API_KEY;
    }

    if (previousExpoApiKey) {
      process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY = previousExpoApiKey;
    } else {
      delete process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY;
    }
  });

  it("uses the mock provider when no config is present", () => {
    delete process.env.HIGGSFIELD_API_KEY;
    delete process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY;

    const provider = createHiggsfieldProvider();
    expect(provider).toBeInstanceOf(HiggsfieldMockProvider);
  });

  it("uses the real provider when config is present", () => {
    process.env.HIGGSFIELD_API_KEY = "real-key";

    const provider = createHiggsfieldProvider();
    expect(provider).toBeInstanceOf(HiggsfieldRealProvider);
  });
});
