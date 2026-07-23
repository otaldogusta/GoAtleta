import type {
  PedagogicalIntent,
  PhaseIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "../models";
import type { ActivityCatalogTaxonomy } from "./activity-catalog";
import type { SessionPlanningContext } from "../session-planning-context";
import { composeActivityPattern } from "./activity-pattern-composer";
import {
  VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS,
  type ActivityFocusVariant,
  type ActivityKnowledgePattern,
} from "./activity-knowledge-patterns";

export type ActivityPatternStage = "warmup" | "drill" | "game" | "cooldown";
export type ActivityPatternAgeStage =
  | "early"
  | "base"
  | "transition"
  | "formation"
  | "specialization";

export type ActivityPatternAgeProfile = {
  stage: ActivityPatternAgeStage;
  label: string;
  gameForm: "mini_2x2" | "mini_3x3" | "mini_4x4" | "game_applied";
  organizationCue: string;
  challengeCue: string;
};

export type ActivityPatternSelectionContext = {
  primarySkill: VolleyballSkill;
  focusVariant?: ActivityFocusVariant;
  ageProfile: ActivityPatternAgeProfile;
  periodizationPhase?: SessionPlanningContext["periodizationPhase"];
  phaseIntent?: PhaseIntent;
  progressionDimension?: ProgressionDimension;
  pedagogicalIntent?: PedagogicalIntent;
  loadIntent?: WeeklyLoadIntent;
  materials: string[];
  classSize: number;
  recentActivityFamilies: string[];
  recentActivityNames?: string[];
  recentActivityPatternIds?: string[];
  upcomingEvents?: SessionPlanningContext["upcomingEvents"];
};

export type ActivityPatternActivitySpec = {
  id: string;
  stage: ActivityPatternStage;
  name: string;
  participants: string;
  organization: string;
  starter: string;
  action: string;
  rotation: string;
  simpleRule: string;
  scoring?: string;
  materials: string[];
  space: string;
  execution: string;
  coachFocus: string;
  successCriteria: string;
  adaptation: string;
  sourcePatternId?: string;
};

export type ActivityPattern = {
  id: string;
  stage: ActivityPatternStage;
  skills: VolleyballSkill[];
  variant?: ActivityFocusVariant;
  ageStages: ActivityPatternAgeStage[];
  families: string[];
  playerFormat: string;
  space: string;
  materials: string[];
  periodizationFit: ("exploration" | "technical" | "decision" | "pressure" | "game_transfer")[];
  catalogTaxonomy?: ActivityCatalogTaxonomy;
  build: (context: ActivityPatternSelectionContext) => ActivityPatternActivitySpec;
};

export type ActivityPatternBlocks = {
  warmup: ActivityPatternActivitySpec[];
  main: ActivityPatternActivitySpec[];
  cooldown: ActivityPatternActivitySpec[];
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const includesAny = (values: string[], targets: string[]) => {
  const normalizedValues = values.map(normalize);
  return targets.some((target) =>
    normalizedValues.some((value) => value.includes(target))
  );
};

const contextIntentFits = (
  pattern: ActivityPattern,
  context: ActivityPatternSelectionContext
) => {
  const fits = pattern.periodizationFit;
  if (
    context.pedagogicalIntent === "decision_making" ||
    context.progressionDimension === "tomada_decisao"
  ) {
    return fits.includes("decision");
  }
  if (
    context.loadIntent === "alto" ||
    context.periodizationPhase === "pre_competitivo" ||
    context.periodizationPhase === "competitivo" ||
    context.progressionDimension === "pressao_tempo" ||
    context.progressionDimension === "oposicao"
  ) {
    return fits.includes("pressure") || fits.includes("game_transfer");
  }
  if (context.progressionDimension === "transferencia_jogo") {
    return fits.includes("game_transfer") || fits.includes("decision");
  }
  if (context.periodizationPhase === "base") {
    return fits.includes("exploration") || fits.includes("technical");
  }
  return fits.includes("technical") || fits.includes("decision");
};

const resolvePhaseIntent = (
  context: ActivityPatternSelectionContext
): PhaseIntent | undefined => {
  if (context.phaseIntent) return context.phaseIntent;
  if (context.periodizationPhase === "base") return "exploracao_fundamentos";
  if (context.periodizationPhase === "desenvolvimento") return "estabilizacao_tecnica";
  if (context.periodizationPhase === "pre_competitivo") return "aceleracao_decisao";
  if (context.periodizationPhase === "competitivo") return "pressao_competitiva";
  return undefined;
};

const scoreCatalogTaxonomy = (
  taxonomy: ActivityCatalogTaxonomy | undefined,
  context: ActivityPatternSelectionContext
) => {
  if (!taxonomy) return 0;

  let score = 0;
  const phaseIntent = resolvePhaseIntent(context);

  if (phaseIntent) {
    score += taxonomy.periodizationCompatibility.includes(phaseIntent) ? 44 : -36;
  }
  if (
    context.progressionDimension &&
    taxonomy.progressionCompatibility.includes(context.progressionDimension)
  ) {
    score += 18;
  }
  if (
    context.pedagogicalIntent &&
    taxonomy.pedagogicalIntent === context.pedagogicalIntent
  ) {
    score += 16;
  }
  if (context.loadIntent && taxonomy.loadCompatibility.includes(context.loadIntent)) {
    score += 8;
  }
  if (taxonomy.ageRange.includes(context.ageProfile.stage)) {
    score += 8;
  }
  return score;
};

const scorePattern = (
  pattern: ActivityPattern,
  context: ActivityPatternSelectionContext
) => {
  let score = 0;
  if (pattern.skills.includes(context.primarySkill)) score += 40;
  if (pattern.variant === context.focusVariant) score += 24;
  if (!pattern.variant && !context.focusVariant) score += 12;
  if (pattern.ageStages.includes(context.ageProfile.stage)) score += 20;
  if (contextIntentFits(pattern, context)) score += 10;
  if (!includesAny(context.recentActivityFamilies, pattern.families)) score += 6;
  if (pattern.materials.every((material) => includesAny(context.materials, [material]))) {
    score += 4;
  }
  if (context.classSize >= 16 && /equipe|grupo|turma/.test(normalize(pattern.playerFormat))) {
    score += 2;
  }
  score += scoreCatalogTaxonomy(pattern.catalogTaxonomy, context);
  return score;
};

const resolveRecentPatternIndex = (
  pattern: ActivityPattern,
  context: ActivityPatternSelectionContext
) => {
  const patternId = normalize(pattern.id);
  const activityName = normalize(pattern.build(context).name);
  const patternIndex = (context.recentActivityPatternIds ?? [])
    .map(normalize)
    .findIndex((value) => value === patternId);
  const nameIndex = (context.recentActivityNames ?? [])
    .map(normalize)
    .findIndex((value) => value === activityName);

  if (patternIndex < 0) return nameIndex;
  if (nameIndex < 0) return patternIndex;
  return Math.min(patternIndex, nameIndex);
};

const knowledgeToPattern = (knowledge: ActivityKnowledgePattern): ActivityPattern => ({
  id: knowledge.id,
  stage: knowledge.stage,
  skills: [knowledge.skill],
  variant: knowledge.variant,
  ageStages: knowledge.ageStages,
  families: knowledge.families,
  playerFormat: knowledge.players,
  space: knowledge.space,
  materials: knowledge.materials,
  periodizationFit: knowledge.periodizationFit,
  catalogTaxonomy: knowledge.catalogTaxonomy,
  build: (context) => composeActivityPattern(knowledge, context),
});

export const VOLLEYBALL_ACTIVITY_PATTERNS: ActivityPattern[] =
  VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS.map(knowledgeToPattern);

const selectPattern = (
  stage: ActivityPatternStage,
  context: ActivityPatternSelectionContext
) => {
  const sameVariant = VOLLEYBALL_ACTIVITY_PATTERNS.filter(
    (pattern) =>
      pattern.stage === stage &&
      pattern.skills.includes(context.primarySkill) &&
      pattern.variant === context.focusVariant &&
      pattern.ageStages.includes(context.ageProfile.stage)
  );
  const generic = VOLLEYBALL_ACTIVITY_PATTERNS.filter(
    (pattern) =>
      pattern.stage === stage &&
      pattern.skills.includes(context.primarySkill) &&
      !pattern.variant &&
      pattern.ageStages.includes(context.ageProfile.stage)
  );
  const fallback = VOLLEYBALL_ACTIVITY_PATTERNS.filter(
    (pattern) =>
      pattern.stage === stage &&
      pattern.skills.includes(context.primarySkill) &&
      (pattern.variant === context.focusVariant || !pattern.variant)
  );
  const available = sameVariant.length ? sameVariant : generic.length ? generic : fallback;
  const fresh = available.filter((pattern) => resolveRecentPatternIndex(pattern, context) < 0);
  const selectionPool = fresh.length ? fresh : available;
  return [...selectionPool].sort((left, right) => {
    if (!fresh.length) {
      const recentUseDelta =
        resolveRecentPatternIndex(right, context) - resolveRecentPatternIndex(left, context);
      if (recentUseDelta) return recentUseDelta;
    }
    const scoreDelta = scorePattern(right, context) - scorePattern(left, context);
    return scoreDelta || left.id.localeCompare(right.id);
  })[0];
};

export const buildPatternBackedVolleyballBlocks = (
  context: ActivityPatternSelectionContext
): ActivityPatternBlocks => {
  const warmup = selectPattern("warmup", context)?.build(context);
  const drill = selectPattern("drill", context)?.build(context);
  const game = selectPattern("game", context)?.build(context);
  const cooldown = selectPattern("cooldown", context)?.build(context);

  return {
    warmup: warmup ? [warmup] : [],
    main: [drill, game].filter(
      (activity): activity is ActivityPatternActivitySpec => Boolean(activity)
    ),
    cooldown: cooldown ? [cooldown] : [],
  };
};
