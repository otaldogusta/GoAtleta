import type { Signal as CopilotSignal } from "../ai/signal-engine";

const signalSeverityOrder: Record<CopilotSignal["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type CopilotActionLite = {
  id: string;
};

const isValidSeverity = (value: unknown): value is CopilotSignal["severity"] =>
  value === "low" || value === "medium" || value === "high" || value === "critical";

export const isValidCopilotSignal = (
  value: CopilotSignal | null | undefined
): value is CopilotSignal => {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    isValidSeverity(value.severity) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.detectedAt === "string"
  );
};

export const sortCopilotSignals = (signals: (CopilotSignal | null | undefined)[]) =>
  signals.filter(isValidCopilotSignal).sort((left, right) => {
    const severityDiff =
      signalSeverityOrder[right.severity] - signalSeverityOrder[left.severity];
    if (severityDiff !== 0) return severityDiff;
    return String(right.detectedAt).localeCompare(String(left.detectedAt));
  });

export const getRecommendedSignalActions = <T extends CopilotActionLite>(
  signal: CopilotSignal | null,
  actions: T[]
) => {
  if (!signal?.recommendedActionIds?.length) return [];
  const actionById = new Map(actions.map((item) => [item.id, item]));
  return signal.recommendedActionIds
    .map((actionId) => actionById.get(actionId))
    .filter((item): item is T => Boolean(item));
};
