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
