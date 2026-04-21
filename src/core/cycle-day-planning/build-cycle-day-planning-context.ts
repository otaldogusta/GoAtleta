import type {
  ClassGroup,
  ClassPlan,
  CycleDayPlanningContext,
  DominantGapType,
  PhaseIntent,
  ProgressionDimension,
  RecentSessionSummary,
  TrainingPlanDevelopmentStage,
  VolleyballSkill,
  WeeklyLoadIntent,
  WeeklyOperationalStrategySnapshot,
} from "../models";
import type { PlanningPhase } from "../pedagogical-planning";
import { getPlannedLoads } from "../periodization-load";
import { getSkillMetrics, scoutingSkills, type ScoutingCounts } from "../scouting";
import { resolveDominantBlockStrategyProfile } from "./resolve-block-dominant-strategy";
import { resolveHistoricalConfidence } from "./resolve-historical-confidence";
import { resolveSessionIndexInWeek } from "./resolve-session-index-in-week";

export type BuildCycleDayPlanningContextParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  sessionDate: string;
  recentSessions?: RecentSessionSummary[] | null;
  scoutingCounts?: ScoutingCounts | null;
  sessionIndexInWeek?: number;
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
  if (text.includes("fundament") || text.includes("base tecnica") || text.includes("iniciacao")) {
    return "passe";
  }
  if (text.includes("resist") || text.includes("condicion")) return "defesa";
  if (text.includes("organiz") || text.includes("sistema") || text.includes("coletiv")) {
    return "transicao";
  }
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
  dimension: ProgressionDimension,
  steps = 1
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
  if (currentIndex < 0) return dimension;
  const nextIndex = Math.min(currentIndex + Math.max(0, steps), ladder.length - 1);
  return ladder[nextIndex];
};

const sortRecentSessions = (sessions: RecentSessionSummary[]) =>
  [...sessions].sort((left, right) => normalizeText(right.sessionDate).localeCompare(normalizeText(left.sessionDate)));

const resolveRecentSkills = (recentSessions: RecentSessionSummary[]) =>
  recentSessions
    .map((session) => session.primarySkill)
    .filter((skill): skill is VolleyballSkill => Boolean(skill));

const resolveRecentProgressionDimensions = (recentSessions: RecentSessionSummary[]) =>
  recentSessions
    .map((session) => session.progressionDimension)
    .filter((dimension): dimension is ProgressionDimension => Boolean(dimension));

const resolvePrimarySkill = (params: {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  scoutingCounts?: ScoutingCounts | null;
  recentSkills: VolleyballSkill[];
  sessionIndexInWeek: number;
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

  const candidates = uniqueStrings([scoutingSkill, themeSkill, goalSkill, modalitySkill]) as VolleyballSkill[];
  const shiftedCandidates = params.sessionIndexInWeek > 1 ? [...candidates.slice(1), candidates[0]].filter(Boolean) : candidates;
  const nonRepeatedCandidate = shiftedCandidates.find((skill) => skill !== recentDominant);
  if (nonRepeatedCandidate) return nonRepeatedCandidate;
  if (shiftedCandidates[0]) return shiftedCandidates[0];

  const fallbackIndex = Math.max(0, params.sessionIndexInWeek - 1) % DEFAULT_SKILL_ROTATION.length;
  return DEFAULT_SKILL_ROTATION.find((skill, index) => index >= fallbackIndex && skill !== params.recentSkills[0]) ?? DEFAULT_SKILL_ROTATION[fallbackIndex] ?? DEFAULT_SKILL_ROTATION[0];
};

const resolveSecondarySkill = (params: {
  primarySkill: VolleyballSkill;
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  recentSkills: VolleyballSkill[];
  sessionIndexInWeek: number;
}): VolleyballSkill | undefined => {
  const candidates = uniqueStrings([
    resolveSkillFromText(params.classPlan?.theme),
    resolveSkillFromText(params.classGroup.goal),
    resolveSkillFromText(params.classGroup.modality),
    ...params.recentSkills.slice(0, 3),
    params.primarySkill === "passe" ? "levantamento" : "passe",
  ]) as VolleyballSkill[];
  if (!candidates.length) return undefined;
  const startIndex = params.sessionIndexInWeek > 1 ? 1 : 0;
  return [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)].find(
    (skill) => skill && skill !== params.primarySkill
  );
};

const resolveProgressionDimensionTarget = (params: {
  planningPhase?: PlanningPhase;
  classLevel: number;
  dominantGapType?: DominantGapType;
  recentProgressionDimensions: ProgressionDimension[];
  historicalConfidence: CycleDayPlanningContext["historicalConfidence"];
  sessionIndexInWeek: number;
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
    const advanceBy = params.historicalConfidence === "high" ? 1 : 0;
    return advanceProgressionDimension(target, advanceBy);
  }

  if (params.sessionIndexInWeek >= 3 && params.historicalConfidence !== "none") {
    return advanceProgressionDimension(target, 1);
  }

  return target;
};

const resolvePedagogicalIntent = (params: {
  phaseIntent: PhaseIntent;
  progressionDimensionTarget: ProgressionDimension;
  primarySkill: VolleyballSkill;
}): CycleDayPlanningContext["pedagogicalIntent"] => {
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
  sessionIndexInWeek: number;
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
    params.sessionIndexInWeek >= 2 ? "cooperacao" : null,
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

const resolveRepeatGuards = (recentSessions: RecentSessionSummary[]) => {
  const latestSession = recentSessions[0];
  if (!latestSession) return [];

  const blockRepeatCount = recentSessions
    .slice(0, 3)
    .filter((session) => session.dominantBlock && session.dominantBlock === latestSession.dominantBlock).length;
  const fingerprintRepeatCount = recentSessions
    .slice(0, 3)
    .filter((session) => session.fingerprint && session.fingerprint === latestSession.fingerprint).length;

  return uniqueStrings([
    latestSession.primarySkill && latestSession.progressionDimension
      ? `${latestSession.primarySkill} com ${latestSession.progressionDimension.replace(/_/g, " ")}`
      : null,
    blockRepeatCount >= 2 && latestSession.dominantBlock
      ? `bloco ${latestSession.dominantBlock.replace(/_/g, " ")}`
      : null,
    fingerprintRepeatCount >= 2 && latestSession.fingerprint ? `fingerprint ${latestSession.fingerprint}` : null,
  ]).slice(0, 3);
};

const resolveProgressionAnchor = (recentSessions: RecentSessionSummary[]) => {
  const latestSession = recentSessions[0];
  if (!latestSession) return undefined;

  const summary = uniqueStrings([
    latestSession.primarySkill,
    latestSession.progressionDimension?.replace(/_/g, " "),
    latestSession.dominantBlock?.replace(/_/g, " "),
  ]).join(" / ");

  return summary || latestSession.fingerprint || undefined;
};

const resolveClassPlanDominantBlock = (classPlan?: ClassPlan | null) => {
  if (!classPlan) return undefined;

  const explicitBlock = String(classPlan.constraints ?? "")
    .split("|")
    .map((item) => item.trim())
    .find((item) => normalizeText(item).startsWith("bloco dominante:"));

  if (explicitBlock) {
    const value = explicitBlock.split(":").slice(1).join(":").trim();
    if (value && resolveDominantBlockStrategyProfile(value)) return value;
  }

  const candidates = [classPlan.physicalFocus];
  return candidates.find((candidate) => resolveDominantBlockStrategyProfile(candidate)) ?? undefined;
};

const resolveWeeklyOperationalDecision = (params: {
  classPlan?: ClassPlan | null;
  sessionIndexInWeek: number;
}): CycleDayPlanningContext["weeklyOperationalDecision"] => {
  const raw = String(params.classPlan?.generationContextSnapshotJson ?? "").trim();
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as {
      weeklyOperationalStrategy?:
        | WeeklyOperationalStrategySnapshot
        | {
            decisions?: Array<{
              sessionIndexInWeek?: number;
              sessionRole?: string;
              quarterFocus?: string;
              appliedRules?: string[];
              driftRisks?: string[];
              quarter?: "Q1" | "Q2" | "Q3" | "Q4" | "unknown";
              closingType?: "exploracao" | "consolidacao" | "aplicacao" | "fechamento" | "unknown";
            }>;
          };
    };
    const decisions = parsed.weeklyOperationalStrategy?.decisions;
    if (!Array.isArray(decisions)) return undefined;

    const matched = decisions.find(
      (item) => Number(item?.sessionIndexInWeek) === params.sessionIndexInWeek
    );
    if (!matched) return undefined;

    const allowedRoles = new Set([
      "introducao_exploracao",
      "retomada_consolidacao",
      "consolidacao_orientada",
      "pressao_decisao",
      "transferencia_jogo",
      "sintese_fechamento",
    ]);
    if (!allowedRoles.has(String(matched.sessionRole ?? ""))) return undefined;

    return {
      sessionIndexInWeek: params.sessionIndexInWeek,
      sessionRole: matched.sessionRole as NonNullable<
        CycleDayPlanningContext["weeklyOperationalDecision"]
      >["sessionRole"],
      quarterFocus: String(matched.quarterFocus ?? "").trim(),
      appliedRules: Array.isArray(matched.appliedRules)
        ? matched.appliedRules.map((value) => String(value)).filter(Boolean)
        : [],
      driftRisks: Array.isArray(matched.driftRisks)
        ? matched.driftRisks.map((value) => String(value)).filter(Boolean)
        : [],
      quarter: matched.quarter ?? "unknown",
      closingType: matched.closingType ?? "unknown",
    };
  } catch {
    return undefined;
  }
};

export const buildCycleDayPlanningContext = (
  params: BuildCycleDayPlanningContextParams
): CycleDayPlanningContext => {
  const planningPhase = normalizePlanningPhase(params.classPlan?.phase);
  const targetPse = parseRpeTarget(params.classPlan?.rpeTarget);
  const plannedLoads = getPlannedLoads(
    params.classPlan?.rpeTarget ?? "",
    params.classGroup.durationMinutes || 60,
    params.classGroup.daysPerWeek || 1
  );
  const weeklyLoadIntent = resolveWeeklyLoadIntent(planningPhase, targetPse);
  const phaseIntent = resolvePhaseIntent(planningPhase, weeklyLoadIntent);
  const recentSessions = sortRecentSessions([...(params.recentSessions ?? [])].slice(0, 5));
  const historicalConfidence = resolveHistoricalConfidence(recentSessions);
  const recentSkills = resolveRecentSkills(recentSessions);
  const recentProgressionDimensions = resolveRecentProgressionDimensions(recentSessions);
  const sessionIndexInWeek =
    typeof params.sessionIndexInWeek === "number" && Number.isFinite(params.sessionIndexInWeek)
      ? Math.max(1, Math.floor(params.sessionIndexInWeek))
      : resolveSessionIndexInWeek({
          daysOfWeek: params.classGroup.daysOfWeek,
          sessionDate: params.sessionDate,
        });
  const dominantGapSkill = resolveScoutingPrioritySkill(params.scoutingCounts);
  const dominantGapType = resolveDominantGapType(params.scoutingCounts);
  const primarySkill = resolvePrimarySkill({
    classGroup: params.classGroup,
    classPlan: params.classPlan,
    scoutingCounts: params.scoutingCounts,
    recentSkills,
    sessionIndexInWeek,
  });
  const progressionDimensionTarget = resolveProgressionDimensionTarget({
    planningPhase,
    classLevel: params.classGroup.level,
    dominantGapType,
    recentProgressionDimensions,
    historicalConfidence,
    sessionIndexInWeek,
  });
  const weeklyOperationalDecision = resolveWeeklyOperationalDecision({
    classPlan: params.classPlan,
    sessionIndexInWeek,
  });

  return {
    classId: params.classGroup.id,
    classGoal: params.classGroup.goal,
    sessionDate: params.sessionDate,
    modality: params.classGroup.modality,
    classLevel: params.classGroup.level,
    ageBand: params.classGroup.ageBand ?? "",
    daysPerWeek: params.classGroup.daysPerWeek,
    developmentStage: pickDevelopmentStage(params.classGroup),
    planningPhase,
    weekNumber: params.classPlan?.weekNumber,
    sessionIndexInWeek,
    historicalConfidence,
    phaseIntent,
    weeklyLoadIntent,
    primarySkill,
    secondarySkill: resolveSecondarySkill({
      primarySkill,
      classGroup: params.classGroup,
      classPlan: params.classPlan,
      recentSkills,
      sessionIndexInWeek,
    }),
    progressionDimensionTarget,
    pedagogicalIntent: resolvePedagogicalIntent({
      phaseIntent,
      progressionDimensionTarget,
      primarySkill,
    }),
    recentSessions,
    weeklyOperationalDecision,
    dominantGapSkill: dominantGapSkill ?? undefined,
    dominantGapType,
    dominantBlock: resolveClassPlanDominantBlock(params.classPlan) ?? recentSessions[0]?.dominantBlock,
    targetPse,
    plannedSessionLoad: plannedLoads.plannedSessionLoad || undefined,
    plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad || undefined,
    duration: params.classGroup.durationMinutes || 60,
    materials: splitMaterials(params.classGroup.equipment ?? ""),
    constraints: splitMaterials(
      [params.classGroup.goal, params.classPlan?.constraints, params.classGroup.equipment]
        .filter(Boolean)
        .join(", ")
    ),
    mustAvoidRepeating: resolveRepeatGuards(recentSessions),
    mustProgressFrom: resolveProgressionAnchor(recentSessions),
    allowedDrillFamilies: resolveAllowedDrillFamilies({
      developmentStage: pickDevelopmentStage(params.classGroup),
      phaseIntent,
      progressionDimensionTarget,
      sessionIndexInWeek,
    }),
    forbiddenDrillFamilies: resolveForbiddenDrillFamilies({
      developmentStage: pickDevelopmentStage(params.classGroup),
      phaseIntent,
    }),
  };
};
