import {
  formatEvidenceRuleSummary,
  resolveEvidenceRulesForContext,
  type EvidenceTrace,
} from "../evidence";
import type { ClassPlan } from "../models";
import { generateScoutingImpactFromActions } from "../scouting-impact";
import { resolveTeamPlanningContext } from "../team-context";
import type { ScoutingImpact, TeamPlanningLoadBias } from "../team-context";
import { assertScenarioExpectation } from "./scenario-expectations";
import type { GoldenScenario, GoldenScenarioResult } from "./types";

const loadBiasRank: Record<TeamPlanningLoadBias, number> = {
  reduce: 0,
  maintain: 1,
  increase: 2,
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
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

const makeBasePlan = (scenario: GoldenScenario): ClassPlan => ({
  id: `plan_${scenario.id}`,
  classId: scenario.classContext.classId,
  startDate: scenario.classContext.weekStartDate,
  weekNumber: 1,
  phase: "Desenvolvimento",
  theme: "Continuidade do ciclo",
  generalObjective: "Desenvolver a semana sem perder o eixo planejado",
  specificObjective: "Saque e recepção",
  technicalFocus: "Saque e recepção",
  physicalFocus: "Coordenação e controle de carga",
  pedagogicalRule: "Tarefas representativas com controle de densidade",
  weekNotes: "Plano base do cenário",
  constraints: "Carga moderada controlada",
  mvFormat: "MV2",
  warmupProfile: "Ativação com bola",
  jumpTarget: "baixo",
  rpeTarget: "4-5",
  source: "AUTO",
  createdAt: `${scenario.classContext.weekStartDate}T10:00:00.000Z`,
  updatedAt: `${scenario.classContext.weekStartDate}T10:00:00.000Z`,
  ...scenario.baseWeekPlan,
});

const buildEvidenceTrace = (params: {
  scenario: GoldenScenario;
  hasRecentScoutingImpact: boolean;
  scoutingSampleSize?: number;
  manualOverride: boolean;
  loadIntent?: string;
}): EvidenceTrace => {
  const rules = resolveEvidenceRulesForContext({
    classAgeBand: params.scenario.classContext.ageBand,
    youth: params.scenario.classContext.youth,
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

const mergeEvidenceTraces = (traces: Array<EvidenceTrace | null | undefined>): EvidenceTrace => {
  const ruleIds = uniqueStrings(traces.flatMap((trace) => trace?.evidenceRuleIds ?? []));
  const summaries = uniqueStrings(traces.flatMap((trace) => trace?.evidenceSummary ?? []));
  const confidence = traces.flatMap((trace) => trace?.confidence ?? []);
  return {
    evidenceRuleIds: ruleIds,
    evidenceSummary: summaries,
    confidence,
  };
};

const resolveScenarioLoadBias = (params: {
  contextBias: TeamPlanningLoadBias;
  impacts: ScoutingImpact[];
}) => {
  const impactBias = params.impacts.some((impact) => impact.loadImpact === "reduce")
    ? "reduce"
    : params.impacts.some((impact) => impact.loadImpact === "increase")
      ? "increase"
      : "maintain";
  return loadBiasRank[params.contextBias] <= loadBiasRank[impactBias]
    ? params.contextBias
    : impactBias;
};

const applyScenarioWeekDecision = (params: {
  plan: ClassPlan;
  scenario: GoldenScenario;
  impacts: ScoutingImpact[];
  focusHints: string[];
  loadBias: TeamPlanningLoadBias;
  evidenceTrace: EvidenceTrace;
}) => {
  if (params.scenario.manualOverride || params.plan.source === "MANUAL") {
    return params.plan;
  }

  const impactFocus = params.impacts.flatMap((impact) => [
    ...impact.recommendedFocus,
    ...impact.weaknesses,
  ]);
  const focusToApply = uniqueStrings([...impactFocus, ...params.focusHints].map(resolveTrainingCue)).slice(0, 3);
  const nextPlan: ClassPlan = { ...params.plan };
  if (focusToApply.length) {
    nextPlan.technicalFocus = uniqueStrings([nextPlan.technicalFocus, ...focusToApply]).slice(0, 3).join(" · ");
    nextPlan.specificObjective = uniqueStrings([nextPlan.specificObjective, ...focusToApply]).slice(0, 3).join(" · ");
  }
  if (params.loadBias === "reduce") {
    nextPlan.constraints = uniqueStrings([
      nextPlan.constraints,
      "Evitar alta densidade e fadiga excessiva",
    ]).join(" | ");
  }
  nextPlan.generationContextSnapshotJson = JSON.stringify({
    scenarioId: params.scenario.id,
    scoutingImpact: {
      impactIds: params.impacts.map((impact) => impact.id),
      recommendedFocus: uniqueStrings(params.impacts.flatMap((impact) => impact.recommendedFocus)),
      weaknesses: uniqueStrings(params.impacts.flatMap((impact) => impact.weaknesses)),
      tacticalNotes: uniqueStrings(params.impacts.flatMap((impact) => impact.tacticalNotes)),
      loadImpact: params.loadBias,
      appliedSignals: focusToApply,
      evidenceTrace: params.evidenceTrace,
    },
  });
  return nextPlan;
};

export function runGoldenScenario(scenario: GoldenScenario): GoldenScenarioResult {
  const generatedImpactResult = scenario.scoutingActions?.length
    ? generateScoutingImpactFromActions({
        classId: scenario.classContext.classId,
        eventId: scenario.events?.[0]?.id,
        scoutingSessionId: `${scenario.id}_session`,
        date: scenario.classContext.referenceDate,
        actions: scenario.scoutingActions,
        sessionType: scenario.events?.[0]?.type === "official_match"
          ? "official_match"
          : scenario.events?.[0]?.type === "friendly"
            ? "friendly"
            : "training",
      })
    : null;

  const impacts = [
    ...(scenario.scoutingImpacts ?? []),
    ...(generatedImpactResult?.impact ? [generatedImpactResult.impact] : []),
  ];

  const teamPlanningContext = resolveTeamPlanningContext({
    classId: scenario.classContext.classId,
    referenceDate: scenario.classContext.referenceDate,
    events: scenario.events ?? [],
    coachInterventions: scenario.interventions ?? [],
    scoutingImpacts: impacts,
    upcomingWindowDays: 7,
    recentWindowDays: 7,
  });

  const contextRules = resolveEvidenceRulesForContext({
    classAgeBand: scenario.classContext.ageBand,
    youth: scenario.classContext.youth,
    planningMode: teamPlanningContext.planningMode,
    hasUpcomingMatch: teamPlanningContext.hasUpcomingMatch,
    daysUntilMatch: teamPlanningContext.daysUntilMatch ?? undefined,
    hasRecentScoutingImpact: impacts.some((impact) => impact.weaknesses.length > 0),
    manualOverride: Boolean(scenario.manualOverride),
    loadIntent: teamPlanningContext.recommendedLoadBias,
  });

  const scenarioTrace = buildEvidenceTrace({
    scenario,
    hasRecentScoutingImpact: impacts.some((impact) => impact.weaknesses.length > 0),
    scoutingSampleSize: scenario.scoutingActions?.length,
    manualOverride: Boolean(scenario.manualOverride),
    loadIntent: teamPlanningContext.recommendedLoadBias,
  });
  const evidenceTrace = mergeEvidenceTraces([
    generatedImpactResult?.evidenceTrace,
    ...impacts.map((impact) => impact.evidenceTrace),
    {
      evidenceRuleIds: contextRules.map((rule) => rule.id),
      evidenceSummary: contextRules.map(formatEvidenceRuleSummary),
      confidence: contextRules.map((rule) => rule.confidence),
    },
    scenarioTrace,
  ]);

  const loadBias = resolveScenarioLoadBias({
    contextBias: teamPlanningContext.recommendedLoadBias,
    impacts,
  });
  const basePlan = makeBasePlan(scenario);
  const adaptedWeekPlan = applyScenarioWeekDecision({
    plan: basePlan,
    scenario,
    impacts,
    focusHints: teamPlanningContext.focusHints,
    loadBias,
    evidenceTrace,
  });
  const focus = uniqueStrings([
    adaptedWeekPlan.technicalFocus,
    adaptedWeekPlan.specificObjective,
    ...teamPlanningContext.focusHints,
    ...impacts.flatMap((impact) => [...impact.recommendedFocus, ...impact.weaknesses]),
  ]);
  const avoid = uniqueStrings([
    ...teamPlanningContext.avoidHints,
    adaptedWeekPlan.constraints,
  ]);

  const resultWithoutChecks = {
    scenarioId: scenario.id,
    planningMode: teamPlanningContext.planningMode,
    recommendedLoadBias: loadBias,
    focus,
    avoid,
    evidenceRuleIds: evidenceTrace.evidenceRuleIds,
    evidenceConfidence: evidenceTrace.confidence,
    explanation: uniqueStrings([
      teamPlanningContext.reason,
      generatedImpactResult?.reasons.join("; "),
      generatedImpactResult?.ignoredReasons.join("; "),
    ]).join("; "),
    teamPlanningContext,
    generatedScoutingImpact: generatedImpactResult?.impact ?? null,
    scoutingImpacts: impacts,
    adaptedWeekPlan,
    checks: [],
    passed: false,
  };
  const checks = assertScenarioExpectation(resultWithoutChecks, scenario.expected);
  return {
    ...resultWithoutChecks,
    checks,
    passed: checks.every((check) => check.passed),
  };
}

export function runGoldenScenarios(scenarios: GoldenScenario[]): GoldenScenarioResult[] {
  return scenarios.map(runGoldenScenario);
}
