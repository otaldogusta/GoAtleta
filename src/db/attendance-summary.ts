import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration, getScopedOrganizationId, supabaseGet } from "./client";
import { getAttendanceAll } from "./students";

export type AttendanceDailySummary = {
  classId: string;
  date: string;
  total: number;
  present: number;
};

export async function getMonthlyAttendanceSummary(options: {
  organizationId?: string | null;
  monthKey: string;
}): Promise<AttendanceDailySummary[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.monthKey)) throw new Error("Mês de presença inválido.");
  const start = `${options.monthKey}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = next.toISOString().slice(0, 10);
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const initialOrganizationId = await getActiveOrganizationId();
  const organizationId = await getScopedOrganizationId(options.organizationId, "getMonthlyAttendanceSummary");
  if (!organizationId) return [];
  if (!identity.userId) throw new Error("Sessão expirada. Entre novamente.");
  const assertCurrent = async () => {
    assertSessionIdentity(identity);
    const current = await getActiveOrganizationId();
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration() || current !== initialOrganizationId) throw new SessionIdentityChangedError();
  };
  await assertCurrent();
  // One scalar JSON result is not truncated by PostgREST's row limit.
  let result: { days: AttendanceDailySummary[] };
  try {
    result = await supabaseGet<{ days: AttendanceDailySummary[] }>(
      `/rpc/get_monthly_attendance_summary_v1?p_organization_id=${encodeURIComponent(organizationId)}&p_start=${start}&p_end=${end}`,
      identity,
    );
  } catch (error) {
    await assertCurrent();
    // Only this fixed signature being absent permits the complete legacy read.
    // Authorization, transport and invalid responses must remain visible errors.
    if (!(error instanceof Error) || error.message !== "Supabase GET error: 404 PGRST202") throw error;
    const records = await getAttendanceAll({ organizationId, startIso: start, endIso: end });
    await assertCurrent();
    const days = new Map<string, AttendanceDailySummary>();
    for (const row of records) {
      const key = JSON.stringify([row.classId, row.date]);
      const day = days.get(key) ?? { classId: row.classId, date: row.date, total: 0, present: 0 };
      day.total += 1;
      if (row.status !== "faltou") day.present += 1;
      days.set(key, day);
    }
    result = { days: [...days.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 :
      a.classId < b.classId ? -1 : a.classId > b.classId ? 1 : 0) };
  }
  await assertCurrent();
  if (!result || !Array.isArray(result.days)) throw new Error("Resumo de presença inválido.");
  const seen = new Set<string>();
  for (const row of result.days) {
    if (!row || typeof row.classId !== "string" || typeof row.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date < start || row.date >= end ||
        !Number.isSafeInteger(row.total) || row.total <= 0 || !Number.isSafeInteger(row.present) || row.present < 0 || row.present > row.total) {
      throw new Error("Resumo de presença inválido.");
    }
    const key = JSON.stringify([row.classId, row.date]);
    if (seen.has(key)) throw new Error("Resumo de presença repetido.");
    seen.add(key);
  }
  return result.days;
}
