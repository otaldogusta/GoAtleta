import { resolveHistoricalConfidence } from "../cycle-day-planning/resolve-historical-confidence";
import type { RecentSessionSummary } from "../models";

const buildSummary = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-03-01",
  wasPlanned: false,
  wasApplied: false,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: null,
  executionState: "unknown",
  teacherOverrideWeight: "none",
  ...overrides,
});

describe("resolveHistoricalConfidence", () => {
  it("returns none when there is no recent evidence", () => {
    expect(resolveHistoricalConfidence([])).toBe("none");
    expect(resolveHistoricalConfidence(null)).toBe("none");
  });

  it("returns low when only generated plans exist", () => {
    const confidence = resolveHistoricalConfidence([
      buildSummary({
        sessionDate: "2026-03-08",
        wasPlanned: true,
        executionState: "planned_only",
      }),
    ]);

    expect(confidence).toBe("low");
  });

  it("returns medium when there is applied or teacher-edited evidence", () => {
    const confidence = resolveHistoricalConfidence([
      buildSummary({
        sessionDate: "2026-03-15",
        wasApplied: true,
        executionState: "applied_not_confirmed",
        primarySkill: "passe",
      }),
    ]);

    expect(confidence).toBe("medium");
  });

  it("returns high when multiple strong sessions show continuity", () => {
    const confidence = resolveHistoricalConfidence([
      buildSummary({
        sessionDate: "2026-03-22",
        wasApplied: true,
        wasConfirmedExecuted: true,
        executionState: "confirmed_executed",
        primarySkill: "saque",
        progressionDimension: "pressao_tempo",
        fingerprint: "saque:pressao_tempo:alto",
      }),
      buildSummary({
        sessionDate: "2026-03-29",
        wasApplied: true,
        wasEditedByTeacher: true,
        wasConfirmedExecuted: true,
        executionState: "teacher_edited",
        primarySkill: "saque",
        progressionDimension: "pressao_tempo",
        fingerprint: "saque:pressao_tempo:alto",
        teacherOverrideWeight: "strong",
      }),
    ]);

    expect(confidence).toBe("high");
  });
});
