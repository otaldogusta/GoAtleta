import type { ClassGroup, Student } from "../../../core/models";
import {
  resolveClassDevelopmentLevelLabel,
  type ClassDevelopmentLevelLabel,
} from "../../../core/class-development-level";
import { PROFILE_NAME_FALLBACK } from "../../../core/profile-name";

export type ClassCardStudentAvatar = {
  id: string;
  label: string;
  photoUrl?: string;
  color: string;
};

export type ClassCardTeacherViewModel = {
  name: string;
  compactName: string;
  initials: string;
  photoUrl?: string;
  isFallback: boolean;
};

export type ClassCardStaffViewModel = {
  id: string;
  name: string;
  initials: string;
  photoUrl?: string;
  role: "assistant" | "intern";
  roleLabel: string;
  color: string;
};

export type CoverageSummary = {
  label: string;
  dateLabel: string;
  tone: "success" | "warning";
};

export type ClassCardViewModel = {
  developmentLevelLabel: ClassDevelopmentLevelLabel;
  studentCount: number;
  visibleStudents: ClassCardStudentAvatar[];
  extraStudentCount: number;
  teacher: ClassCardTeacherViewModel;
  supportStaff: ClassCardStaffViewModel[];
  coverageSummary?: CoverageSummary;
};

type BuildClassCardViewModelParams = {
  classGroup: ClassGroup;
  students?: Student[];
  teacher?: {
    name?: string | null;
    photoUrl?: string | null;
  } | null;
  staff?: {
    id: string;
    name?: string | null;
    photoUrl?: string | null;
    role: "head" | "assistant" | "intern";
  }[];
  coverageSummary?: CoverageSummary | null;
};

const AVATAR_COLORS = ["#3DDC84", "#93C5FD", "#F8D394", "#FCA5A5", "#C4B5FD"];
const FALLBACK_TEACHER_NAME = "Professor não definido";
const MAX_VISIBLE_STUDENTS = 4;
const COMPOUND_GIVEN_NAME_PREFIXES = new Set([
  "ana",
  "maria",
  "joão",
  "josé",
  "luís",
  "luiz",
]);

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const getInitials = (name: string, fallback = "A") => {
  const words = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return fallback;
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? words[words.length - 1]?.[0] ?? "" : "";
  const result = `${first}${second}`.trim().toUpperCase();
  return result || fallback;
};

export const formatCompactPersonName = (name: string) => {
  if (
    name === PROFILE_NAME_FALLBACK ||
    name === "Professor responsável" ||
    name === FALLBACK_TEACHER_NAME
  ) {
    return name;
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  const keepsCompoundGivenName = COMPOUND_GIVEN_NAME_PREFIXES.has(
    words[0]!.toLocaleLowerCase("pt-BR")
  );
  if (words.length === 2 && keepsCompoundGivenName) return words.join(" ");
  const givenName = keepsCompoundGivenName ? words.slice(0, 2).join(" ") : words[0]!;
  const lastName = words[words.length - 1]!;
  return `${givenName} ${lastName[0]?.toLocaleUpperCase("pt-BR") ?? ""}.`;
};

export const groupStudentsByClassId = (students: Student[]) => {
  return students.reduce<Record<string, Student[]>>((acc, student) => {
    const classId = student.classId?.trim();
    if (!classId) return acc;
    if (!acc[classId]) acc[classId] = [];
    acc[classId].push(student);
    return acc;
  }, {});
};

export function buildClassCardViewModel({
  classGroup,
  students = [],
  teacher,
  staff = [],
  coverageSummary,
}: BuildClassCardViewModelParams): ClassCardViewModel {
  const orderedStudents = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const baseHash = hashString(classGroup.name || classGroup.id || "turma");
  const visibleStudents = orderedStudents.slice(0, MAX_VISIBLE_STUDENTS).map((student, index) => {
    const initials = getInitials(student.name, "A").slice(0, 2) || "A";
    const photoUrl = student.photoUrl?.trim() || undefined;
    return {
      id: student.id,
      label: initials,
      photoUrl,
      color: AVATAR_COLORS[(baseHash + index) % AVATAR_COLORS.length],
    };
  });
  const teacherName = teacher?.name?.trim() || FALLBACK_TEACHER_NAME;
  const supportStaff = staff
    .filter(
      (member): member is typeof member & { role: "assistant" | "intern" } =>
        member.role !== "head" && Boolean(member.name?.trim())
    )
    .sort((left, right) => {
      if (left.role !== right.role) return left.role === "assistant" ? -1 : 1;
      return (left.name || "").localeCompare(right.name || "", "pt-BR");
    })
    .map((member, index) => {
      const name = member.name!.trim();
      return {
        id: member.id,
        name,
        initials:
          name === PROFILE_NAME_FALLBACK
            ? member.role === "assistant"
              ? "A"
              : "E"
            : getInitials(name, member.role === "assistant" ? "A" : "E").slice(0, 2),
        photoUrl: member.photoUrl?.trim() || undefined,
        role: member.role,
        roleLabel: member.role === "assistant" ? "Auxiliar" : "Estagiário(a)",
        color: AVATAR_COLORS[(hashString(member.id || name) + index) % AVATAR_COLORS.length],
      };
    });

  return {
    developmentLevelLabel: resolveClassDevelopmentLevelLabel(classGroup),
    studentCount: orderedStudents.length,
    visibleStudents,
    extraStudentCount: Math.max(0, orderedStudents.length - visibleStudents.length),
    teacher: {
      name: teacherName,
      compactName: teacher?.name?.trim()
        ? formatCompactPersonName(teacherName)
        : teacherName,
      initials:
        teacherName === PROFILE_NAME_FALLBACK
          ? "PR"
          : getInitials(teacherName, "PR").slice(0, 2),
      photoUrl: teacher?.photoUrl?.trim() || undefined,
      isFallback:
        !teacher?.name?.trim() ||
        teacherName === PROFILE_NAME_FALLBACK ||
        teacherName === "Professor responsável",
    },
    supportStaff,
    coverageSummary: coverageSummary ?? undefined,
  };
}
