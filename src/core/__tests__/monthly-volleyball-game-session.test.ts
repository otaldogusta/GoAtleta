import type { ClassCalendarException, ClassGroup } from "../models";
import {
  resolveMonthlyVolleyballGameDurations,
  resolveMonthlyVolleyballGameSession,
} from "../monthly-volleyball-game-session";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class-monthly-game",
  name: "Capivaras",
  organizationId: "org-1",
  unit: "Centro",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [3, 5],
  daysPerWeek: 2,
  goal: "Fundamentos",
  equipment: "quadra",
  level: 1,
  mvLevel: "base",
  cycleStartDate: "2026-01-01",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildException = (
  overrides: Partial<ClassCalendarException> = {}
): ClassCalendarException => ({
  id: "exception-1",
  classId: "class-monthly-game",
  orgId: "org-1",
  date: "2026-07-31",
  reason: "Sem aula",
  kind: "no_training",
  ...overrides,
});

describe("monthly volleyball game session policy", () => {
  it("reserves the last actual class of the month for the consolidated game", () => {
    const policy = resolveMonthlyVolleyballGameSession({
      classGroup: buildClassGroup(),
      sessionDate: "2026-07-31",
    });

    expect(policy.applies).toBe(true);
    expect(policy.lastSessionDate).toBe("2026-07-31");
    expect(policy.warmupMinutes).toBe(10);
    expect(policy.gameMinutes).toBe(45);
    expect(policy.cooldownMinutes).toBe(5);
  });

  it("moves the game to the preceding actual class when the nominal last class is cancelled", () => {
    const classGroup = buildClassGroup();
    const calendarExceptions = [buildException()];

    expect(
      resolveMonthlyVolleyballGameSession({
        classGroup,
        sessionDate: "2026-07-29",
        calendarExceptions,
      }).applies
    ).toBe(true);
    expect(
      resolveMonthlyVolleyballGameSession({
        classGroup,
        sessionDate: "2026-07-31",
        calendarExceptions,
      }).applies
    ).toBe(false);
  });

  it("does not apply to another sport", () => {
    const policy = resolveMonthlyVolleyballGameSession({
      classGroup: buildClassGroup({ modality: "futebol" }),
      sessionDate: "2026-07-31",
    });

    expect(policy.applies).toBe(false);
    expect(policy.lastSessionDate).toBeNull();
  });

  it("keeps the game as the largest block for longer and shorter classes", () => {
    expect(resolveMonthlyVolleyballGameDurations(60)).toEqual({
      warmupMinutes: 10,
      gameMinutes: 45,
      cooldownMinutes: 5,
    });
    expect(resolveMonthlyVolleyballGameDurations(90)).toEqual({
      warmupMinutes: 10,
      gameMinutes: 75,
      cooldownMinutes: 5,
    });
  });
});
