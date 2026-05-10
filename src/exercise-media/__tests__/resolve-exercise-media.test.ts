import {
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../exercise-media-registry";
import { normalizeExerciseMediaKey } from "../exercise-media-normalization";
import { resolveExerciseMedia } from "../resolve-exercise-media";
import type { ExerciseMediaAsset } from "../exercise-media.types";

function buildAsset(
  overrides: Partial<ExerciseMediaAsset> = {}
): ExerciseMediaAsset {
  const title = overrides.title ?? "Manchete para alvo";
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    exerciseKey:
      overrides.exerciseKey ?? normalizeExerciseMediaKey(title),
    title,
    kind: overrides.kind ?? "video",
    source: overrides.source ?? "manual",
    status: overrides.status ?? "approved",
    uri: overrides.uri ?? "https://example.com/demo.mp4",
    modality: overrides.modality,
    sport: overrides.sport,
    ageBand: overrides.ageBand,
    level: overrides.level,
    tags: overrides.tags,
    createdAt: overrides.createdAt ?? "2026-05-07T10:00:00.000Z",
    updatedAt: overrides.updatedAt,
    thumbnailUri: overrides.thumbnailUri,
    qrUri: overrides.qrUri,
  };
}

describe("resolveExerciseMedia", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("resolve por nome exato normalizado", () => {
    const asset = buildAsset({
      id: "media-1",
      title: "Manchete para alvo",
      sport: "volei",
    });

    registerExerciseMediaAsset(asset);

    const result = resolveExerciseMedia({
      exerciseName: "Manchete para alvo",
      sport: "volei",
    });

    expect(result.reason).toBe("exact_match");
    expect(result.asset?.id).toBe("media-1");
  });

  it("ignora asset draft e archived", () => {
    registerExerciseMediaAsset(
      buildAsset({
        id: "draft-1",
        status: "draft",
      })
    );
    registerExerciseMediaAsset(
      buildAsset({
        id: "archived-1",
        status: "archived",
      })
    );

    const result = resolveExerciseMedia({
      exerciseName: "Manchete para alvo",
    });

    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
  });

  it("respeita preferredKind", () => {
    registerExerciseMediaAsset(
      buildAsset({
        id: "image-1",
        kind: "image",
        uri: "https://example.com/manchete.png",
      })
    );
    registerExerciseMediaAsset(
      buildAsset({
        id: "video-1",
        kind: "video",
      })
    );

    const result = resolveExerciseMedia({
      exerciseName: "Manchete para alvo",
      preferredKind: "image",
    });

    expect(result.asset?.id).toBe("image-1");
  });

  it("retorna not_found quando nao tem midia", () => {
    const result = resolveExerciseMedia({
      exerciseName: "Saque flutuante",
    });

    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("usa tags como fallback", () => {
    registerExerciseMediaAsset(
      buildAsset({
        id: "tag-1",
        title: "Recepcao base",
        exerciseKey: "recepcao-base",
        tags: ["recepcao", "primeira bola"],
      })
    );

    const result = resolveExerciseMedia({
      exerciseName: "atividade sem nome cadastrado",
      tags: ["primeira bola"],
    });

    expect(result.reason).toBe("tag_match");
    expect(result.asset?.id).toBe("tag-1");
  });

  it("nao quebra com string vazia", () => {
    const result = resolveExerciseMedia({
      exerciseName: "",
    });

    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
  });

  it("prioriza approved e contexto mais proximo", () => {
    registerExerciseMediaAsset(
      buildAsset({
        id: "generic-1",
        ageBand: "8-11",
        sport: "volei",
      })
    );
    registerExerciseMediaAsset(
      buildAsset({
        id: "best-1",
        ageBand: "8-11",
        sport: "volei",
        modality: "treino",
        level: "iniciante",
        createdAt: "2026-05-07T12:00:00.000Z",
      })
    );

    const result = resolveExerciseMedia({
      exerciseName: "Manchete para alvo",
      modality: "treino",
      sport: "volei",
      ageBand: "8-11",
      level: "iniciante",
    });

    expect(result.reason).toBe("exact_match");
    expect(result.asset?.id).toBe("best-1");
  });
});
