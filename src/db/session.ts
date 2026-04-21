// ---------------------------------------------------------------------------
// Session logs + scouting logs domain module
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/react-native";
import type { ScoutingLog, SessionLog, StudentScoutingLog } from "../core/models";
import { getClassById } from "./classes";
import {
    getActiveOrganizationId,
    getScopedOrganizationId,
    isAuthError,
    isMissingRelation,
    isNetworkError,
    supabaseGet,
    supabasePatch,
    supabasePost,
} from "./client";
import {
    buildScoutingLogClientId,
    buildSessionLogClientId,
    buildStudentScoutingClientId,
    enqueueWrite,
} from "./nfc-sync";
import type { ScoutingLogRow, SessionLogRow, StudentScoutingRow } from "./row-types";
import { getTrainingPlans } from "./training";
import { resolveTrainingPlanForDate, syncTrainingSessionFromReport } from "./training-sessions";

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

const scoutingRowToLog = (row: ScoutingLogRow): ScoutingLog => ({
  id: row.id,
  classId: row.classid,
  unit: row.unit ?? "",
  mode: row.mode === "jogo" ? "jogo" : "treino",
  clientId: row.client_id ?? row.id,
  date: row.date,
  serve0: row.serve_0 ?? 0,
  serve1: row.serve_1 ?? 0,
  serve2: row.serve_2 ?? 0,
  receive0: row.receive_0 ?? 0,
  receive1: row.receive_1 ?? 0,
  receive2: row.receive_2 ?? 0,
  set0: row.set_0 ?? 0,
  set1: row.set_1 ?? 0,
  set2: row.set_2 ?? 0,
  attackSend0: row.attack_send_0 ?? 0,
  attackSend1: row.attack_send_1 ?? 0,
  attackSend2: row.attack_send_2 ?? 0,
  createdAt: row.createdat,
  updatedAt: row.updatedat ?? row.createdat,
});

const studentScoutingRowToLog = (row: StudentScoutingRow): StudentScoutingLog => ({
  id: row.id,
  studentId: row.studentid,
  classId: row.classid,
  date: row.date,
  serve0: row.serve_0 ?? 0,
  serve1: row.serve_1 ?? 0,
  serve2: row.serve_2 ?? 0,
  receive0: row.receive_0 ?? 0,
  receive1: row.receive_1 ?? 0,
  receive2: row.receive_2 ?? 0,
  set0: row.set_0 ?? 0,
  set1: row.set_1 ?? 0,
  set2: row.set_2 ?? 0,
  attackSend0: row.attack_send_0 ?? 0,
  attackSend1: row.attack_send_1 ?? 0,
  attackSend2: row.attack_send_2 ?? 0,
  createdAt: row.createdat,
  updatedAt: row.updatedat ?? row.createdat,
});

// ---------------------------------------------------------------------------
// Scouting logs
// ---------------------------------------------------------------------------

export async function getScoutingLogByDate(
  classId: string,
  date: string,
  mode: "treino" | "jogo" = "treino",
  options: { organizationId?: string | null } = {}
): Promise<ScoutingLog | null> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<ScoutingLogRow[]>(
      organizationId
        ? `/scouting_logs?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&date=eq.${encodeURIComponent(date)}&mode=eq.${encodeURIComponent(mode)}&limit=1`
        : `/scouting_logs?select=*&classid=eq.${encodeURIComponent(classId)}&date=eq.${encodeURIComponent(date)}&mode=eq.${encodeURIComponent(mode)}&limit=1`
    );
    const row = rows[0];
    return row ? scoutingRowToLog(row) : null;
  } catch (error) {
    if (isMissingRelation(error, "scouting_logs")) return null;
    if (isAuthError(error)) return null;
    if (isNetworkError(error)) return null;
    throw error;
  }
}

export async function getLatestScoutingLog(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<ScoutingLog | null> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<ScoutingLogRow[]>(
      organizationId
        ? `/scouting_logs?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc&limit=1`
        : `/scouting_logs?select=*&classid=eq.${encodeURIComponent(classId)}&order=date.desc&limit=1`
    );
    const row = rows[0];
    return row ? scoutingRowToLog(row) : null;
  } catch (error) {
    if (isMissingRelation(error, "scouting_logs")) return null;
    if (isAuthError(error)) return null;
    throw error;
  }
}

export async function saveScoutingLog(
  log: ScoutingLog,
  options?: { allowQueue?: boolean; organizationId?: string }
): Promise<ScoutingLog> {
  const allowQueue = options?.allowQueue !== false;
  try {
    const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
    const now = new Date().toISOString();
    const mode = log.mode === "jogo" ? "jogo" : "treino";
    const clientId = buildScoutingLogClientId(log);
    const logId = log.id?.trim() || clientId;
    const payload = {
      id: logId,
      client_id: clientId,
      classid: log.classId,
      organization_id: organizationId ?? undefined,
      unit: log.unit ?? null,
      mode,
      date: log.date,
      serve_0: log.serve0,
      serve_1: log.serve1,
      serve_2: log.serve2,
      receive_0: log.receive0,
      receive_1: log.receive1,
      receive_2: log.receive2,
      set_0: log.set0,
      set_1: log.set1,
      set_2: log.set2,
      attack_send_0: log.attackSend0,
      attack_send_1: log.attackSend1,
      attack_send_2: log.attackSend2,
      createdat: log.createdAt || now,
      updatedat: now,
    };

    await supabasePost(
      "/scouting_logs?on_conflict=id",
      [payload],
      { Prefer: "resolution=merge-duplicates" }
    );
    return {
      ...log,
      id: logId,
      clientId,
      mode,
      createdAt: payload.createdat,
      updatedAt: now,
    };
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({
        id: "queue_scout_" + Date.now(),
        kind: "scouting_log",
        payload: { ...log, id: log.id || "", clientId: log.clientId || "" },
        createdAt: new Date().toISOString(),
      });
      return { ...log };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Student scouting logs
// ---------------------------------------------------------------------------

export async function getStudentScoutingByRange(
  classId: string,
  startIso: string,
  endIso: string
): Promise<StudentScoutingLog[]> {
  try {
    const rows = await supabaseGet<StudentScoutingRow[]>(
      "/student_scouting_logs?select=*&classid=eq." +
        encodeURIComponent(classId) +
        "&date=gte." +
        encodeURIComponent(startIso) +
        "&date=lt." +
        encodeURIComponent(endIso)
    );
    return rows.map(studentScoutingRowToLog);
  } catch (error) {
    if (isMissingRelation(error, "student_scouting_logs")) return [];
    throw error;
  }
}

export async function getStudentScoutingByDate(
  studentId: string,
  classId: string,
  date: string
): Promise<StudentScoutingLog | null> {
  try {
    const rows = await supabaseGet<StudentScoutingRow[]>(
      "/student_scouting_logs?select=*&studentid=eq." +
        encodeURIComponent(studentId) +
        "&classid=eq." +
        encodeURIComponent(classId) +
        "&date=eq." +
        encodeURIComponent(date) +
        "&limit=1"
    );
    const row = rows[0];
    return row ? studentScoutingRowToLog(row) : null;
  } catch (error) {
    if (isMissingRelation(error, "student_scouting_logs")) return null;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("22P02") || message.includes("invalid input syntax for type uuid")) return null;
    throw error;
  }
}

export async function saveStudentScoutingLog(
  log: StudentScoutingLog,
  options?: { allowQueue?: boolean }
) {
  const allowQueue = options?.allowQueue !== false;
  try {
    const now = new Date().toISOString();
    const clientId = buildStudentScoutingClientId(log);
    const logId = log.id?.trim() || clientId;
    const payload = {
      id: logId,
      studentid: log.studentId,
      classid: log.classId,
      date: log.date,
      serve_0: log.serve0,
      serve_1: log.serve1,
      serve_2: log.serve2,
      receive_0: log.receive0,
      receive_1: log.receive1,
      receive_2: log.receive2,
      set_0: log.set0,
      set_1: log.set1,
      set_2: log.set2,
      attack_send_0: log.attackSend0,
      attack_send_1: log.attackSend1,
      attack_send_2: log.attackSend2,
      createdat: log.createdAt || now,
      updatedat: now,
    };

    await supabasePost(
      "/student_scouting_logs?on_conflict=id",
      [payload],
      { Prefer: "resolution=merge-duplicates" }
    );
    return { ...log, id: logId, createdAt: payload.createdat, updatedAt: now };
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({
        id: "queue_student_scout_" + Date.now(),
        kind: "student_scouting_log",
        payload: { ...log, id: log.id || "" },
        createdAt: new Date().toISOString(),
      });
      return { ...log };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Session logs
// ---------------------------------------------------------------------------

export async function saveSessionLog(
  log: SessionLog,
  options?: { allowQueue?: boolean; organizationId?: string }
) {
  const allowQueue = options?.allowQueue !== false;
  const clientId = buildSessionLogClientId(log);
  const logId = log.id?.trim() || clientId;
  const shouldPatchById = !!log.id?.trim() && !log.clientId?.trim();
  const pseValue =
    typeof (log as { PSE?: number }).PSE === "number"
      ? (log as { PSE?: number }).PSE
      : (log as { rpe?: number }).rpe ?? 0;
  const activity = log.activity?.trim() || null;
  const conclusion = log.conclusion?.trim() || null;
  const photos = log.photos?.trim() || null;
  const participantsCount =
    typeof log.participantsCount === "number" &&
    Number.isFinite(log.participantsCount) &&
    log.participantsCount >= 0
      ? Math.round(log.participantsCount)
      : null;

  try {
    const organizationId = options?.organizationId ?? (await getActiveOrganizationId());

    if (shouldPatchById) {
      await supabasePatch(
        organizationId
          ? "/session_logs?id=eq." +
              encodeURIComponent(log.id || "") +
              "&organization_id=eq." +
              encodeURIComponent(organizationId)
          : "/session_logs?id=eq." + encodeURIComponent(log.id || ""),
        {
          client_id: clientId,
          classid: log.classId,
          organization_id: organizationId ?? undefined,
          rpe: pseValue,
          technique: log.technique,
          attendance: log.attendance,
          activity,
          conclusion,
          participants_count: participantsCount,
          photos,
          pain_score: log.painScore ?? null,
          createdat: log.createdAt,
        }
      );
    } else {
      await supabasePost(
        "/session_logs?on_conflict=client_id",
        [
          {
            id: logId,
            client_id: clientId,
            classid: log.classId,
            organization_id: organizationId ?? undefined,
            rpe: pseValue,
            technique: log.technique,
            attendance: log.attendance,
            activity,
            conclusion,
            participants_count: participantsCount,
            photos,
            pain_score: log.painScore ?? null,
            createdat: log.createdAt,
          },
        ],
        { Prefer: "resolution=merge-duplicates" }
      );
    }

    try {
      const [classInfo, plans] = await Promise.all([
        getClassById(log.classId, { organizationId }),
        getTrainingPlans({ organizationId, classId: log.classId }),
      ]);
      if (classInfo) {
        const plan = resolveTrainingPlanForDate(
          plans,
          classInfo.id,
          (log.createdAt ?? new Date().toISOString()).slice(0, 10)
        );
        await syncTrainingSessionFromReport({
          classInfo,
          createdAt: log.createdAt ?? new Date().toISOString(),
          report: {
            activity,
            conclusion,
            PSE: pseValue,
            attendance: log.attendance,
            participantsCount: participantsCount ?? undefined,
            photos,
          },
          plan,
          organizationId,
        });
      }
    } catch {
      // best-effort compatibility layer; legacy report save already succeeded
    }
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({
        id: "queue_log_" + Date.now(),
        kind: "session_log",
        payload: { ...log, id: logId, clientId },
        createdAt: new Date().toISOString(),
      });
      return;
    }
    throw error;
  }
}

export async function getSessionLogByDate(
  classId: string,
  date: string,
  options: { organizationId?: string | null } = {}
): Promise<SessionLog | null> {
  try {
    const start = `${date}T00:00:00.000Z`;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<SessionLogRow[]>(
      organizationId
        ? `/session_logs?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&createdat=gte.${encodeURIComponent(start)}&createdat=lt.${encodeURIComponent(end.toISOString())}&order=client_id.desc.nullslast,createdat.desc&limit=1`
        : `/session_logs?select=*&classid=eq.${encodeURIComponent(classId)}&createdat=gte.${encodeURIComponent(start)}&createdat=lt.${encodeURIComponent(end.toISOString())}&order=client_id.desc.nullslast,createdat.desc&limit=1`
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      clientId: row.client_id ?? row.id,
      classId: row.classid,
      PSE: row.rpe,
      technique: (["boa", "ok", "ruim", "nenhum"].includes(row.technique ?? "") ? row.technique : "boa") as "boa" | "ok" | "ruim" | "nenhum",
      attendance: row.attendance,
      activity: row.activity ?? "",
      conclusion: row.conclusion ?? "",
      participantsCount: row.participants_count ?? 0,
      photos: row.photos ?? "",
      painScore: row.pain_score ?? 0,
      createdAt: row.createdat,
    };
  } catch (error) {
    if (isAuthError(error)) return null;
    if (isNetworkError(error)) return null;
    throw error;
  }
}

export async function getSessionLogsByRange(
  startIso: string,
  endIso: string,
  options: { organizationId?: string | null } = {}
): Promise<SessionLog[]> {
  const startedAt = Date.now();
  const organizationId = await getScopedOrganizationId(
    options.organizationId,
    "getSessionLogsByRange"
  );
  if (!organizationId) return [];
  const rows = await supabaseGet<SessionLogRow[]>(
    `/session_logs?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&createdat=gte.${encodeURIComponent(startIso)}&createdat=lt.${encodeURIComponent(endIso)}`
  );
  const mapped = rows.map((row) => ({
    id: row.id,
    clientId: row.client_id ?? row.id,
    classId: row.classid,
    PSE: row.rpe,
    technique: (["boa", "ok", "ruim", "nenhum"].includes(row.technique ?? "") ? row.technique : "boa") as "boa" | "ok" | "ruim" | "nenhum",
    attendance: row.attendance,
    activity: row.activity ?? "",
    conclusion: row.conclusion ?? "",
    participantsCount: row.participants_count ?? 0,
    photos: row.photos ?? "",
    painScore: row.pain_score ?? 0,
    createdAt: row.createdat,
  }));
  Sentry.addBreadcrumb({
    category: "sqlite-query",
    message: "getSessionLogsByRange",
    level: "info",
    data: { ms: Date.now() - startedAt, rows: mapped.length },
  });
  return mapped;
}

export async function getSessionLogsByClass(
  classId: string,
  options: {
    organizationId?: string | null;
    startIso?: string | null;
    endIso?: string | null;
    limit?: number;
  } = {}
): Promise<SessionLog[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const query = [
      "select=*",
      `classid=eq.${encodeURIComponent(classId)}`,
      organizationId ? `organization_id=eq.${encodeURIComponent(organizationId)}` : "",
      options.startIso ? `createdat=gte.${encodeURIComponent(options.startIso)}` : "",
      options.endIso ? `createdat=lt.${encodeURIComponent(options.endIso)}` : "",
      "order=createdat.desc",
      typeof options.limit === "number" && options.limit > 0
        ? `limit=${Math.floor(options.limit)}`
        : "",
    ]
      .filter(Boolean)
      .join("&");
    const rows = await supabaseGet<SessionLogRow[]>(`/session_logs?${query}`);
    return rows.map((row) => ({
      id: row.id,
      clientId: row.client_id ?? row.id,
      classId: row.classid,
      PSE: row.rpe,
      technique: (["boa", "ok", "ruim", "nenhum"].includes(row.technique ?? "")
        ? row.technique
        : "boa") as "boa" | "ok" | "ruim" | "nenhum",
      attendance: row.attendance,
      activity: row.activity ?? "",
      conclusion: row.conclusion ?? "",
      participantsCount: row.participants_count ?? 0,
      photos: row.photos ?? "",
      painScore: row.pain_score ?? 0,
      createdAt: row.createdat,
    }));
  } catch (error) {
    if (isMissingRelation(error, "session_logs")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    throw error;
  }
}
