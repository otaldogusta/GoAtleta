import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  TrainingPlan,
} from "../../../../core/models";
import { convertDailyLessonPlanToTrainingPlan } from "../convert-daily-lesson-plan-to-training-plan";
import { resolveSessionEffectivePlan } from "../resolve-session-effective-plan";

const classGroup: ClassGroup = {
  id: "class_1",
  name: "Turma 08-11",
  organizationId: "org_1",
  unit: "Rede Esperanca",
  unitId: "unit_1",
  colorKey: "green",
  modality: "voleibol",
  ageBand: "08-11",
  gender: "feminino",
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "Formacao",
  equipment: "misto",
  level: 1,
  mvLevel: "iniciante",
  cycleStartDate: "2026-01-01",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classPlan: ClassPlan = {
  id: "week_1",
  classId: classGroup.id,
  startDate: "2026-05-01",
  weekNumber: 18,
  phase: "desenvolvimento",
  theme: "Bloqueio e cobertura",
  technicalFocus: "Bloqueio",
  physicalFocus: "Coordenacao",
  constraints: "Mini 4x4",
  mvFormat: "mini jogo",
  warmupProfile: "com bola",
  jumpTarget: "baixo",
  rpeTarget: "PSE 4",
  source: "AUTO",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
};

const dailyPlan = (overrides: Partial<DailyLessonPlan> = {}): DailyLessonPlan => ({
  id: "daily_1",
  classId: classGroup.id,
  weeklyPlanId: classPlan.id,
  date: "2026-05-02",
  dayOfWeek: 6,
  title: "Etapa: bloqueio inicial",
  blocksJson: JSON.stringify([
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: 12,
      activities: [{ id: "w1", name: "Deslocamento com bola", description: "Em duplas." }],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: 38,
      activities: [{ id: "m1", name: "Mini 4x4", description: "Cobertura e contra-ataque." }],
    },
    {
      key: "cooldown",
      label: "Volta a calma",
      durationMinutes: 10,
      activities: [{ id: "c1", name: "Roda final", description: "Feedback curto." }],
    },
  ]),
  sessionEnvironment: "quadra",
  sessionPrimaryComponent: "tecnico_tatico",
  warmup: "Aquecimento em duplas.",
  mainPart: "Mini 4x4 com cobertura.",
  cooldown: "Roda final.",
  observations: "Foco em leitura.",
  generationVersion: 1,
  derivedFromWeeklyVersion: 1,
  syncStatus: "in_sync",
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

const trainingPlan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: "training_1",
  classId: classGroup.id,
  title: "Treino salvo",
  tags: ["tipo:quadra"],
  warmup: ["Aquecimento"],
  main: ["Parte principal"],
  cooldown: ["Final"],
  warmupTime: "10 min",
  mainTime: "40 min",
  cooldownTime: "10 min",
  applyDays: [],
  applyDate: "2026-05-02",
  createdAt: "2026-04-29T00:00:00.000Z",
  status: "final",
  origin: "manual",
  ...overrides,
});

describe("convertDailyLessonPlanToTrainingPlan", () => {
  it("preserves daily lesson title, blocks and source tags in memory", () => {
    const converted = convertDailyLessonPlanToTrainingPlan({
      dailyPlan: dailyPlan(),
      classPlan,
      classGroup,
      studentsCount: 12,
      sessionDate: "2026-05-02",
      weekdayId: 6,
    });

    expect(converted.id).toBe("effective_daily_daily_1");
    expect(converted.applyDate).toBe("2026-05-02");
    expect(converted.title).toBe("Etapa: bloqueio inicial");
    expect(converted.tags).toContain("origem:planejamento_turma");
    expect(converted.tags).toContain("tipo:quadra");
    expect(converted.main).toEqual(["Mini 4x4"]);
    expect(converted.pedagogy?.blocks?.main.activities[0]?.description).toBe(
      "Cobertura e contra-ataque."
    );
  });

  it("uses clean teacher-facing objective and success criterion from daily observations", () => {
    const converted = convertDailyLessonPlanToTrainingPlan({
      dailyPlan: dailyPlan({
        observations: [
          "Objetivo da aula: Desenvolver controlar a primeira bola em jogo.",
          "Foco da aula: Manchete e recepção com alvo.",
          "Critério de sucesso: Realizar 3 recepções controladas em sequência.",
        ].join("\n"),
      }),
      classPlan,
      classGroup,
      studentsCount: 12,
      sessionDate: "2026-05-02",
      weekdayId: 6,
    });

    expect(converted.pedagogy?.sessionObjective).toBe(
      "Desenvolver o controle da primeira bola em jogo."
    );
    expect(converted.pedagogy?.sessionObjective).not.toContain("Desenvolver controlar");
    expect(converted.pedagogy?.learningObjectives?.specific).toContain(
      "Manchete e recepção com alvo."
    );
    expect(converted.pedagogy?.learningObjectives?.successCriteria).toContain(
      "Realizar 3 recepções controladas em sequência."
    );
  });
});

describe("resolveSessionEffectivePlan", () => {
  it("uses a saved court DailyLessonPlan when no TrainingPlan exists", async () => {
    const result = await resolveSessionEffectivePlan({
      classGroup,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      currentTrainingPlan: null,
      currentClassPlan: classPlan,
      currentDailyLessonPlan: dailyPlan(),
      studentsCount: 12,
    });

    expect(result.source).toBe("daily_lesson_plan");
    expect(result.plan?.title).toBe("Etapa: bloqueio inicial");
    expect(result.conflict?.kind).toBe("missing_training_plan");
  });

  it("keeps an academy DailyLessonPlan as the effective plan without persisting", async () => {
    const result = await resolveSessionEffectivePlan({
      classGroup,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      currentTrainingPlan: null,
      currentClassPlan: classPlan,
      currentDailyLessonPlan: dailyPlan({
        sessionEnvironment: "academia",
        sessionPrimaryComponent: "resistido",
        sessionComponents: [
          {
            type: "academia_resistido",
            durationMin: 30,
            resistancePlan: {
              id: "res_1",
              label: "Forca base",
              primaryGoal: "forca_base",
              transferTarget: "salto de bloqueio",
              estimatedDurationMin: 30,
              exercises: [
                {
                  name: "Agachamento",
                  category: "membros_inferiores",
                  sets: 3,
                  reps: "8",
                  rest: "90s",
                },
              ],
            },
          },
        ],
      }),
      studentsCount: 12,
    });

    expect(result.source).toBe("daily_lesson_plan");
    expect(result.plan?.tags).toContain("tipo:academia");
    expect(result.plan?.main[0]).toBe("Mini 4x4");
  });

  it("prioritizes DailyLessonPlan and reports conflict when environments diverge", async () => {
    const result = await resolveSessionEffectivePlan({
      classGroup,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      currentTrainingPlan: trainingPlan({
        id: "training_academia",
        tags: ["tipo:academia"],
        title: "Treino de academia",
      }),
      currentClassPlan: classPlan,
      currentDailyLessonPlan: dailyPlan({ sessionEnvironment: "quadra" }),
      studentsCount: 12,
    });

    expect(result.source).toBe("daily_lesson_plan");
    expect(result.plan?.id).toBe("effective_daily_daily_1");
    expect(result.conflict).toMatchObject({
      kind: "environment_mismatch",
      dailyEnvironment: "quadra",
      trainingEnvironment: "academia",
    });
  });

  it("returns none when no plan exists", async () => {
    const result = await resolveSessionEffectivePlan({
      classGroup,
      sessionDate: "2026-05-02",
      weekdayId: 6,
      currentTrainingPlan: null,
      currentClassPlan: classPlan,
      currentDailyLessonPlan: null,
      studentsCount: 12,
    });

    expect(result).toEqual({ plan: null, source: "none", conflict: null });
  });
});
