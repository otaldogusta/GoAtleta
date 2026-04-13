import { buildCycleDayPlanningContext } from "../../../core/cycle-day-planning/build-cycle-day-planning-context";
import type {
    ClassGroup,
    ClassPlan,
    DominantGapType,
    PedagogicalIntent,
    PhaseIntent,
    ProgressionDimension,
    Student,
    TrainingPlan,
    TrainingPlanDevelopmentStage,
    VolleyballSkill,
    WeeklyLoadIntent,
} from "../../../core/models";
import type { PlanningPhase } from "../../../core/pedagogical-planning";
import { getSkillMetrics, scoutingSkills, type ScoutingCounts } from "../../../core/scouting";
import { buildRecentSessionSummary } from "./build-recent-session-summary";

export type { DominantGapType, PedagogicalIntent, PhaseIntent, WeeklyLoadIntent };

export type ClassGenerationContext = {
  classId: string;
  sessionDate: string;
  modality: string;
  classLevel: number;
  ageBand: string;
  developmentStage: TrainingPlanDevelopmentStage;
  planningPhase?: PlanningPhase;
  weekNumber?: number;
  rpeTarget?: number;
  phaseIntent: PhaseIntent;
  weeklyLoadIntent: WeeklyLoadIntent;
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimensionTarget: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  recentSkills: VolleyballSkill[];
  recentProgressionDimensions: ProgressionDimension[];
  recentObjectives: string[];
  recentPlanHashes: string[];
  dominantGapSkill?: VolleyballSkill;
  dominantGapType?: DominantGapType;
  mustAvoidRepeating: string[];
  mustProgressFrom?: string;
  duration: number;
  materials: string[];
  constraints: string[];
  allowedDrillFamilies: string[];
  forbiddenDrillFamilies: string[];
};

type BuildClassGenerationContextParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  students: Student[];
  sessionDate: string;
  scoutingCounts?: ScoutingCounts | null;
  recentPlans?: TrainingPlan[];
};

const DEFAULT_SKILL_ROTATION: VolleyballSkill[] = [
  "passe",
  "levantamento",
  "ataque",
  "saque",
  "defesa",
  "bloqueio",
  "transicao",
];

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const splitMaterials = (value: string) =>
  String(value ?? "")
    .split(/[\n,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseAgeBandStart = (value: string) => {
  const match = String(value ?? "").match(/(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const pickDevelopmentStage = (classGroup: ClassGroup): TrainingPlanDevelopmentStage => {
  const ageStart = parseAgeBandStart(classGroup.ageBand);
  if (ageStart !== null && ageStart <= 11) return "fundamental";
  if (ageStart !== null && ageStart <= 16) return "especializado";
  return "aplicado";
};

const normalizePlanningPhase = (phase?: string): PlanningPhase | undefined => {
  if (!phase) return undefined;
  const normalized = normalizeText(phase);
  if (/competi/.test(normalized)) return /pre/.test(normalized) ? "pre_competitivo" : "competitivo";
  if (/desenvolv|tatico|tecnico/.test(normalized)) return "desenvolvimento";
  if (/base|fundament|coordenac|padroes|exploracao|ludic|consolidac/.test(normalized)) return "base";
  return undefined;
};

const parseRpeTarget = (rpeTarget?: string): number | undefined => {
  if (!rpeTarget) return undefined;
  const match = rpeTarget.match(/(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const resolveSkillFromText = (value: string | null | undefined): VolleyballSkill | null => {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.includes("levant")) return "levantamento";
  if (text.includes("ataq") || text.includes("cortada") || text.includes("spike")) return "ataque";
  if (text.includes("bloq") || text.includes("block")) return "bloqueio";
  if (text.includes("defes") || text.includes("dig") || text.includes("cobertura")) return "defesa";
  if (text.includes("saque") || text.includes("serv")) return "saque";
  if (text.includes("trans") || text.includes("virada") || text.includes("jogo")) return "transicao";
  if (text.includes("passe") || text.includes("recep") || text.includes("manchete")) return "passe";
  return null;
};

const resolveScoutingPrioritySkill = (counts?: ScoutingCounts | null): VolleyballSkill | null => {
  if (!counts) return null;
  const ranked = scoutingSkills
    .map((skill) => ({
      id: skill.id,
      metrics: getSkillMetrics(counts[skill.id]),
    }))
    .filter((entry) => entry.metrics.total > 0)
    .sort((left, right) => {
      if (left.metrics.goodPct !== right.metrics.goodPct) {
        return left.metrics.goodPct - right.metrics.goodPct;
      }
      return left.metrics.avg - right.metrics.avg;
    });

  const weakest = ranked[0];
  if (!weakest) return null;

  const mapToSkill: Record<(typeof scoutingSkills)[number]["id"], VolleyballSkill> = {
    serve: "saque",
    receive: "passe",
    set: "levantamento",
    attack_send: "ataque",
  };

  return mapToSkill[weakest.id] ?? null;
};

const resolveDominantGapType = (counts?: ScoutingCounts | null): DominantGapType | undefined => {
  if (!counts) return undefined;
  const ranked = scoutingSkills
    .map((skill) => ({
      id: skill.id,
      metrics: getSkillMetrics(counts[skill.id]),
    }))
    .filter((entry) => entry.metrics.total > 0)
    .sort((left, right) => {
      if (left.metrics.goodPct !== right.metrics.goodPct) {
        return left.metrics.goodPct - right.metrics.goodPct;
      }
      return left.metrics.avg - right.metrics.avg;
    });

  const weakest = ranked[0];
  if (!weakest) return undefined;
  if (weakest.id === "set" || weakest.id === "attack_send") {
    if (weakest.metrics.goodPct <= 0.18) return "tomada_decisao";
    return "organizacao";
  }
  if (weakest.metrics.avg <= 0.75) return "tecnica";
  if (weakest.metrics.goodPct <= 0.22) return "consistencia";
  return "pressao";
};

const resolveWeeklyLoadIntent = (
  planningPhase: PlanningPhase | undefined,
  rpeTarget: number | undefined
): WeeklyLoadIntent => {
  if (typeof rpeTarget === "number") {
    if (rpeTarget >= 7) return "alto";
    if (rpeTarget <= 4) return "baixo";
    return "moderado";
  }
  if (planningPhase === "competitivo") return "alto";
  if (planningPhase === "base") return "baixo";
  return "moderado";
};

const resolvePhaseIntent = (
  planningPhase: PlanningPhase | undefined,
  weeklyLoadIntent: WeeklyLoadIntent
): PhaseIntent => {
  if (planningPhase === "competitivo") {
    return weeklyLoadIntent === "alto" ? "pressao_competitiva" : "transferencia_jogo";
  }
  if (planningPhase === "pre_competitivo") return "aceleracao_decisao";
  if (planningPhase === "desenvolvimento") return "estabilizacao_tecnica";
  return "exploracao_fundamentos";
};

const advanceProgressionDimension = (
  dimension: ProgressionDimension
): ProgressionDimension => {
  const ladder: ProgressionDimension[] = [
    "consistencia",
    "precisao",
    "pressao_tempo",
    "oposicao",
    "tomada_decisao",
    "transferencia_jogo",
  ];
  const currentIndex = ladder.indexOf(dimension);
  if (currentIndex < 0 || currentIndex >= ladder.length - 1) return dimension;
  return ladder[currentIndex + 1];
};

const deriveDrillFamily = (plan: TrainingPlan): string => {
  const text = normalizeText(
    [
      plan.title,
      ...(plan.tags ?? []),
      ...(plan.warmup ?? []),
      ...(plan.main ?? []),
      ...(plan.cooldown ?? []),
      plan.pedagogy?.sessionObjective,
      plan.pedagogy?.objective?.description,
    ].join(" ")
  );

  if (text.includes("jogo reduz") || text.includes("jogo condicionado") || text.includes("rally")) {
    return "jogo_condicionado";
  }
  if (text.includes("alvo") || text.includes("zona") || text.includes("direcion")) {
    return "alvo_zona";
  }
  if (text.includes("desloc") || text.includes("transicao")) {
    return "deslocamento";
  }
  if (text.includes("cooper") || text.includes("dupla") || text.includes("continuidade")) {
    return "cooperacao";
  }
  if (text.includes("estacao") || text.includes("circuito")) {
    return "estacoes";
  }
  if (text.includes("saque")) {
    return "saque_direcionado";
  }
  return "bloco_tecnico";
};

const resolvePrimarySkill = (params: {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  scoutingCounts?: ScoutingCounts | null;
  recentSkills: VolleyballSkill[];
}): VolleyballSkill => {
  const technicalFocusSkill = resolveSkillFromText(params.classPlan?.technicalFocus);
  const themeSkill = resolveSkillFromText(params.classPlan?.theme);
  const goalSkill = resolveSkillFromText(params.classGroup.goal);
  const modalitySkill = resolveSkillFromText(params.classGroup.modality);
  const scoutingSkill = resolveScoutingPrioritySkill(params.scoutingCounts);
  const recentDominant =
    params.recentSkills[0] && params.recentSkills[1] && params.recentSkills[0] === params.recentSkills[1]
      ? params.recentSkills[0]
      : null;

  if (technicalFocusSkill) return technicalFocusSkill;

  const candidates = uniqueStrings([
    scoutingSkill,
    themeSkill,
    goalSkill,
    modalitySkill,
  ]) as VolleyballSkill[];

  const nonRepeatedCandidate = candidates.find((skill) => skill !== recentDominant);
  if (nonRepeatedCandidate) return nonRepeatedCandidate;
  if (candidates[0]) return candidates[0];

  return (
    DEFAULT_SKILL_ROTATION.find((skill) => skill !== params.recentSkills[0]) ??
    DEFAULT_SKILL_ROTATION[0]
  );
};

const resolveSecondarySkill = (params: {
  primarySkill: VolleyballSkill;
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  recentSkills: VolleyballSkill[];
}): VolleyballSkill | undefined => {
  const candidates = uniqueStrings([
    resolveSkillFromText(params.classPlan?.theme),
    resolveSkillFromText(params.classGroup.goal),
    resolveSkillFromText(params.classGroup.modality),
    ...params.recentSkills.slice(0, 3),
    params.primarySkill === "passe" ? "levantamento" : "passe",
  ]) as VolleyballSkill[];
  return candidates.find((skill) => skill && skill !== params.primarySkill);
};

const resolveProgressionDimensionTarget = (params: {
  planningPhase?: PlanningPhase;
  classLevel: number;
  dominantGapType?: DominantGapType;
  recentProgressionDimensions: ProgressionDimension[];
}): ProgressionDimension => {
  let target: ProgressionDimension;

  if (params.dominantGapType === "consistencia") {
    target = "consistencia";
  } else if (params.dominantGapType === "tecnica") {
    target = params.planningPhase === "base" ? "consistencia" : "precisao";
  } else if (params.dominantGapType === "tomada_decisao") {
    target = "tomada_decisao";
  } else if (params.dominantGapType === "organizacao") {
    target = "transferencia_jogo";
  } else if (params.dominantGapType === "pressao") {
    target = "pressao_tempo";
  } else if (params.planningPhase === "competitivo") {
    target = "transferencia_jogo";
  } else if (params.planningPhase === "pre_competitivo") {
    target = "tomada_decisao";
  } else if (params.planningPhase === "desenvolvimento") {
    target = params.classLevel >= 3 ? "oposicao" : "pressao_tempo";
  } else {
    target = "consistencia";
  }

  if (
    params.recentProgressionDimensions[0] === target &&
    params.recentProgressionDimensions[1] === target
  ) {
    return advanceProgressionDimension(target);
  }

  return target;
};

const resolvePedagogicalIntent = (params: {
  phaseIntent: PhaseIntent;
  progressionDimensionTarget: ProgressionDimension;
  primarySkill: VolleyballSkill;
}): PedagogicalIntent => {
  if (params.phaseIntent === "pressao_competitiva") return "pressure_adaptation";
  if (params.progressionDimensionTarget === "tomada_decisao") return "decision_making";
  if (params.progressionDimensionTarget === "transferencia_jogo") {
    return params.primarySkill === "transicao" ? "team_organization" : "game_reading";
  }
  if (
    params.progressionDimensionTarget === "pressao_tempo" ||
    params.progressionDimensionTarget === "oposicao"
  ) {
    return "pressure_adaptation";
  }
  return "technical_adjustment";
};

const resolveAllowedDrillFamilies = (params: {
  developmentStage: TrainingPlanDevelopmentStage;
  phaseIntent: PhaseIntent;
  progressionDimensionTarget: ProgressionDimension;
}): string[] => {
  if (params.developmentStage === "fundamental") {
    return uniqueStrings([
      "cooperacao",
      "alvo_zona",
      "bloco_tecnico",
      params.progressionDimensionTarget === "transferencia_jogo" ? "jogo_condicionado" : null,
    ]);
  }
  if (params.phaseIntent === "pressao_competitiva") {
    return ["jogo_condicionado", "deslocamento", "bloco_tecnico"];
  }
  return uniqueStrings([
    "bloco_tecnico",
    "deslocamento",
    params.progressionDimensionTarget === "tomada_decisao" ? "jogo_condicionado" : "alvo_zona",
  ]);
};

const resolveForbiddenDrillFamilies = (params: {
  developmentStage: TrainingPlanDevelopmentStage;
  phaseIntent: PhaseIntent;
}): string[] => {
  if (params.developmentStage === "fundamental") {
    return ["pressao_competitiva", "circuito_mecanico_extenso"];
  }
  if (params.phaseIntent === "pressao_competitiva") {
    return ["cooperacao_passiva_repetitiva"];
  }
  return ["repeticao_estatica_prolongada"];
};

const resolveRecentObjectives = (recentPlans: TrainingPlan[]) =>
  uniqueStrings(
    recentPlans.map(
      (plan) =>
        plan.pedagogy?.sessionObjective ||
        plan.pedagogy?.objective?.description ||
        plan.title
    )
  ).slice(0, 5);

const resolveRepeatGuards = (recentPlans: TrainingPlan[]) => {
  const latestPlan = recentPlans[0];
  if (!latestPlan) return [];

  const latestFamily = deriveDrillFamily(latestPlan);
  const latestSkill = latestPlan.pedagogy?.focus?.skill;
  const latestDimension = latestPlan.pedagogy?.progression?.dimension;
  const familyRepeatCount = recentPlans
    .slice(0, 3)
    .map(deriveDrillFamily)
    .filter((family) => family === latestFamily).length;

  return uniqueStrings([
    latestSkill && latestDimension
      ? `${latestSkill} com ${latestDimension.replace(/_/g, " ")}`
      : null,
    familyRepeatCount >= 2 ? `familia ${latestFamily.replace(/_/g, " ")}` : null,
    latestPlan.pedagogy?.sessionObjective
      ? `objetivo ${latestPlan.pedagogy.sessionObjective}`
      : null,
  ]).slice(0, 3);
};

const resolveProgressionAnchor = (recentPlans: TrainingPlan[]) => {
  const latestPlan = recentPlans[0];
  if (!latestPlan) return undefined;

  const latestSkill = latestPlan.pedagogy?.focus?.skill;
  const latestDimension = latestPlan.pedagogy?.progression?.dimension;
  const latestFamily = deriveDrillFamily(latestPlan);
  const summary = uniqueStrings([
    latestSkill,
    latestDimension?.replace(/_/g, " "),
    latestFamily.replace(/_/g, " "),
  ]).join(" / ");

  return summary || latestPlan.pedagogy?.sessionObjective || latestPlan.title || undefined;
};

export function buildClassGenerationContext(
  params: BuildClassGenerationContextParams
): ClassGenerationContext {
  const recentPlans = [...(params.recentPlans ?? [])].slice(0, 5);
  const recentSessions = buildRecentSessionSummary({
    classId: params.classGroup.id,
    plans: recentPlans,
    limit: 5,
  });
  const cycleContext = buildCycleDayPlanningContext({
    classGroup: params.classGroup,
    classPlan: params.classPlan,
    sessionDate: params.sessionDate,
    recentSessions,
    scoutingCounts: params.scoutingCounts,
  });
  const recentSkills = recentPlans
    .map((plan) => plan.pedagogy?.focus?.skill)
    .filter((skill): skill is VolleyballSkill => Boolean(skill));
  const recentProgressionDimensions = recentPlans
    .map((plan) => plan.pedagogy?.progression?.dimension)
    .filter((dimension): dimension is ProgressionDimension => Boolean(dimension));

  return {
    classId: cycleContext.classId,
    sessionDate: cycleContext.sessionDate,
    modality: cycleContext.modality ?? "",
    classLevel: cycleContext.classLevel,
    ageBand: cycleContext.ageBand ?? "",
    developmentStage: cycleContext.developmentStage,
    planningPhase: cycleContext.planningPhase,
    weekNumber: cycleContext.weekNumber,
    rpeTarget: cycleContext.targetPse,
    phaseIntent: cycleContext.phaseIntent,
    weeklyLoadIntent: cycleContext.weeklyLoadIntent,
    primarySkill: cycleContext.primarySkill,
    secondarySkill: cycleContext.secondarySkill,
    progressionDimensionTarget: cycleContext.progressionDimensionTarget,
    pedagogicalIntent: cycleContext.pedagogicalIntent,
    recentSkills,
    recentProgressionDimensions,
    recentObjectives: resolveRecentObjectives(recentPlans),
    recentPlanHashes: uniqueStrings(recentPlans.map((plan) => plan.inputHash)).slice(0, 5),
    dominantGapSkill: cycleContext.dominantGapSkill,
    dominantGapType: cycleContext.dominantGapType,
    mustAvoidRepeating: cycleContext.mustAvoidRepeating,
    mustProgressFrom: cycleContext.mustProgressFrom,
    duration: cycleContext.duration,
    materials: cycleContext.materials,
    constraints: cycleContext.constraints,
    allowedDrillFamilies: cycleContext.allowedDrillFamilies,
    forbiddenDrillFamilies: cycleContext.forbiddenDrillFamilies,
  };
}
