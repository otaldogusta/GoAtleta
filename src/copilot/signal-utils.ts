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

export const sortCopilotSignals = (signals: CopilotSignal[]) =>
  [...signals].sort((left, right) => {
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
