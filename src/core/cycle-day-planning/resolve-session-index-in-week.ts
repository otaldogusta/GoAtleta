const normalizeWeekday = (value: number) => (value === 0 ? 7 : value);

export const resolveOrderedTrainingDays = (daysOfWeek?: number[] | null) =>
  [...new Set((daysOfWeek ?? []).map(normalizeWeekday))]
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
    .sort((left, right) => left - right);

export const resolveSessionIndexInWeek = (params: {
  daysOfWeek?: number[] | null;
  sessionDate: string;
}) => {
  const orderedDays = resolveOrderedTrainingDays(params.daysOfWeek);
  if (!orderedDays.length) return 1;

  const parsedDate = new Date(`${params.sessionDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return 1;

  const weekday = normalizeWeekday(parsedDate.getDay());
  const exactIndex = orderedDays.indexOf(weekday);
  if (exactIndex >= 0) return exactIndex + 1;

  const previousOrSame = orderedDays.filter((value) => value <= weekday).length;
  return previousOrSame || 1;
};
