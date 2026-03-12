export type PlannedLoads = {
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
};

const normalizeTargetText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const getPSEValueFromTarget = (target: string) => {
  const normalized = normalizeTargetText(target);
  const matches = normalized.match(/\d+(?:[.,]\d+)?/g);
  if (!matches?.length) return null;

  const values = matches
    .map((value) => Number(value.replace(",", ".")))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return null;
  if (values.length === 1) return values[0] ?? null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const getPlannedLoads = (
  rpeTarget: string,
  durationMinutes: number,
  sessionsPerWeek: number
): PlannedLoads => {
  const targetValue = getPSEValueFromTarget(rpeTarget);
  if (targetValue == null) {
    return { plannedSessionLoad: 0, plannedWeeklyLoad: 0 };
  }

  const normalizedDuration = Math.max(15, Number(durationMinutes) || 60);
  const normalizedSessions = Math.max(1, Number(sessionsPerWeek) || 1);
  const plannedSessionLoad = Math.round(targetValue * normalizedDuration);
  const plannedWeeklyLoad = Math.round(plannedSessionLoad * normalizedSessions);

  return { plannedSessionLoad, plannedWeeklyLoad };
};

export const formatPlannedLoad = (value: number) => `${Math.round(value)} AU`;
