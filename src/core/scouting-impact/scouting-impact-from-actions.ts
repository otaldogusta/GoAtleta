import {
  formatEvidenceRuleSummary,
  resolveEvidenceRulesForContext,
  type EvidenceTrace,
} from "../evidence";
import type { ScoutingAction } from "../scouting-action";
import type { ScoutingImpact, ScoutingLoadImpact } from "../team-context";
import {
  calculateScoutingPriorityBySkill,
  resolveRecommendedFocusFromPriorities,
} from "./scouting-impact-priority";

export type GeneratedScoutingImpactInput = {
  classId: string;
  eventId?: string;
  scoutingSessionId: string;
  date: string;
  actions: ScoutingAction[];
  sessionType?: "training" | "friendly" | "official_match";
};

export type GeneratedScoutingImpactResult = {
  impact: ScoutingImpact | null;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  ignoredReasons: string[];
  evidenceTrace?: EvidenceTrace;
};

const buildId = (input: GeneratedScoutingImpactInput) =>
  `scouting_impact_${input.scoutingSessionId}_${Date.now()}`;

function unique(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(value.trim());
  }
  return output;
}

export function resolveLoadImpactFromSessionAndActions(
  input: GeneratedScoutingImpactInput,
): ScoutingLoadImpact {
  const priorities = calculateScoutingPriorityBySkill(input.actions);
  const recurringWeaknesses = priorities.filter((item) => item.weaknessLabel).length;
  if ((input.sessionType === "friendly" || input.sessionType === "official_match") && recurringWeaknesses >= 2) {
    return "reduce";
  }
  return "maintain";
}

function buildTacticalNote(label: string) {
  if (label === "recepção sob pressão") {
    return "Recepção apresentou recorrência de ações C/erro.";
  }
  if (label === "cobertura pós-ataque") {
    return "Cobertura apareceu como ponto de atenção em transição.";
  }
  if (label === "comunicação defensiva") {
    return "Comunicação tardia/ausente foi registrada em ações recentes.";
  }
  if (label === "transição lenta") {
    return "Transição lenta apareceu de forma recorrente nas ações registradas.";
  }
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} apareceu como ponto de atenção no scouting.`;
}

function buildEvidenceTrace(input: {
  actions: ScoutingAction[];
  hasWeaknesses: boolean;
  loadImpact?: ScoutingLoadImpact;
  sessionType?: GeneratedScoutingImpactInput["sessionType"];
}): EvidenceTrace {
  const rules = resolveEvidenceRulesForContext({
    hasRecentScoutingImpact: input.hasWeaknesses,
    scoutingSampleSize: input.actions.length,
    sessionType: input.sessionType,
    loadIntent: input.loadImpact,
  });
  return {
    evidenceRuleIds: rules.map((rule) => rule.id),
    evidenceSummary: rules.map(formatEvidenceRuleSummary),
    confidence: rules.map((rule) => rule.confidence),
  };
}

export function generateScoutingImpactFromActions(
  input: GeneratedScoutingImpactInput,
): GeneratedScoutingImpactResult {
  const ignoredReasons: string[] = [];
  const reasons: string[] = [];
  const totalActions = input.actions.length;

  if (totalActions < 6) {
    const evidenceTrace = buildEvidenceTrace({
      actions: input.actions,
      hasWeaknesses: false,
      sessionType: input.sessionType,
    });
    return {
      impact: null,
      confidence: "low",
      reasons: [],
      ignoredReasons: ["dados insuficientes"],
      evidenceTrace,
    };
  }

  const priorities = calculateScoutingPriorityBySkill(input.actions);
  const weaknesses = unique(priorities.flatMap((item) => (item.weaknessLabel ? [item.weaknessLabel] : [])));
  const strengths = unique(priorities.flatMap((item) => (item.strengthLabel ? [item.strengthLabel] : [])));
  const recommendedFocus = resolveRecommendedFocusFromPriorities(priorities);

  for (const priority of priorities) {
    if (priority.totalActions < 3) {
      ignoredReasons.push(`${priority.label}: menos de 3 ações`);
    }
  }

  if (!weaknesses.length && !strengths.length) {
    const evidenceTrace = buildEvidenceTrace({
      actions: input.actions,
      hasWeaknesses: false,
      loadImpact: resolveLoadImpactFromSessionAndActions(input),
      sessionType: input.sessionType,
    });
    return {
      impact: null,
      confidence: "low",
      reasons: [],
      ignoredReasons: ["sem padrão técnico recorrente"],
      evidenceTrace,
    };
  }

  if (weaknesses.length) {
    reasons.push("fraquezas recorrentes identificadas por fundamento");
  }
  if (strengths.length) {
    reasons.push("forças recorrentes identificadas por fundamento");
  }

  const loadImpact = resolveLoadImpactFromSessionAndActions(input);
  const evidenceTrace = buildEvidenceTrace({
    actions: input.actions,
    hasWeaknesses: weaknesses.length > 0,
    loadImpact,
    sessionType: input.sessionType,
  });

  const impact: ScoutingImpact = {
    id: buildId(input),
    classId: input.classId,
    eventId: input.eventId ?? input.scoutingSessionId,
    date: input.date,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    tacticalNotes: recommendedFocus.map(buildTacticalNote).slice(0, 3),
    recommendedFocus: recommendedFocus.slice(0, 3),
    loadImpact,
    evidenceTrace,
    evidenceRuleIds: evidenceTrace.evidenceRuleIds,
    evidenceSummary: evidenceTrace.evidenceSummary,
    evidenceConfidence: evidenceTrace.confidence,
    createdAt: new Date().toISOString(),
  };

  return {
    impact,
    confidence: totalActions >= 12 ? "high" : "medium",
    reasons,
    ignoredReasons,
    evidenceTrace,
  };
}
