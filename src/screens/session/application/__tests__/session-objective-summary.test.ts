import { buildSessionObjectiveFromPlanContent, resolveSessionObjectiveText } from "../session-objective-summary";
import type { TrainingPlan } from "../../../../core/models";

const basePlan: TrainingPlan = {
  id: "plan_1",
  classId: "class_1",
  title: "Plano antigo",
  warmup: ["Reage e vai!"],
  main: ["Manchecone", "Tocone"],
  cooldown: ["Roda final"],
  applyDays: [],
  status: "final",
  version: 1,
  pedagogy: {
    sessionObjective: "Objetivo antigo congelado.",
    focus: { skill: "levantamento" },
    progression: { dimension: "decisao" },
    blocks: {
      warmup: {
        summary: "Ativacao",
        activities: [{ name: "Reage e vai!", description: "" }],
      },
      main: {
        summary: "Jogo reduzido",
        activities: [
          { name: "3x3 com tres contatos", description: "" },
          { name: "Rodizio com comunicacao", description: "" },
        ],
      },
      cooldown: {
        summary: "Fechamento",
        activities: [{ name: "Roda final", description: "" }],
      },
    },
  },
};

describe("session objective summary", () => {
  it("derives the visible objective from current plan content before stale generated text", () => {
    expect(resolveSessionObjectiveText(basePlan)).toBe(
      "Desenvolver levantamento em 3x3 com tres contatos e Rodizio com comunicacao, priorizando tomada de decisao."
    );
  });

  it("updates when the main block content changes", () => {
    const editedPlan: TrainingPlan = {
      ...basePlan,
      main: ["Saque alvo"],
      pedagogy: {
        ...basePlan.pedagogy,
        blocks: {
          ...basePlan.pedagogy?.blocks,
          main: {
            summary: "Saque em alvo",
            activities: [{ name: "Saque em zonas", description: "" }],
          },
        } as NonNullable<TrainingPlan["pedagogy"]>["blocks"],
      },
    };

    expect(buildSessionObjectiveFromPlanContent(editedPlan)).toBe(
      "Desenvolver saque em Saque em zonas, priorizando tomada de decisao."
    );
  });

  it("prefers structured activity skill over stale stored focus", () => {
    const editedPlan: TrainingPlan = {
      ...basePlan,
      pedagogy: {
        ...basePlan.pedagogy,
        focus: { skill: "levantamento" },
        blocks: {
          ...basePlan.pedagogy?.blocks,
          main: {
            summary: "Passe",
            activities: [
              {
                name: "Passe orientado",
                description: "Organização: duplas. Execução: manchete para alvo.",
                primarySkill: "passe",
              },
              {
                name: "Passe para alvo em duplas",
                description: "Primeiro contato jogável.",
                primarySkill: "passe",
              },
            ],
          },
        } as NonNullable<TrainingPlan["pedagogy"]>["blocks"],
      },
    };

    expect(buildSessionObjectiveFromPlanContent(editedPlan)).toBe(
      "Desenvolver passe em Passe orientado e Passe para alvo em duplas, priorizando tomada de decisao."
    );
  });

  it("preserves a manually edited objective", () => {
    const editedPlan: TrainingPlan = {
      ...basePlan,
      pedagogy: {
        ...basePlan.pedagogy,
        sessionObjective: "Trabalhar comunicacao antes do ataque.",
        sessionObjectiveSource: "manual",
      },
    };

    expect(resolveSessionObjectiveText(editedPlan)).toBe(
      "Trabalhar comunicacao antes do ataque."
    );
  });
});
