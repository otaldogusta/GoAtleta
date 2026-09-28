import type { HomeScheduleItem, HomeScheduleSlot } from "./homeScheduleTypes";

export function buildHomeScheduleSlots(items: HomeScheduleItem[]): HomeScheduleSlot[] {
  return [...items]
    .sort((left, right) =>
      left.startTime - right.startTime ||
      left.className.localeCompare(right.className),
    )
    .map((item) => ({
      key: `${item.dateKey}-${item.startTime}-${item.endTime}-${item.classId}`,
      timeLabel: item.timeLabel,
      startTime: item.startTime,
      endTime: item.endTime,
      items: [item],
    }));
}

export function resolvePreferredScheduleSlotIndex(
  slots: HomeScheduleSlot[],
  dateKey: string,
  todayDateKey: string,
  nowTime: number,
) {
  const matchingIndexes = slots.flatMap((slot, index) =>
    slot.items[0]?.dateKey === dateKey ? [index] : [],
  );
  if (!matchingIndexes.length) return -1;

  if (dateKey > todayDateKey) return matchingIndexes[0];
  if (dateKey < todayDateKey) return matchingIndexes[matchingIndexes.length - 1];

  return (
    matchingIndexes.find((index) => slots[index].endTime > nowTime) ??
    matchingIndexes[matchingIndexes.length - 1]
  );
}
