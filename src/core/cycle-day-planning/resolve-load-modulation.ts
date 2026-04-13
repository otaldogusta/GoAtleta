import type {
    CycleDayPlanningContext,
    ProgressionDimension,
    SessionStrategy,
    StrategyLevel,
    WeeklyLoadIntent,
} from "../models";

export type LoadModulationProfileKey = "recovery" | "balanced" | "intensive";

export type LoadModulationInfluence = {
  key: LoadModulationProfileKey;
  label: string;
  targetPse?: number;
  demandIndex?: number;
  plannedSessionLoad?: number;
};

export type LoadModulationResult = {
  strategy: SessionStrategy;
  adjusted: boolean;
  influence: LoadModulationInfluence;
};

const PROGRESSION_LADDER: ProgressionDimension[] = [
  "consistencia",
  "precisao",
  "pressao_tempo",
  "oposicao",
  "tomada_decisao",
  "transferencia_jogo",
];

const LEVEL_ORDER: StrategyLevel[] = ["low", "medium", "high"];
const LOAD_ORDER: WeeklyLoadIntent[] = ["baixo", "moderado", "alto"];

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

const FAMILY_PRIORITY_BY_PROFILE: Record<LoadModulationProfileKey, string[]> = {
  recovery: ["bloco_tecnico", "alvo_zona", "cooperacao", "deslocamento", "jogo_condicionado"],
  balanced: ["bloco_tecnico", "deslocamento", "cooperacao", "alvo_zona", "jogo_condicionado"],
  intensive: ["deslocamento", "jogo_condicionado", "cooperacao", "bloco_tecnico", "alvo_zona"],
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

const shiftLoad = (value: WeeklyLoadIntent, delta: number): WeeklyLoadIntent => {
  const index = LOAD_ORDER.indexOf(value);
  const nextIndex = Math.min(Math.max(index + delta, 0), LOAD_ORDER.length - 1);
  return LOAD_ORDER[nextIndex] ?? value;
};

const shiftProgression = (value: ProgressionDimension, delta: number): ProgressionDimension => {
  const index = PROGRESSION_LADDER.indexOf(value);
  if (index < 0) return value;
  const nextIndex = Math.min(Math.max(index + delta, 0), PROGRESSION_LADDER.length - 1);
  return PROGRESSION_LADDER[nextIndex] ?? value;
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

const prioritizeFamilies = (
  strategy: SessionStrategy,
  context: CycleDayPlanningContext,
  profile: LoadModulationProfileKey
) => {
  const available = context.allowedDrillFamilies.filter(
    (family) => !strategy.forbiddenDrillFamilies.includes(family)
  );
  const current = Array.from(new Set([...strategy.drillFamilies, ...available]));
  const preferred = FAMILY_PRIORITY_BY_PROFILE[profile] ?? FAMILY_PRIORITY_BY_PROFILE.balanced;
  return [
    ...preferred.filter((family) => current.includes(family)),
    ...current.filter((family) => !preferred.includes(family)),
  ].slice(0, Math.max(2, strategy.drillFamilies.length));
};

const scoreFromTargetPse = (targetPse?: number) => {
  if (typeof targetPse !== "number") return 0;
  if (targetPse >= 7) return 1;
  if (targetPse <= 4) return -1;
  return 0;
};

const scoreFromDemandIndex = (demandIndex?: number) => {
  if (typeof demandIndex !== "number") return 0;
  if (demandIndex >= 7) return 1;
  if (demandIndex <= 4) return -1;
  return 0;
};

const scoreFromWeeklyLoadIntent = (loadIntent: WeeklyLoadIntent) => {
  if (loadIntent === "alto") return 1;
  if (loadIntent === "baixo") return -1;
  return 0;
};

const scoreFromPlannedSessionLoad = (context: CycleDayPlanningContext) => {
  if (typeof context.plannedSessionLoad !== "number") return 0;
  const duration = Math.max(30, context.duration || 60);
  const perMinute = context.plannedSessionLoad / duration;
  if (perMinute >= 6.5) return 1;
  if (perMinute <= 4.5) return -1;
  return 0;
};

export const resolveLoadModulationProfile = (
  context: CycleDayPlanningContext
): LoadModulationInfluence => {
  const score = [
    scoreFromWeeklyLoadIntent(context.weeklyLoadIntent),
    scoreFromTargetPse(context.targetPse),
    scoreFromDemandIndex(context.demandIndex),
    scoreFromPlannedSessionLoad(context),
  ].reduce((sum, current) => sum + current, 0);

  if (score >= 2) {
    return {
      key: "intensive",
      label: "Carga intensiva",
      targetPse: context.targetPse,
      demandIndex: context.demandIndex,
      plannedSessionLoad: context.plannedSessionLoad,
    };
  }

  if (score <= -2) {
    return {
      key: "recovery",
      label: "Carga regenerativa",
      targetPse: context.targetPse,
      demandIndex: context.demandIndex,
      plannedSessionLoad: context.plannedSessionLoad,
    };
  }

  return {
    key: "balanced",
    label: "Carga equilibrada",
    targetPse: context.targetPse,
    demandIndex: context.demandIndex,
    plannedSessionLoad: context.plannedSessionLoad,
  };
};

export const applyLoadModulation = (params: {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
}): LoadModulationResult => {
  const influence = resolveLoadModulationProfile(params.context);
  if (influence.key === "balanced") {
    return {
      strategy: params.strategy,
      adjusted: false,
      influence,
    };
  }

  const phaseBounds = PHASE_BOUNDS[params.context.phaseIntent];
  const progressionDelta = influence.key === "intensive" ? 1 : -1;
  const progressionDimension = clampProgression(
    shiftProgression(params.strategy.progressionDimension, progressionDelta),
    phaseBounds.min,
    phaseBounds.max
  );

  const levelDelta = influence.key === "intensive" ? 1 : -1;
  let oppositionLevel = shiftLevel(params.strategy.oppositionLevel, levelDelta);
  let timePressureLevel = shiftLevel(params.strategy.timePressureLevel, levelDelta);
  let gameTransferLevel = shiftLevel(
    params.strategy.gameTransferLevel,
    influence.key === "intensive" && progressionDimension !== "precisao" ? 1 : levelDelta
  );

  if (params.context.developmentStage === "fundamental") {
    oppositionLevel = clampLevel(oppositionLevel, "medium");
    timePressureLevel = clampLevel(timePressureLevel, "medium");
    gameTransferLevel = clampLevel(gameTransferLevel, "medium");
  }

  const nextStrategy: SessionStrategy = {
    ...params.strategy,
    progressionDimension,
    loadIntent:
      influence.key === "intensive"
        ? shiftLoad(params.strategy.loadIntent, 1)
        : shiftLoad(params.strategy.loadIntent, -1),
    drillFamilies: prioritizeFamilies(params.strategy, params.context, influence.key),
    oppositionLevel,
    timePressureLevel,
    gameTransferLevel,
  };

  const adjusted = JSON.stringify(nextStrategy) !== JSON.stringify(params.strategy);

  return {
    strategy: nextStrategy,
    adjusted,
    influence,
  };
};
