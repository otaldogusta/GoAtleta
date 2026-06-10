import type {
  CycleDayPlanningContext,
  PedagogicalFeedbackSignal,
  PedagogicalFeedbackSignalConfidence,
  ProgressionDimension,
  SessionStrategy,
  StrategyLevel,
  WeeklyLoadIntent,
} from "../models";

export type ReportFeedbackInfluence = {
  applied: boolean;
  signals: PedagogicalFeedbackSignal[];
  rulesApplied: string[];
  changedFields: string[];
};

type ApplyReportFeedbackRulesParams = {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
};

const CONFIDENCE_ORDER: Record<PedagogicalFeedbackSignalConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
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

const collectReportFeedbackSignals = (
  context: CycleDayPlanningContext
): PedagogicalFeedbackSignal[] => {
  const signals = new Set<PedagogicalFeedbackSignal>();

  context.recentSessions.slice(0, 3).forEach((session) => {
    (session.pedagogicalFeedbackSignalEvidence ?? []).forEach((item) => {
      if (CONFIDENCE_ORDER[item.confidence] >= CONFIDENCE_ORDER.medium) {
        signals.add(item.type);
      }
    });

    (session.pedagogicalFeedbackSignals ?? []).forEach((signal) => {
      signals.add(signal);
    });
  });

  return [...signals];
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

const lowerProgression = (value: ProgressionDimension): ProgressionDimension => {
  const index = PROGRESSION_LADDER.indexOf(value);
  if (index <= 0) return value;
  return PROGRESSION_LADDER[index - 1] ?? value;
};

const prioritizeFamilies = (strategy: SessionStrategy, preferred: string[]) => [
  ...preferred.filter(
    (family) =>
      strategy.drillFamilies.includes(family) &&
      !strategy.forbiddenDrillFamilies.includes(family)
  ),
  ...strategy.drillFamilies.filter((family) => !preferred.includes(family)),
];

const sameStrategy = (left: SessionStrategy, right: SessionStrategy) =>
  JSON.stringify(left) === JSON.stringify(right);

export const applyReportFeedbackRules = (
  params: ApplyReportFeedbackRulesParams
): { strategy: SessionStrategy; influence: ReportFeedbackInfluence } => {
  const signals = collectReportFeedbackSignals(params.context);
  const rulesApplied: string[] = [];
  const changedFields = new Set<string>();
  let strategy = { ...params.strategy };

  const hasParticipationSignal =
    signals.includes("low_participation") || signals.includes("low_frequency");
  const hasClimateSignal =
    signals.includes("class_agitation") ||
    signals.includes("emotional_conflict") ||
    signals.includes("excessive_competition");

  if (hasParticipationSignal) {
    const nextStrategy: SessionStrategy = {
      ...strategy,
      loadIntent: shiftLoad(strategy.loadIntent, -1),
      oppositionLevel: shiftLevel(strategy.oppositionLevel, -1),
      timePressureLevel: shiftLevel(strategy.timePressureLevel, -1),
      gameTransferLevel: shiftLevel(strategy.gameTransferLevel, -1),
      drillFamilies: prioritizeFamilies(strategy, ["cooperacao", "alvo_zona", "bloco_tecnico"]),
    };

    if (!sameStrategy(nextStrategy, strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("report_feedback_participation_rebuild");
      changedFields.add("loadIntent");
      changedFields.add("oppositionLevel");
      changedFields.add("timePressureLevel");
      changedFields.add("gameTransferLevel");
      changedFields.add("drillFamilies");
    }
  }

  if (signals.includes("recurring_technical_difficulty")) {
    const nextProgression = lowerProgression(strategy.progressionDimension);
    const nextStrategy: SessionStrategy = {
      ...strategy,
      progressionDimension: nextProgression,
      pedagogicalIntent: "technical_adjustment",
      drillFamilies: prioritizeFamilies(strategy, ["bloco_tecnico", "alvo_zona", "cooperacao"]),
    };

    if (!sameStrategy(nextStrategy, strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("report_feedback_technical_regression");
      changedFields.add("progressionDimension");
      changedFields.add("pedagogicalIntent");
      changedFields.add("drillFamilies");
    }
  }

  if (hasClimateSignal) {
    const nextStrategy: SessionStrategy = {
      ...strategy,
      loadIntent: strategy.loadIntent === "alto" ? "moderado" : strategy.loadIntent,
      pedagogicalIntent:
        strategy.pedagogicalIntent === "pressure_adaptation"
          ? "team_organization"
          : strategy.pedagogicalIntent,
      oppositionLevel: shiftLevel(strategy.oppositionLevel, -1),
      timePressureLevel: shiftLevel(strategy.timePressureLevel, -1),
      drillFamilies: prioritizeFamilies(strategy, ["cooperacao", "jogo_condicionado", "alvo_zona"]),
    };

    if (!sameStrategy(nextStrategy, strategy)) {
      strategy = nextStrategy;
      rulesApplied.push("report_feedback_climate_mediation");
      changedFields.add("loadIntent");
      changedFields.add("pedagogicalIntent");
      changedFields.add("oppositionLevel");
      changedFields.add("timePressureLevel");
      changedFields.add("drillFamilies");
    }
  }

  return {
    strategy,
    influence: {
      applied: rulesApplied.length > 0,
      signals,
      rulesApplied,
      changedFields: [...changedFields],
    },
  };
};
