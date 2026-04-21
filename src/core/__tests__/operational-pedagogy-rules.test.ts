import { applyOperationalPedagogyRules } from "../cycle-day-planning/apply-operational-pedagogy-rules";
import type { CycleDayPlanningContext, SessionStrategy } from "../models";

const buildContext = (overrides: Partial<CycleDayPlanningContext> = {}): CycleDayPlanningContext => ({
  classId: "class_1",
  classGoal: "Fundamentos e organização",
  sessionDate: "2026-04-08",
  modality: "voleibol",
  classLevel: 1,
  ageBand: "09-11",
  daysPerWeek: 2,
  developmentStage: "fundamental",
  planningPhase: "base",
  weekNumber: 5,
  sessionIndexInWeek: 1,
  historicalConfidence: "medium",
  phaseIntent: "exploracao_fundamentos",
  weeklyLoadIntent: "baixo",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimensionTarget: "consistencia",
  pedagogicalIntent: "technical_adjustment",
  recentSessions: [],
  dominantGapSkill: "passe",
  dominantGapType: "tecnica",
  dominantBlock: "Base tecnica",
  targetPse: 4,
  demandIndex: 3,
  plannedSessionLoad: 240,
  plannedWeeklyLoad: 480,
  duration: 60,
  materials: ["bola"],
  constraints: [],
  mustAvoidRepeating: [],
  mustProgressFrom: "fundamentos basicos",
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "cooperacao"],
  forbiddenDrillFamilies: [],
  ...overrides,
});

const buildStrategy = (overrides: Partial<SessionStrategy> = {}): SessionStrategy => ({
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "tomada_decisao",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "alto",
  drillFamilies: ["jogo_condicionado", "cooperacao"],
  forbiddenDrillFamilies: [],
  oppositionLevel: "high",
  timePressureLevel: "high",
  gameTransferLevel: "high",
  ...overrides,
});

describe("operational pedagogy rules", () => {
  it("makes age band a hard constraint over load and complexity", () => {
    const result = applyOperationalPedagogyRules({
      context: buildContext(),
      strategy: buildStrategy(),
    });

    expect(result.strategy.loadIntent).not.toBe("alto");
    expect(result.strategy.oppositionLevel).not.toBe("high");
    expect(result.strategy.timePressureLevel).not.toBe("high");
    expect(result.influence.rulesApplied).toContain("age_band_hard_constraint");
  });

  it("locks progression down when recent teacher-edited history indicates review", () => {
    const result = applyOperationalPedagogyRules({
      context: buildContext({
        recentSessions: [
          {
            sessionDate: "2026-04-05",
            wasPlanned: true,
            wasApplied: true,
            wasEditedByTeacher: true,
            wasConfirmedExecuted: true,
            executionState: "teacher_edited",
            primarySkill: "passe",
            progressionDimension: "tomada_decisao",
            teacherOverrideWeight: "strong",
          },
        ],
      }),
      strategy: buildStrategy({ progressionDimension: "oposicao", loadIntent: "moderado" }),
    });

    expect(result.strategy.progressionDimension).toBe("consistencia");
    expect(result.influence.rulesApplied).toContain("recent_history_review_lock");
  });

  it("forces at least one evolution axis when the stimulus is repeating", () => {
    const result = applyOperationalPedagogyRules({
      context: buildContext({
        developmentStage: "especializado",
        ageBand: "13-15",
        phaseIntent: "estabilizacao_tecnica",
        sessionIndexInWeek: 2,
        targetPse: 5,
        recentSessions: [
          {
            sessionDate: "2026-04-05",
            wasPlanned: true,
            wasApplied: true,
            wasEditedByTeacher: false,
            wasConfirmedExecuted: true,
            executionState: "confirmed_executed",
            primarySkill: "passe",
            progressionDimension: "precisao",
            teacherOverrideWeight: "none",
          },
        ],
      }),
      strategy: buildStrategy({
        progressionDimension: "precisao",
        loadIntent: "moderado",
        oppositionLevel: "medium",
        timePressureLevel: "medium",
        gameTransferLevel: "low",
      }),
    });

    expect(result.strategy.progressionDimension).toBe("pressao_tempo");
    expect(result.influence.rulesApplied).toContain("anti_repetition_progression_axis");
  });

  it("respects weekly transfer role as an execution guardrail", () => {
    const result = applyOperationalPedagogyRules({
      context: buildContext({
        developmentStage: "especializado",
        ageBand: "13-15",
        phaseIntent: "transferencia_jogo",
        sessionIndexInWeek: 2,
        weeklyOperationalDecision: {
          sessionIndexInWeek: 2,
          sessionRole: "transferencia_jogo",
          quarterFocus: "Aplicar decisões no jogo reduzido.",
          appliedRules: ["quarterly_anchor_alignment"],
          driftRisks: [],
          quarter: "Q3",
          closingType: "aplicacao",
        },
      }),
      strategy: buildStrategy({
        progressionDimension: "precisao",
        loadIntent: "moderado",
        oppositionLevel: "medium",
        timePressureLevel: "medium",
        gameTransferLevel: "low",
      }),
    });

    expect(result.strategy.progressionDimension).toBe("tomada_decisao");
    expect(result.strategy.gameTransferLevel).toBe("medium");
    expect(result.influence.rulesApplied).toContain("weekly_role_authority");
  });
});
