import {
  getEvidenceRuleById,
  getEvidenceRulesByDomain,
  getEvidenceRulesByType,
  getEvidenceSourceById,
  listEvidenceRules,
  listEvidenceSources,
} from "../evidence-matrix";

describe("evidence matrix", () => {
  test("lists rules and sources", () => {
    expect(listEvidenceRules().length).toBeGreaterThan(0);
    expect(listEvidenceSources().length).toBeGreaterThan(0);
  });

  test("gets rule and source by id", () => {
    expect(getEvidenceRuleById("pre_match_reduce_density")?.label).toBeTruthy();
    expect(getEvidenceSourceById("internal_match_context_review")?.title).toBeTruthy();
  });

  test("filters rules by domain and type", () => {
    expect(getEvidenceRulesByDomain("scouting").some((rule) => rule.id === "small_sample_no_strong_scouting_impact")).toBe(true);
    expect(getEvidenceRulesByType("safety_guard").some((rule) => rule.id === "load_monitoring_signal_not_oracle")).toBe(true);
  });

  test("all rule sourceIds are valid", () => {
    const invalid = listEvidenceRules().flatMap((rule) =>
      rule.sourceIds.filter((sourceId) => !getEvidenceSourceById(sourceId)).map((sourceId) => `${rule.id}:${sourceId}`),
    );
    expect(invalid).toEqual([]);
  });

  test("pending sources require review", () => {
    const invalid = listEvidenceSources().filter(
      (source) => source.type === "pending_reference" && source.reviewRequired !== true,
    );
    expect(invalid).toEqual([]);
  });

  test("rules have recommendation, rationale and confidence", () => {
    for (const rule of listEvidenceRules()) {
      expect(rule.recommendation.trim()).toBeTruthy();
      expect(rule.rationale.trim()).toBeTruthy();
      expect(rule.confidence).toMatch(/low|medium|high/);
    }
  });
});
