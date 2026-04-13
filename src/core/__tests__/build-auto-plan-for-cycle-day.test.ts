import { buildPeriodizationWeekSchedule } from "../../screens/periodization/application/build-auto-plan-for-cycle-day";
import { buildAutoPlanForCycleDay } from "../../screens/session/application/build-auto-plan-for-cycle-day";
import { buildRecentSessionSummary } from "../../screens/session/application/build-recent-session-summary";
import type {
    ClassGroup,
    ClassPlan,
    RecentSessionSummary,
    SessionLog,
    Student,
    TrainingPlan,
    TrainingSession,
} from "../models";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Turma Sub-15",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "13-15",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:30",
  durationMinutes: 90,
  daysOfWeek: [2, 4, 6],
  daysPerWeek: 3,
  goal: "Recepcao e transicao",
  equipment: "quadra",
  level: 2,
  mvLevel: "intermediario",
  cycleStartDate: "2026-03-02",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildClassPlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "cp_1",
  classId: "class_1",
  startDate: "2026-03-30",
  weekNumber: 5,
  phase: "desenvolvimento",
  theme: "Recepcao sob pressao",
  technicalFocus: "Passe",
  physicalFocus: "Coordenacao",
  constraints: "bola rapida, leitura",
  mvFormat: "6x6",
  warmupProfile: "dinamico",
  jumpTarget: "baixo",
  rpeTarget: "PSE 5",
  source: "AUTO",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildStudent = (overrides: Partial<Student> = {}): Student => ({
  id: "student_1",
  name: "Ana",
  organizationId: "org_1",
  classId: "class_1",
  age: 14,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  birthDate: "2012-01-01",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildTrainingPlan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: "plan_1",
  classId: "class_1",
  title: "Treino base",
  tags: [],
  warmup: ["Mobilidade"],
  main: ["Passe alvo"],
  cooldown: ["Respiracao"],
  warmupTime: "15 min",
  mainTime: "40 min",
  cooldownTime: "5 min",
  applyDays: [2],
  applyDate: "2026-04-07",
  createdAt: "2026-04-01T10:00:00.000Z",
  version: 1,
  status: "generated",
  origin: "auto",
  inputHash: "hash_1",
  pedagogy: {
    focus: { skill: "passe" },
    progression: { dimension: "consistencia" },
    sessionObjective: "Estabilizar recepcao",
  },
  ...overrides,
});

const buildTrainingSession = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: "session_1",
  organizationId: "org_1",
  title: "Sessao",
  description: "",
  startAt: "2026-04-07T12:00:00.000Z",
  endAt: "2026-04-07T13:30:00.000Z",
  status: "completed",
  type: "training",
  source: "plan",
  planId: "plan_1",
  classIds: ["class_1"],
  createdAt: "2026-04-07T12:00:00.000Z",
  updatedAt: "2026-04-07T13:30:00.000Z",
  ...overrides,
});

const buildSessionLog = (overrides: Partial<SessionLog> = {}): SessionLog => ({
  id: "log_1",
  classId: "class_1",
  PSE: 5,
  technique: "ok",
  attendance: 0,
  activity: "Sessao aplicada com ajustes do professor",
  conclusion: "Boa resposta apos editar o foco principal",
  photos: "",
  createdAt: "2026-04-07T13:40:00.000Z",
  ...overrides,
});

const buildRecentSession = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-04-05",
  wasPlanned: true,
  wasApplied: true,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: true,
  executionState: "confirmed_executed",
  primarySkill: "ataque",
  secondarySkill: "bloqueio",
  progressionDimension: "tomada_decisao",
  dominantBlock: "main",
  fingerprint: "ataque:tomada_decisao:main",
  teacherOverrideWeight: "none",
  ...overrides,
});

describe("buildAutoPlanForCycleDay", () => {
  it("still builds a valid pedagogical package for classes with no history", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] }),
      classPlan: buildClassPlan({ phase: "base", rpeTarget: "PSE 4" }),
      students: [buildStudent()],
      sessionDate: "2026-04-07",
      recentPlans: [],
    });

    expect(result.cycleContext.historicalConfidence).toBe("none");
    expect(result.repetitionAdjustment.detected).toBe(false);
    expect(result.explanation.historyMode).toBe("bootstrap");
    expect(result.explanation.debug.historicalConfidence).toBe("none");
    expect(result.package.input.duration).toBe(90);
    expect(result.package.input.periodizationPhase).toBe("base");
    expect(result.package.final.main.activities.length).toBeGreaterThan(0);
  });

  it("uses the new context and strategy pipeline to shape the generated context", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 3, daysOfWeek: [2, 4, 6] }),
      classPlan: buildClassPlan({
        phase: "competitivo",
        theme: "Ataque e cobertura",
        technicalFocus: "",
        rpeTarget: "PSE 6",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession(),
        buildRecentSession({
          sessionDate: "2026-04-03",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "strong",
        }),
      ],
      sessionIndexInWeek: 2,
    });

    expect(result.cycleContext.sessionIndexInWeek).toBe(2);
    expect(typeof result.fingerprint).toBe("string");
    expect(result.explanation.historyMode).toBe("strong_history");
    expect(result.generationContext.primarySkill).toBe(result.strategy.primarySkill);
    expect(result.generationContext.progressionDimensionTarget).toBe(
      result.strategy.progressionDimension
    );
    expect(result.generationContext.allowedDrillFamilies).toEqual(result.strategy.drillFamilies);
    expect(result.package.input.constraints).toContain(
      `Skill principal: ${result.strategy.primarySkill}.`
    );
    expect(
      result.package.input.constraints.some((item) => item.includes("Favorecer familias:"))
    ).toBe(true);
  });

  it("carries teacher override influence into the auto-plan pipeline conservatively", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] }),
      classPlan: buildClassPlan({ phase: "base", technicalFocus: "", theme: "Saque" }),
      students: [buildStudent()],
      sessionDate: "2026-04-07",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "strong",
        }),
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "soft",
        }),
      ],
    });

    expect(result.strategy.primarySkill).toBe("saque");
    expect(result.strategy.progressionDimension).toBe("precisao");
    expect(result.overrideAdjusted).toBe(true);
    expect(result.explanation.debug.overrideStrength).toBe("strong");
    expect(result.explanation.debug.overrideLearningWindowGenerations).toBe(3);
    expect(result.explanation.coachSummary).toContain("Aprendizado local do professor (forte)");
    expect(result.explanation.coachSummary).toContain("proximas 3 geracoes");
    expect(result.package.input.constraints).toContain("Skill principal: saque.");
    expect(result.package.input.periodizationPhase).toBe("base");
  });

  it("surfaces dominant block influence in the explanation and strategy output", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({
        phase: "desenvolvimento",
        physicalFocus: "Organizacao ofensiva",
        technicalFocus: "Ataque",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
    });

    expect(result.cycleContext.dominantBlock).toBe("Organizacao ofensiva");
    expect(result.strategy.pedagogicalIntent).toBe("team_organization");
    expect(result.explanation.debug.dominantBlockAdjusted).toBe(true);
    expect(result.explanation.coachSummary).toContain("Bloco organizacao ofensiva priorizado");
  });

  it("surfaces load modulation in the explanation when the week target is intensive", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({
        phase: "competitivo",
        rpeTarget: "PSE 7",
        technicalFocus: "Ataque",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
    });

    expect(result.strategy.loadIntent).toBe("alto");
    expect(result.explanation.debug.loadProfileKey).toBe("intensive");
    expect(result.explanation.debug.loadAdjusted).toBe(true);
    expect(result.explanation.coachSummary).toContain("Carga intensiva");
  });

  it("surfaces anti-repetition adjustment when a recent exact clone exists", () => {
    const baseline = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [],
    });

    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: baseline.strategy.primarySkill,
          secondarySkill: baseline.strategy.secondarySkill,
          progressionDimension: baseline.strategy.progressionDimension,
          dominantBlock: baseline.cycleContext.dominantBlock,
          fingerprint: baseline.fingerprint,
          structuralFingerprint: baseline.structuralFingerprint,
        }),
      ],
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.changedFields.length).toBeGreaterThan(0);
    expect(result.explanation.coachSummary).toContain("Variacao anti-repeticao aplicada");
  });

  it("closes the periodization to session learning loop after apply and teacher edit", () => {
    const classGroup = buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] });
    const classPlan = buildClassPlan({ phase: "base", technicalFocus: "Passe", theme: "Recepcao" });
    const weekSchedule = buildPeriodizationWeekSchedule({
      classGroup,
      classPlan,
      weekPlan: {
        week: 5,
        title: "base",
        focus: "Recepcao",
        volume: "baixo",
        notes: ["construcao", "controle"],
        jumpTarget: "baixo",
        PSETarget: "PSE 4",
        plannedSessionLoad: 320,
        plannedWeeklyLoad: 640,
        source: "AUTO",
      },
      cycleStartDate: classGroup.cycleStartDate,
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 2,
      dominantBlock: "Base tecnica",
    });

    const firstSuggestedSession = weekSchedule.find((item) => item.autoPlan);

    expect(firstSuggestedSession?.autoPlan).toBeTruthy();

    const suggestedDate = firstSuggestedSession!.date;
    const suggestedAutoPlan = firstSuggestedSession!.autoPlan!;

    const generatedPlan = buildTrainingPlan({
      id: "plan_generated",
      applyDate: suggestedDate,
      applyDays: [2],
      status: "generated",
      origin: "auto",
      inputHash: suggestedAutoPlan.fingerprint,
      pedagogy: {
        focus: { skill: suggestedAutoPlan.strategy.primarySkill },
        progression: { dimension: suggestedAutoPlan.strategy.progressionDimension },
        methodology: { approach: "analitico" },
        sessionObjective: suggestedAutoPlan.sessionLabel,
      },
    });
    const editedPlan = buildTrainingPlan({
      id: "plan_final",
      applyDate: suggestedDate,
      applyDays: [2],
      status: "final",
      origin: "edited_auto",
      previousVersionId: "plan_generated",
      parentPlanId: "plan_generated",
      version: 2,
      inputHash: "edited_hash",
      main: ["Saque tatico", "Leitura e decisao"],
      pedagogy: {
        focus: { skill: "saque" },
        progression: { dimension: "transferencia_jogo" },
        methodology: { approach: "jogo" },
        override: {
          type: "methodology",
          fromRuleId: "rule_a",
          toRuleId: "rule_b",
          fromApproach: "analitico",
          toApproach: "jogo",
          createdAt: `${suggestedDate}T14:00:00.000Z`,
        },
        sessionObjective: "Saque sob pressao com leitura",
      },
    });
    const appliedSession = buildTrainingSession({
      id: "session_applied",
      startAt: `${suggestedDate}T12:00:00.000Z`,
      endAt: `${suggestedDate}T13:30:00.000Z`,
      planId: "plan_final",
      classIds: [classGroup.id],
    });
    const recentSummaries = buildRecentSessionSummary({
      classId: classGroup.id,
      plans: [generatedPlan, editedPlan],
      sessions: [appliedSession],
      sessionLogs: [
        buildSessionLog({
          classId: classGroup.id,
          createdAt: `${suggestedDate}T13:40:00.000Z`,
        }),
      ],
    });

    expect(recentSummaries).toHaveLength(1);
    expect(recentSummaries[0]).toMatchObject({
      wasApplied: true,
      wasEditedByTeacher: true,
      executionState: "teacher_edited",
      teacherOverrideWeight: "strong",
    });

    const regenerated = buildAutoPlanForCycleDay({
      classGroup,
      classPlan,
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [editedPlan],
      recentSessions: recentSummaries,
      sessionIndexInWeek: 2,
    });

    expect(regenerated.explanation.historyMode).toBe("partial_history");
    expect(regenerated.recentSessions[0]?.wasEditedByTeacher).toBe(true);
    expect(regenerated.overrideAdjusted).toBe(true);
    expect(regenerated.explanation.debug.overrideStrength).toBe("strong");
    expect(regenerated.explanation.coachSummary).toContain("Aprendizado local do professor (forte)");
  });
});
