import {
  buildWeekDecisionReport,
  type WeekDecisionReport,
} from "../../../core/decision-report";
import {
  getEvidenceRuleById,
  getEvidenceRuleConfidenceLabel,
  getEvidenceRuleTypeLabel,
  type EvidenceConfidence,
  type EvidenceTrace,
} from "../../../core/evidence";
import type { ClassPlan } from "../../../core/models";
import type { ScoutingImpact, TeamPlanningContext } from "../../../core/team-context";

export type WeekDecisionReportViewModel = {
  shouldShow: boolean;
  title: string;
  shortReason: string;
  summary: string;
  sections: Array<{
    title: string;
    items: string[];
  }>;
  evidenceItems: Array<{
    label: string;
    confidence: string;
    typeLabel: string;
    confidenceTone: "muted" | "warning" | "success";
  }>;
  manualOverridePreserved?: boolean;
};

export type WeekDecisionReportViewModelInput = {
  classId: string;
  weekStartDate: string;
  weekPlan?: Partial<ClassPlan> | null;
  teamPlanningContext?: TeamPlanningContext | null;
  scoutingImpact?: ScoutingImpact | null;
  evidenceTrace?: EvidenceTrace | null;
  manualOverride?: boolean;
};

type ScoutingImpactSnapshot = {
  impactIds?: string[];
  recommendedFocus?: string[];
  weaknesses?: string[];
  tacticalNotes?: string[];
  loadImpact?: ScoutingImpact["loadImpact"] | "none";
  appliedSignals?: string[];
  evidenceTrace?: EvidenceTrace;
  manualPreserved?: boolean;
};

const uniqueStrings = (values: Array<string | null | undefined>, limit = 4) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
    if (output.length >= limit) break;
  }
  return output;
};

const parseSnapshot = (snapshotJson?: string | null): Record<string, unknown> | null => {
  if (!snapshotJson?.trim()) return null;
  try {
    const parsed = JSON.parse(snapshotJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isEvidenceConfidence = (value: unknown): value is EvidenceConfidence =>
  value === "low" || value === "medium" || value === "high";

const parseEvidenceTrace = (value: unknown): EvidenceTrace | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const trace = value as Partial<EvidenceTrace>;
  if (!isStringArray(trace.evidenceRuleIds) || !trace.evidenceRuleIds.length) return null;
  return {
    evidenceRuleIds: trace.evidenceRuleIds,
    evidenceSummary: isStringArray(trace.evidenceSummary) ? trace.evidenceSummary : [],
    confidence: Array.isArray(trace.confidence)
      ? trace.confidence.filter(isEvidenceConfidence)
      : [],
  };
};

const parseScoutingImpactSnapshot = (snapshotJson?: string | null): ScoutingImpactSnapshot | null => {
  const snapshot = parseSnapshot(snapshotJson);
  const scoutingImpact = snapshot?.scoutingImpact;
  if (!scoutingImpact || typeof scoutingImpact !== "object" || Array.isArray(scoutingImpact)) return null;
  const raw = scoutingImpact as Record<string, unknown>;
  const evidenceTrace = parseEvidenceTrace(raw.evidenceTrace);
  return {
    impactIds: isStringArray(raw.impactIds) ? raw.impactIds : [],
    recommendedFocus: isStringArray(raw.recommendedFocus) ? raw.recommendedFocus : [],
    weaknesses: isStringArray(raw.weaknesses) ? raw.weaknesses : [],
    tacticalNotes: isStringArray(raw.tacticalNotes) ? raw.tacticalNotes : [],
    appliedSignals: isStringArray(raw.appliedSignals) ? raw.appliedSignals : [],
    loadImpact:
      raw.loadImpact === "reduce" ||
      raw.loadImpact === "maintain" ||
      raw.loadImpact === "increase"
        ? raw.loadImpact
        : "maintain",
    evidenceTrace: evidenceTrace ?? undefined,
    manualPreserved: raw.manualPreserved === true,
  };
};

const parseTeamPlanningContextSnapshot = (snapshotJson?: string | null): TeamPlanningContext | null => {
  const snapshot = parseSnapshot(snapshotJson);
  const context = snapshot?.teamPlanningContext;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const raw = context as Partial<TeamPlanningContext>;
  if (!raw.planningMode || !raw.recommendedLoadBias) return null;
  return {
    hasUpcomingMatch: Boolean(raw.hasUpcomingMatch),
    daysUntilMatch: typeof raw.daysUntilMatch === "number" ? raw.daysUntilMatch : null,
    planningMode: raw.planningMode,
    recommendedLoadBias: raw.recommendedLoadBias,
    focusHints: isStringArray(raw.focusHints) ? raw.focusHints : [],
    avoidHints: isStringArray(raw.avoidHints) ? raw.avoidHints : [],
    reason: typeof raw.reason === "string" ? raw.reason : "",
  };
};

const toScoutingImpact = (params: {
  classId: string;
  weekStartDate: string;
  snapshot: ScoutingImpactSnapshot;
}): ScoutingImpact | null => {
  if (
    !params.snapshot.evidenceTrace &&
    !params.snapshot.recommendedFocus?.length &&
    !params.snapshot.weaknesses?.length &&
    !params.snapshot.tacticalNotes?.length
  ) {
    return null;
  }
  return {
    id: params.snapshot.impactIds?.[0] ?? `snapshot_scouting_${params.weekStartDate}`,
    classId: params.classId,
    eventId: params.snapshot.impactIds?.[0] ?? `snapshot_scouting_${params.weekStartDate}`,
    date: params.weekStartDate,
    strengths: [],
    weaknesses: params.snapshot.weaknesses ?? [],
    tacticalNotes: params.snapshot.tacticalNotes ?? [],
    recommendedFocus: params.snapshot.recommendedFocus ?? [],
    loadImpact: params.snapshot.loadImpact === "reduce" || params.snapshot.loadImpact === "increase"
      ? params.snapshot.loadImpact
      : "maintain",
    evidenceTrace: params.snapshot.evidenceTrace,
    evidenceRuleIds: params.snapshot.evidenceTrace?.evidenceRuleIds,
    evidenceSummary: params.snapshot.evidenceTrace?.evidenceSummary,
    evidenceConfidence: params.snapshot.evidenceTrace?.confidence,
    createdAt: `${params.weekStartDate}T00:00:00.000Z`,
  };
};

const toClassPlan = (input: WeekDecisionReportViewModelInput): ClassPlan | null => {
  const plan = input.weekPlan;
  if (!plan) return null;
  return {
    id: plan.id ?? `week_plan_${input.weekStartDate}`,
    classId: plan.classId ?? input.classId,
    startDate: plan.startDate ?? input.weekStartDate,
    weekNumber: plan.weekNumber ?? 1,
    phase: plan.phase ?? "",
    theme: plan.theme ?? "",
    generalObjective: plan.generalObjective,
    specificObjective: plan.specificObjective,
    technicalFocus: plan.technicalFocus ?? "",
    physicalFocus: plan.physicalFocus ?? "",
    pedagogicalRule: plan.pedagogicalRule,
    weekNotes: plan.weekNotes,
    constraints: plan.constraints ?? "",
    mvFormat: plan.mvFormat ?? "",
    warmupProfile: plan.warmupProfile ?? "",
    jumpTarget: plan.jumpTarget ?? "",
    rpeTarget: plan.rpeTarget ?? "",
    source: plan.source ?? "AUTO",
    generationContextSnapshotJson: plan.generationContextSnapshotJson,
    syncStatus: plan.syncStatus,
    manualOverridesJson: plan.manualOverridesJson,
    manualOverrideMaskJson: plan.manualOverrideMaskJson,
    lastManualEditedAt: plan.lastManualEditedAt,
    createdAt: plan.createdAt ?? `${input.weekStartDate}T00:00:00.000Z`,
    updatedAt: plan.updatedAt ?? `${input.weekStartDate}T00:00:00.000Z`,
  };
};

const getConfidenceTone = (confidence: EvidenceConfidence): "muted" | "warning" | "success" => {
  if (confidence === "high") return "success";
  if (confidence === "low") return "warning";
  return "muted";
};

const buildEvidenceItems = (report: WeekDecisionReport): WeekDecisionReportViewModel["evidenceItems"] =>
  report.evidenceRuleIds
    .map((ruleId) => {
      const rule = getEvidenceRuleById(ruleId);
      if (!rule) return null;
      return {
        label: rule.label,
        confidence: getEvidenceRuleConfidenceLabel(rule.confidence),
        typeLabel: getEvidenceRuleTypeLabel(rule.type),
        confidenceTone: getConfidenceTone(rule.confidence),
      };
    })
    .filter((item): item is WeekDecisionReportViewModel["evidenceItems"][number] => Boolean(item))
    .slice(0, 3);

export function buildWeekDecisionReportViewModel(
  input: WeekDecisionReportViewModelInput,
): WeekDecisionReportViewModel {
  const snapshot = parseScoutingImpactSnapshot(input.weekPlan?.generationContextSnapshotJson);
  const snapshotImpact = snapshot
    ? toScoutingImpact({
        classId: input.classId,
        weekStartDate: input.weekStartDate,
        snapshot,
      })
    : null;
  const report = buildWeekDecisionReport({
    classId: input.classId,
    weekStartDate: input.weekStartDate,
    weekPlan: toClassPlan(input),
    teamPlanningContext:
      input.teamPlanningContext ??
      parseTeamPlanningContextSnapshot(input.weekPlan?.generationContextSnapshotJson),
    scoutingImpact: input.scoutingImpact ?? snapshotImpact,
    evidenceTrace: input.evidenceTrace ?? snapshot?.evidenceTrace ?? null,
    manualOverride: input.manualOverride ?? snapshot?.manualPreserved,
  });

  const evidenceItems = buildEvidenceItems(report);
  const hasRelevantSignals =
    report.scoutingSignals.length > 0 ||
    report.coachInterventions.length > 0 ||
    report.competitiveContext.length > 0 ||
    evidenceItems.length > 0 ||
    Boolean(report.manualOverridePreserved);

  if (!hasRelevantSignals) {
    return {
      shouldShow: false,
      title: "Por que esta semana mudou?",
      shortReason: "",
      summary: "",
      sections: [],
      evidenceItems: [],
    };
  }

  return {
    shouldShow: true,
    title: "Por que esta semana mudou?",
    shortReason: report.shortReason,
    summary: report.summary,
    sections: [
      {
        title: "Sinais usados",
        items: uniqueStrings([
          ...report.scoutingSignals,
          ...report.competitiveContext,
          ...report.coachInterventions,
        ], 4),
      },
      {
        title: "Focos aplicados",
        items: uniqueStrings(report.appliedFocus, 4),
      },
      {
        title: "Evitar",
        items: uniqueStrings(report.avoidedSignals, 3),
      },
    ].filter((section) => section.items.length > 0),
    evidenceItems,
    manualOverridePreserved: report.manualOverridePreserved,
  };
}
