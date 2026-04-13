import type {
    CycleDayPlanningContext,
    KnownMethodologyApproach,
    ProgressionDimension,
    SessionStrategy,
    TeacherEditedField,
    VolleyballSkill,
} from "../models";
import { getConservativeOverrideBonus } from "../override-learning";

export type TeacherOverrideInfluence = {
  strength: "none" | "soft" | "medium" | "strong";
  weightedOccurrences: number;
  learningWindowGenerations: 0 | 1 | 2 | 3;
  preferredPrimarySkill?: VolleyballSkill;
  preferredProgressionDimension?: ProgressionDimension;
  preferredMethodologyApproach?: KnownMethodologyApproach | string;
  preferredDominantBlock?: string;
  learnedFields: TeacherEditedField[];
};

export type TeacherOverrideStrategyResult = {
  strategy: SessionStrategy;
  adjusted: boolean;
  influence: TeacherOverrideInfluence;
};

const PROGRESSION_LADDER: ProgressionDimension[] = [
  "consistencia",
  "precisao",
  "pressao_tempo",
  "oposicao",
  "tomada_decisao",
  "transferencia_jogo",
];

const RECENCY_WEIGHTS = [3, 2, 1];
const OVERRIDE_WEIGHT_SCORE = {
  none: 0,
  soft: 1,
  medium: 2,
  strong: 3,
} as const;

const dominantFamilyByProgression: Record<ProgressionDimension, string> = {
  consistencia: "bloco_tecnico",
  precisao: "alvo_zona",
  pressao_tempo: "deslocamento",
  oposicao: "deslocamento",
  tomada_decisao: "jogo_condicionado",
  transferencia_jogo: "jogo_condicionado",
};

const phaseBounds: Record<
  CycleDayPlanningContext["phaseIntent"],
  { min: ProgressionDimension; max: ProgressionDimension }
> = {
  exploracao_fundamentos: { min: "consistencia", max: "precisao" },
  estabilizacao_tecnica: { min: "precisao", max: "oposicao" },
  aceleracao_decisao: { min: "pressao_tempo", max: "tomada_decisao" },
  transferencia_jogo: { min: "tomada_decisao", max: "transferencia_jogo" },
  pressao_competitiva: { min: "oposicao", max: "transferencia_jogo" },
};

const FAMILY_PRIORITY_BY_APPROACH: Record<string, string[]> = {
  analitico: ["bloco_tecnico", "alvo_zona", "deslocamento"],
  hibrido: ["deslocamento", "cooperacao", "bloco_tecnico"],
  jogo: ["jogo_condicionado", "cooperacao", "deslocamento"],
  global: ["jogo_condicionado", "cooperacao", "deslocamento"],
};

const incrementCount = (map: Map<string, number>, key: string | undefined, value: number) => {
  if (!key || !value) return;
  map.set(key, (map.get(key) ?? 0) + value);
};

const pickTopKey = <T extends string>(map: Map<string, number>): T | undefined => {
  let bestKey: string | undefined;
  let bestScore = 0;
  map.forEach((score, key) => {
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  });
  return bestKey as T | undefined;
};

const hasEditedField = (
  fields: TeacherEditedField[] | undefined,
  field: TeacherEditedField
) => !fields || !fields.length || fields.includes(field);

const resolveLearningWindowGenerations = (
  strength: TeacherOverrideInfluence["strength"]
): TeacherOverrideInfluence["learningWindowGenerations"] => {
  if (strength === "strong") return 3;
  if (strength === "medium") return 2;
  if (strength === "soft") return 1;
  return 0;
};

const resolveInfluenceStrength = (totalWeightedScore: number): TeacherOverrideInfluence["strength"] => {
  if (totalWeightedScore >= 10) return "strong";
  if (totalWeightedScore >= 5) return "medium";
  if (totalWeightedScore >= 2) return "soft";
  return "none";
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

const stepToward = (
  current: ProgressionDimension,
  target: ProgressionDimension
): ProgressionDimension => {
  const currentIndex = PROGRESSION_LADDER.indexOf(current);
  const targetIndex = PROGRESSION_LADDER.indexOf(target);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return current;
  return PROGRESSION_LADDER[currentIndex + (targetIndex > currentIndex ? 1 : -1)] ?? current;
};

const reprioritizeFamilies = (
  strategy: SessionStrategy,
  progression: ProgressionDimension
): string[] => {
  const preferred = dominantFamilyByProgression[progression];
  if (!preferred || strategy.drillFamilies[0] === preferred) return strategy.drillFamilies;
  if (!strategy.drillFamilies.includes(preferred)) return strategy.drillFamilies;

  return [preferred, ...strategy.drillFamilies.filter((family) => family !== preferred)];
};

const reprioritizeFamiliesByApproach = (
  strategy: SessionStrategy,
  approach?: KnownMethodologyApproach | string
) => {
  const priority = FAMILY_PRIORITY_BY_APPROACH[String(approach ?? "").trim().toLowerCase()];
  if (!priority?.length) return strategy.drillFamilies;

  const prioritized = [
    ...priority.filter((family) => strategy.drillFamilies.includes(family)),
    ...strategy.drillFamilies.filter((family) => !priority.includes(family)),
  ];

  return prioritized.length ? prioritized : strategy.drillFamilies;
};

export const resolveTeacherOverrideWeight = (
  context: CycleDayPlanningContext
): TeacherOverrideInfluence => {
  const editedSessions = context.recentSessions
    .filter((session) => session.wasEditedByTeacher || session.teacherOverrideWeight !== "none")
    .slice(0, 3);

  if (!editedSessions.length) {
    return {
      strength: "none",
      weightedOccurrences: 0,
      learningWindowGenerations: 0,
      learnedFields: [],
    };
  }

  const skillScores = new Map<string, number>();
  const progressionScores = new Map<string, number>();
  const approachScores = new Map<string, number>();
  const blockScores = new Map<string, number>();
  let weightedOccurrences = 0;
  let totalWeightedScore = 0;
  const learnedFields = new Set<TeacherEditedField>();

  editedSessions.forEach((session, index) => {
    const recencyWeight = RECENCY_WEIGHTS[index] ?? 1;
    const overrideWeight = OVERRIDE_WEIGHT_SCORE[session.teacherOverrideWeight] ?? 0;
    weightedOccurrences += overrideWeight;
    const score = recencyWeight * overrideWeight;
    totalWeightedScore += score;

    (session.teacherEditedFields ?? []).forEach((field) => learnedFields.add(field));

    if (hasEditedField(session.teacherEditedFields, "primarySkill")) {
      incrementCount(skillScores, session.primarySkill, score);
    }
    if (hasEditedField(session.teacherEditedFields, "progressionDimension")) {
      incrementCount(progressionScores, session.progressionDimension, score);
    }
    if (hasEditedField(session.teacherEditedFields, "methodologyApproach")) {
      incrementCount(approachScores, session.methodologyApproach, score);
    }
    incrementCount(blockScores, session.dominantBlock, score);
  });

  const conservativeBonus = getConservativeOverrideBonus(weightedOccurrences, 2, 3, 12);
  if (conservativeBonus === 0) {
    const strength = resolveInfluenceStrength(totalWeightedScore);
    return {
      strength,
      weightedOccurrences,
      learningWindowGenerations: resolveLearningWindowGenerations(strength),
      preferredPrimarySkill: pickTopKey<VolleyballSkill>(skillScores),
      preferredProgressionDimension: pickTopKey<ProgressionDimension>(progressionScores),
      preferredMethodologyApproach: pickTopKey<KnownMethodologyApproach | string>(approachScores),
      preferredDominantBlock: pickTopKey<string>(blockScores),
      learnedFields: [...learnedFields],
    };
  }

  const strength = resolveInfluenceStrength(totalWeightedScore + conservativeBonus);

  return {
    strength,
    weightedOccurrences,
    learningWindowGenerations: resolveLearningWindowGenerations(strength),
    preferredPrimarySkill: pickTopKey<VolleyballSkill>(skillScores),
    preferredProgressionDimension: pickTopKey<ProgressionDimension>(progressionScores),
    preferredMethodologyApproach: pickTopKey<KnownMethodologyApproach | string>(approachScores),
    preferredDominantBlock: pickTopKey<string>(blockScores),
    learnedFields: [...learnedFields],
  };
};

export const applyTeacherOverrideInfluence = (params: {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
  influence?: TeacherOverrideInfluence;
}): TeacherOverrideStrategyResult => {
  const influence = params.influence ?? resolveTeacherOverrideWeight(params.context);
  if (influence.strength === "none") {
    return {
      strategy: params.strategy,
      adjusted: false,
      influence,
    };
  }

  let nextStrategy = params.strategy;
  let adjusted = false;

  if (
    influence.strength !== "soft" &&
    influence.preferredPrimarySkill &&
    influence.preferredPrimarySkill !== nextStrategy.primarySkill
  ) {
    nextStrategy = {
      ...nextStrategy,
      primarySkill: influence.preferredPrimarySkill,
      secondarySkill:
        nextStrategy.primarySkill !== influence.preferredPrimarySkill
          ? nextStrategy.primarySkill
          : nextStrategy.secondarySkill,
    };
    adjusted = true;
  }

  if (influence.preferredProgressionDimension) {
    const bounds = phaseBounds[params.context.phaseIntent];
    const boundedTarget = clampProgression(
      influence.preferredProgressionDimension,
      bounds.min,
      bounds.max
    );
    const stepped = stepToward(nextStrategy.progressionDimension, boundedTarget);
    if (stepped !== nextStrategy.progressionDimension) {
      nextStrategy = {
        ...nextStrategy,
        progressionDimension: stepped,
        drillFamilies: reprioritizeFamilies(nextStrategy, stepped),
      };
      adjusted = true;
    }
  }

  if (influence.preferredMethodologyApproach) {
    const reprioritizedFamilies = reprioritizeFamiliesByApproach(
      nextStrategy,
      influence.preferredMethodologyApproach
    );
    if (JSON.stringify(reprioritizedFamilies) !== JSON.stringify(nextStrategy.drillFamilies)) {
      nextStrategy = {
        ...nextStrategy,
        drillFamilies: reprioritizedFamilies,
      };
      adjusted = true;
    }
  }

  return {
    strategy: nextStrategy,
    adjusted,
    influence,
  };
};
