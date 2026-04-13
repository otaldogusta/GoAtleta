import type { HistoricalConfidence, RecentSessionSummary } from "../models";

type ValueMap = Map<string, number>;

const hasStructuredContinuitySignal = (summary: RecentSessionSummary) =>
  Boolean(summary.fingerprint || summary.primarySkill || summary.progressionDimension);

const incrementCount = (map: ValueMap, key: string | undefined) => {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
};

const hasRepeatedValue = (map: ValueMap) => [...map.values()].some((count) => count >= 2);

const hasStrongEvidence = (summary: RecentSessionSummary) =>
  summary.executionState === "confirmed_executed" || summary.executionState === "teacher_edited";

const hasMediumEvidence = (summary: RecentSessionSummary) =>
  hasStrongEvidence(summary) ||
  summary.executionState === "applied_not_confirmed" ||
  summary.wasApplied ||
  summary.wasEditedByTeacher;

const hasLowEvidence = (summary: RecentSessionSummary) =>
  hasMediumEvidence(summary) || summary.executionState === "planned_only" || summary.wasPlanned;

const hasContinuitySignals = (summaries: RecentSessionSummary[]) => {
  const fingerprintCounts: ValueMap = new Map();
  const primarySkillCounts: ValueMap = new Map();
  const progressionCounts: ValueMap = new Map();

  summaries.forEach((summary) => {
    incrementCount(fingerprintCounts, summary.fingerprint);
    incrementCount(primarySkillCounts, summary.primarySkill);
    incrementCount(progressionCounts, summary.progressionDimension);
  });

  return (
    hasRepeatedValue(fingerprintCounts) ||
    hasRepeatedValue(primarySkillCounts) ||
    hasRepeatedValue(progressionCounts)
  );
};

export const resolveHistoricalConfidence = (
  recentSessions: RecentSessionSummary[] | null | undefined
): HistoricalConfidence => {
  const summaries = (recentSessions ?? []).filter(Boolean);

  if (!summaries.length) return "none";

  const strongEvidenceSessions = summaries.filter(hasStrongEvidence);
  const strongStructuredSessions = strongEvidenceSessions.filter(hasStructuredContinuitySignal);

  if (
    strongEvidenceSessions.length >= 2 &&
    strongStructuredSessions.length >= 2 &&
    hasContinuitySignals(strongEvidenceSessions)
  ) {
    return "high";
  }

  if (summaries.some(hasMediumEvidence)) {
    return "medium";
  }

  if (summaries.some(hasLowEvidence)) {
    return "low";
  }

  return "none";
};
