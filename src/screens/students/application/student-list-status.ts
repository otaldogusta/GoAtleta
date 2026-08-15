import type { Student } from "../../../core/models";

export type StudentListPrimaryStatus = "active" | "experimental" | "inactive";

export function resolveStudentListPrimaryStatus(
  student: Pick<Student, "isExperimental" | "membershipStatus">,
): StudentListPrimaryStatus {
  if (student.membershipStatus === "inactive") return "inactive";
  if (student.isExperimental) return "experimental";
  return "active";
}
