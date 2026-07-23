import type { ClassGroup, Student } from "../../../core/models";
import {
  resolveClassDevelopmentLevelLabel,
  type ClassDevelopmentLevelLabel,
} from "../../../core/class-development-level";

export type ClassCardStudentAvatar = {
  id: string;
  label: string;
  photoUrl?: string;
  color: string;
};

export type ClassCardTeacherViewModel = {
  name: string;
  initials: string;
  photoUrl?: string;
  isFallback: boolean;
};

export type ClassCardViewModel = {
  developmentLevelLabel: ClassDevelopmentLevelLabel;
  studentCount: number;
  visibleStudents: ClassCardStudentAvatar[];
  extraStudentCount: number;
  teacher: ClassCardTeacherViewModel;
};

type BuildClassCardViewModelParams = {
  classGroup: ClassGroup;
  students?: Student[];
  teacher?: {
    name?: string | null;
    photoUrl?: string | null;
  } | null;
};

const AVATAR_COLORS = ["#3DDC84", "#93C5FD", "#F8D394", "#FCA5A5", "#C4B5FD"];
const FALLBACK_TEACHER_NAME = "Professor não definido";
const MAX_VISIBLE_STUDENTS = 4;

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const getInitials = (name: string, fallback = "T") => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return fallback;
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? words[words.length - 1]?.[0] ?? "" : "";
  return `${first}${second}`.toUpperCase() || fallback;
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
}: BuildClassCardViewModelParams): ClassCardViewModel {
  const orderedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const baseHash = hashString(classGroup.name || classGroup.id || "turma");
  const visibleStudents = orderedStudents.slice(0, MAX_VISIBLE_STUDENTS).map((student, index) => ({
    id: student.id,
    label: getInitials(student.name, "A").slice(0, 2),
    photoUrl: student.photoUrl || undefined,
    color: AVATAR_COLORS[(baseHash + index) % AVATAR_COLORS.length],
  }));
  const teacherName = teacher?.name?.trim() || FALLBACK_TEACHER_NAME;

  return {
    developmentLevelLabel: resolveClassDevelopmentLevelLabel(classGroup),
    studentCount: orderedStudents.length,
    visibleStudents,
    extraStudentCount: Math.max(0, orderedStudents.length - visibleStudents.length),
    teacher: {
      name: teacherName,
      initials: getInitials(teacherName, "PR").slice(0, 2),
      photoUrl: teacher?.photoUrl?.trim() || undefined,
      isFallback: !teacher?.name?.trim(),
    },
  };
}
