import type {
  StudentRelationshipKind,
  StudentRelationshipPermissions,
} from "../../api/student-relationship-invite";

export const relationshipKindLabel: Record<StudentRelationshipKind, string> = {
  athlete: "Atleta",
  guardian: "Responsável",
  payer: "Responsável financeiro",
  viewer: "Acompanhante",
};

export const permissionsForRelationshipKind = (
  kind: StudentRelationshipKind,
): StudentRelationshipPermissions => {
  if (kind === "athlete") {
    return {
      canViewProfile: true,
      canViewSchedule: true,
      canViewAttendance: true,
      canViewProgress: true,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
    };
  }
  if (kind === "guardian") {
    return {
      canViewProfile: true,
      canViewSchedule: true,
      canViewAttendance: true,
      canViewProgress: true,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
    };
  }
  if (kind === "payer") {
    return {
      canViewProfile: false,
      canViewSchedule: false,
      canViewAttendance: false,
      canViewProgress: false,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
    };
  }
  return {
    canViewProfile: true,
    canViewSchedule: true,
    canViewAttendance: true,
    canViewProgress: true,
    canViewHealth: false,
    canSignConsents: false,
    canViewFinancial: false,
    canPay: false,
  };
};

export const normalizeRelationshipPermissions = (
  permissions: StudentRelationshipPermissions,
): StudentRelationshipPermissions => ({
  ...permissions,
  canViewHealth: false,
  canSignConsents: false,
  canViewFinancial: permissions.canViewFinancial || permissions.canPay,
});
