import type {
    CycleDayPlanningContext,
    ProgressionDimension,
    SessionStrategy,
    StrategyLevel,
    WeeklyLoadIntent,
} from "../models";

export type OperationalPedagogyInfluence = {
  applied: boolean;
  rulesApplied: string[];
  changedFields: string[];
};

type ApplyOperationalPedagogyRulesParams = {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
};

const PROGRESSION_LADDER: ProgressionDimension[] = [
  "consistencia",
  "precisao",
  "pressao_tempo",
  "oposicao",
  "tomada_decisao",
  "transferencia_jogo",
];

const LOAD_ORDER: WeeklyLoadIntent[] = ["baixo", "moderado", "alto"];
const LEVEL_ORDER: StrategyLevel[] = ["low", "medium", "high"];

const PHASE_BOUNDS: Record<
  CycleDayPlanningContext["phaseIntent"],
  { min: ProgressionDimension; max: ProgressionDimension }
> = {
  exploracao_fundamentos: { min: "consistencia", max: "precisao" },
  estabilizacao_tecnica: { min: "precisao", max: "oposicao" },
  aceleracao_decisao: { min: "pressao_tempo", max: "tomada_decisao" },
  transferencia_jogo: { min: "tomada_decisao", max: "transferencia_jogo" },
  pressao_competitiva: { min: "oposicao", max: "transferencia_jogo" },
};

const shiftLoad = (value: WeeklyLoadIntent, delta: number): WeeklyLoadIntent => {
  const index = LOAD_ORDER.indexOf(value);
  const nextIndex = Math.min(Math.max(index + delta, 0), LOAD_ORDER.length - 1);
  return LOAD_ORDER[nextIndex] ?? value;
};

const shiftLevel = (value: StrategyLevel, delta: number): StrategyLevel => {
  const index = LEVEL_ORDER.indexOf(value);
  const nextIndex = Math.min(Math.max(index + delta, 0), LEVEL_ORDER.length - 1);
  return LEVEL_ORDER[nextIndex] ?? value;
};

const clampLevel = (value: StrategyLevel, maxValue: StrategyLevel): StrategyLevel => {
  const index = LEVEL_ORDER.indexOf(value);
  const maxIndex = LEVEL_ORDER.indexOf(maxValue);
  if (index < 0 || maxIndex < 0) return value;
  return LEVEL_ORDER[Math.min(index, maxIndex)] ?? value;
};

const ensureMinLevel = (value: StrategyLevel, minValue: StrategyLevel): StrategyLevel => {
  const index = LEVEL_ORDER.indexOf(value);
  const minIndex = LEVEL_ORDER.indexOf(minValue);
  if (index < 0 || minIndex < 0) return value;
  return LEVEL_ORDER[Math.max(index, minIndex)] ?? value;
};

const ensureMinLoad = (value: WeeklyLoadIntent, minValue: WeeklyLoadIntent): WeeklyLoadIntent => {
  const index = LOAD_ORDER.indexOf(value);
  const minIndex = LOAD_ORDER.indexOf(minValue);
  if (index < 0 || minIndex < 0) return value;
  return LOAD_ORDER[Math.max(index, minIndex)] ?? value;
};

const clampLoad = (value: WeeklyLoadIntent, maxValue: WeeklyLoadIntent): WeeklyLoadIntent => {
  const index = LOAD_ORDER.indexOf(value);
  const maxIndex = LOAD_ORDER.indexOf(maxValue);
  if (index < 0 || maxIndex < 0) return value;
  return LOAD_ORDER[Math.min(index, maxIndex)] ?? value;
};

const clampProgression = (
  value: ProgressionDimension,
  minValue: ProgressionDimension,
  maxValue: ProgressionDimension
): ProgressionDimension => {
  const index = PROGRESSION_LADDER.indexOf(value);
  const minIndex = PROGRESSION_LADDER.indexOf(minValue);
  const maxIndex = PROGRESSION_LADDER.indexOf(maxValue);
  if (index < 0 || minIndex < 0 || maxIndex < 0) return value;
  return PROGRESSION_LADDER[Math.min(Math.max(index, minIndex), maxIndex)] ?? value;
};

const raiseProgressionWithinBounds = (
  value: ProgressionDimension,
  maxValue: ProgressionDimension
): ProgressionDimension => {
  const index = PROGRESSION_LADDER.indexOf(value);
  const maxIndex = PROGRESSION_LADDER.indexOf(maxValue);
  if (index < 0 || maxIndex < 0) return value;
  return PROGRESSION_LADDER[Math.min(index + 1, maxIndex)] ?? value;
};

const hasReviewLockSignal = (context: CycleDayPlanningContext) =>
  context.recentSessions
    .slice(0, 2)
    .some(
      (session) =>
        session.wasEditedByTeacher &&
        (session.teacherOverrideWeight === "strong" || session.teacherOverrideWeight === "medium")
    );

const isRepeatedStimulus = (context: CycleDayPlanningContext, strategy: SessionStrategy) => {
  const recent = context.recentSessions.slice(0, 2);
  return recent.some(
    (session) =>
      !session.fingerprint &&
      !session.structuralFingerprint &&
      session.primarySkill === strategy.primarySkill &&
      session.progressionDimension === strategy.progressionDimension
  );
};

const applyWeekSessionRoleAuthority = (params: {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
  phaseBounds: { min: ProgressionDimension; max: ProgressionDimension };
}): SessionStrategy => {
  // Authority contract: week defines pedagogical intention, session defines execution detail,
  // and guardrails keep execution inside the weekly role envelope.
  const role = params.context.weeklyOperationalDecision?.sessionRole;
  if (!role) return params.strategy;

  if (role === "introducao_exploracao" || role === "retomada_consolidacao") {
    return {
      ...params.strategy,
      progressionDimension: clampProgression(
        params.strategy.progressionDimension,
        params.phaseBounds.min,
        "precisao"
      ),
      loadIntent: params.strategy.loadIntent === "alto" ? "moderado" : params.strategy.loadIntent,
      oppositionLevel: clampLevel(params.strategy.oppositionLevel, "medium"),
      timePressureLevel: clampLevel(params.strategy.timePressureLevel, "medium"),
      gameTransferLevel: clampLevel(params.strategy.gameTransferLevel, "medium"),
    };
  }

  if (role === "consolidacao_orientada") {
    return {
      ...params.strategy,
      progressionDimension: clampProgression(
        params.strategy.progressionDimension,
        "precisao",
        params.phaseBounds.max
      ),
    };
  }

  if (role === "pressao_decisao") {
    return {
      ...params.strategy,
      progressionDimension: clampProgression(
        params.strategy.progressionDimension,
        "pressao_tempo",
        params.phaseBounds.max
      ),
      loadIntent: ensureMinLoad(params.strategy.loadIntent, "moderado"),
      oppositionLevel: ensureMinLevel(params.strategy.oppositionLevel, "medium"),
      timePressureLevel: ensureMinLevel(params.strategy.timePressureLevel, "medium"),
    };
  }

  if (role === "sintese_fechamento") {
    const prioritizedDrillFamilies = params.strategy.drillFamilies.includes("jogo_condicionado")
      ? [
          "jogo_condicionado",
          ...params.strategy.drillFamilies.filter((family) => family !== "jogo_condicionado"),
        ]
      : params.strategy.drillFamilies;

    return {
      ...params.strategy,
      progressionDimension: clampProgression(
        params.strategy.progressionDimension,
        "tomada_decisao",
        params.phaseBounds.max
      ),
      loadIntent: clampLoad(params.strategy.loadIntent, "moderado"),
      gameTransferLevel: ensureMinLevel(params.strategy.gameTransferLevel, "medium"),
      drillFamilies: prioritizedDrillFamilies,
    };
  }

  if (role === "transferencia_jogo") {
    return {
      ...params.strategy,
      progressionDimension: clampProgression(
        params.strategy.progressionDimension,
        "tomada_decisao",
        params.phaseBounds.max
      ),
      gameTransferLevel: ensureMinLevel(params.strategy.gameTransferLevel, "medium"),
    };
  }

  return params.strategy;
};

export const applyOperationalPedagogyRules = (
  params: ApplyOperationalPedagogyRulesParams
): { strategy: SessionStrategy; influence: OperationalPedagogyInfluence } => {
  const { context } = params;
  const phaseBounds = PHASE_BOUNDS[context.phaseIntent];
  const rulesApplied: string[] = [];
  const changedFields = new Set<string>();
  let strategy = { ...params.strategy };

  const boundedProgression = clampProgression(
    strategy.progressionDimension,
    phaseBounds.min,
    phaseBounds.max
  );
  if (boundedProgression !== strategy.progressionDimension) {
    strategy = { ...strategy, progressionDimension: boundedProgression };
    rulesApplied.push("phase_bounds_priority");
    changedFields.add("progressionDimension");
  }

  const weekRoleStrategy = applyWeekSessionRoleAuthority({
    context,
    strategy,
    phaseBounds,
  });
  if (JSON.stringify(weekRoleStrategy) !== JSON.stringify(strategy)) {
    strategy = weekRoleStrategy;
    rulesApplied.push("weekly_role_authority");
    changedFields.add("progressionDimension");
    changedFields.add("loadIntent");
    changedFields.add("oppositionLevel");
    changedFields.add("timePressureLevel");
    changedFields.add("gameTransferLevel");
  }

  if (context.developmentStage === "fundamental") {
    const nextStrategy: SessionStrategy = {
      ...strategy,
      loadIntent: strategy.loadIntent === "alto" ? "moderado" : strategy.loadIntent,
      oppositionLevel: clampLevel(strategy.oppositionLevel, "medium"),
      timePressureLevel: clampLevel(strategy.timePressureLevel, "medium"),
      gameTransferLevel: clampLevel(strategy.gameTransferLevel, "medium"),
    };
    if (JSON.stringify(nextStrategy) !== JSON.stringify(strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("age_band_hard_constraint");
      changedFields.add("loadIntent");
      changedFields.add("oppositionLevel");
      changedFields.add("timePressureLevel");
      changedFields.add("gameTransferLevel");
    }
  }

  if ((context.targetPse ?? 0) > 0 && (context.targetPse ?? 0) <= 4) {
    const nextLoad = shiftLoad(strategy.loadIntent, -1);
    const nextTransfer = clampLevel(strategy.gameTransferLevel, "medium");
    if (nextLoad !== strategy.loadIntent || nextTransfer !== strategy.gameTransferLevel) {
      strategy = {
        ...strategy,
        loadIntent: nextLoad,
        gameTransferLevel: nextTransfer,
      };
      rulesApplied.push("planned_load_priority");
      changedFields.add("loadIntent");
      changedFields.add("gameTransferLevel");
    }
  }

  if (
    context.daysPerWeek >= 2 &&
    (context.sessionIndexInWeek ?? 1) === 1 &&
    context.weeklyLoadIntent !== "alto" &&
    (context.targetPse ?? 0) < 7
  ) {
    const nextStrategy: SessionStrategy = {
      ...strategy,
      oppositionLevel: shiftLevel(strategy.oppositionLevel, -1),
      timePressureLevel: shiftLevel(strategy.timePressureLevel, -1),
    };
    if (JSON.stringify(nextStrategy) !== JSON.stringify(strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("weekly_session_position_priority");
      changedFields.add("oppositionLevel");
      changedFields.add("timePressureLevel");
    }
  }

  if (hasReviewLockSignal(context)) {
    const nextStrategy: SessionStrategy = {
      ...strategy,
      progressionDimension: phaseBounds.min,
      loadIntent: shiftLoad(strategy.loadIntent, -1),
      gameTransferLevel: shiftLevel(strategy.gameTransferLevel, -1),
    };
    if (JSON.stringify(nextStrategy) !== JSON.stringify(strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("recent_history_review_lock");
      changedFields.add("progressionDimension");
      changedFields.add("loadIntent");
      changedFields.add("gameTransferLevel");
    }
  }

  if (!hasReviewLockSignal(context) && isRepeatedStimulus(context, strategy)) {
    const raisedProgression = raiseProgressionWithinBounds(strategy.progressionDimension, phaseBounds.max);
    if (raisedProgression !== strategy.progressionDimension) {
      strategy = { ...strategy, progressionDimension: raisedProgression };
      rulesApplied.push("anti_repetition_progression_axis");
      changedFields.add("progressionDimension");
    } else {
      const nextTransfer = shiftLevel(strategy.gameTransferLevel, 1);
      if (nextTransfer !== strategy.gameTransferLevel) {
        strategy = { ...strategy, gameTransferLevel: nextTransfer };
        rulesApplied.push("anti_repetition_collective_axis");
        changedFields.add("gameTransferLevel");
      }
    }
  }

  return {
    strategy,
    influence: {
      applied: rulesApplied.length > 0,
      rulesApplied,
      changedFields: [...changedFields],
    },
  };
};
