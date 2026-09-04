import type { Student } from "../../../core/models";

export function getStudentLoginAccessLabel(student: Pick<Student, "studentUserId" | "loginEmail">, compact = false) {
  if (student.studentUserId) return compact ? "Com acesso" : "Acesso vinculado";
  if (student.studentUserId === undefined) return compact ? "A verificar" : "Acesso não verificado";
  return student.loginEmail.trim()
    ? compact ? "Sem acesso" : "Acesso não vinculado"
    : compact ? "Sem e-mail" : "Sem e-mail de acesso";
}
