import {
  formatEvidenceRuleSummary,
  resolveEvidenceRulesForContext,
  type EvidenceTrace,
} from "../../../core/evidence";
import type { ClassPlan } from "../../../core/models";
import type { ScoutingImpact, TeamPlanningContext } from "../../../core/team-context";

export type AdaptWeekPlanWithScoutingImpactInput = {
  classId: string;
  weekStartDate: string;
  baseWeekPlan: ClassPlan;
  teamPlanningContext?: TeamPlanningContext | null;
  scoutingImpacts?: ScoutingImpact[] | null;
};

export type AdaptWeekPlanWithScoutingImpactOutput = {
  adaptedWeekPlan: ClassPlan;
  explanation: string;
  appliedSignals: string[];
  evidenceTrace?: EvidenceTrace;
};

type ScoutingImpactSnapshot = {
  impactIds: string[];
  recommendedFocus: string[];
  weaknesses: string[];
  tacticalNotes: string[];
  loadImpact: ScoutingImpact["loadImpact"] | "none";
  appliedSignals: string[];
  evidenceTrace?: EvidenceTrace;
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const normalized = cleaned.toLowerCase();
    if (!cleaned || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(cleaned);
  }
  return output;
};

const isManualOrOverriddenPlan = (plan: ClassPlan) =>
  plan.source === "MANUAL" ||
  Boolean(plan.manualOverrideMaskJson?.trim()) ||
  Boolean(plan.manualOverridesJson?.trim()) ||
  plan.syncStatus === "overridden" ||
  Boolean(plan.lastManualEditedAt?.trim());

const buildEvidenceTrace = (params: {
  hasRecentScoutingImpact: boolean;
  scoutingSampleSize?: number;
  manualOverride: boolean;
  loadIntent?: string;
}): EvidenceTrace => {
  const rules = resolveEvidenceRulesForContext({
    hasRecentScoutingImpact: params.hasRecentScoutingImpact,
    scoutingSampleSize: params.scoutingSampleSize,
    manualOverride: params.manualOverride,
    loadIntent: params.loadIntent,
  });
  return {
    evidenceRuleIds: rules.map((rule) => rule.id),
    evidenceSummary: rules.map(formatEvidenceRuleSummary),
    confidence: rules.map((rule) => rule.confidence),
  };
};

const parseSnapshot = (value?: string) => {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const maxPseFromTarget = (target: string) => {
  const values = target.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  return values.length ? Math.max(...values) : null;
};

const resolveTrainingCue = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("recepcao")) return "recepção contextualizada";
  if (normalized.includes("cobertura")) return "cobertura pós-ataque";
  if (normalized.includes("comunicacao")) return "comunicação defensiva";
  if (normalized.includes("transicao")) return "transição defesa-ataque";
  return value;
};

const resolveRelevantImpacts = (input: AdaptWeekPlanWithScoutingImpactInput) =>
  [...(input.scoutingImpacts ?? [])]
    .filter((impact) => impact.classId === input.classId)
    .filter((impact) => !input.weekStartDate || impact.date <= input.weekStartDate)
    .sort((a, b) => {
      if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);

export function adaptWeekPlanWithScoutingImpact(
  input: AdaptWeekPlanWithScoutingImpactInput,
): AdaptWeekPlanWithScoutingImpactOutput {
  const impacts = resolveRelevantImpacts(input);
  if (!impacts.length) {
    return {
      adaptedWeekPlan: input.baseWeekPlan,
      explanation: "Sem scouting recente aplicado à semana.",
      appliedSignals: [],
    };
  }

  const recommendedFocus = uniqueStrings(impacts.flatMap((impact) => impact.recommendedFocus)).slice(0, 2);
  const weaknesses = uniqueStrings(impacts.flatMap((impact) => impact.weaknesses)).slice(0, 3);
  const tacticalNotes = uniqueStrings(impacts.flatMap((impact) => impact.tacticalNotes)).slice(0, 3);
  const trainingCues = uniqueStrings([...recommendedFocus, ...weaknesses].map(resolveTrainingCue)).slice(0, 3);
  const appliedSignals = uniqueStrings([...trainingCues, ...tacticalNotes]).slice(0, 3);
  const loadImpact = impacts.some((impact) => impact.loadImpact === "reduce")
    ? "reduce"
    : impacts.some((impact) => impact.loadImpact === "maintain")
      ? "maintain"
      : "none";
  const manualOverride = isManualOrOverriddenPlan(input.baseWeekPlan);
  const evidenceTrace = buildEvidenceTrace({
    hasRecentScoutingImpact: impacts.length > 0,
    scoutingSampleSize: undefined,
    manualOverride,
    loadIntent: loadImpact === "none" ? undefined : loadImpact,
  });

  const explanation = [
    "A semana foi ajustada por scouting recente.",
    appliedSignals.length ? `Sinais: ${appliedSignals.join(" / ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (manualOverride) {
    return {
      adaptedWeekPlan: input.baseWeekPlan,
      explanation,
      appliedSignals,
      evidenceTrace,
    };
  }

  const plan: ClassPlan = { ...input.baseWeekPlan };
  const focusToApply = trainingCues.slice(0, 2);
  if (focusToApply.length) {
    plan.technicalFocus = uniqueStrings([plan.technicalFocus, ...focusToApply]).slice(0, 3).join(" · ");
    plan.specificObjective = uniqueStrings([plan.specificObjective, ...focusToApply]).slice(0, 3).join(" · ");
  }

  if (loadImpact === "reduce") {
    plan.constraints = uniqueStrings([
      plan.constraints,
      "Scouting recente: evitar alta densidade e volume desnecessário",
    ])
      .slice(0, 6)
      .join(" | ");
    plan.weekNotes = uniqueStrings([
      plan.weekNotes,
      "Ajustada por scouting recente: reduzir densidade e priorizar correções técnicas.",
    ])
      .slice(0, 3)
      .join(" | ");
    const maxPse = maxPseFromTarget(plan.rpeTarget);
    if (maxPse !== null && maxPse >= 7) {
      plan.rpeTarget = "4-6";
    }
  } else if (loadImpact === "maintain") {
    plan.weekNotes = uniqueStrings([
      plan.weekNotes,
      "Scouting recente usado como foco técnico sem alterar a carga planejada.",
    ])
      .slice(0, 3)
      .join(" | ");
  }

  const scoutingImpactSnapshot: ScoutingImpactSnapshot = {
    impactIds: impacts.map((impact) => impact.id),
    recommendedFocus,
    weaknesses,
    tacticalNotes,
    loadImpact,
    appliedSignals,
    evidenceTrace,
  };
  plan.generationContextSnapshotJson = JSON.stringify({
    ...parseSnapshot(plan.generationContextSnapshotJson),
    scoutingImpact: scoutingImpactSnapshot,
    teamPlanningContext: input.teamPlanningContext ?? undefined,
  });

  return {
    adaptedWeekPlan: plan,
    explanation,
    appliedSignals,
    evidenceTrace,
  };
}
