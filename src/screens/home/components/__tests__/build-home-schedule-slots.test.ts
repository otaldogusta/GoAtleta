import { buildHomeScheduleSlots } from "../build-home-schedule-slots";
import type { HomeScheduleItem } from "../homeScheduleTypes";

const lesson = (
  classId: string,
  className: string,
  startTime: number,
): HomeScheduleItem => ({
  classId,
  className,
  unit: "Rede Esportes Pinhais",
  gender: "mixed",
  dateKey: "2026-09-26",
  dateLabel: "Sáb | 26/09",
  startTime,
  endTime: startTime + 60 * 60 * 1000,
  timeLabel: "09:00 - 10:00",
});

describe("buildHomeScheduleSlots", () => {
  it("keeps simultaneous classes as individually accessible carousel entries", () => {
    const slots = buildHomeScheduleSlots([
      lesson("class-2", "Turma 13-15", 9_000),
      lesson("class-1", "Estrelas do Saque", 9_000),
      lesson("class-3", "Águias", 10_000),
    ]);

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.items)).toEqual([
      [expect.objectContaining({ classId: "class-1" })],
      [expect.objectContaining({ classId: "class-2" })],
      [expect.objectContaining({ classId: "class-3" })],
    ]);
    expect(new Set(slots.map((slot) => slot.key)).size).toBe(3);
  });
});
