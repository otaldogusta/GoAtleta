import type {
  ClassResponsible,
  ClassStaffAssignment,
} from "../../../api/class-responsibles";
import type { OrgMember } from "../../../api/members";
import {
  PROFILE_NAME_FALLBACK,
  resolveProfileDisplayName,
} from "../../../core/profile-name";

export const applyMemberNamesToClassResponsibles = (
  responsibles: readonly ClassResponsible[],
  members: readonly OrgMember[]
) => {
  const membersByUserId = new Map(
    members.map((member) => [member.userId, member] as const)
  );

  return responsibles.map((responsible) => {
    const member = membersByUserId.get(responsible.userId);
    const responsibleName = resolveProfileDisplayName({
      displayName: responsible.displayName,
      email: responsible.email || member?.email,
      fallback: "Professor responsável",
    });
    const memberName = resolveProfileDisplayName({
      displayName: member?.displayName,
      email: member?.email,
    });
    const hasResolvedResponsibleName = Boolean(
      responsibleName &&
        responsibleName !== "Professor responsável" &&
        responsibleName !== responsible.userId &&
        !responsibleName.includes("@")
    );
    if (hasResolvedResponsibleName) {
      return responsibleName === responsible.displayName
        ? responsible
        : { ...responsible, displayName: responsibleName };
    }
    if (memberName !== PROFILE_NAME_FALLBACK) {
      return { ...responsible, displayName: memberName };
    }
    return responsible.displayName === "Professor responsável"
      ? responsible
      : { ...responsible, displayName: "Professor responsável" };
  });
};

const GENERIC_STAFF_NAMES = new Set([
  "Professor responsável",
  "Auxiliar",
  "Estagiário(a)",
  PROFILE_NAME_FALLBACK,
]);

export const applyMemberIdentitiesToClassStaff = ({
  assignments,
  members,
  responsibles,
}: {
  assignments: readonly ClassStaffAssignment[];
  members: readonly OrgMember[];
  responsibles: readonly ClassResponsible[];
}) => {
  const membersByUserId = new Map(
    members.map((member) => [member.userId, member] as const)
  );
  const responsibleIdentitiesByUserId = new Map(
    responsibles.map((responsible) => [responsible.userId, responsible] as const)
  );

  return assignments.map((assignment) => {
    const member = membersByUserId.get(assignment.userId);
    const assignmentName = resolveProfileDisplayName({
      displayName: assignment.displayName,
      email: member?.email,
    });
    const memberName = resolveProfileDisplayName({
      displayName: member?.displayName,
      email: member?.email,
    });
    const responsible = responsibleIdentitiesByUserId.get(assignment.userId);
    const responsibleName = resolveProfileDisplayName({
      displayName: responsible?.displayName,
      email: responsible?.email || member?.email,
    });
    const displayName =
      (!GENERIC_STAFF_NAMES.has(assignmentName) ? assignmentName : "") ||
      (memberName !== PROFILE_NAME_FALLBACK ? memberName : "") ||
      (responsibleName !== PROFILE_NAME_FALLBACK ? responsibleName : "") ||
      PROFILE_NAME_FALLBACK;
    const photoUrl = assignment.photoUrl?.trim() || responsible?.photoUrl?.trim() || null;

    return {
      ...assignment,
      displayName,
      photoUrl,
    };
  });
};
