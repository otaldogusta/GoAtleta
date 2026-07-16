import type { ClassGroup, TrainingPlan } from "../../../../core/models";
import { buildSessionMonthlyPlanData } from "../../../../pdf/templates/session-plan";
import { buildClassPlanPdfData } from "../build-class-plan-pdf-data";

const classGroup = {
  id: "class-1",
  name: "Primeiros Saques",
  unit: "Rede Esperança",
  ageBand: "8-11 anos",
  gender: "misto",
  startTime: "14:00",
  durationMinutes: 60,
} as ClassGroup;

const plan = {
  id: "plan-1",
  classId: classGroup.id,
  title: "Diagnóstico do contato sem segurar a bola",
  tags: [],
  warmup: ["Bola no ar com balão"],
  main: ["Diagnóstico individual", "Situação-problema"],
  cooldown: ["Roda de conversa"],
  warmupTime: "10 min",
  mainTime: "45 min",
  cooldownTime: "5 min",
  createdAt: "2026-07-01T12:00:00.000Z",
  pedagogy: {
    learningObjectives: {
      general: "Identificar quando a bola é segurada durante a recepção.",
      specific: ["Executar toque e manchete sem interromper o movimento da bola."],
      pedagogicalGuidelines: ["Quantas recepções seguidas a dupla consegue realizar sem segurar?"],
    },
  },
} as TrainingPlan;

describe("buildClassPlanPdfData", () => {
  it("preserva o modelo pedagógico, os horários e as atividades da aula", () => {
    const data = buildClassPlanPdfData({
      classGroup,
      plan,
      lessonDate: "2026-07-15",
      coachName: "Gustavo Ribeiro dos Santos",
    });
    const monthly = buildSessionMonthlyPlanData(data);
    const lesson = monthly.lessons[0];

    expect(data.timeLabel).toBe("14h às 15h");
    expect(data.blocks.map((block) => block.durationMinutes)).toEqual([10, 45, 5]);
    expect(lesson.blocks[1]).toMatchObject({
      period: "Parte principal",
      activities: "1. Diagnóstico individual\n2. Situação-problema",
      time: "45'",
    });
    expect(lesson.observations).toBe("");
  });
});
