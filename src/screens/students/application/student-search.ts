import type { ClassGroup, Student } from "../../../core/models";

export const ALL_STUDENTS_UNITS_LABEL = "Todas";

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

const isNumericToken = (value: string) => /^\d+$/.test(value);

export const normalizedTextMatchesToken = (text: string, token: string) => {
  const words = splitStudentSearchTokens(text);
  if (!words.length) return false;
  if (isNumericToken(token)) {
    return words.some((word) => word.includes(token));
  }
  return words.some((word) => word === token || word.startsWith(token));
};

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

  return tokens.every((token) => normalizedTextMatchesToken(haystack, token));
};

export const hasActiveStudentSearch = (query: string | null | undefined) =>
  normalizeStudentSearchText(query).length > 0;

export const filterStudentsForList = (params: {
  students: Student[];
  classById: ReadonlyMap<string, ClassGroup>;
  unitFilter: string;
  unitLabel: (value: string) => string;
  query: string;
}) => {
  const filteredByUnit =
    params.unitFilter === ALL_STUDENTS_UNITS_LABEL
      ? params.students
      : params.students.filter((student) => {
          const cls = params.classById.get(student.classId) ?? null;
          return params.unitLabel(cls?.unit ?? "") === params.unitFilter;
        });

  const query = normalizeStudentSearchText(params.query);
  if (!query) return filteredByUnit;

  return filteredByUnit.filter((student) => {
    const cls = params.classById.get(student.classId) ?? null;
    const unitName = params.unitLabel(cls?.unit ?? "");
    return studentMatchesSearch({
      student,
      classGroup: cls,
      unitName,
      query,
    });
  });
};
