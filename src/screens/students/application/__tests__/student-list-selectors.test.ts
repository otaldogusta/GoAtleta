import type { ClassGroup, Student } from "../../../../core/models";
import {
  buildStudentListGroups,
  groupStudentsByClassId,
  type StudentListPalette,
} from "../student-list-selectors";

const palette: StudentListPalette = { bg: "#123456", text: "#ffffff" };

const buildClass = (params: Partial<ClassGroup> & { id: string; name: string }): ClassGroup =>
  ({
    organizationId: "org_1",
    unit: "Rede Esportes Pinhais",
    unitId: "unit_1",
    colorKey: "blue",
    modality: "voleibol",
    ageBand: "10-12",
    gender: "misto",
    startTime: "14:00",
    endTime: "15:00",
    durationMinutes: 60,
    daysOfWeek: [1, 3],
    daysPerWeek: 2,
    goal: "Fundamentos",
    equipment: "quadra",
    level: 1,
    mvLevel: "MV1",
    cycleStartDate: "2026-01-01",
    cycleLengthWeeks: 12,
    acwrLow: 0.8,
    acwrHigh: 1.3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...params,
  }) as ClassGroup;

const buildStudent = (params: Partial<Student> & { id: string; name: string; classId: string }) =>
  ({
    birthDate: "",
    guardianName: "",
    guardianPhone: "",
    phone: "",
    loginEmail: "",
    ra: "",
    ...params,
  }) as Student;

describe("student list selectors", () => {
  it("groups filtered students by class and sorts names", () => {
    const cls = buildClass({ id: "class_1", name: "Turma 10-12" });
    const students = [
      buildStudent({ id: "student_b", name: "Bruna", classId: cls.id }),
      buildStudent({ id: "student_a", name: "Ana", classId: cls.id }),
    ];

    const groups = buildStudentListGroups({
      classes: [cls],
      classById: new Map([[cls.id, cls]]),
      studentsByClassId: groupStudentsByClassId(students),
      unitFilter: "Todas",
      unitLabel: (value) => String(value || "Sem unidade"),
      hasActiveSearch: false,
      fallbackPalette: palette,
      resolveClassPalette: () => palette,
      resolveUnitPalette: () => palette,
      formatClassScheduleLabel: () => "Seg, Qua 14h",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].unitName).toBe("Rede Esportes Pinhais");
    expect(groups[0].classes[0].students.map((student) => student.name)).toEqual(["Ana", "Bruna"]);
  });

  it("hides empty classes during active search", () => {
    const classWithMatch = buildClass({ id: "class_match", name: "Turma com aluno" });
    const classWithoutMatch = buildClass({ id: "class_empty", name: "Turma vazia", startTime: "15:00" });

    const groups = buildStudentListGroups({
      classes: [classWithMatch, classWithoutMatch],
      classById: new Map([
        [classWithMatch.id, classWithMatch],
        [classWithoutMatch.id, classWithoutMatch],
      ]),
      studentsByClassId: groupStudentsByClassId([
        buildStudent({ id: "student_1", name: "Flávia", classId: classWithMatch.id }),
      ]),
      unitFilter: "Todas",
      unitLabel: (value) => String(value || "Sem unidade"),
      hasActiveSearch: true,
      fallbackPalette: palette,
      resolveClassPalette: () => palette,
      resolveUnitPalette: () => palette,
      formatClassScheduleLabel: () => "",
    });

    expect(groups[0].classes.map((group) => group.classId)).toEqual(["class_match"]);
  });
});
