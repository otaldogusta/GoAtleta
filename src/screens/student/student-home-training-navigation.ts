export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveAdjacentDayIndex(
  currentIndex: number,
  offset: -1 | 1,
  total: number,
) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, currentIndex + offset));
}

export function resolveDayIndexAfterSwipe({
  currentIndex,
  dragDistance,
  velocityX,
  total,
}: {
  currentIndex: number;
  dragDistance: number;
  velocityX: number;
  total: number;
}) {
  if (total <= 0) return 0;
  const direction = dragDistance <= -36 || velocityX <= -0.3
    ? 1
    : dragDistance >= 36 || velocityX >= 0.3
      ? -1
      : 0;
  if (direction === 0) return Math.max(0, Math.min(total - 1, currentIndex));
  return resolveAdjacentDayIndex(currentIndex, direction, total);
}

export function resolveTrainingIndexForDate(
  schedule: { startsAt: Date }[],
  dateKey: string,
) {
  return schedule.findIndex((item) => toLocalDateKey(item.startsAt) === dateKey);
}
