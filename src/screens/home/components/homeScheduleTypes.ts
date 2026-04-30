import type { ClassGroup } from "../../../core/models";

export type HomeScheduleItem = {
  classId: string;
  className: string;
  unit: string;
  gender: ClassGroup["gender"] | null;
  dateKey: string;
  dateLabel: string;
  startTime: number;
  endTime: number;
  timeLabel: string;
};

export type HomeScheduleSlot = {
  key: string;
  timeLabel: string;
  startTime: number;
  endTime: number;
  items: HomeScheduleItem[];
};

export type WeekDaySummary = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  fullLabel: string;
  lessonCount: number;
  durationMinutes: number;
  isToday: boolean;
};
