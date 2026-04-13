import { applyPlanGuards } from "../cycle-day-planning/apply-plan-guards";
import { buildPlanFingerprintSet } from "../cycle-day-planning/build-plan-fingerprint";
import type { CycleDayPlanningContext, SessionStrategy } from "../models";

const buildContext = (
  overrides: Partial<CycleDayPlanningContext> = {}
): CycleDayPlanningContext => ({
  classId: "class_1",
  sessionDate: "2026-04-10",
  modality: "voleibol",
  classLevel: 2,
  ageBand: "13-15",
  daysPerWeek: 2,
  developmentStage: "especializado",
  planningPhase: "desenvolvimento",
  weekNumber: 5,
  sessionIndexInWeek: 2,
  historicalConfidence: "high",
  phaseIntent: "estabilizacao_tecnica",
  weeklyLoadIntent: "moderado",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimensionTarget: "precisao",
  pedagogicalIntent: "technical_adjustment",
  recentSessions: [],
  dominantBlock: "main",
  targetPse: 5,
  demandIndex: 6,
  plannedSessionLoad: 450,
  plannedWeeklyLoad: 900,
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "deslocamento"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  ...overrides,
});

const buildStrategy = (overrides: Partial<SessionStrategy> = {}): SessionStrategy => ({
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "precisao",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "moderado",
  drillFamilies: ["bloco_tecnico", "alvo_zona"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  oppositionLevel: "medium",
  timePressureLevel: "medium",
  gameTransferLevel: "low",
  ...overrides,
});

const buildRecentSession = (params: {
  context?: Partial<CycleDayPlanningContext>;
  strategy?: Partial<SessionStrategy>;
  sessionDate?: string;
  wasEditedByTeacher?: boolean;
  teacherOverrideWeight?: "none" | "soft" | "strong";
}) => {
  const context = buildContext({
    recentSessions: [],
    ...(params.context ?? {}),
  });
  const strategy = buildStrategy(params.strategy ?? {});
  const fingerprints = buildPlanFingerprintSet({ context, strategy });

  return {
    sessionDate: params.sessionDate ?? "2026-04-03",
    wasPlanned: true,
    wasApplied: true,
    wasEditedByTeacher: params.wasEditedByTeacher ?? false,
    wasConfirmedExecuted: true,
    executionState: params.wasEditedByTeacher ? "teacher_edited" : "confirmed_executed",
    primarySkill: strategy.primarySkill,
    secondarySkill: strategy.secondarySkill,
    progressionDimension: strategy.progressionDimension,
    dominantBlock: context.dominantBlock,
    fingerprint: fingerprints.exactFingerprint,
    structuralFingerprint: fingerprints.structuralFingerprint,
    teacherOverrideWeight: params.teacherOverrideWeight ?? "none",
  };
};

describe("applyPlanGuards", () => {
  it("does not force variation when historical confidence is none", () => {
    const context = buildContext({ historicalConfidence: "none" });
    const strategy = buildStrategy();

    const result = applyPlanGuards({
      context,
      strategy,
    });

    expect(result.strategy).toEqual(strategy);
    expect(result.repetitionAdjustment.detected).toBe(false);
    expect(result.repetitionAdjustment.risk).toBe("none");
  });

  it("varies the candidate when the fingerprint fully repeats the latest session", () => {
    const strategy = buildStrategy();
    const context = buildContext({
      recentSessions: [buildRecentSession({ strategy })],
    });

    const result = applyPlanGuards({
      context,
      strategy,
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.reason).toBe("recent_exact_clone");
    expect(result.strategy.loadIntent).toBe(strategy.loadIntent);
    expect(result.strategy.primarySkill).toBe(strategy.primarySkill);
    expect(result.repetitionAdjustment.changedFields).toContain("drillFamilies");
    expect(result.fingerprint).not.toBe(
      buildPlanFingerprintSet({ context, strategy }).exactFingerprint
    );
  });

  it("honors explicit recent sessions passed outside the context object", () => {
    const strategy = buildStrategy();
    const recentSessions = [buildRecentSession({ strategy })];
    const context = buildContext({ recentSessions: [] });

    const result = applyPlanGuards({
      context,
      strategy,
      recentSessions,
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.reason).toBe("recent_exact_clone");
  });

  it("changes progression within the same week when structural repetition accumulates", () => {
    const context = buildContext({
      sessionDate: "2026-04-10",
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-08",
          strategy: {
            drillFamilies: ["alvo_zona", "bloco_tecnico"],
            timePressureLevel: "low",
          },
        }),
        buildRecentSession({
          sessionDate: "2026-04-07",
          strategy: {
            drillFamilies: ["deslocamento", "alvo_zona"],
            timePressureLevel: "high",
          },
        }),
      ],
    });
    const strategy = buildStrategy();

    const result = applyPlanGuards({ context, strategy });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.reason).toBe("same_week_structural_repeat");
    expect(result.repetitionAdjustment.risk).toBe("high");
    expect(result.strategy.primarySkill).toBe(strategy.primarySkill);
    expect(result.strategy.progressionDimension).not.toBe(strategy.progressionDimension);
    expect(result.repetitionAdjustment.changedFields).toContain("progressionDimension");
  });

  it("does not reduce the high-load envelope just to avoid repetition", () => {
    const context = buildContext({
      weeklyLoadIntent: "alto",
      targetPse: 7,
      demandIndex: 8,
      plannedSessionLoad: 630,
      recentSessions: [
        buildRecentSession({
          strategy: {
            loadIntent: "alto",
            progressionDimension: "oposicao",
            timePressureLevel: "high",
            gameTransferLevel: "high",
            drillFamilies: ["deslocamento", "jogo_condicionado"],
          },
        }),
      ],
    });
    const strategy = buildStrategy({
      loadIntent: "alto",
      progressionDimension: "oposicao",
      timePressureLevel: "high",
      gameTransferLevel: "high",
      drillFamilies: ["deslocamento", "jogo_condicionado"],
    });

    const result = applyPlanGuards({
      context,
      strategy,
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.strategy.loadIntent).toBe("alto");
    expect(result.strategy.timePressureLevel).toBe("high");
    expect(result.strategy.gameTransferLevel).toBe("high");
  });

  it("keeps base tecnica variation inside a technical envelope", () => {
    const strategy = buildStrategy({
      loadIntent: "baixo",
      gameTransferLevel: "low",
      timePressureLevel: "low",
      drillFamilies: ["bloco_tecnico", "alvo_zona"],
    });
    const context = buildContext({
      dominantBlock: "Base tecnica",
      weeklyLoadIntent: "baixo",
      recentSessions: [buildRecentSession({ context: { dominantBlock: "Base tecnica" }, strategy })],
      allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "deslocamento"],
    });

    const result = applyPlanGuards({ context, strategy });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.strategy.loadIntent).toBe("baixo");
    expect(result.strategy.gameTransferLevel).toBe("low");
    expect(result.strategy.drillFamilies).not.toContain("jogo_condicionado");
  });

  it("weights strong teacher-edited sessions more aggressively", () => {
    const strategy = buildStrategy();
    const context = buildContext({
      recentSessions: [
        buildRecentSession({
          strategy,
          sessionDate: "2026-04-08",
          wasEditedByTeacher: true,
          teacherOverrideWeight: "strong",
        }),
      ],
    });

    const result = applyPlanGuards({ context, strategy });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.risk).toBe("high");
    expect(result.repetitionAdjustment.reason).toBe("recent_exact_clone");
  });
});
