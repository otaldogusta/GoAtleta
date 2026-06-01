import {
  filterStudentsForList,
  normalizeStudentSearchText,
  normalizedTextMatchesToken,
  studentMatchesSearch,
} from "../student-search";
import type { ClassGroup, Student } from "../../../../core/models";

const student = {
  id: "student_1",
  name: "Flávia Sara da Silva",
  classId: "class_1",
  guardianName: "Márcia Silva",
  guardianPhone: "(41) 99999-0000",
  phone: "",
  loginEmail: "flavia@example.com",
  ra: "12345",
} as Student;

const classGroup = {
  id: "class_1",
  name: "Turma 10-12",
  ageBand: "10-12",
  goal: "Fundamentos",
  modality: "voleibol",
} as ClassGroup;

describe("student search", () => {
  it("normalizes accents and casing", () => {
    expect(normalizeStudentSearchText("Flávia")).toBe("flavia");
    expect(normalizeStudentSearchText("FLAVIA")).toBe("flavia");
  });

  it("matches names with or without accents", () => {
    expect(studentMatchesSearch({ student, classGroup, query: "flavia" })).toBe(true);
    expect(studentMatchesSearch({ student, classGroup, query: "Flávia" })).toBe(true);
    expect(studentMatchesSearch({ student, classGroup, query: "sara" })).toBe(true);
  });

  it("does not match text in the middle of a word", () => {
    expect(normalizedTextMatchesToken("Gonçalves", "goncalves")).toBe(true);
    expect(normalizedTextMatchesToken("Gonçalves", "gonc")).toBe(true);
    expect(normalizedTextMatchesToken("Gonçalves", "alves")).toBe(false);
    expect(
      studentMatchesSearch({
        student: { ...student, name: "Isabela Fisher Gonçalves" },
        classGroup,
        query: "alves",
      })
    ).toBe(false);
  });

  it("matches class and unit context with multiple tokens", () => {
    expect(
      studentMatchesSearch({
        student,
        classGroup,
        unitName: "Rede Esportes Pinhais",
        query: "flavia pinhais",
      })
    ).toBe(true);
  });

  it("rejects unrelated tokens", () => {
    expect(studentMatchesSearch({ student, classGroup, query: "joao" })).toBe(false);
  });

  it("filters list by unit and accent-insensitive query", () => {
    const otherStudent = {
      ...student,
      id: "student_2",
      name: "João Alves",
      classId: "class_2",
    } as Student;
    const otherClass = {
      ...classGroup,
      id: "class_2",
      unit: "Outra unidade",
    } as ClassGroup;
    const classById = new Map<string, ClassGroup>([
      [classGroup.id, { ...classGroup, unit: "Rede Esportes Pinhais" } as ClassGroup],
      [otherClass.id, otherClass],
    ]);

    expect(
      filterStudentsForList({
        students: [student, otherStudent],
        classById,
        unitFilter: "Rede Esportes Pinhais",
        unitLabel: (value) => String(value || "Sem unidade"),
        query: "flavia",
      }).map((item) => item.id)
    ).toEqual(["student_1"]);
  });
});
