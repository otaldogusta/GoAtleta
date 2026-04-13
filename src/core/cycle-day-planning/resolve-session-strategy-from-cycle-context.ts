import type {
    CycleDayPlanningContext,
    ProgressionDimension,
    SessionStrategy,
    StrategyLevel,
    VolleyballSkill,
    WeeklyLoadIntent,
} from "../models";
import {
    applyDominantBlockStrategy,
    type DominantBlockStrategyInfluence,
} from "./resolve-block-dominant-strategy";
import {
    applyLoadModulation,
    type LoadModulationInfluence,
} from "./resolve-load-modulation";
import {
    applyTeacherOverrideInfluence,
    type TeacherOverrideInfluence,
} from "./resolve-teacher-override-weight";

export type SessionStrategyResolution = {
  baseStrategy: SessionStrategy;
  dominantBlockAdjusted: boolean;
  dominantBlockInfluence: DominantBlockStrategyInfluence;
  loadAdjusted: boolean;
  loadInfluence: LoadModulationInfluence;
  strategy: SessionStrategy;
  overrideAdjusted: boolean;
  overrideInfluence: TeacherOverrideInfluence;
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

const FAMILY_PRIORITY_BY_INTENT: Record<CycleDayPlanningContext["pedagogicalIntent"], string[]> = {
  technical_adjustment: ["bloco_tecnico", "alvo_zona", "deslocamento", "cooperacao", "jogo_condicionado"],
  decision_making: ["jogo_condicionado", "deslocamento", "alvo_zona", "cooperacao", "bloco_tecnico"],
  game_reading: ["jogo_condicionado", "cooperacao", "deslocamento", "alvo_zona", "bloco_tecnico"],
  team_organization: ["cooperacao", "jogo_condicionado", "deslocamento", "alvo_zona", "bloco_tecnico"],
  pressure_adaptation: ["jogo_condicionado", "deslocamento", "bloco_tecnico", "alvo_zona", "cooperacao"],
};

const PHASE_BASE_LEVELS: Record<
  CycleDayPlanningContext["phaseIntent"],
  Pick<SessionStrategy, "oppositionLevel" | "timePressureLevel" | "gameTransferLevel">
> = {
  exploracao_fundamentos: {
    oppositionLevel: "low",
    timePressureLevel: "low",
    gameTransferLevel: "low",
  },
  estabilizacao_tecnica: {
    oppositionLevel: "medium",
    timePressureLevel: "medium",
    gameTransferLevel: "low",
  },
  aceleracao_decisao: {
    oppositionLevel: "medium",
    timePressureLevel: "high",
    gameTransferLevel: "medium",
  },
  transferencia_jogo: {
    oppositionLevel: "medium",
    timePressureLevel: "medium",
    gameTransferLevel: "high",
  },
  pressao_competitiva: {
    oppositionLevel: "high",
    timePressureLevel: "high",
    gameTransferLevel: "high",
  },
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

const raiseProgression = (value: ProgressionDimension, steps: number): ProgressionDimension => {
  const index = PROGRESSION_LADDER.indexOf(value);
  if (index < 0) return value;
  const nextIndex = Math.min(index + Math.max(0, steps), PROGRESSION_LADDER.length - 1);
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

const resolvePrimarySkill = (context: CycleDayPlanningContext) => {
  if (
    context.daysPerWeek >= 3 &&
    context.sessionIndexInWeek === 2 &&
    context.secondarySkill &&
    context.phaseIntent !== "exploracao_fundamentos"
  ) {
    return context.secondarySkill;
  }
  return context.primarySkill;
};

const resolveSecondarySkill = (
  context: CycleDayPlanningContext,
  primarySkill: VolleyballSkill
) => {
  if (primarySkill === context.primarySkill) return context.secondarySkill;
  return context.primarySkill;
};

const resolveProgressionDimension = (context: CycleDayPlanningContext): ProgressionDimension => {
  const base = context.progressionDimensionTarget;

  if (context.phaseIntent === "exploracao_fundamentos") {
    if (context.developmentStage === "especializado") {
      const specializedBase = base === "consistencia" ? "precisao" : base;
      const maxValue =
        context.sessionIndexInWeek && context.sessionIndexInWeek > 1
          ? "pressao_tempo"
          : "precisao";
      return clampProgression(specializedBase, "precisao", maxValue);
    }

    const maxValue = context.sessionIndexInWeek && context.sessionIndexInWeek > 1 ? "precisao" : "consistencia";
    return clampProgression(base, "consistencia", maxValue);
  }

  if (context.phaseIntent === "estabilizacao_tecnica") {
    const adjusted = context.sessionIndexInWeek && context.sessionIndexInWeek >= 3 ? raiseProgression(base, 1) : base;
    return clampProgression(adjusted, "precisao", "oposicao");
  }

  if (context.phaseIntent === "aceleracao_decisao") {
    const adjusted = context.sessionIndexInWeek && context.sessionIndexInWeek >= 2 ? raiseProgression(base, 1) : base;
    return clampProgression(adjusted, "pressao_tempo", "tomada_decisao");
  }

  if (context.phaseIntent === "transferencia_jogo") {
    const adjusted = context.daysPerWeek >= 3 && context.sessionIndexInWeek === 3 ? raiseProgression(base, 1) : base;
    return clampProgression(adjusted, "tomada_decisao", "transferencia_jogo");
  }

  return clampProgression(base, "oposicao", "transferencia_jogo");
};

const resolveLoadIntent = (context: CycleDayPlanningContext): WeeklyLoadIntent => {
  const frequency = Math.max(1, context.daysPerWeek || 1);
  const sessionIndex = Math.max(1, context.sessionIndexInWeek || 1);

  if (context.developmentStage === "especializado" && frequency === 2 && sessionIndex === 1) {
    return context.weeklyLoadIntent;
  }

  if (frequency >= 3) {
    if (sessionIndex === 1) return shiftLoad(context.weeklyLoadIntent, -1);
    if (sessionIndex === 3 && context.phaseIntent !== "exploracao_fundamentos") {
      return shiftLoad(context.weeklyLoadIntent, context.weeklyLoadIntent === "baixo" ? 0 : 1);
    }
  }

  if (frequency === 2) {
    if (sessionIndex === 1 && context.phaseIntent !== "pressao_competitiva") {
      return shiftLoad(context.weeklyLoadIntent, -1);
    }
    if (sessionIndex === 2 && /aceleracao|transferencia|pressao/.test(context.phaseIntent)) {
      return shiftLoad(context.weeklyLoadIntent, 1);
    }
  }

  if (context.developmentStage === "fundamental" && sessionIndex === 1) {
    return shiftLoad(context.weeklyLoadIntent, -1);
  }

  return context.weeklyLoadIntent;
};

const resolveBaseLevels = (context: CycleDayPlanningContext) => ({
  ...PHASE_BASE_LEVELS[context.phaseIntent],
});

const resolveLevels = (context: CycleDayPlanningContext) => {
  const levels = resolveBaseLevels(context);
  const progression = resolveProgressionDimension(context);
  const frequency = Math.max(1, context.daysPerWeek || 1);
  const sessionIndex = Math.max(1, context.sessionIndexInWeek || 1);

  if (progression === "oposicao") {
    levels.oppositionLevel = shiftLevel(levels.oppositionLevel, 1);
  }
  if (progression === "pressao_tempo") {
    levels.timePressureLevel = shiftLevel(levels.timePressureLevel, 1);
  }
  if (progression === "tomada_decisao") {
    levels.timePressureLevel = shiftLevel(levels.timePressureLevel, 1);
    levels.gameTransferLevel = shiftLevel(levels.gameTransferLevel, 1);
  }
  if (progression === "transferencia_jogo") {
    levels.gameTransferLevel = "high";
    levels.oppositionLevel = shiftLevel(levels.oppositionLevel, 1);
  }

  if (context.historicalConfidence === "none") {
    levels.gameTransferLevel = shiftLevel(levels.gameTransferLevel, -1);
  }

  if (frequency >= 3 && sessionIndex === 1) {
    levels.oppositionLevel = shiftLevel(levels.oppositionLevel, -1);
    levels.timePressureLevel = shiftLevel(levels.timePressureLevel, -1);
  }
  if (frequency >= 3 && sessionIndex === 3) {
    levels.gameTransferLevel = shiftLevel(levels.gameTransferLevel, 1);
  }

  if (context.developmentStage === "fundamental") {
    levels.oppositionLevel = clampLevel(levels.oppositionLevel, "medium");
    levels.timePressureLevel = clampLevel(levels.timePressureLevel, "medium");
  }

  return levels;
};

const clampLevel = (value: StrategyLevel, maxValue: StrategyLevel): StrategyLevel => {
  const index = LEVEL_ORDER.indexOf(value);
  const maxIndex = LEVEL_ORDER.indexOf(maxValue);
  if (index < 0 || maxIndex < 0) return value;
  return LEVEL_ORDER[Math.min(index, maxIndex)] ?? value;
};

const resolveGoalDrivenFamilies = (context: CycleDayPlanningContext): string[] => {
  const goalText = normalizeText(context.classGoal);
  if (!goalText) return [];

  if (/fundament|base tecnica|iniciacao/.test(goalText)) {
    return ["bloco_tecnico", "alvo_zona"];
  }
  if (/resist|condicion/.test(goalText)) {
    return ["deslocamento", "cooperacao"];
  }
  if (/organiz|sistema|coletiv|transica/.test(goalText)) {
    return ["jogo_condicionado", "cooperacao"];
  }
  return [];
};

const prioritizeFamilies = (context: CycleDayPlanningContext, progression: ProgressionDimension) => {
  const priority = [...FAMILY_PRIORITY_BY_INTENT[context.pedagogicalIntent]];

  if (progression === "consistencia" || progression === "precisao") {
    priority.unshift("bloco_tecnico", "alvo_zona");
  }
  if (progression === "tomada_decisao" || progression === "transferencia_jogo") {
    priority.unshift("jogo_condicionado", "cooperacao");
  }
  if (progression === "pressao_tempo" || progression === "oposicao") {
    priority.unshift("deslocamento");
  }

  if (context.daysPerWeek >= 3 && context.sessionIndexInWeek === 3) {
    priority.unshift("jogo_condicionado");
  }

  if (
    context.daysPerWeek === 2 &&
    context.sessionIndexInWeek === 2 &&
    context.phaseIntent !== "exploracao_fundamentos"
  ) {
    priority.unshift("deslocamento", "cooperacao");
  }

  const goalDriven = resolveGoalDrivenFamilies(context);
  if (goalDriven.length) {
    // Apply class identity last so it wins tie-breakers against generic cycle defaults.
    priority.unshift(...goalDriven);
  }

  return priority;
};

const resolveDrillFamilies = (context: CycleDayPlanningContext, progression: ProgressionDimension) => {
  const forbidden = new Set(context.forbiddenDrillFamilies);
  const available = context.allowedDrillFamilies.filter((family) => !forbidden.has(family));
  const priority = prioritizeFamilies(context, progression);
  const ranked = Array.from(new Set([...priority, ...available])).filter((family) => available.includes(family));
  const maxFamilies = context.phaseIntent === "pressao_competitiva" ? 3 : 2;
  const selected = ranked.slice(0, maxFamilies);
  return selected.length ? selected : available.slice(0, maxFamilies);
};

const buildBaseSessionStrategy = (context: CycleDayPlanningContext): SessionStrategy => {
  const primarySkill = resolvePrimarySkill(context);
  const secondarySkill = resolveSecondarySkill(context, primarySkill);
  const progressionDimension = resolveProgressionDimension(context);
  const drillFamilies = resolveDrillFamilies(context, progressionDimension);
  const levels = resolveLevels(context);

  return {
    primarySkill,
    secondarySkill,
    progressionDimension,
    pedagogicalIntent: context.pedagogicalIntent,
    loadIntent: resolveLoadIntent(context),
    drillFamilies,
    forbiddenDrillFamilies: [...context.forbiddenDrillFamilies],
    oppositionLevel: levels.oppositionLevel,
    timePressureLevel: levels.timePressureLevel,
    gameTransferLevel: levels.gameTransferLevel,
  };
};

export const resolveSessionStrategyDecisionFromCycleContext = (
  context: CycleDayPlanningContext
): SessionStrategyResolution => {
  const phaseStrategy = buildBaseSessionStrategy(context);
  const dominantBlockResult = applyDominantBlockStrategy({
    context,
    strategy: phaseStrategy,
  });
  const loadResult = applyLoadModulation({
    context,
    strategy: dominantBlockResult.strategy,
  });
  const baseStrategy = loadResult.strategy;
  const overrideResult = applyTeacherOverrideInfluence({
    context,
    strategy: baseStrategy,
  });

  return {
    baseStrategy,
    dominantBlockAdjusted: dominantBlockResult.adjusted,
    dominantBlockInfluence: dominantBlockResult.influence,
    loadAdjusted: loadResult.adjusted,
    loadInfluence: loadResult.influence,
    strategy: overrideResult.strategy,
    overrideAdjusted: overrideResult.adjusted,
    overrideInfluence: overrideResult.influence,
  };
};

export const resolveSessionStrategyFromCycleContext = (
  context: CycleDayPlanningContext
): SessionStrategy => resolveSessionStrategyDecisionFromCycleContext(context).strategy;
