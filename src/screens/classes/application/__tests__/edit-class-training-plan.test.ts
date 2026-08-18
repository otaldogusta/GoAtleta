import type { TrainingPlan } from "../../../../core/models";
import {
  appendClassPlanActivity,
  buildClassPlanBlockDraft,
  findClassPlanUnnamedActivity,
  getClassPlanPdfContentDraft,
  getClassPlanSpecificObjective,
  normalizeClassTrainingPlan,
  removeClassPlanActivity,
  updateClassPlanPdfContent,
  updateClassPlanSpecificObjective,
  updateClassTrainingPlanBlock,
} from "../edit-class-training-plan";

const plan: TrainingPlan = {
  id: "plan_1",
  classId: "class_1",
  title: "Passe",
  tags: [],
  warmup: ["Aquecimento antigo"],
  main: ["Atividade antiga"],
  cooldown: ["Fechamento antigo"],
  warmupTime: "10",
  mainTime: "45",
  cooldownTime: "5",
  createdAt: "2026-07-15T00:00:00.000Z",
  pedagogy: {
    blocks: {
      warmup: { activities: [{ name: "Aquecimento antigo" }] },
      main: {
        summary: "Objetivo antigo",
        activities: [{ name: "Atividade antiga", description: "Descrição antiga" }],
      },
      cooldown: { activities: [{ name: "Fechamento antigo" }] },
    },
  },
};

describe("edit-class-training-plan", () => {
  it("builds an editable draft from the resolved block", () => {
    expect(buildClassPlanBlockDraft(plan, "main")).toEqual({
      duration: "45",
      objective: "Objetivo antigo",
      activities: [{ name: "Atividade antiga", description: "Descrição antiga" }],
    });
  });

  it("hydrates editable descriptions for legacy plans that only stored activity names", () => {
    const legacyPlan: TrainingPlan = {
      ...plan,
      title: "Primeiros Saques · Passe",
      warmup: ["Chama e devolve"],
      main: ["Passe em duplas para zona-alvo", "Jogo da zona jogável"],
      cooldown: ["Roda rápida de fechamento"],
      pedagogy: undefined,
    };

    const warmup = buildClassPlanBlockDraft(legacyPlan, "warmup");
    const main = buildClassPlanBlockDraft(legacyPlan, "main");
    const cooldown = buildClassPlanBlockDraft(legacyPlan, "cooldown");

    expect(warmup.activities[0]?.description).toContain("uma bola por dupla");
    expect(main.activities[0]?.description).toContain("zona-alvo com cones");
    expect(main.activities[1]?.description).toContain("primeiro contato");
    expect(cooldown.activities[0]?.description).toContain("reduza gradualmente a intensidade");
  });

  it("preserves spaces and temporarily empty activities while editing", () => {
    const next = updateClassTrainingPlanBlock(plan, "main", {
      duration: "40",
      objective: "Executar o passe com continuidade.",
      activities: [
        { name: " Passe em duplas ", description: " Trocas com alvo. " },
        { name: "", description: "Em edição" },
      ],
    });

    expect(next.mainTime).toBe("40");
    expect(next.main).toEqual([" Passe em duplas ", ""]);
    expect(next.pedagogy?.blocks?.main.summary).toBe("Executar o passe com continuidade.");
    expect(next.pedagogy?.blocks?.main.activities[0]).toEqual({
      name: " Passe em duplas ",
      description: " Trocas com alvo. ",
    });
    expect(buildClassPlanBlockDraft(next, "main").activities[1]).toEqual({
      name: "",
      description: "Em edição",
    });
    expect(plan.main).toEqual(["Atividade antiga"]);
  });

  it("preserves an unnamed activity when another block is edited", () => {
    const mainInProgress = updateClassTrainingPlanBlock(plan, "main", {
      duration: "45",
      objective: "Objetivo antigo",
      activities: [
        { name: "", description: "Descrição que ainda está sendo editada" },
      ],
    });
    const next = updateClassTrainingPlanBlock(mainInProgress, "warmup", {
      duration: "12",
      objective: "",
      activities: [{ name: "Novo aquecimento", description: "" }],
    });

    expect(buildClassPlanBlockDraft(next, "main").activities).toEqual([
      { name: "", description: "Descrição que ainda está sendo editada" },
    ]);
    expect(findClassPlanUnnamedActivity(next)).toEqual({
      blockKey: "main",
      index: 0,
    });
  });

  it("keeps the legacy fallback when a stored rich block has no activities", () => {
    const planWithEmptyStoredWarmup: TrainingPlan = {
      ...plan,
      warmup: ["Aquecimento legado"],
      pedagogy: {
        ...plan.pedagogy,
        blocks: {
          ...plan.pedagogy?.blocks,
          warmup: { activities: [] },
        },
      },
    };

    expect(
      buildClassPlanBlockDraft(planWithEmptyStoredWarmup, "warmup")
        .activities[0]?.name
    ).toBe("Aquecimento legado");
  });

  it("normalizes text and removes empty activities only when saving", () => {
    const draft = updateClassPlanSpecificObjective(
      updateClassTrainingPlanBlock(plan, "main", {
        duration: " 40 ",
        objective: " Objetivo do bloco ",
        activities: [
          { name: " Passe em duplas ", description: " Trocas com alvo. " },
          { name: "  ", description: "temporário" },
        ],
      }),
      " Objetivo específico da aula "
    );

    const normalized = normalizeClassTrainingPlan(draft);

    expect(normalized.mainTime).toBe("40");
    expect(normalized.main).toEqual(["Passe em duplas"]);
    expect(normalized.pedagogy?.blocks?.main).toEqual({
      summary: "Objetivo do bloco",
      activities: [{ name: "Passe em duplas", description: "Trocas com alvo." }],
    });
    expect(getClassPlanSpecificObjective(normalized)).toBe("Objetivo específico da aula");
  });

  it("preserves whole-cell PDF text without rebuilding the manual description", () => {
    const longDescription =
      "Descrição manual extensa, com organização própria, critérios de observação e adaptações que não podem ser substituídos pelo texto automático anterior.";
    const editedMain = updateClassTrainingPlanBlock(plan, "main", {
      duration: "45",
      objective: "Objetivo antigo",
      activitiesText: "1. Manchete controle e toque\n2. Situação de jogo 6x0",
      descriptionText: longDescription,
      activities: [
        { name: "Manchete controle e toque", description: "Descrição antiga" },
        { name: "Situação de jogo 6x0", description: "Outra descrição antiga" },
      ],
    });
    const afterAnotherBlockEdit = updateClassTrainingPlanBlock(editedMain, "warmup", {
      duration: "12",
      objective: "",
      activities: [{ name: "Novo aquecimento", description: "" }],
    });
    const normalized = normalizeClassTrainingPlan(afterAnotherBlockEdit);
    const mainDraft = buildClassPlanBlockDraft(normalized, "main");

    expect(mainDraft.activitiesText).toBe(
      "1. Manchete controle e toque\n2. Situação de jogo 6x0"
    );
    expect(mainDraft.descriptionText).toBe(longDescription);
    expect(normalized.pedagogy?.blocks?.main.descriptionText).toBe(longDescription);
  });

  it("clears whole-cell overrides when the structured activity list changes", () => {
    const draft = {
      ...buildClassPlanBlockDraft(plan, "main"),
      activitiesText: "Texto manual de atividades",
      descriptionText: "Texto manual de descrição",
    };

    expect(appendClassPlanActivity(draft)).toMatchObject({
      activitiesText: undefined,
      descriptionText: undefined,
    });
    expect(
      removeClassPlanActivity(
        { ...draft, activities: [...draft.activities, { name: "Outra", description: "" }] },
        1
      )
    ).toMatchObject({
      activitiesText: undefined,
      descriptionText: undefined,
    });
  });

  it("adds a visible activity with a unique editable name", () => {
    const first = appendClassPlanActivity(buildClassPlanBlockDraft(plan, "main"));
    const second = appendClassPlanActivity(first);

    expect(first.activities.at(-1)).toEqual({ name: "Nova atividade", description: "" });
    expect(second.activities.at(-1)).toEqual({ name: "Nova atividade 2", description: "" });
  });

  it("removes only the selected activity and preserves the final activity in a block", () => {
    const draft = {
      ...buildClassPlanBlockDraft(plan, "main"),
      activities: [
        { name: "Primeira atividade", description: "Descrição 1" },
        { name: "Segunda atividade", description: "Descrição 2" },
      ],
    };

    expect(removeClassPlanActivity(draft, 0).activities).toEqual([
      { name: "Segunda atividade", description: "Descrição 2" },
    ]);

    const originalFinalActivityDraft = buildClassPlanBlockDraft(plan, "warmup");
    const finalActivityDraft = removeClassPlanActivity(
      originalFinalActivityDraft,
      0
    );
    expect(finalActivityDraft).toBe(originalFinalActivityDraft);
  });

  it("updates the lesson specific objective without changing block summaries or descriptions", () => {
    const next = updateClassPlanSpecificObjective(plan, "Controlar o passe para manter a continuidade.");

    expect(getClassPlanSpecificObjective(next)).toBe("Controlar o passe para manter a continuidade.");
    expect(next.pedagogy?.blocks).toEqual(plan.pedagogy?.blocks);
    expect(next.pedagogy?.blocks?.warmup.summary).toBeUndefined();
    expect(next.pedagogy?.blocks?.main.summary).toBe("Objetivo antigo");
    expect(next.pedagogy?.blocks?.main.activities[0]?.description).toBe("Descrição antiga");
  });

  it("allows clearing the specific objective without restoring a legacy fallback while editing", () => {
    const legacyPlan: TrainingPlan = {
      ...plan,
      pedagogy: { ...plan.pedagogy, sessionObjective: "Objetivo legado" },
    };

    expect(getClassPlanSpecificObjective(updateClassPlanSpecificObjective(legacyPlan, ""))).toBe("");
  });

  it("updates every editable PDF field and preserves additional pedagogical guidelines", () => {
    const source: TrainingPlan = {
      ...plan,
      pedagogy: {
        ...plan.pedagogy,
        learningObjectives: {
          general: "Geral antigo",
          specific: ["Específico antigo"],
          pedagogicalGuidelines: ["Pergunta antiga", "Orientação complementar"],
        },
      },
    };
    const next = updateClassPlanPdfContent(source, {
      generalObjective: "Geral novo",
      specificObjective: "Específico novo",
      situationProblem: "Pergunta nova?",
      observations: "Observação nova",
    });

    expect(getClassPlanPdfContentDraft(next)).toEqual({
      generalObjective: "Geral novo",
      specificObjective: "Específico novo",
      situationProblem: "Pergunta nova?",
      observations: "Observação nova",
    });
    expect(next.pedagogy?.learningObjectives?.pedagogicalGuidelines).toEqual([
      "Pergunta nova?",
      "Orientação complementar",
    ]);
    expect(next.pedagogy?.blocks).toEqual(source.pedagogy?.blocks);
  });
});
