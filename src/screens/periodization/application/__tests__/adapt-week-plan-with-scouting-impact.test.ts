import type { ClassPlan } from "../../../../core/models";
import { assertEvidenceRuleIds } from "../../../../core/evidence";
import type { ScoutingImpact, TeamPlanningContext } from "../../../../core/team-context";
import { adaptWeekPlanWithScoutingImpact } from "../adapt-week-plan-with-scouting-impact";

const baseContext: TeamPlanningContext = {
  hasUpcomingMatch: false,
  daysUntilMatch: null,
  planningMode: "normal",
  recommendedLoadBias: "maintain",
  focusHints: [],
  avoidHints: [],
  reason: "scouting recente",
};

const makePlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "plan_1",
  classId: "class_1",
  startDate: "2026-05-11",
  weekNumber: 20,
  phase: "Desenvolvimento",
  theme: "Continuidade do ciclo",
  generalObjective: "Desenvolver fundamentos",
  specificObjective: "Saque e recepção",
  technicalFocus: "Saque e recepção",
  physicalFocus: "Coordenação",
  pedagogicalRule: "Jogo reduzido",
  weekNotes: "Foco da semana: continuidade",
  constraints: "Carga médio · 4-6",
  mvFormat: "MV2",
  warmupProfile: "Ativação com bola",
  jumpTarget: "baixo",
  rpeTarget: "4-6",
  source: "AUTO",
  createdAt: "2026-05-11T10:00:00.000Z",
  updatedAt: "2026-05-11T10:00:00.000Z",
  ...overrides,
});

const makeImpact = (overrides: Partial<ScoutingImpact> = {}): ScoutingImpact => ({
  id: "impact_1",
  classId: "class_1",
  eventId: "session_1",
  date: "2026-05-10",
  strengths: [],
  weaknesses: ["recepção sob pressão"],
  tacticalNotes: ["Recepção apresentou recorrência de ações C/erro."],
  recommendedFocus: ["recepção sob pressão"],
  loadImpact: "maintain",
  createdAt: "2026-05-10T10:00:00.000Z",
  ...overrides,
});

const adapt = (plan = makePlan(), impacts: ScoutingImpact[] = [makeImpact()]) =>
  adaptWeekPlanWithScoutingImpact({
    classId: "class_1",
    weekStartDate: "2026-05-11",
    baseWeekPlan: plan,
    teamPlanningContext: baseContext,
    scoutingImpacts: impacts,
  });

describe("adaptWeekPlanWithScoutingImpact", () => {
  test("keeps base plan when there is no ScoutingImpact", () => {
    const plan = makePlan();
    const result = adapt(plan, []);
    expect(result.adaptedWeekPlan).toBe(plan);
    expect(result.appliedSignals).toEqual([]);
  });

  test("adds contextual receive focus without replacing cycle focus", () => {
    const result = adapt();
    expect(result.adaptedWeekPlan.technicalFocus).toContain("Saque e recepção");
    expect(result.adaptedWeekPlan.technicalFocus).toContain("recepção contextualizada");
    expect(result.adaptedWeekPlan.specificObjective).toContain("recepção contextualizada");
  });

  test("maps coverage weakness to coverage and transition cue", () => {
    const result = adapt(makePlan(), [
      makeImpact({
        weaknesses: ["cobertura pós-ataque"],
        recommendedFocus: ["cobertura pós-ataque"],
        tacticalNotes: ["Cobertura apareceu como ponto de atenção em transição."],
      }),
    ]);
    expect(result.adaptedWeekPlan.technicalFocus).toContain("cobertura pós-ataque");
    expect(result.appliedSignals.join(" ")).toContain("Cobertura apareceu");
  });

  test("loadImpact reduce adds density constraint and avoids high rpe", () => {
    const result = adapt(makePlan({ rpeTarget: "7-8", constraints: "Carga alto" }), [
      makeImpact({ loadImpact: "reduce" }),
    ]);
    expect(result.adaptedWeekPlan.constraints).toContain("evitar alta densidade");
    expect(result.adaptedWeekPlan.weekNotes).toContain("reduzir densidade");
    expect(result.adaptedWeekPlan.rpeTarget).toBe("4-6");
  });

  test("limits focus and applied signals", () => {
    const result = adapt(makePlan(), [
      makeImpact({
        recommendedFocus: [
          "recepção sob pressão",
          "cobertura pós-ataque",
          "comunicação defensiva",
          "transição lenta",
        ],
        weaknesses: ["recepção sob pressão", "cobertura pós-ataque", "comunicação defensiva"],
        tacticalNotes: ["nota 1", "nota 2", "nota 3"],
      }),
    ]);
    expect(result.adaptedWeekPlan.technicalFocus.split(" · ").length).toBeLessThanOrEqual(3);
    expect(result.appliedSignals).toHaveLength(3);
  });

  test("does not overwrite manual or overridden plan fields", () => {
    const plan = makePlan({
      source: "MANUAL",
      technicalFocus: "Foco manual",
      manualOverrideMaskJson: JSON.stringify(["technicalFocus"]),
    });
    const result = adapt(plan);
    expect(result.adaptedWeekPlan).toBe(plan);
    expect(result.explanation).toContain("scouting recente");
  });

  test("stores scouting traceability in generation snapshot", () => {
    const result = adapt(makePlan({ generationContextSnapshotJson: JSON.stringify({ existing: true }) }));
    const snapshot = JSON.parse(result.adaptedWeekPlan.generationContextSnapshotJson ?? "{}");
    expect(snapshot.existing).toBe(true);
    expect(snapshot.scoutingImpact.impactIds).toEqual(["impact_1"]);
    expect(snapshot.scoutingImpact.recommendedFocus).toContain("recepção sob pressão");
    expect(snapshot.scoutingImpact.appliedSignals).toContain("recepção contextualizada");
    expect(snapshot.scoutingImpact.evidenceTrace.evidenceRuleIds).toContain("scouting_weakness_influences_focus_not_cycle");
    expect(assertEvidenceRuleIds(snapshot.scoutingImpact.evidenceTrace.evidenceRuleIds).invalid).toEqual([]);
  });

  test("manual override includes evidence trace without mutating snapshot", () => {
    const plan = makePlan({
      source: "MANUAL",
      technicalFocus: "Foco manual",
      generationContextSnapshotJson: JSON.stringify({ existing: true }),
    });
    const result = adapt(plan);
    expect(result.adaptedWeekPlan).toBe(plan);
    expect(result.evidenceTrace?.evidenceRuleIds).toContain("manual_override_preserves_teacher_decision");
  });

  test("without scouting does not create unnecessary evidence trace", () => {
    const result = adapt(makePlan(), []);
    expect(result.evidenceTrace).toBeUndefined();
  });
});
