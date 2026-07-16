import type { TrainingPlan } from "../../../../core/models";
import {
  appendClassPlanActivity,
  buildClassPlanBlockDraft,
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

  it("updates structured and legacy activities without mutating the source", () => {
    const next = updateClassTrainingPlanBlock(plan, "main", {
      duration: "40",
      objective: "Executar o passe com continuidade.",
      activities: [
        { name: " Passe em duplas ", description: " Trocas com alvo. " },
        { name: "Jogo reduzido", description: "" },
      ],
    });

    expect(next.mainTime).toBe("40");
    expect(next.main).toEqual(["Passe em duplas", "Jogo reduzido"]);
    expect(next.pedagogy?.blocks?.main.summary).toBe("Executar o passe com continuidade.");
    expect(next.pedagogy?.blocks?.main.activities[0]).toEqual({
      name: "Passe em duplas",
      description: "Trocas com alvo.",
    });
    expect(plan.main).toEqual(["Atividade antiga"]);
  });

  it("adds a visible activity with a unique editable name", () => {
    const first = appendClassPlanActivity(buildClassPlanBlockDraft(plan, "main"));
    const second = appendClassPlanActivity(first);

    expect(first.activities.at(-1)).toEqual({ name: "Nova atividade", description: "" });
    expect(second.activities.at(-1)).toEqual({ name: "Nova atividade 2", description: "" });
  });
});
