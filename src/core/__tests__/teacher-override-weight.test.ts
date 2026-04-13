import {
    applyTeacherOverrideInfluence,
    resolveTeacherOverrideWeight,
} from "../cycle-day-planning/resolve-teacher-override-weight";
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
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  mustProgressFrom: undefined,
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "jogo_condicionado"],
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

describe("teacher override influence", () => {
  it("creates measurable short-term influence from strong recent teacher edits", () => {
    const context = buildContext({
      recentSessions: [
        {
          sessionDate: "2026-04-08",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "bloqueio",
          progressionDimension: "oposicao",
          dominantBlock: "main",
          fingerprint: "bloqueio:oposicao:main",
          teacherOverrideWeight: "strong",
        },
        {
          sessionDate: "2026-04-05",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "bloqueio",
          progressionDimension: "oposicao",
          dominantBlock: "main",
          fingerprint: "bloqueio:oposicao:main",
          teacherOverrideWeight: "soft",
        },
      ],
    });

    const influence = resolveTeacherOverrideWeight(context);
    const result = applyTeacherOverrideInfluence({
      context,
      strategy: buildStrategy(),
      influence,
    });

    expect(influence.strength).toBe("strong");
    expect(influence.learningWindowGenerations).toBe(3);
    expect(result.adjusted).toBe(true);
    expect(result.strategy.primarySkill).toBe("bloqueio");
    expect(result.strategy.progressionDimension).toBe("pressao_tempo");
    expect(result.strategy.loadIntent).toBe("moderado");
  });

  it("keeps a one-off soft edit conservative instead of distorting the cycle", () => {
    const context = buildContext({
      recentSessions: [
        {
          sessionDate: "2026-04-08",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "ataque",
          progressionDimension: "tomada_decisao",
          dominantBlock: "main",
          fingerprint: "ataque:tomada_decisao:main",
          teacherOverrideWeight: "soft",
          teacherEditedFields: ["primarySkill"],
        },
      ],
    });

    const influence = resolveTeacherOverrideWeight(context);
    const result = applyTeacherOverrideInfluence({
      context,
      strategy: buildStrategy(),
      influence,
    });

    expect(influence.strength).toBe("soft");
    expect(influence.learningWindowGenerations).toBe(1);
    expect(result.adjusted).toBe(false);
    expect(result.strategy).toEqual(buildStrategy());
  });

  it("uses medium methodology learning to reprioritize families without changing load", () => {
    const context = buildContext({
      recentSessions: [
        {
          sessionDate: "2026-04-08",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "passe",
          progressionDimension: "precisao",
          dominantBlock: "main",
          fingerprint: "passe:precisao:main",
          methodologyApproach: "jogo",
          teacherEditedFields: ["methodologyApproach", "activityStructure"],
          teacherOverrideWeight: "medium",
        },
        {
          sessionDate: "2026-04-05",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "passe",
          progressionDimension: "precisao",
          dominantBlock: "main",
          fingerprint: "passe:precisao:main",
          methodologyApproach: "jogo",
          teacherEditedFields: ["methodologyApproach"],
          teacherOverrideWeight: "medium",
        },
      ],
    });

    const influence = resolveTeacherOverrideWeight(context);
    const result = applyTeacherOverrideInfluence({
      context,
      strategy: buildStrategy({ drillFamilies: ["bloco_tecnico", "jogo_condicionado"] }),
      influence,
    });

    expect(influence.strength).toBe("strong");
    expect(influence.preferredMethodologyApproach).toBe("jogo");
    expect(result.adjusted).toBe(true);
    expect(result.strategy.drillFamilies[0]).toBe("jogo_condicionado");
    expect(result.strategy.loadIntent).toBe("moderado");
  });

  it("does not let teacher overrides redefine the macro phase", () => {
    const context = buildContext({
      phaseIntent: "exploracao_fundamentos",
      planningPhase: "base",
      recentSessions: [
        {
          sessionDate: "2026-04-08",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          dominantBlock: "main",
          fingerprint: "saque:transferencia_jogo:main",
          teacherOverrideWeight: "strong",
        },
        {
          sessionDate: "2026-04-05",
          wasPlanned: true,
          wasApplied: true,
          wasEditedByTeacher: true,
          wasConfirmedExecuted: true,
          executionState: "teacher_edited",
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          dominantBlock: "main",
          fingerprint: "saque:transferencia_jogo:main",
          teacherOverrideWeight: "soft",
        },
      ],
    });

    const result = applyTeacherOverrideInfluence({
      context,
      strategy: buildStrategy({ progressionDimension: "consistencia" }),
    });

    expect(result.adjusted).toBe(true);
    expect(result.strategy.progressionDimension).toBe("precisao");
    expect(result.strategy.loadIntent).toBe("moderado");
  });
});
