import type { ClassGroup, Student } from "../../../../core/models";
import { buildExistingStudentOptions } from "../StudentExistingAutocomplete";

const classes = [
  { id: "class_current", name: "Turma 12-14", unit: "Rede Pinhais" },
  { id: "class_other", name: "Turma 10-12", unit: "Capão da Imbuia" },
] as ClassGroup[];

const students = [
  { id: "student_1", name: "Isabela Fisher Gonçalves", classId: "class_other" },
  { id: "student_2", name: "Isadora Lima", classId: "class_current" },
  { id: "student_3", name: "João Ismael", classId: "class_other" },
] as Student[];

describe("buildExistingStudentOptions", () => {
  it("waits for a useful query before showing people", () => {
    expect(
      buildExistingStudentOptions({
        students,
        classes,
        currentClassStudentIds: [],
        query: "i",
      })
    ).toEqual([]);
  });

  it("finds existing students ignoring accents and casing", () => {
    const options = buildExistingStudentOptions({
      students,
      classes,
      currentClassStudentIds: [],
      query: "goncalves",
    });

    expect(options).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({ id: "student_1" }),
        className: "Turma 10-12",
        unitName: "Capão da Imbuia",
        isInCurrentClass: false,
      }),
    ]);
  });

  it("identifies a person who is already linked to the current class", () => {
    const options = buildExistingStudentOptions({
      students,
      classes,
      currentClassStudentIds: ["student_2"],
      query: "isa",
    });

    expect(options.map((option) => [option.student.id, option.isInCurrentClass])).toEqual([
      ["student_1", false],
      ["student_2", true],
    ]);
  });

  it("prioritizes names that start with the query", () => {
    const options = buildExistingStudentOptions({
      students,
      classes,
      currentClassStudentIds: [],
      query: "is",
    });

    expect(options.map((option) => option.student.id)).toEqual(["student_1", "student_2", "student_3"]);
  });
});
