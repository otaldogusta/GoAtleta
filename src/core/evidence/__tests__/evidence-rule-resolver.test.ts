import {
  assertEvidenceRuleIds,
  formatEvidenceRuleSummary,
  getEvidenceRuleConfidenceLabel,
  getEvidenceRuleTypeLabel,
  resolveEvidenceRulesForContext,
} from "../evidence-rule-resolver";

const resolveIds = (context: Parameters<typeof resolveEvidenceRulesForContext>[0]) =>
  resolveEvidenceRulesForContext(context).map((rule) => rule.id);

describe("evidence rule resolver", () => {
  test("resolves pre-match rule", () => {
    expect(resolveIds({ hasUpcomingMatch: true, daysUntilMatch: 1 })).toContain("pre_match_reduce_density");
  });

  test("resolves post-match rule", () => {
    expect(resolveIds({ planningMode: "post_match" })).toContain("post_match_recovery_bias");
  });

  test("resolves youth 07-09 safety rule", () => {
    expect(resolveIds({ classAgeBand: "07-09" })).toContain("youth_load_ceiling_not_low_lock");
  });

  test("resolves small scouting sample rule", () => {
    expect(resolveIds({ scoutingSampleSize: 5 })).toContain("small_sample_no_strong_scouting_impact");
  });

  test("resolves recent scouting impact rule", () => {
    expect(resolveIds({ hasRecentScoutingImpact: true })).toContain("scouting_weakness_influences_focus_not_cycle");
  });

  test("resolves manual override rule", () => {
    expect(resolveIds({ manualOverride: true })).toContain("manual_override_preserves_teacher_decision");
  });

  test("resolves load monitoring rule", () => {
    expect(resolveIds({ loadIntent: "reduce" })).toContain("load_monitoring_signal_not_oracle");
  });

  test("assertEvidenceRuleIds separates valid and invalid ids", () => {
    expect(assertEvidenceRuleIds(["pre_match_reduce_density", "missing_rule"])).toEqual({
      valid: ["pre_match_reduce_density"],
      invalid: ["missing_rule"],
    });
  });

  test("formats evidence rule summary and labels", () => {
    const [rule] = resolveEvidenceRulesForContext({ manualOverride: true });
    expect(rule).toBeTruthy();
    expect(formatEvidenceRuleSummary(rule!)).toContain("Preservar decisao manual");
    expect(getEvidenceRuleConfidenceLabel("medium")).toBe("media");
    expect(getEvidenceRuleTypeLabel("operational_heuristic")).toBe("heuristica operacional");
  });
});
