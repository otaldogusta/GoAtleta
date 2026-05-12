import { assertEvidenceRuleIds } from "../evidence";
import type { TeamPlanningLoadBias } from "../team-context";
import type { GoldenScenarioCheck, GoldenScenarioExpected, GoldenScenarioResult } from "./types";

const loadBiasRank: Record<TeamPlanningLoadBias, number> = {
  reduce: 0,
  maintain: 1,
  increase: 2,
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const includesAll = (haystack: string[], needles: string[] = []) => {
  const text = normalize(haystack.join(" | "));
  return needles.every((needle) => text.includes(normalize(needle)));
};

const includesNone = (haystack: string[], needles: string[] = []) => {
  const text = normalize(haystack.join(" | "));
  return needles.every((needle) => !text.includes(normalize(needle)));
};

const makeCheck = (id: string, passed: boolean, message: string): GoldenScenarioCheck => ({
  id,
  passed,
  message,
});

export function includesExpectedFocus(result: GoldenScenarioResult, expected: string[] = []) {
  return includesAll(result.focus, expected);
}

export function includesExpectedEvidenceRules(result: GoldenScenarioResult, expected: string[] = []) {
  return expected.every((ruleId) => result.evidenceRuleIds.includes(ruleId));
}

export function doesNotIncludeForbiddenSignals(result: GoldenScenarioResult, forbidden: string[] = []) {
  return includesNone([...result.focus, ...result.avoid], forbidden);
}

export function respectsManualOverride(result: GoldenScenarioResult) {
  return result.adaptedWeekPlan.source === "MANUAL" && result.evidenceRuleIds.includes(
    "manual_override_preserves_teacher_decision",
  );
}

export function assertScenarioExpectation(
  result: GoldenScenarioResult,
  expected: GoldenScenarioExpected,
): GoldenScenarioCheck[] {
  const checks: GoldenScenarioCheck[] = [];

  if (expected.planningMode) {
    checks.push(
      makeCheck(
        "planning_mode",
        result.planningMode === expected.planningMode,
        `planningMode esperado: ${expected.planningMode}`,
      ),
    );
  }

  if (expected.recommendedLoadBias) {
    checks.push(
      makeCheck(
        "recommended_load_bias",
        result.recommendedLoadBias === expected.recommendedLoadBias,
        `recommendedLoadBias esperado: ${expected.recommendedLoadBias}`,
      ),
    );
  }

  if (expected.maxLoadBias) {
    checks.push(
      makeCheck(
        "max_load_bias",
        loadBiasRank[result.recommendedLoadBias] <= loadBiasRank[expected.maxLoadBias],
        `recommendedLoadBias não deve passar de ${expected.maxLoadBias}`,
      ),
    );
  }

  if (expected.expectedFocusIncludes?.length) {
    checks.push(
      makeCheck(
        "expected_focus",
        includesExpectedFocus(result, expected.expectedFocusIncludes),
        `foco deve incluir: ${expected.expectedFocusIncludes.join(", ")}`,
      ),
    );
  }

  if (expected.expectedAvoidIncludes?.length) {
    checks.push(
      makeCheck(
        "expected_avoid",
        includesAll(result.avoid, expected.expectedAvoidIncludes),
        `evitar deve incluir: ${expected.expectedAvoidIncludes.join(", ")}`,
      ),
    );
  }

  if (expected.expectedEvidenceRuleIds?.length) {
    checks.push(
      makeCheck(
        "expected_evidence",
        includesExpectedEvidenceRules(result, expected.expectedEvidenceRuleIds),
        `evidência deve incluir: ${expected.expectedEvidenceRuleIds.join(", ")}`,
      ),
    );
  }

  if (expected.shouldNotInclude?.length) {
    checks.push(
      makeCheck(
        "forbidden_signals",
        doesNotIncludeForbiddenSignals(result, expected.shouldNotInclude),
        `não deve incluir: ${expected.shouldNotInclude.join(", ")}`,
      ),
    );
  }

  if (expected.shouldPreserveManualOverride) {
    checks.push(
      makeCheck(
        "manual_override",
        respectsManualOverride(result),
        "plano manual deve ser preservado",
      ),
    );
  }

  if (expected.shouldAllowModerateLoad) {
    checks.push(
      makeCheck(
        "moderate_load_allowed",
        normalize(result.adaptedWeekPlan.constraints).includes("moderada") ||
          normalize(result.adaptedWeekPlan.rpeTarget).includes("4-5") ||
          normalize(result.adaptedWeekPlan.rpeTarget).includes("4-6"),
        "cenário deve permitir carga moderada controlada",
      ),
    );
  }

  if (typeof expected.minEvidenceRules === "number") {
    checks.push(
      makeCheck(
        "min_evidence_rules",
        result.evidenceRuleIds.length >= expected.minEvidenceRules,
        `deve ter ao menos ${expected.minEvidenceRules} regras de evidência`,
      ),
    );
  }

  const invalidRules = assertEvidenceRuleIds(result.evidenceRuleIds).invalid;
  checks.push(
    makeCheck(
      "valid_evidence_rules",
      invalidRules.length === 0,
      invalidRules.length ? `regras inexistentes: ${invalidRules.join(", ")}` : "regras válidas",
    ),
  );

  return checks;
}
