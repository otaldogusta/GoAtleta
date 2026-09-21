type AttendanceRow = {
  classid: string;
  studentid: string;
  date: string;
  status: string;
};

type StudentRow = { id: string; name: string; classid?: string | null };
type ClassRow = { id: string; name: string };

export type AttendanceRankingItem = {
  studentId: string;
  studentName: string;
  classNames: string[];
  absences: number;
  records: number;
  attendanceRate: number;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

export const isAttendanceRankingQuestion = (message: string) => {
  const text = normalize(message);
  const mentionsAbsence = /\b(falta|faltas|faltam|ausencia|ausencias)\b/.test(text);
  const asksRanking = /\b(mais|maior|ranking|lista|listar|quem)\b/.test(text);
  return mentionsAbsence && asksRanking && /\b(aluno|alunos|atleta|atletas|quem)\b/.test(text);
};

export const resolveRequestedDays = (message: string, fallback = 90) => {
  const normalized = normalize(message);
  const match = normalized.match(/(?:ultim[oa]s?\s+)?(\d{1,3})\s+dias?/);
  if (!match) return fallback;
  return Math.min(365, Math.max(1, Number(match[1])));
};

export const buildAttendanceRanking = (
  attendance: AttendanceRow[],
  students: StudentRow[],
  classes: ClassRow[],
): AttendanceRankingItem[] => {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const classById = new Map(classes.map((item) => [item.id, item.name]));
  const totals = new Map<string, { absences: number; records: number; classIds: Set<string> }>();

  for (const row of attendance) {
    if (!studentById.has(row.studentid)) continue;
    const current = totals.get(row.studentid) ?? { absences: 0, records: 0, classIds: new Set<string>() };
    current.records += 1;
    if (normalize(row.status) === "faltou") current.absences += 1;
    current.classIds.add(row.classid);
    totals.set(row.studentid, current);
  }

  return Array.from(totals.entries())
    .map(([studentId, total]) => ({
      studentId,
      studentName: studentById.get(studentId)?.name?.trim() || "Aluno sem nome",
      classNames: Array.from(total.classIds).map((id) => classById.get(id)).filter((name): name is string => Boolean(name)).sort(),
      absences: total.absences,
      records: total.records,
      attendanceRate: total.records ? Math.round(((total.records - total.absences) / total.records) * 100) : 0,
    }))
    .sort((left, right) => right.absences - left.absences || left.attendanceRate - right.attendanceRate || left.studentName.localeCompare(right.studentName, "pt-BR"));
};

const formatDate = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

export async function resolveAttendanceRanking(params: {
  supabase: any;
  organizationId: string;
  classId?: string | null;
  message: string;
  now?: Date;
}) {
  if (!isAttendanceRankingQuestion(params.message)) return null;

  const days = resolveRequestedDays(params.message);
  const now = params.now ?? new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  const rows: AttendanceRow[] = [];

  for (let offset = 0; ; offset += 1000) {
    let query = params.supabase
      .from("attendance_logs")
      .select("classid,studentid,date,status")
      .eq("organization_id", params.organizationId)
      .gte("date", startDate)
      .lte("date", endDate);
    if (params.classId) query = query.eq("classid", params.classId);
    const { data, error } = await query
      .order("date", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as AttendanceRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  if (!rows.length) {
    return {
      reply: `Não há chamadas registradas entre ${formatDate(startDate)} e ${formatDate(endDate)}${params.classId ? " nesta turma" : " nas turmas acessíveis"}.`,
      days,
      startDate,
      endDate,
      ranking: [] as AttendanceRankingItem[],
    };
  }

  const studentIds = Array.from(new Set(rows.map((row) => row.studentid)));
  const classIds = Array.from(new Set(rows.map((row) => row.classid)));
  const [{ data: students, error: studentsError }, { data: classes, error: classesError }] = await Promise.all([
    params.supabase.from("students").select("id,name,classid").eq("organization_id", params.organizationId).in("id", studentIds),
    params.supabase.from("classes").select("id,name").eq("organization_id", params.organizationId).in("id", classIds),
  ]);
  if (studentsError) throw studentsError;
  if (classesError) throw classesError;

  const ranking = buildAttendanceRanking(rows, students ?? [], classes ?? []);
  const withAbsences = ranking.filter((item) => item.absences > 0).slice(0, 10);
  const coveredClasses = new Set(rows.map((row) => row.classid)).size;
  const coveredDates = new Set(rows.map((row) => `${row.classid}:${row.date}`)).size;

  if (!withAbsences.length) {
    return {
      reply: `Nenhuma falta foi registrada nas ${coveredDates} chamadas de ${coveredClasses} turma(s) entre ${formatDate(startDate)} e ${formatDate(endDate)}.`,
      days,
      startDate,
      endDate,
      ranking,
    };
  }

  const lines = withAbsences.map((item, index) => {
    const classesLabel = item.classNames.length ? ` — ${item.classNames.join(", ")}` : "";
    return `${index + 1}. **${item.studentName}**: ${item.absences} falta(s) em ${item.records} chamada(s) (${item.attendanceRate}% de presença)${classesLabel}`;
  });
  return {
    reply: `**Alunos com mais faltas nos últimos ${days} dias**\n\n${lines.join("\n")}\n\nBase: ${coveredDates} chamadas registradas em ${coveredClasses} turma(s), de ${formatDate(startDate)} a ${formatDate(endDate)}. Turmas sem chamada no período não entram no cálculo.`,
    days,
    startDate,
    endDate,
    ranking,
  };
}
