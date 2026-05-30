import type { ClassCalendarException, ClassGroup } from "../models";
import { buildClassContextSnapshot } from "../class-context-snapshot";
import { buildSessionCalendar } from "../session-calendar-engine";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Sub-11",
  organizationId: "org_1",
  unit: "Unidade Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "mista",
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "base",
  equipment: "misto",
  level: 1,
  mvLevel: "iniciante",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("SessionCalendarEngine", () => {
  it("gera sessoes reais do mes conforme os dias da turma", () => {
    const result = buildSessionCalendar({
      classGroup: buildClassGroup({ daysOfWeek: [2, 4], daysPerWeek: 2 }),
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.sessions).toHaveLength(9);
    expect(result.sessions[0]).toMatchObject({
      date: "2026-06-02",
      weekday: 2,
      weekIndex: 0,
      sessionIndexInWeek: 1,
    });
    expect(result.reasons[0]).toMatchObject({
      source: "calendar_engine",
      confidence: "high",
    });
  });

  it("remove excecao no_training e preserva razao operacional", () => {
    const exceptions: ClassCalendarException[] = [
      {
        id: "ex_1",
        classId: "class_1",
        organizationId: "org_1",
        date: "2026-06-04",
        reason: "Feriado",
        kind: "no_training",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const result = buildSessionCalendar({
      classGroup: buildClassGroup(),
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      exceptions,
    });

    expect(result.sessions.map((session) => session.date)).toEqual(["2026-06-02"]);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Sessao removida por excecao de calendario.",
          evidence: "2026-06-04: Feriado",
        }),
      ])
    );
  });

  it("nao inventa sessoes quando a turma nao tem dias configurados", () => {
    const result = buildSessionCalendar({
      classGroup: buildClassGroup({ daysOfWeek: [], daysPerWeek: 0 }),
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.sessions).toEqual([]);
    expect(result.reasons[0]).toMatchObject({
      source: "safe_default",
      confidence: "low",
    });
  });
});

describe("ClassContextSnapshot", () => {
  it("diferencia contexto forte de fallback de calendario", () => {
    const classGroup = buildClassGroup();
    const calendar = buildSessionCalendar({
      classGroup,
      startDate: "2026-06-01",
      endDate: "2026-06-07",
    });

    const snapshot = buildClassContextSnapshot({
      classGroup,
      sessions: calendar.sessions,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.calendar.sessionCount).toBe(2);
    expect(snapshot.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "class_profile", confidence: "high" }),
        expect.objectContaining({ source: "calendar_engine", confidence: "high" }),
      ])
    );
  });
});
