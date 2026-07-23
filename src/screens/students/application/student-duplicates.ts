import type { Student } from "../../../core/models";
import { normalizeStudentLookupName } from "../../../core/students/find-possible-existing-students";

export type PossibleDuplicateStudentGroup = {
  normalizedName: string;
  displayName: string;
  studentIds: string[];
};

export function findPossibleDuplicateStudentGroups(
  students: readonly Student[]
): PossibleDuplicateStudentGroup[] {
  const groupsByName = new Map<string, Student[]>();

  for (const student of students) {
    const normalizedName = normalizeStudentLookupName(student.name);
    if (!normalizedName) continue;
    const group = groupsByName.get(normalizedName) ?? [];
    group.push(student);
    groupsByName.set(normalizedName, group);
  }

  return Array.from(groupsByName.entries())
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => ({
      normalizedName,
      displayName: group[0]?.name.trim() ?? "",
      studentIds: group.map((student) => student.id),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
}

export function buildPossibleDuplicateStudentIdSet(
  groups: readonly PossibleDuplicateStudentGroup[]
): ReadonlySet<string> {
  return new Set(groups.flatMap((group) => group.studentIds));
}

export function findStudentsWithSameNormalizedName(
  students: readonly Student[],
  name: string
): Student[] {
  const normalizedName = normalizeStudentLookupName(name);
  if (!normalizedName) return [];
  return students.filter(
    (student) => normalizeStudentLookupName(student.name) === normalizedName
  );
}

export function buildPossibleDuplicateReviewSignature(
  group: PossibleDuplicateStudentGroup
): string {
  return `${group.normalizedName}:${[...group.studentIds].sort().join(",")}`;
}
