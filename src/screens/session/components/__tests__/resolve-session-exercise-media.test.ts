import {
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../../../../exercise-media/exercise-media-registry";
import { resolveSessionExerciseMedia } from "../resolve-session-exercise-media";

describe("resolveSessionExerciseMedia", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("returns approved media for a resistance exercise when context matches", () => {
    registerExerciseMediaAsset({
      id: "demo-agachamento-video",
      exerciseKey: "agachamento",
      title: "Demonstração do agachamento",
      kind: "video",
      source: "seed",
      status: "approved",
      uri: "https://example.com/agachamento.mp4",
      thumbnailUri: "https://example.com/agachamento.png",
      modality: "treino_resistido",
      sport: "volleyball",
      createdAt: "2026-05-07T00:00:00.000Z",
    });

    const result = resolveSessionExerciseMedia({
      exerciseName: "Agachamento",
      category: "membros_inferiores",
      transferTarget: "Salto e bloqueio",
      trainingContext: "volleyball",
    });

    expect(result.reason).toBe("exact_match");
    expect(result.asset?.id).toBe("demo-agachamento-video");
    expect(result.asset?.uri).toBe("https://example.com/agachamento.mp4");
  });

  it("returns not_found when no approved media exists", () => {
    const result = resolveSessionExerciseMedia({
      exerciseName: "Stiff",
      category: "membros_inferiores",
      trainingContext: "general_fitness",
    });

    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
    expect(result.candidates).toEqual([]);
  });
});
