import {
  listClassStaffIdentitiesByClassIds,
  replaceClassStaffAssignments,
  type ClassStaffDraftAssignment,
} from "../api/class-responsibles";
import {
  applyClassStaffAssignmentsWithHistory,
  getClassStaffVersion,
  isClassStaffHistoryUnavailable,
} from "../api/class-staff-history";
import type { ClassGroup } from "../core/models";
import { deleteClass, duplicateClass } from "../db/classes";

const toDraftAssignment = (
  assignment: Awaited<ReturnType<typeof listClassStaffIdentitiesByClassIds>>[number]
): ClassStaffDraftAssignment => ({
  userId: assignment.userId,
  staffProfileId: assignment.staffProfileId ?? null,
  displayName: assignment.displayName ?? null,
  isPlaceholder: Boolean(assignment.isPlaceholder),
  staffRole: assignment.staffRole,
});

async function copyCurrentClassStaff(input: {
  organizationId: string;
  sourceClassId: string;
  targetClassId: string;
}) {
  const sourceAssignments = await listClassStaffIdentitiesByClassIds({
    organizationId: input.organizationId,
    classIds: [input.sourceClassId],
  });
  if (!sourceAssignments.length) return;

  const assignments = sourceAssignments.map(toDraftAssignment);
  try {
    const expectedVersion = await getClassStaffVersion(input.organizationId, input.targetClassId);
    await applyClassStaffAssignmentsWithHistory({
      organizationId: input.organizationId,
      classId: input.targetClassId,
      expectedVersion,
      assignments: assignments.map((assignment) => ({
        userId: assignment.isPlaceholder ? null : assignment.userId,
        staffProfileId: assignment.staffProfileId,
        displayName: assignment.displayName,
        isPlaceholder: assignment.isPlaceholder,
        staffRole: assignment.staffRole,
      })),
    });
  } catch (error) {
    if (!isClassStaffHistoryUnavailable(error)) throw error;
    await replaceClassStaffAssignments({
      organizationId: input.organizationId,
      classId: input.targetClassId,
      assignments,
    });
  }
}

export async function duplicateClassWithCurrentStaff(base: ClassGroup): Promise<string> {
  const organizationId = base.organizationId?.trim();
  if (!organizationId) throw new Error("A turma precisa pertencer a uma organização para ser duplicada.");

  const duplicatedClassId = await duplicateClass(base);
  try {
    await copyCurrentClassStaff({
      organizationId,
      sourceClassId: base.id,
      targetClassId: duplicatedClassId,
    });
    return duplicatedClassId;
  } catch (error) {
    try {
      await deleteClass(duplicatedClassId);
    } catch {
      // Preserve the staff-copy error; a reload exposes any orphan draft copy.
    }
    const detail = error instanceof Error ? error.message : "Falha desconhecida.";
    throw new Error(`Não foi possível copiar a equipe da turma. A duplicação foi cancelada. ${detail}`);
  }
}
