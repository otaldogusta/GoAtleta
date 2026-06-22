import type { Exercise } from "../models";
import {
  classifyExerciseLink,
  getExerciseLinkSearchTags,
  matchesExerciseLinkSearch,
  mergeInferredExerciseLinkTags,
  scoreExerciseLinkForPlanningBlock,
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
});
