import type { DecisionReason, PedagogicalDecisionSupport } from "./models";

export type WeeklyPeriodizationSnapshot = {
  schemaVersion: 1;
  pedagogicalDecisionSupport?: PedagogicalDecisionSupport;
  decisionReasons: DecisionReason[];
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isDecisionReason = (value: unknown): value is DecisionReason => {
  if (!isRecord(value)) return false;
  return (
    typeof value.kind === "string" &&
    typeof value.source === "string" &&
    typeof value.confidence === "string" &&
    typeof value.message === "string"
  );
};

export const parseWeeklyPeriodizationSnapshot = (
  raw: string | null | undefined
): WeeklyPeriodizationSnapshot => {
  try {
    const parsed = JSON.parse(String(raw ?? "{}"));
    if (!isRecord(parsed)) {
      return { schemaVersion: 1, decisionReasons: [] };
    }

    return {
      ...parsed,
      schemaVersion: 1,
      decisionReasons: Array.isArray(parsed.decisionReasons)
        ? parsed.decisionReasons.filter(isDecisionReason)
        : [],
    };
  } catch {
    return { schemaVersion: 1, decisionReasons: [] };
  }
};

export const serializeWeeklyPeriodizationSnapshot = (
  snapshot: Partial<WeeklyPeriodizationSnapshot>
) =>
  JSON.stringify({
    ...snapshot,
    schemaVersion: 1,
    decisionReasons: Array.isArray(snapshot.decisionReasons)
      ? snapshot.decisionReasons
      : [],
  });

