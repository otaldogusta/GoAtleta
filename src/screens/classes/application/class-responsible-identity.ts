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

  const resolved = responsibles.map((responsible) => {
    const member = membersByUserId.get(responsible.userId);
    const responsibleName = resolveProfileDisplayName({
      displayName: responsible.displayName,
      email: responsible.email || member?.email,
      fallback: PROFILE_NAME_FALLBACK,
    });
    const memberName = resolveProfileDisplayName({
      displayName: member?.displayName,
      email: member?.email,
    });
    const hasResolvedResponsibleName = Boolean(
      responsibleName &&
        !GENERIC_STAFF_NAMES.has(responsibleName) &&
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
    return responsible.displayName === PROFILE_NAME_FALLBACK
      ? responsible
      : { ...responsible, displayName: PROFILE_NAME_FALLBACK };
  });

  const identifiedByClassId = new Map<string, number>();
  for (const responsible of resolved) {
    if (responsible.displayName !== PROFILE_NAME_FALLBACK) {
      identifiedByClassId.set(
        responsible.classId,
        (identifiedByClassId.get(responsible.classId) ?? 0) + 1
      );
    }
  }
  return resolved.filter((responsible) =>
    responsible.displayName !== PROFILE_NAME_FALLBACK || identifiedByClassId.get(responsible.classId) !== 1
  );
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

  const resolved = assignments.map((assignment) => {
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
      (!GENERIC_STAFF_NAMES.has(responsibleName) ? responsibleName : "") ||
      PROFILE_NAME_FALLBACK;
    const photoUrl = assignment.photoUrl?.trim() || responsible?.photoUrl?.trim() || null;

    return {
      ...assignment,
      displayName,
      photoUrl,
    };
  });

  const identifiedHeadByClassId = new Map<string, string>();
  const ambiguousIdentifiedHeadClasses = new Set<string>();
  for (const assignment of resolved) {
    if (assignment.staffRole !== "head" || assignment.displayName === PROFILE_NAME_FALLBACK) continue;
    const existing = identifiedHeadByClassId.get(assignment.classId);
    if (existing && existing !== assignment.userId) ambiguousIdentifiedHeadClasses.add(assignment.classId);
    else identifiedHeadByClassId.set(assignment.classId, assignment.userId);
  }

  return resolved.map((assignment) => {
    if (
      assignment.staffRole === "head" &&
      assignment.displayName === PROFILE_NAME_FALLBACK &&
      identifiedHeadByClassId.has(assignment.classId) &&
      !ambiguousIdentifiedHeadClasses.has(assignment.classId)
    ) {
      return { ...assignment, staffRole: "assistant" as const };
    }
    return assignment;
  });
};

export const reconcileClassResponsiblesWithStaff = ({
  responsibles,
  assignments,
  classes,
}: {
  responsibles: readonly ClassResponsible[];
  assignments: readonly ClassStaffAssignment[];
  classes: readonly { id: string; name: string; unit?: string | null }[];
}) => {
  const classesById = new Map(classes.map((item) => [item.id, item] as const));
  const headsGroupedByClassId = new Map<string, ClassStaffAssignment[]>();
  for (const assignment of assignments) {
    if (assignment.staffRole !== "head") continue;
    const current = headsGroupedByClassId.get(assignment.classId) ?? [];
    current.push(assignment);
    headsGroupedByClassId.set(assignment.classId, current);
  }
  const staffHeadsByClassId = new Map(
    Array.from(headsGroupedByClassId.entries())
      .filter(([, heads]) => heads.length === 1)
      .map(([classId, heads]) => [classId, heads[0]!] as const)
  );
  const reconciled = responsibles.filter((responsible) => !staffHeadsByClassId.has(responsible.classId));

  for (const [classId, assignment] of staffHeadsByClassId) {
    const classGroup = classesById.get(classId);
    const previous = responsibles.find((responsible) => responsible.classId === classId);
    reconciled.push({
      classId,
      userId: assignment.userId,
      className: classGroup?.name ?? previous?.className ?? "Turma",
      unit: classGroup?.unit?.trim() || previous?.unit || "Sem unidade",
      displayName: assignment.displayName?.trim() || PROFILE_NAME_FALLBACK,
      email: previous?.userId === assignment.userId ? previous.email : null,
      photoUrl: assignment.photoUrl?.trim() || (previous?.userId === assignment.userId ? previous.photoUrl : null),
    });
  }

  return reconciled;
};
