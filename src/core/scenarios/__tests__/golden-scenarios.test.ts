import { assertEvidenceRuleIds } from "../../evidence";
import { goldenScenarios } from "../golden-scenarios";
import { runGoldenScenario, runGoldenScenarios } from "../run-golden-scenario";

describe("golden scenarios", () => {
  test("all scenarios have id, label and description", () => {
    for (const scenario of goldenScenarios) {
      expect(scenario.id).toBeTruthy();
      expect(scenario.label).toBeTruthy();
      expect(scenario.description).toBeTruthy();
    }
  });

  test("all scenarios pass their expectations", () => {
    const results = runGoldenScenarios(goldenScenarios);
    const failed = results.flatMap((result) =>
      result.checks
        .filter((check) => !check.passed)
        .map((check) => `${result.scenarioId}:${check.id}:${check.message}`),
    );
    expect(failed).toEqual([]);
  });

  test("expected evidence rule ids exist in Evidence Matrix", () => {
    const expectedRuleIds = goldenScenarios.flatMap(
      (scenario) => scenario.expected.expectedEvidenceRuleIds ?? [],
    );
    expect(assertEvidenceRuleIds(expectedRuleIds).invalid).toEqual([]);
  });

  test("scenarios with scouting do not increase load automatically", () => {
    const results = runGoldenScenarios(
      goldenScenarios.filter(
        (scenario) => (scenario.scoutingActions?.length ?? 0) > 0 || (scenario.scoutingImpacts?.length ?? 0) > 0,
      ),
    );

    expect(results.every((result) => result.recommendedLoadBias !== "increase")).toBe(true);
  });

  test("manual override scenario preserves manual plan", () => {
    const result = runGoldenScenario(
      goldenScenarios.find((scenario) => scenario.id === "manual_override_preserved_with_scouting")!,
    );

    expect(result.adaptedWeekPlan.source).toBe("MANUAL");
    expect(result.adaptedWeekPlan.technicalFocus).toBe("Foco manual do professor");
    expect(result.evidenceRuleIds).toContain("manual_override_preserves_teacher_decision");
  });

  test("youth 7-9 scenario allows controlled moderate load without high default", () => {
    const result = runGoldenScenario(
      goldenScenarios.find((scenario) => scenario.id === "youth_7_9_not_low_lock")!,
    );

    expect(result.evidenceRuleIds).toContain("youth_load_ceiling_not_low_lock");
    expect(result.adaptedWeekPlan.rpeTarget).toBe("4-5");
    expect(result.adaptedWeekPlan.constraints.toLowerCase()).toContain("moderada");
    expect(result.adaptedWeekPlan.constraints.toLowerCase()).not.toContain("carga alta");
  });

  test("small sample scouting does not create strong impact", () => {
    const result = runGoldenScenario(
      goldenScenarios.find((scenario) => scenario.id === "small_sample_scouting_no_strong_impact")!,
    );

    expect(result.generatedScoutingImpact).toBeNull();
    expect(result.evidenceRuleIds).toContain("small_sample_no_strong_scouting_impact");
    expect(result.recommendedLoadBias).not.toBe("increase");
  });
});
