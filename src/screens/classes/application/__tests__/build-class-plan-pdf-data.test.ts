import type { ClassGroup, TrainingPlan } from "../../../../core/models";
import { buildSessionMonthlyPlanData } from "../../../../pdf/templates/session-plan";
import { buildClassPlanPdfData } from "../build-class-plan-pdf-data";
import {
  updateClassPlanPdfContent,
  updateClassTrainingPlanBlock,
} from "../edit-class-training-plan";

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
    expect(lesson.blocks.every((block) => block.description !== "-")).toBe(true);
    expect(lesson.observations).toBe("");
  });

  it("leva a edição do objetivo específico ao cabeçalho sem apagar a descrição do aquecimento", () => {
    const originalLesson = buildSessionMonthlyPlanData(
      buildClassPlanPdfData({ classGroup, plan, lessonDate: "2026-07-15" })
    ).lessons[0];
    const editedPlan = updateClassPlanPdfContent(plan, {
      generalObjective: "Aplicar o passe em situações de jogo.",
      specificObjective: "Direcionar o passe para uma zona-alvo com controle.",
      situationProblem: "Como manter a bola jogável para o colega?",
      observations: "Usar bolas mais leves para quem precisar.",
    });
    const lesson = buildSessionMonthlyPlanData(
      buildClassPlanPdfData({ classGroup, plan: editedPlan, lessonDate: "2026-07-15" })
    ).lessons[0];

    expect(lesson.specificObjective).toContain(
      "Procedimental: Direcionar o passe para uma zona-alvo com controle."
    );
    expect(lesson.generalObjective).toBe("Aplicar o passe em situações de jogo.");
    expect(lesson.situationProblem).toBe("Como manter a bola jogável para o colega?");
    expect(lesson.observations).toBe("Usar bolas mais leves para quem precisar.");
    expect(lesson.blocks[0]).toMatchObject({
      period: "Aquecimento",
      description: originalLesson.blocks[0]?.description,
    });
    expect(lesson.blocks[0]?.description).not.toBe("-");
  });

  it("edita todas as células pedagógicas e preserva identificação e agenda automáticas", () => {
    let editedPlan = updateClassPlanPdfContent(plan, {
      generalObjective: "Objetivo geral editado",
      specificObjective: "Objetivo específico editado",
      situationProblem: "Situação-problema editada?",
      observations: "Observações editadas",
    });
    editedPlan = updateClassTrainingPlanBlock(editedPlan, "warmup", {
      duration: "12",
      objective: "",
      activities: [{ name: "Aquecimento editado", description: "Descrição do aquecimento" }],
    });
    editedPlan = updateClassTrainingPlanBlock(editedPlan, "main", {
      duration: "40",
      objective: "",
      activities: [{ name: "Atividade principal editada", description: "Descrição principal" }],
    });
    editedPlan = updateClassTrainingPlanBlock(editedPlan, "cooldown", {
      duration: "8",
      objective: "",
      activities: [{ name: "Volta à calma editada", description: "Descrição final" }],
    });

    const lesson = buildSessionMonthlyPlanData(
      buildClassPlanPdfData({
        classGroup,
        plan: editedPlan,
        lessonDate: "2026-07-15",
        coachName: "Gustavo Ribeiro dos Santos",
      })
    ).lessons[0];

    expect(lesson).toMatchObject({
      generalObjective: "Objetivo geral editado",
      situationProblem: "Situação-problema editada?",
      observations: "Observações editadas",
      dateLabel: "quarta-feira, 15/07/2026",
      timeLabel: "14h às 15h",
    });
    expect(lesson.specificObjective).toContain("Procedimental: Objetivo específico editado");
    expect(lesson.blocks).toEqual([
      { period: "Aquecimento", activities: "Aquecimento editado", time: "12'", description: "Descrição do aquecimento" },
      { period: "Parte principal", activities: "1. Atividade principal editada", time: "40'", description: "1. Descrição principal" },
      { period: "Volta à calma", activities: "Volta à calma editada", time: "", description: "Descrição final" },
    ]);
  });
});
