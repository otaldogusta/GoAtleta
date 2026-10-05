import type { ClassGroup, Student } from "../../../core/models";

/** Resolve only from the authorized directory; a URL never widens its scope. */
export function resolveStudentProfile(
  id: string | string[] | undefined,
  organizationId: string | undefined,
  students: Student[],
  classes: Map<string, ClassGroup>,
) {
  if (typeof id !== "string" || !organizationId) return null;
  const student = students.find(item => item.id === id && item.organizationId === organizationId);
  if (!student) return null;
  const group = classes.get(student.classId);
  return { student, classGroup: group?.organizationId === organizationId ? group : null };
}

export function studentProfileAge(student: Pick<Student, "age" | "birthDate">, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(student.birthDate ?? "");
  if (!match) return Number.isFinite(student.age) && student.age >= 0 ? student.age : null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) return null;
  return today.getFullYear() - year - (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day) ? 1 : 0);
}
