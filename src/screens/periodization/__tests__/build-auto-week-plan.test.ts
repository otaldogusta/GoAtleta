import type { ClassCalendarException, ClassGroup } from "../../../core/models";
import { buildAutoWeekPlan } from "../build-auto-week-plan";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Turma 09-11",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "Saque e recepção",
  equipment: "quadra",
  level: 1,
  mvLevel: "MV2",
  cycleStartDate: "2026-03-23",
  cycleLengthWeeks: 12,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-23T10:00:00.000Z",
  ...overrides,
});

describe("buildAutoWeekPlan", () => {
  it("synthesizes week identity with skill, progression, load and class goal", () => {
    const plan = buildAutoWeekPlan({
      selectedClass: buildClassGroup(),
      weekNumber: 5,
      cycleLength: 12,
      activeCycleStartDate: "2026-03-23",
      isCompetitiveMode: false,
      calendarExceptions: [] as ClassCalendarException[],
      competitiveProfile: null,
      ageBand: "09-11",
      periodizationModel: "formacao",
      weeklySessions: 2,
      sportProfile: "voleibol",
    });

    expect(plan).toBeTruthy();
    expect(plan?.theme || "").toContain("·");
    expect(plan?.technicalFocus || "").toContain("Progressão em");
    expect(plan?.physicalFocus).toBe("Coordenação, agilidade e ritmo específico");
    expect(plan?.constraints || "").toContain("Semana 5:");
    expect(plan?.constraints || "").toContain("Objetivo da turma: Saque e recepção");
    expect(plan?.constraints || "").toContain("Carga médio");
  });
});
