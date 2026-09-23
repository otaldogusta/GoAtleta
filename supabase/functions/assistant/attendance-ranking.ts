type AttendanceRow = {
  classid: string;
  studentid: string;
  date: string;
  status: string;
};

type StudentRow = { id: string; name: string; classid?: string | null };
type ClassRow = { id: string; name: string };
type StaffTenureRow = {
  class_id: string;
  user_id: string | null;
  staff_profile_id: string | null;
  display_name_snapshot: string;
  starts_on: string;
  ends_on: string | null;
  status: string;
};

type AttendanceRankingScope =
  | { kind: "context" }
  | { kind: "all" }
  | { kind: "professor"; professorName: string };

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

export const resolveAttendanceRankingScope = (message: string): AttendanceRankingScope => {
  const normalized = normalize(message);
  if (/\b(todas? as turmas|todas? turmas|de tudo|geral da organizacao)\b/.test(normalized)) {
    return { kind: "all" };
  }

  const marker = /\b(?:prof(?:essor(?:a)?)?|treinador(?:a)?)\.?\s*/i;
  const markerMatch = message.match(marker);
  if (!markerMatch || markerMatch.index === undefined) return { kind: "context" };

  const remainder = message.slice(markerMatch.index + markerMatch[0].length).trim();
  const quoted = remainder.match(/^["'“”]([^"'“”]+)["'“”]/);
  const rawName = quoted?.[1] ?? remainder.split(
    /\s+\b(?:nos?|nas?|durante|entre|com|que|dos?|das?|ultim[oa]s?)\b/i,
    1,
  )[0];
  const professorName = String(rawName ?? "")
    .replace(/^["'“”]+|["'“”?!,.;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return professorName ? { kind: "professor", professorName } : { kind: "context" };
};

const staffIdentityKey = (row: StaffTenureRow) =>
  row.user_id ? `user:${row.user_id}` : `profile:${row.staff_profile_id ?? "unknown"}`;

export const resolveProfessorClassScope = (
  professorName: string,
  tenures: StaffTenureRow[],
  requesterUserId?: string | null,
) => {
  const requested = normalize(professorName).trim();
  const identities = new Map<string, {
    displayName: string;
    userId: string | null;
    classIds: Set<string>;
    periods: Array<{ classId: string; startsOn: string; endsOn: string | null }>;
  }>();

  for (const tenure of tenures) {
    const displayName = tenure.display_name_snapshot?.trim();
    if (!displayName) continue;
    const key = staffIdentityKey(tenure);
    const current = identities.get(key) ?? {
      displayName,
      userId: tenure.user_id,
      classIds: new Set<string>(),
      periods: [],
    };
    current.classIds.add(tenure.class_id);
    current.periods.push({ classId: tenure.class_id, startsOn: tenure.starts_on, endsOn: tenure.ends_on });
    identities.set(key, current);
  }

  const entries = Array.from(identities.values());
  const exact = entries.filter((entry) => normalize(entry.displayName) === requested);
  const candidates = exact.length
    ? exact
    : entries.filter((entry) => {
        const name = normalize(entry.displayName);
        return name === requested || name.startsWith(`${requested} `) || name.includes(` ${requested} `);
      });
  const requester = candidates.find((entry) => requesterUserId && entry.userId === requesterUserId);
  const selected = candidates.length === 1 ? candidates[0] : requester;

  return {
    selected: selected
      ? { displayName: selected.displayName, classIds: Array.from(selected.classIds), periods: selected.periods }
      : null,
    candidates: candidates.map((entry) => entry.displayName).sort((left, right) => left.localeCompare(right, "pt-BR")),
  };
};

const loadCurrentStaffFallback = async (supabase: any, organizationId: string, startDate: string) => {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id")
    .eq("organization_id", organizationId);
  if (classesError) throw classesError;
  const classIds = (classes ?? []).map((item: { id: string }) => item.id).filter(Boolean);
  if (!classIds.length) return [] as StaffTenureRow[];

  const { data, error } = await supabase.rpc("list_org_class_staff_for_classes", {
    p_org_id: organizationId,
    p_class_ids: classIds,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    class_id: String(row.class_id ?? ""),
    user_id: row.user_id ? String(row.user_id) : null,
    staff_profile_id: row.staff_profile_id ? String(row.staff_profile_id) : null,
    display_name_snapshot: String(row.display_name ?? "Profissional"),
    starts_on: startDate,
    ends_on: null,
    status: "active",
  })) as StaffTenureRow[];
};

const loadStaffTenures = async (
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
) => {
  const { data, error } = await supabase
    .from("class_staff_tenures")
    .select("class_id,user_id,staff_profile_id,display_name_snapshot,starts_on,ends_on,status")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .lte("starts_on", endDate);
  if (error) {
    console.warn("assistant: class staff history unavailable, using current team", { code: error.code });
    return loadCurrentStaffFallback(supabase, organizationId, startDate);
  }
  return ((data ?? []) as StaffTenureRow[]).filter((row) => !row.ends_on || row.ends_on >= startDate);
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

export const isAttendanceWithinStaffPeriods = (
  row: Pick<AttendanceRow, "classid" | "date">,
  periods: Array<{ classId: string; startsOn: string; endsOn: string | null }>,
) => periods.some((period) =>
  period.classId === row.classid
  && row.date >= period.startsOn
  && (!period.endsOn || row.date <= period.endsOn)
);

export async function resolveAttendanceRanking(params: {
  supabase: any;
  organizationId: string;
  classId?: string | null;
  requesterUserId?: string | null;
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
  const requestedScope = resolveAttendanceRankingScope(params.message);
  let scopedClassIds: string[] | null = requestedScope.kind === "context" && params.classId
    ? [params.classId]
    : null;
  let scopedPeriods: Array<{ classId: string; startsOn: string; endsOn: string | null }> | null = null;
  let scopeLabel = requestedScope.kind === "all" ? "nas turmas acessíveis" : null;

  if (requestedScope.kind === "professor") {
    const tenures = await loadStaffTenures(params.supabase, params.organizationId, startDate, endDate);
    const professorScope = resolveProfessorClassScope(
      requestedScope.professorName,
      tenures,
      params.requesterUserId,
    );
    if (!professorScope.selected) {
      if (professorScope.candidates.length > 1) {
        return {
          reply: `Encontrei mais de um profissional chamado ${requestedScope.professorName}: ${professorScope.candidates.join(", ")}. Informe o nome completo para eu não misturar as turmas.`,
          days,
          startDate,
          endDate,
          ranking: [] as AttendanceRankingItem[],
        };
      }
      return {
        reply: `Não encontrei um profissional chamado ${requestedScope.professorName} vinculado às turmas acessíveis nesse período.`,
        days,
        startDate,
        endDate,
        ranking: [] as AttendanceRankingItem[],
      };
    }
    scopedClassIds = professorScope.selected.classIds;
    scopedPeriods = professorScope.selected.periods;
    scopeLabel = `nas turmas de ${professorScope.selected.displayName}`;
  }

  const rows: AttendanceRow[] = [];

  for (let offset = 0; ; offset += 1000) {
    let query = params.supabase
      .from("attendance_logs")
      .select("classid,studentid,date,status")
      .eq("organization_id", params.organizationId)
      .gte("date", startDate)
      .lte("date", endDate);
    if (scopedClassIds?.length === 1) query = query.eq("classid", scopedClassIds[0]);
    if (scopedClassIds && scopedClassIds.length > 1) query = query.in("classid", scopedClassIds);
    const { data, error } = await query
      .order("date", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    const rawPage = (data ?? []) as AttendanceRow[];
    const page = rawPage.filter((row) => !scopedPeriods || isAttendanceWithinStaffPeriods(row, scopedPeriods));
    rows.push(...page);
    if (rawPage.length < 1000) break;
  }

  if (!rows.length) {
    const emptyScope = scopeLabel ?? (scopedClassIds?.length ? "nesta turma" : "nas turmas acessíveis");
    return {
      reply: `Não há chamadas registradas ${emptyScope} entre ${formatDate(startDate)} e ${formatDate(endDate)}.`,
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
    reply: `**Alunos com mais faltas nos últimos ${days} dias**${scopeLabel ? ` ${scopeLabel}` : ""}\n\n${lines.join("\n")}\n\nBase: ${coveredDates} chamadas registradas em ${coveredClasses} turma(s), de ${formatDate(startDate)} a ${formatDate(endDate)}. Turmas sem chamada no período não entram no cálculo.`,
    days,
    startDate,
    endDate,
    ranking,
  };
}
