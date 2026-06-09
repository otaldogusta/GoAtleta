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
      "Desenvolver levantamento em 3x3 com tres contatos e Rodizio com comunicacao, priorizando tomada de decisão."
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
      "Desenvolver saque em Saque em zonas, priorizando tomada de decisão."
    );
  });

  it("builds a natural pass/manchete objective without legacy activity names", () => {
    const editedPlan: TrainingPlan = {
      ...basePlan,
      title: "Turma 07-09 · Passe",
      pedagogy: {
        ...basePlan.pedagogy,
        focus: { skill: "levantamento" },
        progression: { dimension: "consistencia" },
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
                name: "Cone pega-toque",
                description: "Primeiro contato jogável sem segundo contato.",
                primarySkill: "passe",
              },
            ],
          },
        } as NonNullable<TrainingPlan["pedagogy"]>["blocks"],
      },
    };
    const objective = buildSessionObjectiveFromPlanContent(editedPlan);

    expect(objective).toBe(
      "Desenvolver o passe e a manchete em situações simples de jogo, priorizando comunicação, continuidade e primeiro contato jogável."
    );
    expect(objective).toContain("passe");
    expect(objective).toContain("manchete");
    expect(objective).toContain("primeiro contato");
    expect(objective).toContain("continuidade");
    expect(objective).toContain("comunicação");
    expect(objective).not.toContain("consistencia");
    expect(objective).not.toContain("Passe orientado");
    expect(objective).not.toContain("Cone pega-toque");
    expect(objective).not.toContain("segundo contato");
  });

  it("does not let stale pass pedagogy override edited non-pass content", () => {
    const editedPlan: TrainingPlan = {
      ...basePlan,
      title: "Plano antigo de passe",
      main: ["Saque em zonas"],
      pedagogy: {
        ...basePlan.pedagogy,
        focus: { skill: "passe" },
        objective: {
          description: "Desenvolver passe e manchete em recepção.",
        },
        progression: { dimension: "decisao" },
        blocks: {
          ...basePlan.pedagogy?.blocks,
          main: {
            summary: "Saque",
            activities: [
              {
                name: "Saque em zonas",
                description: "A turma saca para zonas largas.",
                primarySkill: "saque",
              },
            ],
          },
        } as NonNullable<TrainingPlan["pedagogy"]>["blocks"],
      },
    };
    const objective = buildSessionObjectiveFromPlanContent(editedPlan);

    expect(objective).toBe(
      "Desenvolver saque em Saque em zonas, priorizando tomada de decisão."
    );
    expect(objective).not.toContain("passe e a manchete");
    expect(objective).not.toContain("primeiro contato jogável");
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
