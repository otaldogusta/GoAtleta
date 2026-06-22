import type { Exercise } from "../models";
import {
  classifyExerciseLink,
  getExerciseLinkPresentation,
  getExerciseLinkSearchTags,
  matchesExerciseLinkSearch,
  mergeInferredExerciseLinkTags,
  scoreExerciseLinkForPlanningBlock,
  shouldRefreshExerciseLinkMetadata,
} from "../exercise-link-classifier";

const exercise = (overrides: Partial<Exercise>): Exercise => ({
  id: "exercise-1",
  title: "",
  tags: [],
  videoUrl: "https://example.com/video",
  source: "",
  description: "",
  publishedAt: "",
  notes: "",
  createdAt: "2026-06-21T12:00:00.000Z",
  ...overrides,
});

describe("exercise link classifier", () => {
  it("classifies toque as both toque and levantamento", () => {
    const tags = classifyExerciseLink({
      title: "Toque em duplas para segundo contato",
      source: "YouTube",
    });

    expect(tags).toEqual(expect.arrayContaining(["toque", "levantamento", "duplas"]));
  });

  it("maps manchete to passe and recepcao", () => {
    const tags = classifyExerciseLink({
      title: "Manchete orientada para recepção",
      description: "Primeiro contato com controle.",
    });

    expect(tags).toEqual(expect.arrayContaining(["passe", "recepcao"]));
  });

  it("handles warmup and activation terms as aquecimento", () => {
    const tags = classifyExerciseLink({
      title: "Warm Up activation drill",
      notes: "Preparação rápida antes do treino.",
    });

    expect(tags).toEqual(expect.arrayContaining(["aquecimento", "drill"]));
  });

  it("classifies strength, core and mobility terms without accents breaking matching", () => {
    const tags = classifyExerciseLink({
      title: "Kurzes Kräftigen core mobility",
      source: "Instagram",
    });

    expect(tags).toEqual(expect.arrayContaining(["forca", "core", "mobilidade", "instagram"]));
  });

  it("classifies queimada descriptions from rich link metadata", () => {
    const tags = classifyExerciseLink({
      title: "Queimada Jogo",
      description:
        "Queimada reativa em dupla com proteção. Um aluno é o corredor e o outro defensor. O defensor pode interceptar a bola para proteger o colega.",
      source: "Pinterest",
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        "queimada",
        "jogo-aplicacao",
        "duplas",
        "defesa",
        "agilidade",
        "pinterest",
      ])
    );
  });

  it("removes stale managed tags while preserving custom tags", () => {
    const tags = mergeInferredExerciseLinkTags(
      {
        title: "Passe em duplas com deslocamento",
        videoUrl: "https://youtu.be/abc",
      },
      ["saque", "favorito"]
    );

    expect(tags).toEqual(expect.arrayContaining(["favorito", "passe", "duplas", "youtube"]));
    expect(tags).not.toContain("saque");
  });

  it("infers search tags for legacy links with no stored tags", () => {
    const tags = getExerciseLinkSearchTags(
      exercise({
        title: "Saque curto por alvo",
        tags: [],
      })
    );

    expect(tags).toEqual(expect.arrayContaining(["saque", "desenvolvimento"]));
  });

  it("scores links for the planning block context", () => {
    const warmup = exercise({ title: "Aquecimento com sprint e mobilidade" });
    const main = exercise({ title: "Saque e recepção sob pressão" });
    const cooldown = exercise({ title: "Alongamento e relaxamento final" });

    expect(scoreExerciseLinkForPlanningBlock(warmup, "warmup")).toBeGreaterThan(
      scoreExerciseLinkForPlanningBlock(main, "warmup")
    );
    expect(scoreExerciseLinkForPlanningBlock(main, "main")).toBeGreaterThan(
      scoreExerciseLinkForPlanningBlock(warmup, "main")
    );
    expect(scoreExerciseLinkForPlanningBlock(cooldown, "cooldown")).toBeGreaterThan(
      scoreExerciseLinkForPlanningBlock(main, "cooldown")
    );
  });

  it("does not match short skill terms inside unrelated longer words", () => {
    const handballLink = exercise({
      title: "Kurzes Kräftigen in der Zweiergruppe",
      description: "#handballpassion #coreworkout #corestrength",
      source: "Instagram",
    });

    expect(classifyExerciseLink(handballLink)).not.toContain("passe");
    expect(matchesExerciseLinkSearch(handballLink, "passe")).toBe(false);
    expect(matchesExerciseLinkSearch(handballLink, "core")).toBe(true);
  });

  it("presents noisy foreign social metadata as a short Portuguese activity", () => {
    const presentation = getExerciseLinkPresentation(
      exercise({
        title:
          'Handballcoach Philipp on Instagram: "Kurzes Kräftigen in der Zweiergruppe. Ziel: Körperspannung steigern, große Muskelgruppen kräftigen. #strengthtraining #krafttraining #coreworkout #corestrength #partnerworkout"',
        description:
          "11K likes, 33 comments - handballcoach_philipp on September 2, 2024: Kurzes Kräftigen in der Zweiergruppe.",
        source: "Instagram",
      })
    );

    expect(presentation.title).toBe("Força e core em duplas");
    expect(presentation.description).toBe(
      "Fortalecimento em duplas para controle corporal e grandes grupos musculares."
    );
    expect(presentation.title).not.toMatch(/Instagram|Kraft|#|@/i);
    expect(presentation.description).not.toMatch(/likes|comments|#/i);
  });

  it("presents a rich Pinterest queimada link as a teacher-friendly activity", () => {
    const presentation = getExerciseLinkPresentation(
      exercise({
        title: "Queimada Jogo",
        description:
          "Gostou?! Segue aí! Variações. Essa é uma variação da queimada reativa. Em dupla com proteção, os alunos jogam em duplas. Um aluno é o corredor e o outro defensor. O defensor pode interceptar a bola lançada para proteger o colega.",
        source: "br.pinterest.com",
      })
    );

    expect(presentation.title).toBe("Queimada reativa em duplas");
    expect(presentation.description).toBe(
      "Jogo de queimada com proteção em duplas, reação e tomada de decisão."
    );
    expect(presentation.title).not.toMatch(/Pinterest|Pin|Jogo$/i);
    expect(presentation.description).not.toMatch(/Gostou|Segue|Encontre/i);
  });

  it("does not expose stale generic Pinterest text when metadata is weak", () => {
    const presentation = getExerciseLinkPresentation(
      exercise({
        title: "Pin em Ida & Oscar",
        description: "1 de fev de 2026 - Encontre (e salve!) seus próprios Pins no Pinterest.",
        source: "br.pinterest.com",
        videoUrl: "https://br.pinterest.com/pin/123",
      })
    );

    expect(presentation.title).toBe("Referência do Pinterest");
    expect(presentation.description).toBe("Link salvo para consulta e uso no planejamento.");
    expect(presentation.title).not.toMatch(/Pin em|Ida|Oscar/i);
    expect(presentation.description).not.toMatch(/Encontre|Pinterest|Pins/i);
  });

  it("marks social links with weak metadata for live refresh", () => {
    expect(
      shouldRefreshExerciseLinkMetadata(
        exercise({
          title: "Pin em Ida & Oscar",
          description: "Encontre (e salve!) seus próprios Pins no Pinterest.",
          source: "br.pinterest.com",
          videoUrl: "https://br.pinterest.com/pin/123",
        })
      )
    ).toBe(true);
  });
});
