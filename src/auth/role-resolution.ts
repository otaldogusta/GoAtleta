import type { FamilyStudentContext } from "../api/family-access";
import type { SelectableUserRole } from "./role-types";

export const resolveAvailableUserRoles = ({
  isTrainer,
  hasStudent,
  familyContexts,
}: {
  isTrainer: boolean;
  hasStudent: boolean;
  familyContexts: readonly FamilyStudentContext[];
}): SelectableUserRole[] => [
  ...(isTrainer ? (["trainer"] as const) : []),
  ...(hasStudent ? (["student"] as const) : []),
  ...(familyContexts.some((context) => context.relationshipType !== "self")
    ? (["family"] as const)
    : []),
];

export const resolvePreferredActiveRole = ({
  availableRoles,
  preferredRole,
}: {
  availableRoles: readonly SelectableUserRole[];
  preferredRole: SelectableUserRole | null;
}): SelectableUserRole | null =>
  preferredRole && availableRoles.includes(preferredRole)
    ? preferredRole
    : (availableRoles[0] ?? null);

export const resolveSelectedFamilyStudent = ({
  familyContexts,
  preferredStudentId,
}: {
  familyContexts: readonly FamilyStudentContext[];
  preferredStudentId: string | null;
}): FamilyStudentContext | null =>
  familyContexts.find((context) => context.studentId === preferredStudentId) ??
  familyContexts[0] ??
  null;
