import { resolveSessionStrategyDecisionFromCycleContext } from "../../../core/cycle-day-planning/resolve-session-strategy-from-cycle-context";
import type {
    ClassGroup,
    ClassPlan,
    SessionStrategy,
} from "../../../core/models";
import type { NextPedagogicalStep } from "../../../core/pedagogy/pedagogical-types";
import { buildPeriodizationAutoPlanForCycleDay, buildPeriodizationWeekSchedule } from "../application/build-auto-plan-for-cycle-day";
import { buildPeriodizationCycleDayPlanningContext } from "../application/build-cycle-day-planning-context";
import { resolveWeekStrategyFromCycleContext } from "../application/resolve-week-strategy-from-cycle-context";

const nextPedagogicalStep: NextPedagogicalStep = {
  stageId: "12-14_q_long_01",
  currentStage: "Consolidação de continuidade com leitura coletiva",
  gameForm: "4x4",
  complexityLevel: "moderado",
  nextStep: ["collective_reading", "decision_under_pressure"],
  pedagogicalConstraints: ["preservar coerência entre sessões"],
  blockRecommendations: {
    warmup: {
      objective: "ativação coordenativa",
      taskStyle: "duplas",
      intensity: "low",
      contexts: ["cooperative_control"],
    },
    main: {
      objective: "aplicação coletiva",
      taskStyle: "jogo reduzido",
      intensity: "medium",
      contexts: ["application_game"],
    },
    cooldown: {
      objective: "síntese",
      taskStyle: "feedback guiado",
      intensity: "low",
      contexts: ["reflection"],
    },
  },
  selectionReason: "Progressão longitudinal com contraste semanal e fechamento trimestral.",
  originMonthIndex: 8,
  chosenBy: "catalog_with_history",
  alreadyIntroduced: ["ball_control_pairs"],
  alreadyPracticedContexts: ["cooperative_control"],
};

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_longitudinal",
  name: "Turma Longitudinal",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "amber",
  modality: "voleibol",
  ageBand: "13-15",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:30",
  durationMinutes: 90,
  daysOfWeek: [2, 4, 6],
  daysPerWeek: 3,
  goal: "Leitura coletiva, transição e aplicação em jogo",
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
  id: "cp_longitudinal",
  classId: "class_longitudinal",
  startDate: "2026-03-30",
  weekNumber: 8,
  phase: "competitivo",
  theme: "Aplicação coletiva sob contraste de carga",
  technicalFocus: "Transição",
  physicalFocus: "Agilidade",
  constraints: "leitura, decisão, continuidade",
  mvFormat: "6x6",
  warmupProfile: "dinamico",
  jumpTarget: "medio",
  rpeTarget: "PSE 7",
  source: "AUTO",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildWeekPlan = (overrides: Record<string, unknown> = {}) => ({
  week: 8,
  title: "competitivo",
  focus: "Aplicação coletiva sob contraste de carga",
  volume: "alto" as const,
  notes: ["leitura coletiva", "tomada de decisão"],
  jumpTarget: "medio",
  PSETarget: "PSE 7",
  plannedSessionLoad: 620,
  plannedWeeklyLoad: 1860,
  source: "AUTO" as const,
  ...overrides,
});

const strategySignature = (strategy: SessionStrategy) => ({
  progressionDimension: strategy.progressionDimension,
  gameTransferLevel: strategy.gameTransferLevel,
  loadIntent: strategy.loadIntent,
  drillFamilies: strategy.drillFamilies,
});

const expectPipelineConsistency = (entry: {
  resolved: ReturnType<typeof resolveSessionStrategyDecisionFromCycleContext>;
  autoPlan: ReturnType<typeof buildPeriodizationAutoPlanForCycleDay>;
}) => {
  expect(strategySignature(entry.autoPlan.strategy)).toEqual(
    strategySignature(entry.resolved.strategy)
  );
};

const toSyntheticRecentSession = (
  autoPlan: ReturnType<typeof buildPeriodizationAutoPlanForCycleDay>,
  dominantBlock?: string
) => ({
  sessionDate: autoPlan.sessionDate,
  wasPlanned: true,
  wasApplied: false,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: null,
  executionState: "planned_only" as const,
  primarySkill: autoPlan.strategy.primarySkill,
  secondarySkill: autoPlan.strategy.secondarySkill,
  progressionDimension: autoPlan.strategy.progressionDimension,
  dominantBlock,
  fingerprint: autoPlan.fingerprint,
  structuralFingerprint: autoPlan.structuralFingerprint,
  teacherOverrideWeight: "none" as const,
});

const runLongitudinalScenario = (params: {
  monthIndex: number;
  weeklySessions: 2 | 3;
  weeklyVolume: "baixo" | "médio" | "alto";
  historicalConfidence: number;
  recentTeacherOverrides?: string[];
  ageBandKey?: "08-10" | "11-12" | "12-14";
  dominantBlock?: string;
  classGroupOverrides?: Partial<ClassGroup>;
  classPlanOverrides?: Partial<ClassPlan>;
  weekPlanOverrides?: Record<string, unknown>;
}) => {
  const weeklySessions = params.weeklySessions;
  const daysOfWeek = weeklySessions === 2 ? [2, 4] : [2, 4, 6];
  const classGroup = buildClassGroup({
    daysOfWeek,
    daysPerWeek: weeklySessions,
    ...params.classGroupOverrides,
  });
  const classPlan = buildClassPlan({ classId: classGroup.id, ...params.classPlanOverrides });
  const weekPlan = buildWeekPlan({ ...params.weekPlanOverrides });
  const weeklyStrategy = resolveWeekStrategyFromCycleContext({
    ageBand: params.ageBandKey ?? "12-14",
    monthIndex: params.monthIndex,
    weeklySessions,
    weeklyVolume: params.weeklyVolume,
    historicalConfidence: params.historicalConfidence,
    recentTeacherOverrides: params.recentTeacherOverrides ?? [],
    nextPedagogicalStep,
  });

  const schedule = buildPeriodizationWeekSchedule({
    classGroup,
    classPlan,
    weekPlan,
    cycleStartDate: classGroup.cycleStartDate,
    periodizationModel: "formacao",
    sportProfile: "voleibol",
    weeklySessions,
    dominantBlock: params.dominantBlock ?? "Aplicacao em jogo",
    macroLabel: "Macro competitivo",
    mesoLabel: "Meso de coerência",
    weeklyOperationalDecisions: weeklyStrategy.decisions,
  });

  const trainingDays = schedule.filter(
    (item): item is typeof item & { autoPlan: NonNullable<typeof item.autoPlan> } => Boolean(item.autoPlan)
  );
  const syntheticRecentSessions: ReturnType<typeof toSyntheticRecentSession>[] = [];

  const pipeline = trainingDays.map((item, index) => {
    const decision = weeklyStrategy.decisions[index]!;
    const dominantBlock = params.dominantBlock ?? "Aplicacao em jogo";
    const context = buildPeriodizationCycleDayPlanningContext({
      classGroup,
      classPlan,
      weekPlan,
      sessionDate: item.date,
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions,
      dominantBlock,
      macroLabel: "Macro competitivo",
      mesoLabel: "Meso de coerência",
      recentSessions: syntheticRecentSessions,
      weeklyOperationalDecision: decision,
    });
    const resolved = resolveSessionStrategyDecisionFromCycleContext(context.cycleContext);
    syntheticRecentSessions.unshift(toSyntheticRecentSession(item.autoPlan, dominantBlock));

    return {
      decision,
      context,
      resolved,
      autoPlan: item.autoPlan,
    };
  });

  return {
    weeklyStrategy,
    pipeline,
  };
};

describe("weekly-session longitudinal coherence", () => {
  it("changes the week and final session behavior when the quarter changes", () => {
    const q3 = runLongitudinalScenario({
      monthIndex: 8,
      weeklySessions: 2,
      weeklyVolume: "alto",
      historicalConfidence: 0.9,
      ageBandKey: "11-12",
    });
    const q4 = runLongitudinalScenario({
      monthIndex: 12,
      weeklySessions: 2,
      weeklyVolume: "alto",
      historicalConfidence: 0.9,
      ageBandKey: "11-12",
    });

    const q3Last = q3.pipeline[1]!;
    const q4Last = q4.pipeline[1]!;

    expect(q3.weeklyStrategy.decisions[1]?.sessionRole).toBe("transferencia_jogo");
    expect(q4.weeklyStrategy.decisions[1]?.sessionRole).toBe("sintese_fechamento");
    expect(q4.weeklyStrategy.decisions[1]?.appliedRules).toContain("quarterly_closing_alignment");
    expect(q4Last.context.cycleContext.weeklyOperationalDecision?.closingType).toBe("fechamento");
    expectPipelineConsistency(q3Last);
    expectPipelineConsistency(q4Last);
    expect(q3Last.autoPlan.strategy.loadIntent).toBe("alto");
    expect(q4Last.autoPlan.strategy.loadIntent).toBe("moderado");
    expect(q4Last.autoPlan.strategy.drillFamilies[0]).toBe("jogo_condicionado");
  });

  it("keeps distinct weekly roles coherent across daily execution", () => {
    const scenario = runLongitudinalScenario({
      monthIndex: 8,
      weeklySessions: 3,
      weeklyVolume: "alto",
      historicalConfidence: 0.9,
      classPlanOverrides: {
        phase: "pre_competitivo",
        rpeTarget: "PSE 6",
      },
      weekPlanOverrides: {
        title: "pre_competitivo",
        PSETarget: "PSE 6",
        plannedSessionLoad: 540,
        plannedWeeklyLoad: 1620,
      },
    });

    const [first, second, third] = scenario.pipeline;

    expect(scenario.weeklyStrategy.decisions.map((decision) => decision.sessionRole)).toEqual([
      "introducao_exploracao",
      "pressao_decisao",
      "transferencia_jogo",
    ]);
    expect(first?.context.cycleContext.weeklyOperationalDecision?.sessionRole).toBe("introducao_exploracao");
    expect(second?.context.cycleContext.weeklyOperationalDecision?.sessionRole).toBe("pressao_decisao");
    expect(third?.context.cycleContext.weeklyOperationalDecision?.sessionRole).toBe("transferencia_jogo");
    expectPipelineConsistency(first!);
    expectPipelineConsistency(second!);
    expectPipelineConsistency(third!);
    expect(first?.autoPlan.strategy.progressionDimension).toBe("precisao");
    expect(["pressao_tempo", "oposicao", "tomada_decisao"]).toContain(
      second?.autoPlan.strategy.progressionDimension
    );
    expect(["medium", "high"]).toContain(second?.autoPlan.strategy.timePressureLevel);
    expect(third?.autoPlan.strategy.progressionDimension).toBe("tomada_decisao");
    expect(third?.autoPlan.strategy.gameTransferLevel).toBe("high");
  });

  it("keeps review-lock weeks from escaping into transfer-heavy sessions", () => {
    const scenario = runLongitudinalScenario({
      monthIndex: 8,
      weeklySessions: 2,
      weeklyVolume: "médio",
      historicalConfidence: 0.5,
      recentTeacherOverrides: ["revisar e consolidar fundamentos da turma"],
      dominantBlock: "Base tecnica",
      classPlanOverrides: {
        phase: "competitivo",
        rpeTarget: "PSE 6",
      },
      weekPlanOverrides: {
        title: "competitivo",
        volume: "médio",
        PSETarget: "PSE 6",
        plannedSessionLoad: 480,
        plannedWeeklyLoad: 960,
      },
    });

    expect(scenario.weeklyStrategy.weekRulesApplied).toContain("recent_history_review_lock");
    expect(scenario.weeklyStrategy.decisions.map((decision) => decision.sessionRole)).toEqual([
      "retomada_consolidacao",
      "consolidacao_orientada",
    ]);

    for (const entry of scenario.pipeline) {
      expectPipelineConsistency(entry);
      expect(entry.autoPlan.strategy.gameTransferLevel).not.toBe("high");
      expect(entry.autoPlan.strategy.drillFamilies[0]).not.toBe("jogo_condicionado");
    }

    expect(scenario.pipeline[0]?.autoPlan.strategy.progressionDimension).toBe("precisao");
  });

  it("preserves intensive contrast without breaking the younger age band envelope", () => {
    const scenario = runLongitudinalScenario({
      monthIndex: 5,
      weeklySessions: 3,
      weeklyVolume: "alto",
      historicalConfidence: 0.9,
      ageBandKey: "08-10",
      classGroupOverrides: {
        ageBand: "09-11",
        goal: "Coordenação, leitura e continuidade",
      },
      classPlanOverrides: {
        phase: "desenvolvimento",
        rpeTarget: "PSE 7",
      },
      weekPlanOverrides: {
        title: "desenvolvimento",
        focus: "Contraste intensivo controlado",
        PSETarget: "PSE 7",
        plannedSessionLoad: 590,
        plannedWeeklyLoad: 1770,
      },
    });

    const second = scenario.pipeline[1]!;

    expect(scenario.weeklyStrategy.decisions[1]?.sessionRole).toBe("pressao_decisao");
    expectPipelineConsistency(second);
    expect(["pressao_tempo", "oposicao"]).toContain(second.autoPlan.strategy.progressionDimension);
    expect(second.autoPlan.strategy.loadIntent).toBe("moderado");
    expect(second.autoPlan.strategy.oppositionLevel).toBe("medium");
    expect(second.autoPlan.strategy.timePressureLevel).toBe("medium");
  });
});
