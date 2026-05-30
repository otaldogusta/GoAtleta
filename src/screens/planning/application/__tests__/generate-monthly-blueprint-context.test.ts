import type { ClassGroup } from "../../../../core/models";
import { generateMonthlyBlueprint } from "../generate-monthly-blueprint";

const classGroup: ClassGroup = {
  id: "class_1",
  name: "Turma Sub-11",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "base",
  equipment: "quadra",
  level: 1,
  mvLevel: "iniciante",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("generateMonthlyBlueprint", () => {
  it("inclui contexto minimo da turma, calendario real e razoes de decisao", () => {
    const blueprint = generateMonthlyBlueprint({
      classGroup,
      monthKey: "2026-06",
    });

    const snapshot = JSON.parse(blueprint.contextSnapshotJson);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.classContextSnapshot.calendar.sessionCount).toBe(9);
    expect(snapshot.classContextSnapshot.profile.name).toBe("Turma Sub-11");
    expect(snapshot.decisionReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "calendar_engine", confidence: "high" }),
        expect.objectContaining({ source: "class_profile", confidence: "high" }),
      ])
    );
  });
});

