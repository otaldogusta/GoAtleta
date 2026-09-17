type InstitutionContext = { studentId: string; organizationId: string; organizationName: string };

/** Profile identity comes from the athlete relationship, not staff membership. */
export function resolveProfileInstitution(
  student: { id: string; organizationId?: string } | null,
  contexts: InstitutionContext[],
  activeOrganization: { id: string; name: string } | null,
) {
  if (!student?.organizationId) return null;
  const linked = contexts.find(context => context.studentId === student.id && context.organizationId === student.organizationId);
  return {
    id: student.organizationId,
    name: linked?.organizationName || (activeOrganization?.id === student.organizationId ? activeOrganization.name : "Instituição vinculada"),
  };
}
