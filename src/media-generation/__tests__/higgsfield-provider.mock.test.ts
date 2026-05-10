import { HiggsfieldMockProvider } from "../providers/higgsfield/higgsfield-provider.mock";
import {
  buildCoachAvatarPrompt,
  buildExerciseImagePrompt,
  buildExerciseVideoPrompt,
  buildMarketingCardPrompt,
} from "../providers/higgsfield/higgsfield-prompts";

describe("HiggsfieldMockProvider", () => {
  const provider = new HiggsfieldMockProvider({
    now: () => "2026-05-08T00:00:00.000Z",
  });

  it("returns completed for valid requests", async () => {
    const result = await provider.generate({
      kind: "exercise_video",
      exerciseName: "Stiff",
      title: "Demonstração do stiff",
    });

    expect(provider.isConfigured()).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.providerName).toBe("higgsfield-mock");
  });

  it("returns failed for invalid requests", async () => {
    const result = await provider.generate({
      kind: "exercise_video",
    });

    expect(result.status).toBe("failed");
    expect(result.asset).toBeNull();
    expect(result.error).toContain("exerciseName or exerciseKey is required");
  });

  it("creates a draft ExerciseMediaAsset for exercise_video", async () => {
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

  it("does not require any API key", async () => {
    const previous = process.env.HIGGSFIELD_API_KEY;
    delete process.env.HIGGSFIELD_API_KEY;

    const result = await provider.generate({
      kind: "exercise_image",
      exerciseName: "Agachamento",
    });

    expect(result.status).toBe("completed");
    process.env.HIGGSFIELD_API_KEY = previous;
  });
});

describe("higgsfield prompts", () => {
  it("exercise prompts stay out of pedagogical decision language", () => {
    const prompt = buildExerciseVideoPrompt({
      kind: "exercise_video",
      exerciseName: "Stiff",
    });

    expect(prompt).toContain("Nao decidir treino");
    expect(prompt).toContain("nao prescrever carga");
    expect(prompt).not.toContain("periodizacao");
    expect(prompt).not.toContain("carga ideal");
  });

  it("builds prompts for all mock surfaces", () => {
    expect(
      buildExerciseImagePrompt({ kind: "exercise_image", exerciseName: "Agachamento" }),
    ).toContain("Agachamento");
    expect(buildCoachAvatarPrompt({ kind: "coach_avatar", coachId: "coach-1" })).toContain(
      "professor",
    );
    expect(
      buildMarketingCardPrompt({ kind: "marketing_card", campaignKey: "matriculas-maio" }),
    ).toContain("campanha");
  });
});
