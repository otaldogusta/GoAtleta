import {
  buildHomeScheduleSlots,
  resolvePreferredScheduleSlotIndex,
} from "../build-home-schedule-slots";
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

  it("selects the current or next lesson when today is clicked", () => {
    const slots = buildHomeScheduleSlots([
      lesson("class-1", "Primeira", 9 * 60 * 60 * 1000),
      lesson("class-2", "Atual", 10 * 60 * 60 * 1000),
      lesson("class-3", "Próxima", 14 * 60 * 60 * 1000),
    ]);

    expect(
      resolvePreferredScheduleSlotIndex(
        slots,
        "2026-09-26",
        "2026-09-26",
        10.5 * 60 * 60 * 1000,
      ),
    ).toBe(1);
  });

  it("selects the latest lesson when all lessons of the day have ended", () => {
    const slots = buildHomeScheduleSlots([
      lesson("class-1", "Primeira", 9 * 60 * 60 * 1000),
      lesson("class-2", "Última", 14 * 60 * 60 * 1000),
    ]);

    expect(
      resolvePreferredScheduleSlotIndex(
        slots,
        "2026-09-26",
        "2026-09-26",
        18 * 60 * 60 * 1000,
      ),
    ).toBe(1);
  });

  it("keeps the first lesson as the entry point for a future day", () => {
    const slots = buildHomeScheduleSlots([
      { ...lesson("class-1", "Primeira", 9 * 60 * 60 * 1000), dateKey: "2026-09-27" },
      { ...lesson("class-2", "Última", 14 * 60 * 60 * 1000), dateKey: "2026-09-27" },
    ]);

    expect(
      resolvePreferredScheduleSlotIndex(
        slots,
        "2026-09-27",
        "2026-09-26",
        4_000_000,
      ),
    ).toBe(0);
  });
});
