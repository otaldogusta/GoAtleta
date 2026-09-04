import type { Student } from "../../../core/models";

export type StudentListPrimaryStatus = "active" | "experimental" | "inactive";

export function resolveStudentListPrimaryStatus(
  student: Pick<Student, "isExperimental" | "membershipStatus">,
): StudentListPrimaryStatus {
  if (student.membershipStatus === "inactive") return "inactive";
  if (student.isExperimental) return "experimental";
  return "active";
}

export function resolveStudentDirectoryStatus(
  student: Pick<Student, "isExperimental" | "membershipStatus" | "studentUserId">,
  familyAccess: "active" | "invited" | "none" | undefined,
) {
  const status = resolveStudentListPrimaryStatus(student);
  if (status === "inactive") return { label: "Inativo", tone: "neutral", reason: "Cadastro inativo na instituição." } as const;
  if (status === "experimental") return { label: "Experimental", tone: "warning", reason: "Aluno em período experimental." } as const;
  if (student.studentUserId || familyAccess === "active") {
    return { label: "Ativo", tone: "success", reason: "Cadastro ativo na instituição, com acesso do aluno ou familiar ativado." } as const;
  }
  if (student.studentUserId === undefined || familyAccess === undefined) {
    return { label: "Ativo", tone: "neutral", reason: "Cadastro ativo. A ativação do acesso ainda não foi confirmada." } as const;
  }
  return { label: "Ativo", tone: "neutral", reason: "Pré-cadastro da instituição. Acesso ainda não ativado." } as const;
}
