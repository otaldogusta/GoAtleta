// ---------------------------------------------------------------------------
// Training sessions (multi-class) domain module
// ---------------------------------------------------------------------------

import type {
  AttendanceRecord,
  ClassGroup,
  TrainingPlan,
  TrainingSession,
  TrainingSessionAttendance,
  TrainingSessionIntegrationRule,
  TrainingSessionSource,
  TrainingSessionStatus,
  TrainingSessionType,
} from "../core/models";
import {
  getActiveOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  supabaseDelete,
  supabaseGet,
  supabasePost,
} from "./client";
import type {
  TrainingSessionAttendanceRow,
  TrainingSessionClassRow,
  TrainingSessionIntegrationRuleRpcRow,
  TrainingSessionRow,
} from "./row-types";

type TrainingSessionSyncParams = {
  classIds: string[];
  startAt: string;
  endAt: string;
  title?: string | null;
  description?: string | null;
  status?: TrainingSessionStatus;
  type?: TrainingSessionType;
  source?: TrainingSessionSource;
  planId?: string | null;
  organizationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  attendance?: TrainingSessionAttendance[];
};

type TrainingIntegrationRuleSyncParams = {
  sessionId: string;
  classIds: string[];
  startAt: string;
  endAt: string;
  organizationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const normalizeClassIds = (classIds: string[]) =>
  Array.from(
    new Set(
      classIds
        .map((classId) => String(classId ?? "").trim())
        .filter(Boolean)
    )
  ).sort();

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const buildTrainingIntegrationRuleId = (sessionId: string) => `tir_${hashString(sessionId)}`;

const buildTrainingIntegrationRuleClassId = (ruleId: string, classId: string) =>
  `trc_${hashString(`${ruleId}|${classId}`)}`;

export const buildTrainingSessionId = (params: {
  organizationId?: string | null;
  startAt: string;
  classIds: string[];
}) => {
  const classIds = normalizeClassIds(params.classIds);
  const key = [
    params.organizationId ?? "",
    params.startAt,
    classIds.join(","),
  ].join("|");
  return `ts_${hashString(key)}`;
};

export const buildTrainingSessionWindow = (
  date: string,
  startTime?: string | null,
  durationMinutes = 60
) => {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const resolvedStart = /^\d{2}:\d{2}$/.test(startTime ?? "")
    ? String(startTime)
    : "12:00";
  const parsedDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;
  const startAt = new Date(`${normalizedDate}T${resolvedStart}:00`).toISOString();
  const endAt = new Date(new Date(startAt).getTime() + parsedDuration * 60_000).toISOString();
  return { startAt, endAt };
};

export const resolveTrainingPlanForDate = (
  plans: TrainingPlan[],
  classId: string,
  date: string,
  weekdayId?: number
) => {
  const relevant = plans.filter((plan) => plan.classId === classId);
  if (!relevant.length) return null;
  const resolvedWeekday =
    typeof weekdayId === "number" && Number.isFinite(weekdayId)
      ? weekdayId
      : new Date(date).getDay();
  const normalizedWeekday = resolvedWeekday === 0 ? 7 : resolvedWeekday;
  const exactDate = relevant
    .filter((plan) => plan.applyDate === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (exactDate) return exactDate;
  return (
    relevant
      .filter((plan) => (plan.applyDays ?? []).includes(normalizedWeekday))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
};

const mapTrainingSessionRow = (
  row: TrainingSessionRow,
  classIds: string[] = []
): TrainingSession => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  title: row.title ?? "",
  description: row.description ?? "",
  startAt: row.start_at,
  endAt: row.end_at,
  status:
    row.status === "completed"
      ? "completed"
      : row.status === "cancelled"
        ? "cancelled"
        : "scheduled",
  type:
    row.type === "integration"
      ? "integration"
      : row.type === "event"
        ? "event"
        : row.type === "match"
          ? "match"
          : "training",
  source:
    row.source === "plan"
      ? "plan"
      : row.source === "import"
        ? "import"
        : "manual",
  planId: row.plan_id ?? null,
  classIds,
  createdAt: row.created_at ?? row.start_at,
  updatedAt: row.updated_at ?? row.created_at ?? row.start_at,
});

export const mapAttendanceRow = (row: TrainingSessionAttendanceRow): TrainingSessionAttendance => ({
  id: row.id,
  sessionId: row.session_id,
  studentId: row.student_id,
  classId: row.class_id,
  organizationId: row.organization_id ?? "",
  status: row.status === "absent" ? "absent" : "present",
  note: row.note ?? "",
  painScore: row.pain_score ?? 0,
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
});

const mapTrainingIntegrationRuleRow = (
  row: TrainingSessionIntegrationRuleRpcRow,
  classIds: string[] = []
): TrainingSessionIntegrationRule => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  sourceSessionId: row.source_session_id,
  startAt: row.start_at,
  endAt: row.end_at,
  classCount: row.class_count ?? classIds.length,
  classIds,
  createdAt: row.created_at ?? row.start_at,
  updatedAt: row.updated_at ?? row.created_at ?? row.start_at,
});

export async function getTrainingIntegrationRules(
  options: { organizationId?: string | null } = {}
): Promise<TrainingSessionIntegrationRule[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return [];
    const rules = await supabasePost<TrainingSessionIntegrationRuleRpcRow[]>(
      "/rpc/get_training_integration_rules",
      {
        _organization_id: organizationId,
      }
    );
    if (!rules.length) return [];
    return rules.map((row) => mapTrainingIntegrationRuleRow(row, row.class_ids ?? []));
  } catch (error) {
    if (
      isMissingRelation(error, "training_session_integration_rules") ||
      isMissingRelation(error, "training_session_integration_rule_classes")
    ) {
      return [];
    }
    if (isAuthError(error) || isNetworkError(error)) return [];
    return [];
  }
}

const buildSessionFilter = (sessionId: string, organizationId?: string | null) =>
  `/training_session_classes?session_id=eq.${encodeURIComponent(sessionId)}` +
  (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "");

const buildAttendanceFilter = (sessionId: string, organizationId?: string | null) =>
  `/training_session_attendance?session_id=eq.${encodeURIComponent(sessionId)}` +
  (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "");

const buildIntegrationRuleFilter = (ruleId: string, organizationId?: string | null) =>
  `/training_session_integration_rule_classes?rule_id=eq.${encodeURIComponent(ruleId)}` +
  (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "");

export async function syncTrainingIntegrationRuleFromSession(
  params: TrainingIntegrationRuleSyncParams
): Promise<TrainingSessionIntegrationRule | null> {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  const classIds = normalizeClassIds(params.classIds);
  const ruleId = buildTrainingIntegrationRuleId(params.sessionId);
  if (!organizationId) return null;

  try {
    if (classIds.length < 2) {
      await supabaseDelete(buildIntegrationRuleFilter(ruleId, organizationId));
      await supabaseDelete(
        `/training_session_integration_rules?id=eq.${encodeURIComponent(ruleId)}` +
          `&organization_id=eq.${encodeURIComponent(organizationId)}`
      );
      return null;
    }

    const nowIso = new Date().toISOString();
    await supabasePost(
      "/training_session_integration_rules?on_conflict=id",
      [
        {
          id: ruleId,
          organization_id: organizationId,
          source_session_id: params.sessionId,
          start_at: params.startAt,
          end_at: params.endAt,
          class_count: classIds.length,
          created_at: params.createdAt ?? nowIso,
          updated_at: params.updatedAt ?? nowIso,
        },
      ],
      { Prefer: "resolution=merge-duplicates" }
    );

    await supabaseDelete(buildIntegrationRuleFilter(ruleId, organizationId));
    await supabasePost(
      "/training_session_integration_rule_classes",
      classIds.map((classId) => ({
        id: buildTrainingIntegrationRuleClassId(ruleId, classId),
        rule_id: ruleId,
        class_id: classId,
        organization_id: organizationId,
        created_at: params.createdAt ?? nowIso,
      })),
      { Prefer: "resolution=merge-duplicates" }
    );

    return mapTrainingIntegrationRuleRow(
      {
        id: ruleId,
        organization_id: organizationId,
        source_session_id: params.sessionId,
        start_at: params.startAt,
        end_at: params.endAt,
        class_count: classIds.length,
        created_at: params.createdAt ?? nowIso,
        updated_at: params.updatedAt ?? nowIso,
      },
      classIds
    );
  } catch (error) {
    if (
      isMissingRelation(error, "training_session_integration_rules") ||
      isMissingRelation(error, "training_session_integration_rule_classes")
    ) {
      return null;
    }
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function deleteTrainingIntegrationRuleBySession(
  sessionId: string,
  options: { organizationId?: string | null } = {}
) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return;
  const ruleId = buildTrainingIntegrationRuleId(sessionId);
  try {
    await supabaseDelete(buildIntegrationRuleFilter(ruleId, organizationId));
    await supabaseDelete(
      `/training_session_integration_rules?id=eq.${encodeURIComponent(ruleId)}` +
        `&organization_id=eq.${encodeURIComponent(organizationId)}`
    );
  } catch (error) {
    if (isMissingRelation(error, "training_session_integration_rules")) return;
    if (isMissingRelation(error, "training_session_integration_rule_classes")) return;
    throw error;
  }
}

export async function upsertTrainingSession(params: TrainingSessionSyncParams) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  const classIds = normalizeClassIds(params.classIds);
  if (!classIds.length) return null;
  const nowIso = new Date().toISOString();
  const sessionId = buildTrainingSessionId({
    organizationId,
    startAt: params.startAt,
    classIds,
  });
  const sessionPayload = {
    id: sessionId,
    organization_id: organizationId ?? undefined,
    title: params.title?.trim() || null,
    description: params.description?.trim() || null,
    start_at: params.startAt,
    end_at: params.endAt,
    status: params.status ?? "scheduled",
    type:
      params.type ?? (classIds.length > 1 ? "integration" : "training"),
    source: params.source ?? (params.planId ? "plan" : "manual"),
    plan_id: params.planId ?? null,
    created_at: params.createdAt ?? nowIso,
    updated_at: params.updatedAt ?? nowIso,
  };

  try {
    await supabasePost(
      "/training_sessions?on_conflict=id",
      [sessionPayload],
      { Prefer: "resolution=merge-duplicates" }
    );

    await supabaseDelete(buildSessionFilter(sessionId, organizationId));
    if (classIds.length) {
      await supabasePost(
        "/training_session_classes",
        classIds.map((classId) => ({
          id: `tsc_${hashString(`${sessionId}|${classId}`)}`,
          session_id: sessionId,
          class_id: classId,
          organization_id: organizationId ?? undefined,
          created_at: params.createdAt ?? nowIso,
        })),
        { Prefer: "resolution=merge-duplicates" }
      );
    }

    await supabaseDelete(buildAttendanceFilter(sessionId, organizationId));
    if (params.attendance?.length) {
      await supabasePost(
        "/training_session_attendance",
        params.attendance.map((item) => ({
          id: `tsa_${hashString(`${sessionId}|${item.studentId}`)}`,
          session_id: sessionId,
          student_id: item.studentId,
          class_id: item.classId,
          organization_id: item.organizationId || organizationId || undefined,
          status: item.status === "absent" ? "absent" : "present",
          note: item.note?.trim() || null,
          pain_score:
            typeof item.painScore === "number" && Number.isFinite(item.painScore)
              ? item.painScore
              : null,
          created_at: item.createdAt ?? nowIso,
          updated_at: item.updatedAt ?? nowIso,
        })),
        { Prefer: "resolution=merge-duplicates" }
      );
    }

    if (classIds.length > 1) {
      await syncTrainingIntegrationRuleFromSession({
        sessionId,
        classIds,
        startAt: params.startAt,
        endAt: params.endAt,
        organizationId,
        createdAt: params.createdAt ?? nowIso,
        updatedAt: params.updatedAt ?? nowIso,
      });
    } else {
      await deleteTrainingIntegrationRuleBySession(sessionId, { organizationId });
    }

    return mapTrainingSessionRow(
      {
        ...sessionPayload,
        organization_id: sessionPayload.organization_id ?? null,
        title: sessionPayload.title ?? null,
        description: sessionPayload.description ?? null,
        created_at: sessionPayload.created_at ?? null,
        updated_at: sessionPayload.updated_at ?? null,
      },
      classIds
    );
  } catch (error) {
    if (
      isMissingRelation(error, "training_sessions") ||
      isMissingRelation(error, "training_session_classes") ||
      isMissingRelation(error, "training_session_attendance")
    ) {
      return null;
    }
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function syncTrainingSessionFromAttendance(params: {
  classInfo: ClassGroup;
  date: string;
  records: AttendanceRecord[];
  plan?: TrainingPlan | null;
  organizationId?: string | null;
}) {
  const startAt = buildTrainingSessionWindow(
    params.date,
    params.classInfo.startTime,
    params.classInfo.durationMinutes
  ).startAt;
  const endAt = buildTrainingSessionWindow(
    params.date,
    params.classInfo.startTime,
    params.classInfo.durationMinutes
  ).endAt;
  const title = params.plan?.title?.trim() || params.classInfo.name;
  const description =
    params.plan
      ? [
          params.plan.warmup?.filter(Boolean).slice(0, 2).join(" / "),
          params.plan.main?.filter(Boolean).slice(0, 2).join(" / "),
          params.plan.cooldown?.filter(Boolean).slice(0, 1).join(" / "),
        ]
          .filter(Boolean)
          .join(" • ")
      : `Chamada registrada em ${params.date}`;
  return upsertTrainingSession({
    classIds: [params.classInfo.id],
    startAt,
    endAt,
    title,
    description,
    status: "completed",
    type: "training",
    source: params.plan ? "plan" : "manual",
    planId: params.plan?.id ?? null,
    organizationId: params.organizationId ?? params.classInfo.organizationId,
    attendance: params.records.map((record) => ({
      id: record.id,
      sessionId: "",
      studentId: record.studentId,
      classId: record.classId,
      organizationId: params.organizationId ?? params.classInfo.organizationId,
      status: record.status === "faltou" ? "absent" : "present",
      note: record.note ?? "",
      painScore: record.painScore ?? 0,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    })),
  });
}

export async function syncTrainingSessionFromReport(params: {
  classInfo: ClassGroup;
  createdAt: string;
  report: {
    activity?: string | null;
    conclusion?: string | null;
    PSE?: number;
    attendance?: number;
    participantsCount?: number;
    photos?: string | null;
  };
  plan?: TrainingPlan | null;
  organizationId?: string | null;
}) {
  const sessionDate = params.createdAt.slice(0, 10);
  const { startAt, endAt } = buildTrainingSessionWindow(
    sessionDate,
    params.classInfo.startTime,
    params.classInfo.durationMinutes
  );
  const title = params.plan?.title?.trim() || params.classInfo.name;
  const parts = [
    params.report.activity?.trim() || "",
    params.report.conclusion?.trim() || "",
    typeof params.report.PSE === "number" ? `PSE ${params.report.PSE}` : "",
    typeof params.report.attendance === "number" ? `Presença ${params.report.attendance}%` : "",
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" • ");
  return upsertTrainingSession({
    classIds: [params.classInfo.id],
    startAt,
    endAt,
    title,
    description: parts || `Relatório registrado em ${sessionDate}`,
    status: "completed",
    type: "training",
    source: params.plan ? "plan" : "manual",
    planId: params.plan?.id ?? null,
    organizationId: params.organizationId ?? params.classInfo.organizationId,
  });
}

export async function getTrainingSessionByDate(
  classId: string,
  date: string,
  options: { organizationId?: string | null } = {}
): Promise<TrainingSession | null> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const classLinks = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id&class_id=eq.${encodeURIComponent(
        classId
      )}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const sessionIds = Array.from(
      new Set(classLinks.map((item) => String(item.session_id ?? "").trim()).filter(Boolean))
    );
    if (!sessionIds.length) return null;
    const inFilter = sessionIds.map((item) => encodeURIComponent(item)).join(",");
    const sessionRows = await supabaseGet<TrainingSessionRow[]>(
      `/training_sessions?select=*&id=in.(${inFilter})` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const row = sessionRows.find((item) => item.start_at.slice(0, 10) === date) ?? sessionRows[0] ?? null;
    if (!row) return null;
    const allLinks = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id,class_id&session_id=eq.${encodeURIComponent(
        row.id
      )}` + (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    return mapTrainingSessionRow(
      row,
      allLinks.map((item) => item.class_id)
    );
  } catch (error) {
    if (isMissingRelation(error, "training_session_classes")) return null;
    if (isMissingRelation(error, "training_sessions")) return null;
    if (isAuthError(error) || isNetworkError(error)) return null;
    throw error;
  }
}

export async function getTrainingSessionsByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<TrainingSession[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const classLinks = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id&class_id=eq.${encodeURIComponent(
        classId
      )}` + (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const sessionIds = Array.from(
      new Set(classLinks.map((item) => String(item.session_id ?? "").trim()).filter(Boolean))
    );
    if (!sessionIds.length) return [];
    const inFilter = sessionIds.map((item) => encodeURIComponent(item)).join(",");
    const sessionRows = await supabaseGet<TrainingSessionRow[]>(
      `/training_sessions?select=*&id=in.(${inFilter})` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "") +
        "&order=start_at.desc"
    );
    const sessionClassRows = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id,class_id&session_id=in.(${inFilter})` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const classIdsBySession = new Map<string, string[]>();
    for (const link of sessionClassRows) {
      const key = String(link.session_id ?? "").trim();
      if (!key) continue;
      const list = classIdsBySession.get(key) ?? [];
      list.push(link.class_id);
      classIdsBySession.set(key, list);
    }
    return sessionRows.map((row) =>
      mapTrainingSessionRow(row, classIdsBySession.get(row.id) ?? [])
    );
  } catch (error) {
    if (isMissingRelation(error, "training_session_classes")) return [];
    if (isMissingRelation(error, "training_sessions")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    throw error;
  }
}

export async function deleteTrainingSessionsByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
) {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const classLinks = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id&class_id=eq.${encodeURIComponent(
        classId
      )}` + (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const sessionIds = Array.from(
      new Set(classLinks.map((item) => String(item.session_id ?? "").trim()).filter(Boolean))
    );
    if (!sessionIds.length) return;

    const idFilter = sessionIds.map((item) => encodeURIComponent(item)).join(",");
    await supabaseDelete(
      `/training_session_attendance?class_id=eq.${encodeURIComponent(classId)}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    await supabaseDelete(
      `/training_session_classes?class_id=eq.${encodeURIComponent(classId)}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );

    const remainingLinks = await supabaseGet<TrainingSessionClassRow[]>(
      `/training_session_classes?select=session_id&session_id=in.(${idFilter})` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
    const stillLinked = new Set(
      remainingLinks.map((item) => String(item.session_id ?? "").trim()).filter(Boolean)
    );

    const remainingSessionRows = sessionIds.length
      ? await supabaseGet<TrainingSessionRow[]>(
          `/training_sessions?select=*&id=in.(${idFilter})` +
            (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
        )
      : [];
    const classIdsBySession = new Map<string, string[]>();
    remainingLinks.forEach((link) => {
      const key = String(link.session_id ?? "").trim();
      if (!key) return;
      const list = classIdsBySession.get(key) ?? [];
      list.push(link.class_id);
      classIdsBySession.set(key, list);
    });
    for (const sessionRow of remainingSessionRows) {
      const linkedClassIds = classIdsBySession.get(sessionRow.id) ?? [];
      if (linkedClassIds.length > 1) {
        await syncTrainingIntegrationRuleFromSession({
          sessionId: sessionRow.id,
          classIds: linkedClassIds,
          startAt: sessionRow.start_at,
          endAt: sessionRow.end_at,
          organizationId: sessionRow.organization_id ?? organizationId,
          createdAt: sessionRow.created_at ?? undefined,
          updatedAt: sessionRow.updated_at ?? undefined,
        });
      } else {
        await deleteTrainingIntegrationRuleBySession(sessionRow.id, {
          organizationId: sessionRow.organization_id ?? organizationId,
        });
      }
    }

    const orphanIds = sessionIds.filter((sessionId) => !stillLinked.has(sessionId));
    if (!orphanIds.length) return;

    const orphanFilter = orphanIds.map((item) => encodeURIComponent(item)).join(",");
    await supabaseDelete(
      `/training_sessions?id=in.(${orphanFilter})` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "")
    );
  } catch (error) {
    if (isMissingRelation(error, "training_session_classes")) return;
    if (isMissingRelation(error, "training_sessions")) return;
    if (isMissingRelation(error, "training_session_attendance")) return;
    throw error;
  }
}

export async function getTrainingSessionAttendanceBySessionId(
  sessionId: string,
  options: { organizationId?: string | null } = {}
): Promise<TrainingSessionAttendance[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<TrainingSessionAttendanceRow[]>(
      `/training_session_attendance?session_id=eq.${encodeURIComponent(sessionId)}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "") +
        "&order=created_at.asc"
    );
    return rows.map(mapAttendanceRow);
  } catch (error) {
    if (isMissingRelation(error, "training_session_attendance")) return [];
    if (isMissingRelation(error, "training_sessions")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    throw error;
  }
}

export async function getTrainingSessionEvidenceByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<{ sessions: TrainingSession[]; attendance: TrainingSessionAttendance[] }> {
  const sessions = await getTrainingSessionsByClass(classId, options);
  if (!sessions.length) {
    return { sessions, attendance: [] };
  }

  const attendanceGroups = await Promise.all(
    sessions.map((session) => getTrainingSessionAttendanceBySessionId(session.id, options))
  );

  return {
    sessions,
    attendance: attendanceGroups.flat(),
  };
}
