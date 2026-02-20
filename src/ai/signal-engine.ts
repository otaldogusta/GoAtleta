import { listAdminPendingSessionLogs } from "../api/reports";
import { listCheckinsByRange } from "../data/attendance-checkins";
import {
  getAttendanceAll,
  getClasses,
  getSessionLogsByRange,
  getStudents,
} from "../db/seed";

export type SignalType =
  | "attendance_drop"
  | "repeated_absence"
  | "report_delay"
  | "unusual_presence_pattern"
  | "engagement_risk";

export type SignalSeverity = "low" | "medium" | "high" | "critical";
export type SignalScope = "organization" | "class" | "student";

export type Signal = {
  id: string;
  type: SignalType;
  severity: SignalSeverity;
  scope: SignalScope;
  organizationId: string;
  classId?: string;
  studentId?: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendedActionIds: string[];
  detectedAt: string;
};

const W_LONG_DAYS = 42;
const W_RECENT_DAYS = 14;
const CACHE_TTL_MS = 60_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const severityPriority: Record<SignalSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const cacheByOrganization = new Map<
  string,
  { expiresAt: number; signals: Signal[] }
>();

const recommendedActionsByType: Record<SignalType, string[]> = {
  attendance_drop: [
    "signal_intervention_plan",
    "signal_cause_analysis",
    "signal_parent_message",
  ],
  repeated_absence: ["signal_parent_message", "signal_intervention_plan"],
  report_delay: ["signal_cause_analysis", "signal_intervention_plan"],
  unusual_presence_pattern: [
    "signal_cause_analysis",
    "signal_intervention_plan",
  ],
  engagement_risk: [
    "signal_intervention_plan",
    "signal_parent_message",
    "signal_cause_analysis",
  ],
};

const toIsoDateUtc = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
};

const parseDateOrNull = (value: string | undefined | null) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const utcDayStartMs = (isoDate: string) => {
  const parsed = Date.parse(`${isoDate}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFixed = (value: number) => Number(value.toFixed(3));

const average = (values: number[]) => {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const dedupeSignalKey = (signal: Signal) =>
  `${signal.type}:${signal.organizationId}:${signal.classId ?? "__none__"}:${signal.studentId ?? "__none__"}`;

const buildSignalId = (params: {
  type: SignalType;
  organizationId: string;
  classId?: string;
  studentId?: string;
}) =>
  `${params.type}:${params.organizationId}:${params.classId ?? "__none__"}:${params.studentId ?? "__none__"}`;

const sortSignals = (signals: Signal[]) =>
  [...signals].sort((left, right) => {
    const severityDiff =
      severityPriority[right.severity] - severityPriority[left.severity];
    if (severityDiff !== 0) return severityDiff;
    return String(right.detectedAt).localeCompare(String(left.detectedAt));
  });

const dedupeSignals = (signals: Signal[]) => {
  const map = new Map<string, Signal>();
  for (const signal of sortSignals(signals)) {
    const key = dedupeSignalKey(signal);
    if (!map.has(key)) {
      map.set(key, signal);
    }
  }
  return sortSignals(Array.from(map.values()));
};

const getNowContext = (nowIso?: string) => {
  const nowMs = parseDateOrNull(nowIso) ?? Date.now();
  const now = new Date(nowMs);
  const nowValue = now.toISOString();
  const longFromIso = new Date(nowMs - W_LONG_DAYS * MS_PER_DAY).toISOString();
  const recentFromIso = new Date(
    nowMs - W_RECENT_DAYS * MS_PER_DAY
  ).toISOString();
  const prevFromIso = new Date(
    nowMs - W_RECENT_DAYS * 2 * MS_PER_DAY
  ).toISOString();
  return { now, nowIso: nowValue, nowMs, longFromIso, recentFromIso, prevFromIso };
};

const buildAttendanceDropSignals = (params: {
  organizationId: string;
  nowIso: string;
  recentFromIso: string;
  prevFromIso: string;
  sessionLogs: Awaited<ReturnType<typeof getSessionLogsByRange>>;
  classesById: Map<string, { name: string }>;
}): Signal[] => {
  const logsByClass = new Map<string, typeof params.sessionLogs>();

  for (const row of params.sessionLogs) {
    const classRows = logsByClass.get(row.classId) ?? [];
    classRows.push(row);
    logsByClass.set(row.classId, classRows);
  }

  const signals: Signal[] = [];
  for (const [classId, rows] of logsByClass.entries()) {
    if (rows.length < 4) continue;

    const recentValues = rows
      .filter((item) => item.createdAt >= params.recentFromIso)
      .map((item) => Number(item.attendance || 0))
      .filter((value) => Number.isFinite(value));
    const previousValues = rows
      .filter(
        (item) =>
          item.createdAt >= params.prevFromIso &&
          item.createdAt < params.recentFromIso
      )
      .map((item) => Number(item.attendance || 0))
      .filter((value) => Number.isFinite(value));

    if (!recentValues.length || !previousValues.length) continue;

    const avgRecent = average(recentValues);
    const avgPrev = average(previousValues);
    if (avgRecent === null || avgPrev === null) continue;

    const drop = avgPrev - avgRecent;
    if (!(avgRecent <= 0.72 && drop >= 0.1)) continue;

    const severity: SignalSeverity =
      drop >= 0.15 || avgRecent < 0.65 ? "high" : "medium";
    const className = params.classesById.get(classId)?.name ?? "Turma";
    const latestDetectedAt =
      rows
        .map((item) => item.createdAt)
        .sort((a, b) => b.localeCompare(a))[0] ?? params.nowIso;

    signals.push({
      id: buildSignalId({ type: "attendance_drop", organizationId: params.organizationId, classId }),
      type: "attendance_drop",
      severity,
      scope: "class",
      organizationId: params.organizationId,
      classId,
      title: `Queda de presença na turma ${className}`,
      summary: `Média recente ${toFixed(avgRecent)} vs anterior ${toFixed(avgPrev)} (queda ${toFixed(drop)}).`,
      evidence: {
        avgRecent: toFixed(avgRecent),
        avgPrev: toFixed(avgPrev),
        drop: toFixed(drop),
        recentSamples: recentValues.length,
        previousSamples: previousValues.length,
      },
      recommendedActionIds: recommendedActionsByType.attendance_drop,
      detectedAt: latestDetectedAt,
    });
  }

  return signals;
};

const buildRepeatedAbsenceSignals = (params: {
  organizationId: string;
  nowMs: number;
  nowIso: string;
  attendanceLogs: Awaited<ReturnType<typeof getAttendanceAll>>;
  studentsById: Map<string, { name: string; classId: string }>;
}): Signal[] => {
  const logsByStudent = new Map<string, typeof params.attendanceLogs>();
  for (const row of params.attendanceLogs) {
    const studentRows = logsByStudent.get(row.studentId) ?? [];
    studentRows.push(row);
    logsByStudent.set(row.studentId, studentRows);
  }

  const signals: Signal[] = [];
  for (const [studentId, rows] of logsByStudent.entries()) {
    const sorted = [...rows].sort((a, b) => {
      const dateDiff = String(b.date).localeCompare(String(a.date));
      if (dateDiff !== 0) return dateDiff;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });

    let streak = 0;
    for (const row of sorted) {
      if (row.status !== "faltou") break;
      streak += 1;
    }
    if (streak < 3) continue;

    const third = sorted[2];
    const thirdMs = utcDayStartMs(third.date);
    if (thirdMs === null) continue;
    if (params.nowMs - thirdMs > 30 * MS_PER_DAY) continue;

    const severity: SignalSeverity = streak >= 4 ? "high" : "medium";
    const student = params.studentsById.get(studentId);
    const latestDate = sorted[0]?.date;
    const detectedAt = latestDate
      ? `${latestDate}T00:00:00.000Z`
      : params.nowIso;

    signals.push({
      id: buildSignalId({
        type: "repeated_absence",
        organizationId: params.organizationId,
        classId: student?.classId,
        studentId,
      }),
      type: "repeated_absence",
      severity,
      scope: "student",
      organizationId: params.organizationId,
      classId: student?.classId,
      studentId,
      title: `Faltas consecutivas de ${student?.name ?? "aluno"}`,
      summary: `${streak} faltas seguidas em até 30 dias.`,
      evidence: {
        streak,
        latestDate,
        oldestDateInWindow: third.date,
      },
      recommendedActionIds: recommendedActionsByType.repeated_absence,
      detectedAt,
    });
  }

  return signals;
};

const buildReportDelaySignals = (params: {
  organizationId: string;
  nowMs: number;
  nowIso: string;
  pendingReports: Awaited<ReturnType<typeof listAdminPendingSessionLogs>>;
}): Signal[] => {
  const signals: Signal[] = [];
  for (const item of params.pendingReports) {
    const lastReportMs = parseDateOrNull(item.lastReportAt);
    const daysWithoutReport =
      lastReportMs === null
        ? null
        : Math.floor((params.nowMs - lastReportMs) / MS_PER_DAY);
    const shouldCreate =
      item.lastReportAt === null ||
      (typeof daysWithoutReport === "number" && daysWithoutReport >= 7);
    if (!shouldCreate) continue;

    const severity: SignalSeverity =
      item.lastReportAt === null ||
      (typeof daysWithoutReport === "number" && daysWithoutReport >= 14)
        ? "high"
        : "medium";
    const detectedAt = item.lastReportAt ?? params.nowIso;

    signals.push({
      id: buildSignalId({
        type: "report_delay",
        organizationId: params.organizationId,
        classId: item.classId,
      }),
      type: "report_delay",
      severity,
      scope: "class",
      organizationId: params.organizationId,
      classId: item.classId,
      title: `Relatório em atraso: ${item.className}`,
      summary:
        daysWithoutReport === null
          ? "Turma sem relatório recente registrado."
          : `${daysWithoutReport} dias sem relatório da turma.`,
      evidence: {
        className: item.className,
        unit: item.unit,
        periodStart: item.periodStart,
        lastReportAt: item.lastReportAt,
        daysWithoutReport,
      },
      recommendedActionIds: recommendedActionsByType.report_delay,
      detectedAt,
    });
  }
  return signals;
};

const buildUnusualPresenceSignals = (params: {
  organizationId: string;
  nowIso: string;
  checkins: Awaited<ReturnType<typeof listCheckinsByRange>>;
  classesById: Map<string, { name: string }>;
}): Signal[] => {
  const byClassAndDay = new Map<string, Map<string, number>>();

  for (const row of params.checkins) {
    if (!row.classId) continue;
    const day = toIsoDateUtc(row.checkedInAt);
    if (!day) continue;
    const byDay = byClassAndDay.get(row.classId) ?? new Map<string, number>();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    byClassAndDay.set(row.classId, byDay);
  }

  const signals: Signal[] = [];
  for (const [classId, byDay] of byClassAndDay.entries()) {
    const dayEntries = Array.from(byDay.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    const counts = dayEntries.map((entry) => entry[1]);
    if (counts.length < 3) continue;
    const historicalMedian = median(counts);
    if (historicalMedian === null || historicalMedian < 6) continue;

    const [latestDate, latestCount] = dayEntries[dayEntries.length - 1];
    let severity: SignalSeverity | null = null;
    if (latestCount <= historicalMedian * 0.4) severity = "high";
    else if (latestCount <= historicalMedian * 0.6) severity = "medium";
    if (!severity) continue;

    const className = params.classesById.get(classId)?.name ?? "Turma";
    signals.push({
      id: buildSignalId({
        type: "unusual_presence_pattern",
        organizationId: params.organizationId,
        classId,
      }),
      type: "unusual_presence_pattern",
      severity,
      scope: "class",
      organizationId: params.organizationId,
      classId,
      title: `Padrão atípico de presença NFC em ${className}`,
      summary: `Último dia com ${latestCount} check-ins vs mediana ${toFixed(historicalMedian)}.`,
      evidence: {
        latestDate,
        latestCount,
        median: toFixed(historicalMedian),
        sampleDays: counts.length,
      },
      recommendedActionIds: recommendedActionsByType.unusual_presence_pattern,
      detectedAt: `${latestDate}T00:00:00.000Z`,
    });
  }

  return signals;
};

const buildEngagementRiskSignal = (params: {
  organizationId: string;
  nowIso: string;
  currentSignals: Signal[];
}) => {
  const attendanceDropCount = params.currentSignals.filter(
    (item) =>
      item.type === "attendance_drop" &&
      (item.severity === "high" || item.severity === "medium")
  ).length;
  const repeatedAbsenceCount = params.currentSignals.filter(
    (item) => item.type === "repeated_absence"
  ).length;
  const reportDelayCount = params.currentSignals.filter(
    (item) => item.type === "report_delay"
  ).length;

  const conditionA = attendanceDropCount >= 2;
  const conditionB = repeatedAbsenceCount >= 5;
  const conditionC = attendanceDropCount >= 1 && reportDelayCount >= 3;
  const conditionsMet = [conditionA, conditionB, conditionC].filter(Boolean)
    .length;

  if (conditionsMet <= 0) return null;

  const severity: SignalSeverity = conditionsMet >= 2 ? "critical" : "high";
  return {
    id: buildSignalId({
      type: "engagement_risk",
      organizationId: params.organizationId,
    }),
    type: "engagement_risk" as const,
    severity,
    scope: "organization" as const,
    organizationId: params.organizationId,
    title: "Risco geral de engajamento",
    summary:
      conditionsMet >= 2
        ? "Risco alto: combinação de faltas, queda de presença e atrasos em relatórios."
        : "Risco elevado: um padrão forte de queda/atraso foi detectado.",
    evidence: {
      conditionsMet,
      attendanceDropCount,
      repeatedAbsenceCount,
      reportDelayCount,
    },
    recommendedActionIds: recommendedActionsByType.engagement_risk,
    detectedAt: params.nowIso,
  };
};

export const __clearSignalEngineCacheForTests = () => {
  cacheByOrganization.clear();
};

export async function getSignals(params: {
  organizationId: string;
  nowIso?: string;
}): Promise<Signal[]> {
  const organizationId = params.organizationId?.trim();
  if (!organizationId) return [];

  const now = getNowContext(params.nowIso);
  const cached = cacheByOrganization.get(organizationId);
  if (cached && cached.expiresAt > now.nowMs) {
    return cached.signals;
  }

  const [classes, students, attendanceLogs, sessionLogs, pendingReports, nfcCheckins] =
    await Promise.all([
      getClasses({ organizationId }),
      getStudents({ organizationId }),
      getAttendanceAll({ organizationId }),
      getSessionLogsByRange(now.longFromIso, now.nowIso, { organizationId }),
      listAdminPendingSessionLogs({ organizationId }),
      listCheckinsByRange({
        organizationId,
        fromIso: now.recentFromIso,
        toIso: now.nowIso,
      }),
    ]);

  const classesById = new Map(classes.map((item) => [item.id, { name: item.name }]));
  const studentsById = new Map(
    students.map((item) => [item.id, { name: item.name, classId: item.classId }])
  );

  const signals: Signal[] = [];
  signals.push(
    ...buildAttendanceDropSignals({
      organizationId,
      nowIso: now.nowIso,
      recentFromIso: now.recentFromIso,
      prevFromIso: now.prevFromIso,
      sessionLogs,
      classesById,
    })
  );
  signals.push(
    ...buildRepeatedAbsenceSignals({
      organizationId,
      nowMs: now.nowMs,
      nowIso: now.nowIso,
      attendanceLogs,
      studentsById,
    })
  );
  signals.push(
    ...buildReportDelaySignals({
      organizationId,
      nowMs: now.nowMs,
      nowIso: now.nowIso,
      pendingReports,
    })
  );
  signals.push(
    ...buildUnusualPresenceSignals({
      organizationId,
      nowIso: now.nowIso,
      checkins: nfcCheckins,
      classesById,
    })
  );

  const engagementRisk = buildEngagementRiskSignal({
    organizationId,
    nowIso: now.nowIso,
    currentSignals: signals,
  });
  if (engagementRisk) {
    signals.push(engagementRisk);
  }

  const finalSignals = dedupeSignals(signals);
  cacheByOrganization.set(organizationId, {
    expiresAt: now.nowMs + CACHE_TTL_MS,
    signals: finalSignals,
  });
  return finalSignals;
}
