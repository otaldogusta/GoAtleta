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
import type { ClassPlan, DailyLessonPlan, TrainingPlan } from "../../../core/models";
import type { ScoutingImpact, TeamPlanningContext } from "../../../core/team-context";

export type SessionDecisionReportViewModel = {
  shouldShow: boolean;
  title: string;
  shortReason: string;
  items: string[];
  avoidItems: string[];
  evidenceItems: Array<{
    label: string;
    confidence: string;
    typeLabel: string;
    confidenceTone: "muted" | "warning" | "success";
  }>;
  manualOverridePreserved?: boolean;
};

export type BuildSessionDecisionReportViewModelInput = {
  classId: string;
  sessionDate: string;
  sessionPlan?: Partial<TrainingPlan> | null;
  dailyPlan?: Partial<DailyLessonPlan> | null;
  weeklyPlan?: Partial<ClassPlan> | null;
  teamPlanningContext?: TeamPlanningContext | null;
  weekDecisionReport?: WeekDecisionReport | null;
  evidenceTrace?: EvidenceTrace | null;
  manualOverride?: boolean;
};

type ScoutingImpactSnapshot = {
  impactIds?: string[];
  recommendedFocus?: string[];
  weaknesses?: string[];
  tacticalNotes?: string[];
  loadImpact?: ScoutingImpact["loadImpact"] | "none";
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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isEvidenceConfidence = (value: unknown): value is EvidenceConfidence =>
  value === "low" || value === "medium" || value === "high";

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
  const scoutingImpact = parseSnapshot(snapshotJson)?.scoutingImpact;
  if (!scoutingImpact || typeof scoutingImpact !== "object" || Array.isArray(scoutingImpact)) return null;
  const raw = scoutingImpact as Record<string, unknown>;
  return {
    impactIds: isStringArray(raw.impactIds) ? raw.impactIds : [],
    recommendedFocus: isStringArray(raw.recommendedFocus) ? raw.recommendedFocus : [],
    weaknesses: isStringArray(raw.weaknesses) ? raw.weaknesses : [],
    tacticalNotes: isStringArray(raw.tacticalNotes) ? raw.tacticalNotes : [],
    loadImpact:
      raw.loadImpact === "reduce" || raw.loadImpact === "maintain" || raw.loadImpact === "increase"
        ? raw.loadImpact
        : "maintain",
    evidenceTrace: parseEvidenceTrace(raw.evidenceTrace) ?? undefined,
    manualPreserved: raw.manualPreserved === true,
  };
};

const parseTeamPlanningContextSnapshot = (snapshotJson?: string | null): TeamPlanningContext | null => {
  const context = parseSnapshot(snapshotJson)?.teamPlanningContext;
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

const firstSnapshot = (input: BuildSessionDecisionReportViewModelInput) =>
  input.dailyPlan?.generationContextSnapshotJson ?? input.weeklyPlan?.generationContextSnapshotJson;

const toScoutingImpact = (params: {
  classId: string;
  sessionDate: string;
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
    id: params.snapshot.impactIds?.[0] ?? `session_snapshot_scouting_${params.sessionDate}`,
    classId: params.classId,
    eventId: params.snapshot.impactIds?.[0] ?? `session_snapshot_scouting_${params.sessionDate}`,
    date: params.sessionDate,
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
    createdAt: `${params.sessionDate}T00:00:00.000Z`,
  };
};

const toClassPlan = (input: BuildSessionDecisionReportViewModelInput): ClassPlan | null => {
  const weekly = input.weeklyPlan;
  const daily = input.dailyPlan;
  if (!weekly && !daily) return null;
  return {
    id: weekly?.id ?? daily?.weeklyPlanId ?? `session_week_${input.sessionDate}`,
    classId: weekly?.classId ?? daily?.classId ?? input.classId,
    startDate: weekly?.startDate ?? daily?.date ?? input.sessionDate,
    weekNumber: weekly?.weekNumber ?? 1,
    phase: weekly?.phase ?? "",
    theme: weekly?.theme ?? daily?.title ?? "",
    generalObjective: weekly?.generalObjective,
    specificObjective: weekly?.specificObjective ?? input.sessionPlan?.title ?? daily?.title,
    technicalFocus: weekly?.technicalFocus ?? input.sessionPlan?.title ?? daily?.title ?? "",
    physicalFocus: weekly?.physicalFocus ?? "",
    pedagogicalRule: weekly?.pedagogicalRule,
    weekNotes: weekly?.weekNotes ?? daily?.observations,
    constraints: weekly?.constraints ?? "",
    mvFormat: weekly?.mvFormat ?? "",
    warmupProfile: weekly?.warmupProfile ?? daily?.warmup ?? "",
    jumpTarget: weekly?.jumpTarget ?? "",
    rpeTarget: weekly?.rpeTarget ?? "",
    source: weekly?.source ?? "AUTO",
    generationContextSnapshotJson: firstSnapshot(input),
    syncStatus: weekly?.syncStatus ?? daily?.syncStatus,
    manualOverridesJson: weekly?.manualOverridesJson ?? daily?.manualOverridesJson,
    manualOverrideMaskJson: weekly?.manualOverrideMaskJson ?? daily?.manualOverrideMaskJson,
    lastManualEditedAt: weekly?.lastManualEditedAt ?? daily?.lastManualEditedAt,
    createdAt: weekly?.createdAt ?? daily?.createdAt ?? `${input.sessionDate}T00:00:00.000Z`,
    updatedAt: weekly?.updatedAt ?? daily?.updatedAt ?? `${input.sessionDate}T00:00:00.000Z`,
  };
};

const confidenceTone = (confidence: EvidenceConfidence): "muted" | "warning" | "success" => {
  if (confidence === "high") return "success";
  if (confidence === "low") return "warning";
  return "muted";
};

const buildEvidenceItems = (report: WeekDecisionReport): SessionDecisionReportViewModel["evidenceItems"] =>
  report.evidenceRuleIds
    .map((ruleId) => {
      const rule = getEvidenceRuleById(ruleId);
      if (!rule) return null;
      return {
        label: rule.label,
        confidence: getEvidenceRuleConfidenceLabel(rule.confidence),
        typeLabel: getEvidenceRuleTypeLabel(rule.type),
        confidenceTone: confidenceTone(rule.confidence),
      };
    })
    .filter((item): item is SessionDecisionReportViewModel["evidenceItems"][number] => Boolean(item))
    .slice(0, 3);

const toViewModel = (report: WeekDecisionReport): SessionDecisionReportViewModel => {
  const evidenceItems = buildEvidenceItems(report);
  const items = uniqueStrings(
    [
      ...report.scoutingSignals,
      ...report.competitiveContext,
      ...report.coachInterventions,
      ...report.appliedFocus,
    ],
    4,
  );
  const avoidItems = uniqueStrings(report.avoidedSignals, 3);
  const shouldShow =
    items.length > 0 || avoidItems.length > 0 || evidenceItems.length > 0 || Boolean(report.manualOverridePreserved);

  return {
    shouldShow,
    title: "Por que esta aula foi ajustada?",
    shortReason: report.manualOverridePreserved
      ? "Plano manual preservado. Sinais aparecem como apoio."
      : report.shortReason,
    items,
    avoidItems,
    evidenceItems,
    manualOverridePreserved: report.manualOverridePreserved,
  };
};

export function buildSessionDecisionReportViewModel(
  input: BuildSessionDecisionReportViewModelInput,
): SessionDecisionReportViewModel {
  if (input.weekDecisionReport) return toViewModel(input.weekDecisionReport);

  const snapshot = parseScoutingImpactSnapshot(firstSnapshot(input));
  const snapshotImpact = snapshot
    ? toScoutingImpact({
        classId: input.classId,
        sessionDate: input.sessionDate,
        snapshot,
      })
    : null;
  const teamPlanningContext =
    input.teamPlanningContext ?? parseTeamPlanningContextSnapshot(firstSnapshot(input));
  const report = buildWeekDecisionReport({
    classId: input.classId,
    weekStartDate: input.sessionDate,
    teamPlanningContext,
    scoutingImpact: snapshotImpact,
    weekPlan: toClassPlan(input),
    evidenceTrace: input.evidenceTrace ?? snapshot?.evidenceTrace ?? null,
    manualOverride: input.manualOverride ?? snapshot?.manualPreserved,
  });

  return toViewModel(report);
}
