import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("operational athlete deletion contract", () => {
  it("does not expose permanent deletion from Gestão", () => {
    const managementRoute = readSource("app/students/index.tsx");
    const editModal = readSource(
      "src/screens/students/modals/StudentEditModal.tsx",
    );

    expect(managementRoute).not.toContain("deleteStudent(");
    expect(editModal).not.toContain("Excluir aluno");
  });

  it("uses inactivation instead of deletion in the class roster", () => {
    const classRoster = readSource("app/class/[id]/students.tsx");

    expect(classRoster).toContain("inactivateStudents");
    expect(classRoster).toContain("Inativar aluno");
    expect(classRoster).toContain('accessibilityLabel="Inativar alunos"');
    expect(classRoster).not.toContain("deleteStudents(");
    expect(classRoster).not.toContain("deleteStudent(");
    expect(classRoster).not.toContain("Excluir aluno");
  });

  it("does not delete students as part of a class cascade", () => {
    const classesDb = readSource("src/db/classes.ts");

    expect(classesDb).not.toContain('supabaseDelete("/students?"');
    expect(classesDb).toContain("A turma possui atletas vinculados");
  });
});
