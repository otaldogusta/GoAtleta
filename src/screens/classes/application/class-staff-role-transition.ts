import type { ClassStaffAssignment } from "../../../api/class-responsibles";

const ROLE_LABELS: Record<ClassStaffAssignment["staffRole"], string> = {
  head: "Professor responsável",
  assistant: "Auxiliar",
  intern: "Estagiário(a)",
};

const getStaffName = (assignment: ClassStaffAssignment | undefined, fallback: string) =>
  assignment?.displayName?.trim() || fallback;

export type ClassStaffRoleTransition = {
  nextAssignments: ClassStaffAssignment[];
  changed: boolean;
  requiresConfirmation: boolean;
  confirmationTitle: string;
  confirmationMessage: string;
};

export function planClassStaffRoleTransition({
  assignments,
  userId,
  nextRole,
}: {
  assignments: readonly ClassStaffAssignment[];
  userId: string;
  nextRole: ClassStaffAssignment["staffRole"];
}): ClassStaffRoleTransition {
  const selected = assignments.find((assignment) => assignment.userId === userId);
  if (!selected || selected.staffRole === nextRole) {
    return {
      nextAssignments: [...assignments],
      changed: false,
      requiresConfirmation: false,
      confirmationTitle: "",
      confirmationMessage: "",
    };
  }

  const previousHead = nextRole === "head"
    ? assignments.find((assignment) => assignment.staffRole === "head" && assignment.userId !== userId)
    : undefined;
  const nextAssignments = assignments.map((assignment) => {
    if (assignment.userId === userId) return { ...assignment, staffRole: nextRole };
    if (nextRole === "head" && assignment.staffRole === "head") {
      return { ...assignment, staffRole: "assistant" as const };
    }
    return assignment;
  });

  if (nextRole !== "head") {
    return {
      nextAssignments,
      changed: true,
      requiresConfirmation: false,
      confirmationTitle: "",
      confirmationMessage: "",
    };
  }

  const incomingName = getStaffName(selected, "O profissional selecionado");
  const incomingChange = `${incomingName} passará de ${ROLE_LABELS[selected.staffRole]} para Professor responsável.`;
  const outgoingChange = previousHead
    ? ` ${getStaffName(previousHead, "O responsável atual")} deixará a responsabilidade e continuará como Auxiliar.`
    : "";

  return {
    nextAssignments,
    changed: true,
    requiresConfirmation: true,
    confirmationTitle: previousHead ? "Trocar professor responsável?" : "Definir professor responsável?",
    confirmationMessage: `${incomingChange}${outgoingChange} Ao salvar, os períodos serão registrados no Histórico da equipe.`,
  };
}
