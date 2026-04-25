import type { ClassGroup, Student } from "../models";

export type ExistingStudentMatchType =
  | "exact_name_birthdate"
  | "exact_name"
  | "similar_name";

export type ExistingStudentMatchConfidence = "high" | "medium" | "low";

export type ExistingStudentMatch = {
  studentId: string;
  studentName: string;
  birthDate?: string | null;
  classId: string;
  className: string;
  matchType: ExistingStudentMatchType;
  confidence: ExistingStudentMatchConfidence;
};

type FindPossibleExistingStudentsParams = {
  name: string;
  birthDate?: string | null;
  currentClassId?: string | null;
  editingStudentId?: string | null;
  students: Student[];
  classesById: Map<string, ClassGroup>;
};

export function normalizeStudentLookupName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalizedName(value: string): string[] {
  return normalizeStudentLookupName(value).split(" ").filter(Boolean);
}

function scoreNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = tokenizeNormalizedName(a);
  const bTokens = tokenizeNormalizedName(b);
  if (!aTokens.length || !bTokens.length) return 0;

  const exactMatches = new Set<string>();
  let partialMatches = 0;

  for (const token of aTokens) {
    if (bTokens.includes(token)) {
      exactMatches.add(token);
      continue;
    }

    const hasInitialMatch = bTokens.some(
      (candidate) =>
        (token.length === 1 && candidate.startsWith(token)) ||
        (candidate.length === 1 && token.startsWith(candidate))
    );
    if (hasInitialMatch) partialMatches += 1;
  }

  const unionSize = new Set([...aTokens, ...bTokens]).size;
  if (!unionSize) return 0;

  const sameFirstToken = aTokens[0] === bTokens[0];
  const sameLastToken = aTokens[aTokens.length - 1] === bTokens[bTokens.length - 1];
  const baseScore = (exactMatches.size + partialMatches * 0.5) / unionSize;

  return baseScore + (sameFirstToken ? 0.08 : 0) + (sameLastToken ? 0.06 : 0);
}

function shouldSearchForDuplicates(normalizedName: string): boolean {
  if (!normalizedName) return false;
  if (normalizedName.length > 5) return true;
  return normalizedName.split(" ").filter(Boolean).length >= 2;
}

export function findPossibleExistingStudents(
  params: FindPossibleExistingStudentsParams
): ExistingStudentMatch[] {
  const normalizedInputName = normalizeStudentLookupName(params.name);
  const normalizedBirthDate = String(params.birthDate ?? "").trim();
  if (!shouldSearchForDuplicates(normalizedInputName)) {
    return [];
  }

  const matches: ExistingStudentMatch[] = [];

  for (const student of params.students) {
    if (params.editingStudentId && student.id === params.editingStudentId) continue;

    const normalizedStudentName = normalizeStudentLookupName(student.name);
    if (!normalizedStudentName) continue;

    const sameBirthDate =
      normalizedBirthDate.length > 0 &&
      String(student.birthDate ?? "").trim().length > 0 &&
      String(student.birthDate).trim() === normalizedBirthDate;

    let matchType: ExistingStudentMatchType | null = null;
    let confidence: ExistingStudentMatchConfidence | null = null;

    if (normalizedStudentName === normalizedInputName && sameBirthDate) {
      matchType = "exact_name_birthdate";
      confidence = "high";
    } else if (normalizedStudentName === normalizedInputName) {
      matchType = "exact_name";
      confidence = "medium";
    } else {
      const similarity = scoreNameSimilarity(normalizedInputName, normalizedStudentName);
      const inputTokens = tokenizeNormalizedName(normalizedInputName);
      const studentTokens = tokenizeNormalizedName(normalizedStudentName);
      const sharedTokens = inputTokens.filter((token) =>
        studentTokens.some(
          (candidate) =>
            candidate === token ||
            (token.length === 1 && candidate.startsWith(token)) ||
            (candidate.length === 1 && token.startsWith(candidate))
        )
      ).length;

      if (similarity >= 0.7 && sharedTokens >= 2) {
        matchType = "similar_name";
        confidence = "low";
      }
    }

    if (!matchType || !confidence) continue;

    const classInfo = params.classesById.get(student.classId);
    matches.push({
      studentId: student.id,
      studentName: student.name,
      birthDate: student.birthDate ?? null,
      classId: student.classId,
      className: classInfo?.name ?? "Turma não encontrada",
      matchType,
      confidence,
    });
  }

  return matches.sort((a, b) => {
    const rank = (value: ExistingStudentMatch) => {
      if (value.matchType === "exact_name_birthdate") return 0;
      if (value.matchType === "exact_name") return 1;
      return 2;
    };

    const typeRankDiff = rank(a) - rank(b);
    if (typeRankDiff !== 0) return typeRankDiff;
    return a.studentName.localeCompare(b.studentName, "pt-BR");
  });
}
