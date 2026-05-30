import type { ClassGroup, Student } from "../../../core/models";

export const normalizeStudentSearchText = (value: string | null | undefined) =>
  String(value ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const splitStudentSearchTokens = (query: string) =>
  normalizeStudentSearchText(query).split(" ").filter(Boolean);

export const studentMatchesSearch = (params: {
  student: Student;
  classGroup?: ClassGroup | null;
  unitName?: string;
  query: string;
}) => {
  const tokens = splitStudentSearchTokens(params.query);
  if (!tokens.length) return true;

  const classGroup = params.classGroup;
  const haystack = normalizeStudentSearchText(
    [
      params.student.name,
      params.student.guardianName,
      params.student.guardianPhone,
      params.student.phone,
      params.student.loginEmail,
      params.student.ra,
      params.unitName,
      classGroup?.name,
      classGroup?.ageBand,
      classGroup?.goal,
      classGroup?.modality,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return tokens.every((token) => haystack.includes(token));
};
