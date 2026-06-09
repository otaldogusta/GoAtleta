import type { TrainingPlan } from "../models";
import {
  getResolvedTrainingPlanActivityNames,
  resolveTrainingPlanBlock,
} from "../training-plan-blocks";

const basePlan = (): TrainingPlan => ({
  id: "plan-1",
  classId: "class-1",
  title: "Aula do dia",
  tags: [],
  warmup: ["Aquecimento legado"],
  main: ["Principal legado"],
  cooldown: ["Volta legado"],
  warmupTime: "10 min",
  mainTime: "45 min",
  cooldownTime: "5 min",
  createdAt: "2026-06-13T00:00:00.000Z",
});

describe("training plan block resolution", () => {
  it("prefers pedagogy blocks over legacy arrays", () => {
    const plan: TrainingPlan = {
      ...basePlan(),
      pedagogy: {
        blocks: {
          warmup: {
            summary: "Resumo rico",
            activities: [{ name: "Pega-pega dos 3 contatos", description: "Texto operacional." }],
          },
          main: {
            activities: [{ name: "Passe em duplas para voltar jogável", description: "Texto operacional." }],
          },
          cooldown: {
            activities: [{ name: "Conversa e feedbacks finais", description: "Texto operacional." }],
          },
        },
      },
    };

    expect(resolveTrainingPlanBlock(plan, "warmup")).toMatchObject({
      source: "pedagogy",
      summary: "Resumo rico",
    });
    expect(getResolvedTrainingPlanActivityNames(plan, "main")).toEqual([
      "Passe em duplas para voltar jogável",
    ]);
  });

  it("falls back to legacy arrays when rich blocks are absent", () => {
    const plan = basePlan();

    expect(resolveTrainingPlanBlock(plan, "main")).toMatchObject({
      source: "legacy",
      activities: [{ name: "Principal legado", description: "" }],
    });
  });
});
