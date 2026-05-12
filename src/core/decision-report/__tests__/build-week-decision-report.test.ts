import type { ClassPlan } from "../../models";
import type {
  CoachIntervention,
  ScoutingImpact,
  TeamEvent,
  TeamPlanningContext,
} from "../../team-context";
import {
  buildWeekDecisionReport,
  formatWeekDecisionReport,
  mergeEvidenceTraces,
} from "../";

const now = "2026-05-10T10:00:00.000Z";

const makePlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "plan_1",
  classId: "class_1",
  startDate: "2026-05-11",
  weekNumber: 1,
  phase: "Desenvolvimento",
  theme: "Continuidade",
  generalObjective: "Desenvolver fundamentos",
  specificObjective: "Recepção contextualizada",
  technicalFocus: "Saque e recepção",
  physicalFocus: "Coordenação",
  pedagogicalRule: "Jogo reduzido",
  weekNotes: "Base",
  constraints: "Carga moderada controlada",
  mvFormat: "MV2",
  warmupProfile: "Ativação",
  jumpTarget: "baixo",
  rpeTarget: "4-5",
  source: "AUTO",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const makeContext = (overrides: Partial<TeamPlanningContext> = {}): TeamPlanningContext => ({
  hasUpcomingMatch: false,
  daysUntilMatch: null,
  planningMode: "normal",
  recommendedLoadBias: "maintain",
  focusHints: [],
  avoidHints: [],
  reason: "sem sinais competitivos",
  ...overrides,
});

const makeImpact = (overrides: Partial<ScoutingImpact> = {}): ScoutingImpact => ({
  id: "impact_1",
  classId: "class_1",
  eventId: "event_1",
  date: "2026-05-10",
  strengths: [],
  weaknesses: ["recepção sob pressão"],
  tacticalNotes: ["Recepção apresentou recorrência de ações C/erro."],
  recommendedFocus: ["recepção contextualizada"],
  loadImpact: "maintain",
  evidenceTrace: {
    evidenceRuleIds: ["scouting_weakness_influences_focus_not_cycle"],
    evidenceSummary: ["Scouting deve influenciar focos sem sequestrar o ciclo."],
    confidence: ["medium"],
  },
  createdAt: now,
  ...overrides,
});

const makeIntervention = (): CoachIntervention => ({
  id: "intervention_1",
  classId: "class_1",
  date: "2026-05-10",
  type: "tactical",
  summary: "Ajuste de cobertura e comunicação",
  tags: ["cobertura", "comunicação"],
  createdAt: now,
});

const makeEvent = (): TeamEvent => ({
  id: "event_1",
  classId: "class_1",
  title: "Amistoso El Cartel",
  type: "friendly",
  date: "2026-05-12",
  importance: "medium",
  createdAt: now,
});

describe("buildWeekDecisionReport", () => {
  test("builds minimal report without signals", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
    });

    expect(report.summary).toBeTruthy();
    expect(report.shortReason).toContain("Sem sinais contextuais");
    expect(report.evidenceRuleIds).toEqual([]);
  });

  test("includes scouting signals and evidence", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
      scoutingImpact: makeImpact(),
      weekPlan: makePlan(),
    });

    expect(report.scoutingSignals).toContain("recepção sob pressão");
    expect(report.appliedFocus.join(" ")).toContain("Recepção contextualizada");
    expect(report.evidenceRuleIds).toContain("scouting_weakness_influences_focus_not_cycle");
  });

  test("includes pre-match competitive context", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
      teamPlanningContext: makeContext({
        hasUpcomingMatch: true,
        daysUntilMatch: 1,
        planningMode: "pre_match",
        recommendedLoadBias: "reduce",
        focusHints: ["organização coletiva", "comunicação"],
        avoidHints: ["fadiga excessiva"],
        reason: "partida em 1 dia",
      }),
      events: [makeEvent()],
    });

    expect(report.shortReason).toContain("pré-jogo");
    expect(report.competitiveContext.join(" ")).toContain("partida em 1 dia");
    expect(report.avoidedSignals).toContain("fadiga excessiva");
  });

  test("includes coach intervention signals", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
      coachInterventions: [makeIntervention()],
    });

    expect(report.coachInterventions).toContain("Ajuste de cobertura e comunicação");
    expect(report.coachInterventions).toContain("cobertura");
  });

  test("marks manual override as preserved", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
      weekPlan: makePlan({ source: "MANUAL", technicalFocus: "Foco manual" }),
      scoutingImpact: makeImpact(),
    });

    expect(report.manualOverridePreserved).toBe(true);
    expect(report.shortReason).toContain("Plano manual preservado");
  });

  test("mergeEvidenceTraces removes duplicate and invalid rule ids", () => {
    const merged = mergeEvidenceTraces(
      {
        evidenceRuleIds: ["scouting_weakness_influences_focus_not_cycle", "missing_rule"],
        evidenceSummary: ["Resumo válido", "Resumo inválido"],
        confidence: ["medium", "low"],
      },
      {
        evidenceRuleIds: ["scouting_weakness_influences_focus_not_cycle"],
        evidenceSummary: ["Duplicado"],
        confidence: ["medium"],
      },
    );

    expect(merged.evidenceRuleIds).toEqual(["scouting_weakness_influences_focus_not_cycle"]);
    expect(merged.evidenceSummary).toEqual(["Resumo válido"]);
  });

  test("formatWeekDecisionReport returns readable text", () => {
    const report = buildWeekDecisionReport({
      classId: "class_1",
      weekStartDate: "2026-05-11",
      scoutingImpact: makeImpact(),
      coachInterventions: [makeIntervention()],
      weekPlan: makePlan(),
    });

    const text = formatWeekDecisionReport(report);
    expect(text).toContain("Scouting");
    expect(text).toContain("Intervenções");
    expect(text).not.toContain("missing_rule");
  });
});
