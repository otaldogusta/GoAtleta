import { assertEvidenceRuleIds, type EvidenceConfidence, type EvidenceTrace } from "../evidence";
import type { ClassPlan } from "../models";
import type { CoachIntervention, ScoutingImpact, TeamEvent } from "../team-context";
import type { BuildWeekDecisionReportInput, WeekDecisionReport } from "./types";

const MAX_LIST_ITEMS = 5;

const uniqueStrings = (values: Array<string | null | undefined>, limit = MAX_LIST_ITEMS) => {
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

const splitFocusText = (value?: string) =>
  String(value ?? "")
    .split(/(?:\s*·\s*|\s*\|\s*|,\s*)/g)
    .map((item) => item.trim())
    .filter(Boolean);

const isManualOrOverriddenPlan = (plan?: ClassPlan | null) =>
  Boolean(
    plan &&
      (plan.source === "MANUAL" ||
        plan.manualOverrideMaskJson?.trim() ||
        plan.manualOverridesJson?.trim() ||
        plan.syncStatus === "overridden" ||
        plan.lastManualEditedAt?.trim()),
  );

const evidenceTraceFromImpact = (impact: ScoutingImpact): EvidenceTrace | null => {
  if (impact.evidenceTrace) return impact.evidenceTrace;
  if (!impact.evidenceRuleIds?.length) return null;
  return {
    evidenceRuleIds: impact.evidenceRuleIds,
    evidenceSummary: impact.evidenceSummary ?? [],
    confidence: impact.evidenceConfidence ?? [],
  };
};

export function mergeEvidenceTraces(...traces: Array<EvidenceTrace | null | undefined>): EvidenceTrace {
  const validRuleIds = new Set(assertEvidenceRuleIds(traces.flatMap((trace) => trace?.evidenceRuleIds ?? [])).valid);
  const seenIds = new Set<string>();
  const evidenceRuleIds: string[] = [];
  const evidenceSummary: string[] = [];
  const confidence: EvidenceConfidence[] = [];

  for (const trace of traces) {
    if (!trace) continue;
    trace.evidenceRuleIds.forEach((ruleId, index) => {
      if (!validRuleIds.has(ruleId) || seenIds.has(ruleId)) return;
      seenIds.add(ruleId);
      evidenceRuleIds.push(ruleId);
      const summary = trace.evidenceSummary[index]?.trim();
      if (summary) evidenceSummary.push(summary);
      const itemConfidence = trace.confidence[index];
      if (itemConfidence) confidence.push(itemConfidence);
    });
  }

  return { evidenceRuleIds, evidenceSummary, confidence };
}

const buildScoutingSignals = (impacts: ScoutingImpact[]) =>
  uniqueStrings(
    impacts.flatMap((impact) => [
      ...impact.weaknesses,
      ...impact.recommendedFocus,
      ...impact.tacticalNotes,
    ]),
  );

const buildCoachInterventionSignals = (interventions: CoachIntervention[]) =>
  uniqueStrings(interventions.flatMap((item) => [item.summary, ...item.tags]));

const buildCompetitiveContext = (input: BuildWeekDecisionReportInput, events: TeamEvent[]) =>
  uniqueStrings([
    input.teamPlanningContext?.reason,
    input.teamPlanningContext?.planningMode && input.teamPlanningContext.planningMode !== "normal"
      ? `Modo: ${input.teamPlanningContext.planningMode}`
      : undefined,
    ...events.map((event) => `${event.title} · ${event.date}`),
  ]);

const resolveLoadBias = (input: BuildWeekDecisionReportInput, impacts: ScoutingImpact[]) => {
  if (input.teamPlanningContext?.recommendedLoadBias) return input.teamPlanningContext.recommendedLoadBias;
  if (impacts.some((impact) => impact.loadImpact === "reduce")) return "reduce";
  if (impacts.some((impact) => impact.loadImpact === "increase")) return "increase";
  if (impacts.some((impact) => impact.loadImpact === "maintain")) return "maintain";
  return undefined;
};

export function summarizeDecisionReason(report: Pick<
  WeekDecisionReport,
  | "manualOverridePreserved"
  | "planningMode"
  | "scoutingSignals"
  | "coachInterventions"
  | "competitiveContext"
>): string {
  if (report.manualOverridePreserved) return "Plano manual preservado; sinais mantidos como recomendação.";
  if (report.planningMode === "pre_match") return "Semana ajustada por contexto pré-jogo.";
  if (report.planningMode === "post_match") return "Semana ajustada por contexto pós-jogo.";
  if (report.scoutingSignals.length) return "Semana ajustada por scouting recente.";
  if (report.coachInterventions.length) return "Semana considera intervenção recente do professor.";
  if (report.competitiveContext.length) return "Semana considera contexto competitivo da turma.";
  return "Sem sinais contextuais relevantes para ajuste da semana.";
}

export function buildWeekDecisionReport(input: BuildWeekDecisionReportInput): WeekDecisionReport {
  const impacts = [input.scoutingImpact, ...(input.scoutingImpacts ?? [])].filter(
    (impact): impact is ScoutingImpact => Boolean(impact),
  );
  const interventions = input.coachInterventions ?? [];
  const events = input.events ?? [];
  const manualOverridePreserved = Boolean(input.manualOverride) || isManualOrOverriddenPlan(input.weekPlan);
  const evidenceTrace = mergeEvidenceTraces(
    input.evidenceTrace,
    ...impacts.map(evidenceTraceFromImpact),
  );

  const appliedFocus = uniqueStrings([
    ...splitFocusText(input.weekPlan?.technicalFocus),
    ...splitFocusText(input.weekPlan?.specificObjective),
    ...(input.teamPlanningContext?.focusHints ?? []),
    ...impacts.flatMap((impact) => impact.recommendedFocus),
  ]);
  const avoidedSignals = uniqueStrings([
    ...(input.teamPlanningContext?.avoidHints ?? []),
    input.weekPlan?.constraints,
  ]);
  const scoutingSignals = buildScoutingSignals(impacts);
  const coachSignals = buildCoachInterventionSignals(interventions);
  const competitiveContext = buildCompetitiveContext(input, events);

  const partialReport = {
    manualOverridePreserved,
    planningMode: input.teamPlanningContext?.planningMode,
    scoutingSignals,
    coachInterventions: coachSignals,
    competitiveContext,
  };
  const shortReason = summarizeDecisionReason(partialReport);
  const summaryParts = uniqueStrings(
    [
      shortReason,
      scoutingSignals.length ? `Scouting: ${scoutingSignals.slice(0, 3).join(" / ")}` : undefined,
      coachSignals.length ? `Intervenção: ${coachSignals.slice(0, 2).join(" / ")}` : undefined,
      competitiveContext.length ? `Contexto: ${competitiveContext.slice(0, 2).join(" / ")}` : undefined,
    ],
    4,
  );

  return {
    classId: input.classId,
    weekStartDate: input.weekStartDate,
    planningMode: input.teamPlanningContext?.planningMode,
    loadBias: resolveLoadBias(input, impacts),
    appliedFocus,
    avoidedSignals,
    scoutingSignals,
    coachInterventions: coachSignals,
    competitiveContext,
    evidenceRuleIds: evidenceTrace.evidenceRuleIds,
    evidenceSummary: evidenceTrace.evidenceSummary,
    evidenceConfidence: evidenceTrace.confidence,
    manualOverridePreserved,
    shortReason,
    summary: summaryParts.join(" "),
  };
}
