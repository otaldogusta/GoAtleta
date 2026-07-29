import type { ClassGroup } from "../../../../core/models";
import {
  buildClassesIcs,
  buildClassesWorkbookRows,
} from "../classes-export";

const classGroup: ClassGroup = {
  id: "class-1",
  name: "Turma 12-14",
  organizationId: "org-1",
  unit: "Rede Esportes Pinhais",
  unitId: "unit-1",
  colorKey: "default",
  modality: "voleibol",
  ageBand: "12-14",
  gender: "feminino",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
  goal: "Fundamentos",
  equipment: "Misto",
  level: 1,
  mvLevel: "MV1",
  cycleStartDate: "2026-07-20",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-07-01T12:00:00.000Z",
};

describe("classes export", () => {
  it("builds a workbook row with operational class data", () => {
    const rows = buildClassesWorkbookRows([classGroup], {
      "class-1": { studentCount: 14, teacherName: "Gustavo Ribeiro" },
    });

    expect(rows[0]).toContain("Professor");
    expect(rows[1]).toEqual(
      expect.arrayContaining([
        "Turma 12-14",
        "Rede Esportes Pinhais",
        "Seg, Qua",
        14,
        "Gustavo Ribeiro",
      ])
    );
  });

  it("builds one weekly calendar event for each class day", () => {
    const content = buildClassesIcs(
      [classGroup],
      new Date("2026-07-29T12:00:00-03:00")
    );

    expect(content).toContain("X-WR-CALNAME:GoAtleta - Turmas");
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(content).toContain("SUMMARY:Aula - Turma 12-14");
    expect(content).toContain("RRULE:FREQ=WEEKLY");
  });
});
