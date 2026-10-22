import { supabaseRestGet } from "../../../api/rest";
import { listClassStaffIdentitiesByClassIds } from "../../../api/class-responsibles";

export type ClassAssignmentDetails = {
  studentCount: number | null;
  teachers: string[] | null;
  interns: string[] | null;
};

// Keep the same direct + active-enrollment union used by getStudentsByClass,
// fetching only identifiers. A failed page never becomes a partial zero count.
async function pages<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  const pageSize = 500;
  for (let page = 0; page < 100; page += 1) {
    const rows = await supabaseRestGet<T[]>(`${path}&order=id.asc&limit=${pageSize}&offset=${page * pageSize}`);
    result.push(...rows);
    if (rows.length < pageSize) return result;
  }
  throw new Error("Não foi possível concluir a contagem de alunos.");
}

async function loadStudentCounts(organizationId: string, classIds: string[]) {
  const scope = encodeURIComponent(organizationId);
  const students = await pages<{ id: string; classid: string }>(`/students?select=id,classid&organization_id=eq.${scope}&membership_status=eq.active`);
  const activeIds = new Set(students.map(student => student.id));
  const memberships = new Map(classIds.map(id => [id, new Set<string>()]));
  for (const student of students) memberships.get(student.classid)?.add(student.id);
  try {
    const enrollments = await pages<{ id: string; student_id: string; class_id: string }>(`/student_class_enrollments?select=id,student_id,class_id&organization_id=eq.${scope}&status=eq.active`);
    for (const enrollment of enrollments) {
      if (activeIds.has(enrollment.student_id)) memberships.get(enrollment.class_id)?.add(enrollment.student_id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/42P01|PGRST205/.test(message) || !message.includes("student_class_enrollments")) throw error;
  }
  return new Map([...memberships].map(([id, members]) => [id, members.size]));
}

export async function loadClassAssignmentDetails(organizationId: string, classIds: string[]): Promise<Record<string, ClassAssignmentDetails>> {
  if (!organizationId.trim() || !classIds.length) return {};
  const [students, staff] = await Promise.allSettled([
    loadStudentCounts(organizationId, classIds),
    listClassStaffIdentitiesByClassIds({ organizationId, classIds }),
  ]);
  return Object.fromEntries(classIds.map(id => {
    const members = staff.status === "fulfilled" ? staff.value.filter(member => member.classId === id) : null;
    return [id, {
      studentCount: students.status === "fulfilled" ? students.value.get(id) ?? 0 : null,
      teachers: members ? members.filter(member => member.staffRole !== "intern").map(member => member.displayName?.trim() || "Professor definido") : null,
      interns: members ? members.filter(member => member.staffRole === "intern").map(member => member.displayName?.trim() || "Estagiário definido") : null,
    }];
  }));
}
