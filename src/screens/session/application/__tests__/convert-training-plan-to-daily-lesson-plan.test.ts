import type { ClassGroup, ClassPlan, DailyLessonPlan, TrainingPlan } from "../../../../core/models";
import { convertTrainingPlanToDailyLessonPlan } from "../convert-training-plan-to-daily-lesson-plan";
import { resolveSessionEffectivePlan } from "../resolve-session-effective-plan";

const classGroup: ClassGroup = {
  id: "class_07_09",
  name: "Turma 07-09",
  organizationId: "org_1",
  unit: "Rede Esportes Pinhais",
  unitId: "unit_1",
  colorKey: "orange",
  modality: "voleibol",
  ageBand: "07-09",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [6],
  daysPerWeek: 1,
  goal: "Formacao",
  equipment: "quadra",
  level: 1,
  mvLevel: "iniciante",
  cycleStartDate: "2026-01-01",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classPlan: ClassPlan = {
  id: "week_2026_05",
  classId: classGroup.id,
  startDate: "2026-04-30",
  weekNumber: 18,
  phase: "fundamentos",
  theme: "Recepcao",
  technicalFocus: "Manchete",
  physicalFocus: "Coordenacao",
  constraints: "Alvo fixo",
  mvFormat: "duplas",
  warmupProfile: "com bola",
  jumpTarget: "baixo",
  rpeTarget: "PSE 4",
  source: "AUTO",
  generationVersion: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
};

const oldDailyPlan: DailyLessonPlan = {
  id: "daily_old",
  classId: classGroup.id,
  weeklyPlanId: classPlan.id,
  date: "2026-05-02",
  dayOfWeek: 6,
  title: "Plano antigo",
  blocksJson: "[]",
  sessionEnvironment: "quadra",
  sessionPrimaryComponent: "tecnico_tatico",
  warmup: "Aquecimento antigo",
  mainPart: "Parte principal antiga",
  cooldown: "Volta antiga",
  observations: "Objetivo da aula: manter plano antigo",
  generationVersion: 2,
  derivedFromWeeklyVersion: 2,
  generationModelVersion: "planning-v2-pedagogical",
  syncStatus: "in_sync",
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const savedTrainingPlan: TrainingPlan = {
  id: "training_saved_pass",
  classId: classGroup.id,
  title: "Turma 07-09 - Passe",
  tags: ["tipo:quadra", "passe"],
  warmup: ["Caça ao alvo com bola\nDuplas com uma bola e cones como alvo."],
  main: ["Recepção com alvo fixo\nTrios: um lança, um recebe e um fica como alvo."],
  cooldown: ["Roda rápida de fechamento\nCada dupla aponta um ajuste para a próxima aula."],
  warmupTime: "10 min",
  mainTime: "45 min",
  cooldownTime: "5 min",
  applyDays: [],
  applyDate: "2026-05-02",
  createdAt: "2026-04-25T00:00:00.000Z",
  status: "final",
  origin: "manual",
  pedagogy: {
    sessionObjective:
      "Desenvolver o controle da primeira bola, orientando a manchete para um alvo definido.",
    learningObjectives: {
      general: "Controle da primeira bola",
      specific: ["Manchete e recepção com alvo."],
      successCriteria: ["Realizar 3 recepções controladas em sequência."],
    },
  },
};

describe("convertTrainingPlanToDailyLessonPlan", () => {
  it("turns an explicitly applied saved training plan into the authoritative daily plan", async () => {
    const dailyPlan = convertTrainingPlanToDailyLessonPlan({
      trainingPlan: savedTrainingPlan,
      classGroup,
      classPlan,
      existingDailyPlan: oldDailyPlan,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      nowIso: "2026-05-02T12:00:00.000Z",
    });

    expect(dailyPlan.id).toBe(oldDailyPlan.id);
    expect(dailyPlan.title).toBe("Turma 07-09 - Passe");
    expect(dailyPlan.mainPart).toContain("Recepção com alvo fixo");
    expect(dailyPlan.mainPart).not.toContain("Parte principal antiga");
    expect(dailyPlan.syncStatus).toBe("overridden");
    expect(dailyPlan.generationModelVersion).toBe("manual-training-plan-apply");

    const resolved = await resolveSessionEffectivePlan({
      classGroup,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      currentTrainingPlan: savedTrainingPlan,
      currentClassPlan: classPlan,
      currentDailyLessonPlan: dailyPlan,
      studentsCount: 12,
    });

    expect(resolved.source).toBe("daily_lesson_plan");
    expect(resolved.plan?.title).toBe("Turma 07-09 - Passe");
    expect(resolved.plan?.main.join(" ")).toContain("Recepção com alvo fixo");
  });
});
