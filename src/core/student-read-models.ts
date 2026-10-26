import type { Student } from "./models";

export type StudentDirectoryRecord = Pick<Student,
  "id" | "name" | "organizationId" | "studentUserId" | "photoUrl" | "ra" |
  "isExperimental" | "membershipStatus" | "financialStatus" | "classId" | "age" |
  "phone" | "loginEmail" | "guardianName" | "guardianPhone" | "guardianRelation" | "birthDate"
>;

export type ClassStudentRecord = Pick<Student, "id" | "name" | "organizationId" | "classId" | "photoUrl">;

// Explicit copies keep full profile/document/health data out of list state.
export const projectStudentDirectoryRecord = (student: StudentDirectoryRecord): StudentDirectoryRecord => ({
  id: student.id, name: student.name, organizationId: student.organizationId,
  studentUserId: student.studentUserId, photoUrl: student.photoUrl, ra: student.ra,
  isExperimental: student.isExperimental, membershipStatus: student.membershipStatus,
  financialStatus: student.financialStatus, classId: student.classId, age: student.age,
  phone: student.phone, loginEmail: student.loginEmail, guardianName: student.guardianName,
  guardianPhone: student.guardianPhone, guardianRelation: student.guardianRelation, birthDate: student.birthDate,
});

export const projectClassStudentRecord = (student: ClassStudentRecord): ClassStudentRecord => ({
  id: student.id, name: student.name, organizationId: student.organizationId,
  classId: student.classId, photoUrl: student.photoUrl,
});
