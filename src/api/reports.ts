import * as Sentry from "@sentry/react-native";
import { supabaseRestGet } from "./rest";
import { canonicalizeUnitLabel } from "../core/unit-label";

type AdminPendingAttendanceRow = {
  organization_id: string;
  class_id: string;
  class_name: string;
  unit: string;
  target_date: string;
  student_count: number | string;
  has_attendance_today: boolean;
};

type AdminPendingSessionLogsRow = {
  organization_id: string;
  class_id: string;
  class_name: string;
  unit: string;
  period_start: string;
  reports_last_7d: number | string;
  last_report_at: string | null;
};

type AdminClassScheduleRow = {
  id: string;
  days: number[] | null;
  daysperweek: number | string | null;
  gender?: string | null;
};

type AdminRecentActivityRow = {
  organization_id: string;
  kind: "attendance" | "session_log";
  class_id: string;
  class_name: string;
  unit: string;
  occurred_at: string;
  actor_user_id: string | null;
  affected_rows: number | string;
  reference_date: string | null;
};

export type AdminPendingAttendance = {
  organizationId: string;
  classId: string;
  className: string;
  unit: string;
  targetDate: string;
  studentCount: number;
  hasAttendanceToday: boolean;
};

export type AdminPendingSessionLogs = {
  organizationId: string;
  classId: string;
  className: string;
  unit: string;
  gender: string | null;
  periodStart: string;
  suggestedDate: string;
  daysWithoutReport: number;
  hasReportHistory: boolean;
  reportsLast7d: number;
  lastReportAt: string | null;
};

export type AdminRecentActivity = {
  organizationId: string;
  kind: "attendance" | "session_log";
  classId: string;
  className: string;
  unit: string;
  occurredAt: string;
  actorUserId: string | null;
  affectedRows: number;
  referenceDate: string | null;
};

export type TeamIntelligenceClassMetric = {
  classId: string;
  className: string;
  unit: string;
  avgAttendance: number;
  avgPse: number;
  sessions: number;
};

export type TeamIntelligenceSnapshot = {
  globalAvgAttendance: number;
  globalAvgPse: number;
  classes: TeamIntelligenceClassMetric[];
  rankingByAttendance: TeamIntelligenceClassMetric[];
};

const toInt = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateKey = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDateKeyLocal = (value: string) => {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const calcDaysSinceDateKey = (dateKey: string) => {
  const target = parseDateKeyLocal(dateKey);
  if (!target) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - target.getTime()) / MS_PER_DAY));
};

const resolveSuggestedSessionDate = (scheduledDays: number[]) => {
  const now = new Date();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const jsWeekday = date.getDay();
    const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
    if (scheduledDays.includes(isoWeekday)) {
      return formatDateKey(date);
    }
  }
  return formatDateKey(now);
};

const assertOrganizationId = (organizationId: string, feature: string) => {
  if (!organizationId || !organizationId.trim()) {
    throw new Error(`Missing organizationId for ${feature}`);
  }
};

const withTiming = async <T>(name: string, operation: () => Promise<T>) => {
  const startedAt = Date.now();
  try {
    const result = await operation();
    Sentry.addBreadcrumb({
      category: "reports",
      message: `${name} success`,
      level: "info",
      data: { ms: Date.now() - startedAt },
    });
    return result;
  } catch (error) {
    Sentry.addBreadcrumb({
      category: "reports",
      message: `${name} error`,
      level: "error",
      data: { ms: Date.now() - startedAt },
    });
    throw error;
  }
};

export async function listAdminPendingAttendance(params: {
  organizationId: string;
}) {
  assertOrganizationId(params.organizationId, "listAdminPendingAttendance");
  const rows = await withTiming("listAdminPendingAttendance", () =>
    supabaseRestGet<AdminPendingAttendanceRow[]>(
      "/v_admin_pending_attendance?organization_id=eq." +
        encodeURIComponent(params.organizationId) +
        "&select=*"
    )
  );
  return rows.map<AdminPendingAttendance>((row) => ({
    organizationId: row.organization_id,
    classId: row.class_id,
    className: row.class_name,
    unit: canonicalizeUnitLabel(row.unit ?? null) || row.unit,
    targetDate: row.target_date,
    studentCount: toInt(row.student_count),
    hasAttendanceToday: row.has_attendance_today,
  }));
}

export async function listAdminPendingSessionLogs(params: {
  organizationId: string;
}) {
  assertOrganizationId(params.organizationId, "listAdminPendingSessionLogs");
  const { rows, classSchedules } = await withTiming("listAdminPendingSessionLogs", async () => {
    const encodedOrgId = encodeURIComponent(params.organizationId);
    const [pendingRows, scheduleRows] = await Promise.all([
      supabaseRestGet<AdminPendingSessionLogsRow[]>(
        "/v_admin_pending_session_logs?organization_id=eq." + encodedOrgId + "&select=*"
      ),
      supabaseRestGet<AdminClassScheduleRow[]>(
        "/classes?organization_id=eq." + encodedOrgId + "&select=id,days,daysperweek,gender"
      ),
    ]);
    return { rows: pendingRows, classSchedules: scheduleRows };
  });

  const isoWeekdaysInWindow = new Set<number>();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    const jsWeekday = day.getDay();
    const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
    isoWeekdaysInWindow.add(isoWeekday);
  }

  const scheduleByClassId = new Map(classSchedules.map((item) => [item.id, item]));
  const filteredRows = rows.filter((row) => {
    const schedule = scheduleByClassId.get(row.class_id);
    if (!schedule) return true;

    const scheduledDays = Array.isArray(schedule.days)
      ? schedule.days
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
      : [];
    if (scheduledDays.length > 0) {
      return scheduledDays.some((weekday) => isoWeekdaysInWindow.has(weekday));
    }

    // Legacy fallback: if days are missing but class has weekly frequency, keep the pending item.
    return toInt(schedule.daysperweek) > 0;
  });

  return filteredRows.map<AdminPendingSessionLogs>((row) => {
    const schedule = scheduleByClassId.get(row.class_id);
    const scheduledDays = Array.isArray(schedule?.days)
      ? schedule.days
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
      : [];

    const classGender =
      schedule?.gender === "masculino" || schedule?.gender === "feminino" || schedule?.gender === "misto"
        ? schedule.gender
        : null;
    const suggestedDate = resolveSuggestedSessionDate(scheduledDays);
    const daysWithoutReport = calcDaysSinceDateKey(suggestedDate);

    return {
      organizationId: row.organization_id,
      classId: row.class_id,
      className: row.class_name,
      unit: canonicalizeUnitLabel(row.unit ?? null) || row.unit,
      gender: classGender,
      periodStart: row.period_start,
      suggestedDate,
      daysWithoutReport,
      hasReportHistory: Boolean(row.last_report_at),
      reportsLast7d: toInt(row.reports_last_7d),
      lastReportAt: row.last_report_at,
    };
  });
}

export async function listAdminRecentActivity(params: {
  organizationId: string;
  limit?: number;
}) {
  assertOrganizationId(params.organizationId, "listAdminRecentActivity");
  const limit = Math.max(1, params.limit ?? 50);
  const rows = await withTiming("listAdminRecentActivity", () =>
    supabaseRestGet<AdminRecentActivityRow[]>(
      "/v_admin_recent_activity?organization_id=eq." +
        encodeURIComponent(params.organizationId) +
        "&select=*&order=occurred_at.desc&limit=" +
        String(limit)
    )
  );
  return rows.map<AdminRecentActivity>((row) => ({
    organizationId: row.organization_id,
    kind: row.kind,
    classId: row.class_id,
    className: row.class_name,
    unit: canonicalizeUnitLabel(row.unit ?? null) || row.unit,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    affectedRows: toInt(row.affected_rows),
    referenceDate: row.reference_date,
  }));
}

export const buildTeamIntelligenceSnapshot = (input: {
  classes: Array<{ id: string; name: string; unit: string }>;
  sessionLogs: Array<{ classId: string; attendance: number; PSE: number }>;
}): TeamIntelligenceSnapshot => {
  const byClass = new Map<string, TeamIntelligenceClassMetric>();

  input.classes.forEach((item) => {
    byClass.set(item.id, {
      classId: item.id,
      className: item.name,
      unit: item.unit,
      avgAttendance: 0,
      avgPse: 0,
      sessions: 0,
    });
  });

  input.sessionLogs.forEach((log) => {
    const metric = byClass.get(log.classId);
    if (!metric) return;
    metric.sessions += 1;
    metric.avgAttendance += Number(log.attendance || 0);
    metric.avgPse += Number(log.PSE || 0);
  });

  const classes = Array.from(byClass.values()).map((item) => {
    if (item.sessions <= 0) return item;
    return {
      ...item,
      avgAttendance: item.avgAttendance / item.sessions,
      avgPse: item.avgPse / item.sessions,
    };
  });

  const globalSessions = classes.reduce((sum, item) => sum + item.sessions, 0);
  const globalAvgAttendance =
    globalSessions > 0
      ? classes.reduce((sum, item) => sum + item.avgAttendance * item.sessions, 0) / globalSessions
      : 0;
  const globalAvgPse =
    globalSessions > 0
      ? classes.reduce((sum, item) => sum + item.avgPse * item.sessions, 0) / globalSessions
      : 0;

  const rankingByAttendance = [...classes]
    .filter((item) => item.sessions > 0)
    .sort((a, b) => b.avgAttendance - a.avgAttendance)
    .slice(0, 5);

  return {
    globalAvgAttendance,
    globalAvgPse,
    classes,
    rankingByAttendance,
  };
};
