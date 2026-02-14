import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { getSessionUserId, getValidAccessToken } from "../auth/session";
import { normalizeAgeBand, parseAgeBandRange } from "../core/age-band";
import { sortClassesBySchedule } from "../core/class-schedule-sort";
import type {
    AbsenceNotice,
    AttendanceRecord,
    ClassGroup,
    ClassPlan,
    Exercise,
    HiddenTemplate,
    ScoutingLog,
    SessionLog,
    Student,
    StudentScoutingLog,
    TrainingPlan,
    TrainingTemplate,
} from "../core/models";
import { normalizeUnitKey } from "../core/unit-key";
import { canonicalizeUnitLabel } from "../core/unit-label";
import { db } from "./sqlite";

const REST_BASE = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

const headers = async () => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const summarizeResponse = (text: string) => {
  if (!text) return "";
  const trimmed = text.trim();
  if (/^<!doctype|^<html/i.test(trimmed)) {
    return "HTML response";
  }
  return trimmed.replace(/\s+/g, " ").slice(0, 280);
};

const supabaseRequest = async (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
) => {
  const startedAt = Date.now();
  const res = await fetch(REST_BASE + path, {
    method,
    headers: {
      ...(await headers()),
      ...(extraHeaders ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ms = Date.now() - startedAt;
  const text = await res.text();
  const summary = summarizeResponse(text);
  const errorCategory =
    res.status === 401 || res.status === 403
      ? "auth"
      : res.status === 404
        ? "not_found"
        : "http_error";
  if (!res.ok) {
    Sentry.setContext("supabase_error", {
      category: errorCategory,
      status: res.status,
      method,
      path,
      ms,
    });
  } else {
    Sentry.setContext("supabase_error", null);
  }
  Sentry.addBreadcrumb({
    category: "supabase",
    message: `${method} ${path}`,
    level: res.ok ? "info" : "error",
    data: {
      status: res.status,
      ms,
      response: summary || undefined,
      errorCategory: res.ok ? undefined : errorCategory,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${method} error: ${res.status} ${summary}`);
  }
  return text;
};

const supabaseGet = async <T>(path: string) => {
  const text = await supabaseRequest("GET", path);
  return (text ? JSON.parse(text) : []) as T;
};

const supabasePost = async <T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
) => {
  const text = await supabaseRequest("POST", path, body, extraHeaders);
  if (!text) return [] as T;
  return JSON.parse(text) as T;
};

const supabasePatch = async <T>(path: string, body: unknown) => {
  const text = await supabaseRequest("PATCH", path, body);
  if (!text) return [] as T;
  return JSON.parse(text) as T;
};

const supabaseDelete = async (path: string) => {
  await supabaseRequest("DELETE", path);
};

const CACHE_KEYS = {
  classes: "cache_classes_v1",
  classPlans: "cache_class_plans_v1",
  trainingPlans: "cache_training_plans_v1",
  trainingTemplates: "cache_training_templates_v1",
  students: "cache_students_v1",
};

const ACTIVE_ORG_STORAGE_KEY = "active-org-id";

const WRITE_QUEUE_KEY = "pending_writes_v1";
const WRITE_QUEUE_MIGRATED_KEY = "pending_writes_sqlite_migrated_v1";
const WRITE_FLUSH_BATCH_SIZE = 20;
const WRITE_ITEM_TIMEOUT_MS = 15000;

type PendingWrite = {
  id: string;
  kind: "session_log" | "attendance_records" | "scouting_log" | "student_scouting_log";
  payload: unknown;
  createdAt: string;
};

type PendingWriteRow = {
  id: string;
  kind: PendingWrite["kind"];
  payload: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  dedupKey: string;
};

type PendingWriteErrorKind =
  | "network"
  | "retryable_server"
  | "auth"
  | "permission"
  | "bad_request"
  | "unknown";

export type PendingWritesDiagnostics = {
  total: number;
  highRetry: number;
  maxRetry: number;
  deadLetterCandidates: number;
};

let pendingWritesInitPromise: Promise<void> | null = null;

const isNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Network request failed") ||
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError") ||
    message.includes("Timed out")
  );
};

const isAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Missing auth token")) return true;
  return (
    message.includes("Supabase") &&
    (message.includes(" 401 ") || message.includes(" 403 "))
  );
};

const isPermissionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("row-level security") ||
    message.includes("code\":\"42501\"") ||
    message.includes(" 42501")
  );
};

const isRetryableServerError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /\s5\d{2}\s/.test(message) || message.includes(" 429 ");
};

const isBadRequestError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(" 400 ") ||
    message.includes(" 404 ") ||
    message.includes(" 409 ") ||
    message.includes(" 422 ")
  );
};

const classifyPendingWriteError = (error: unknown): PendingWriteErrorKind => {
  if (isNetworkError(error)) return "network";
  if (isRetryableServerError(error)) return "retryable_server";
  if (isAuthError(error)) return "auth";
  if (isPermissionError(error)) return "permission";
  if (isBadRequestError(error)) return "bad_request";
  return "unknown";
};

const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }
};

const getActiveOrganizationId = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  } catch {
    return null;
  }
};

const readWriteQueue = async () => {
  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC"
    );
    return rows
      .map((row) => {
        try {
          return {
            id: row.id,
            kind: row.kind,
            payload: JSON.parse(row.payload),
            createdAt: row.createdAt,
          } as PendingWrite;
        } catch {
          return null;
        }
      })
      .filter((item): item is PendingWrite => Boolean(item));
  } catch {
    const stored = await readCache<PendingWrite[]>(WRITE_QUEUE_KEY);
    return stored ?? [];
  }
};

const writeQueue = async (queue: PendingWrite[]) => {
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync("DELETE FROM pending_writes");
    for (const item of queue) {
      const dedupKey = getPendingWriteDedupKey(item) ?? "";
      await db.runAsync(
        "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, 0, NULL, ?)",
        [
          item.id,
          item.kind,
          JSON.stringify(item.payload),
          item.createdAt,
          dedupKey,
        ]
      );
    }
    return;
  } catch {
    await writeCache(WRITE_QUEUE_KEY, queue);
  }
};

const ensurePendingWritesMigrated = async () => {
  if (!pendingWritesInitPromise) {
    pendingWritesInitPromise = (async () => {
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, retryCount INTEGER NOT NULL DEFAULT 0, lastError TEXT, dedupKey TEXT NOT NULL DEFAULT '')"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_createdAt ON pending_writes (createdAt)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dedupKey ON pending_writes (dedupKey)"
      );

      const migrated = await AsyncStorage.getItem(WRITE_QUEUE_MIGRATED_KEY);
      if (migrated === "1") return;

      const legacy = await readCache<PendingWrite[]>(WRITE_QUEUE_KEY);
      if (legacy?.length) {
        for (const item of legacy) {
          const dedupKey = getPendingWriteDedupKey(item) ?? "";
          await db.runAsync(
            "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, 0, NULL, ?)",
            [
              item.id,
              item.kind,
              JSON.stringify(item.payload),
              item.createdAt,
              dedupKey,
            ]
          );
        }
        await AsyncStorage.removeItem(WRITE_QUEUE_KEY);
      }

      await AsyncStorage.setItem(WRITE_QUEUE_MIGRATED_KEY, "1");
    })().catch((error) => {
      pendingWritesInitPromise = null;
      throw error;
    });
  }

  await pendingWritesInitPromise;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getPendingWriteDedupKey = (write: PendingWrite) => {
  if (write.kind === "session_log") {
    const payload = write.payload as SessionLog;
    if (!payload.classId || !payload.createdAt) return null;
    const dateKey = payload.createdAt.slice(0, 10);
    return `${write.kind}:${payload.classId}:${dateKey}`;
  }
  if (write.kind === "attendance_records") {
    const payload = write.payload as { classId: string; date: string };
    if (!payload.classId || !payload.date) return null;
    return `${write.kind}:${payload.classId}:${payload.date}`;
  }
  if (write.kind === "scouting_log") {
    const payload = write.payload as ScoutingLog;
    if (!payload.classId || !payload.date) return null;
    const mode = payload.mode === "jogo" ? "jogo" : "treino";
    return `${write.kind}:${payload.classId}:${payload.date}:${mode}`;
  }
  if (write.kind === "student_scouting_log") {
    const payload = write.payload as StudentScoutingLog;
    if (!payload.studentId || !payload.classId || !payload.date) return null;
    return `${write.kind}:${payload.studentId}:${payload.classId}:${payload.date}`;
  }
  return null;
};

const buildSessionLogClientId = (log: SessionLog) => {
  const existing = (log.clientId || log.id || "").trim();
  if (existing) return existing;
  const timestamp = Number.isFinite(Date.parse(log.createdAt))
    ? Date.parse(log.createdAt)
    : Date.now();
  const suffix = Number.isFinite(Date.parse(log.createdAt))
    ? ""
    : `_${Math.random().toString(16).slice(2, 6)}`;
  return `session_${log.classId}_${timestamp}${suffix}`;
};

const buildScoutingLogClientId = (log: ScoutingLog) => {
  const existing = (log.clientId || log.id || "").trim();
  if (existing) return existing;
  const datePart = log.date ? log.date.trim() : "unknown";
  const mode = log.mode === "jogo" ? "jogo" : "treino";
  return `scout_${log.classId}_${datePart}_${mode}`;
};


const buildStudentScoutingClientId = (log: StudentScoutingLog) => {
  const existing = (log.id || "").trim();
  if (existing) return existing;
  const datePart = log.date ? log.date.trim() : "unknown";
  return `student_scout_${log.studentId}_${log.classId}_${datePart}`;
};

const enqueueWrite = async (write: PendingWrite) => {
  const dedupKey = getPendingWriteDedupKey(write) ?? "";
  try {
    await ensurePendingWritesMigrated();
    if (dedupKey) {
      await db.runAsync("DELETE FROM pending_writes WHERE dedupKey = ?", [dedupKey]);
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      [write.id, write.kind, JSON.stringify(write.payload), write.createdAt, dedupKey]
    );
    return;
  } catch {
    const queue = await readWriteQueue();
    const nextQueue = dedupKey
      ? queue.filter((item) => getPendingWriteDedupKey(item) !== dedupKey)
      : queue;
    nextQueue.push(write);
    await writeQueue(nextQueue);
  }
};

export async function getPendingWritesCount() {
  try {
    await ensurePendingWritesMigrated();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM pending_writes"
    );
    return row?.count ?? 0;
  } catch {
    const queue = await readWriteQueue();
    return queue.length;
  }
}

export async function getPendingWritesDiagnostics(
  highRetryThreshold = 10
): Promise<PendingWritesDiagnostics> {
  try {
    await ensurePendingWritesMigrated();
    const row = await db.getFirstAsync<{
      total: number;
      highRetry: number;
      maxRetry: number | null;
    }>(
      "SELECT COUNT(*) as total, SUM(CASE WHEN retryCount >= ? THEN 1 ELSE 0 END) as highRetry, MAX(retryCount) as maxRetry FROM pending_writes",
      [highRetryThreshold]
    );

    const total = row?.total ?? 0;
    const highRetry = row?.highRetry ?? 0;
    const maxRetry = row?.maxRetry ?? 0;

    return {
      total,
      highRetry,
      maxRetry,
      deadLetterCandidates: highRetry,
    };
  } catch {
    const queue = await readWriteQueue();
    return {
      total: queue.length,
      highRetry: 0,
      maxRetry: 0,
      deadLetterCandidates: 0,
    };
  }
}

export async function flushPendingWrites() {
  let batch: PendingWrite[] = [];
  let usingSqlite = false;

  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC LIMIT ?",
      [WRITE_FLUSH_BATCH_SIZE]
    );
    batch = rows
      .map((row) => {
        try {
          return {
            id: row.id,
            kind: row.kind,
            payload: JSON.parse(row.payload),
            createdAt: row.createdAt,
          } as PendingWrite;
        } catch {
          return null;
        }
      })
      .filter((item): item is PendingWrite => Boolean(item));
    usingSqlite = true;
  } catch {
    const queue = await readWriteQueue();
    batch = queue.slice(0, WRITE_FLUSH_BATCH_SIZE);
  }

  if (!batch.length) return { flushed: 0, remaining: 0 };
  const remainingBatch: PendingWrite[] = [];
  const failedErrors = new Map<string, string>();

  for (const item of batch) {
    try {
      if (item.kind === "session_log") {
        await withTimeout(
          saveSessionLog(item.payload as SessionLog, { allowQueue: false }),
          WRITE_ITEM_TIMEOUT_MS
        );
      } else if (item.kind === "attendance_records") {
        const payload = item.payload as {
          classId: string;
          date: string;
          records: AttendanceRecord[];
        };
        await withTimeout(
          saveAttendanceRecords(payload.classId, payload.date, payload.records, {
            allowQueue: false,
          }),
          WRITE_ITEM_TIMEOUT_MS
        );
      } else if (item.kind === "scouting_log") {
        await withTimeout(
          saveScoutingLog(item.payload as ScoutingLog, { allowQueue: false }),
          WRITE_ITEM_TIMEOUT_MS
        );
      } else if (item.kind === "student_scouting_log") {
        await withTimeout(
          saveStudentScoutingLog(item.payload as StudentScoutingLog, {
            allowQueue: false,
          }),
          WRITE_ITEM_TIMEOUT_MS
        );
      }
    } catch (error) {
      const classification = classifyPendingWriteError(error);
      if (classification !== "bad_request") {
        remainingBatch.push(item);
        const message = error instanceof Error ? error.message : String(error);
        failedErrors.set(item.id, `[${classification}] ${message}`);
      } else {
        Sentry.captureException(error);
        if (usingSqlite) {
          try {
            await db.runAsync("DELETE FROM pending_writes WHERE id = ?", [item.id]);
          } catch {}
        }
      }
    }
  }

  if (usingSqlite) {
    for (const item of batch) {
      const failed = failedErrors.get(item.id);
      if (failed) {
        await db.runAsync(
          "UPDATE pending_writes SET retryCount = retryCount + 1, lastError = ? WHERE id = ?",
          [failed, item.id]
        );
      } else {
        await db.runAsync("DELETE FROM pending_writes WHERE id = ?", [item.id]);
      }
    }
    const countRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM pending_writes"
    );
    const remaining = countRow?.count ?? 0;
    return {
      flushed: batch.length - remainingBatch.length,
      remaining,
    };
  }

  const queue = await readWriteQueue();
  const untouched = queue.slice(WRITE_FLUSH_BATCH_SIZE);
  const nextQueue = [...remainingBatch, ...untouched];
  await writeQueue(nextQueue);
  return {
    flushed: batch.length - remainingBatch.length,
    remaining: nextQueue.length,
  };
}

const isMissingRelation = (error: unknown, relation: string) => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const rel = `public.${relation}`.toLowerCase();
  return (
    message.includes(`relation "public.${relation}"`) ||
    message.includes(`relation \"public.${relation}\"`) ||
    (lower.includes("could not find the table") && lower.includes(rel)) ||
    message.includes("does not exist")
  );
};

const safeGetUnits = async (): Promise<UnitRow[]> => {
  try {
    return await supabaseGet<UnitRow[]>("/units?select=*&order=name.asc");
  } catch (error) {
    if (isMissingRelation(error, "units")) return [];
    if (isAuthError(error)) return [];
    throw error;
  }
};

const ensureUnit = async (
  unitName: string | undefined,
  cachedUnits?: UnitRow[]
): Promise<UnitRow | null> => {
  const name = canonicalizeUnitLabel(unitName);
  if (!name) return null;
  const units = cachedUnits ?? (await safeGetUnits());
  const targetKey = normalizeUnitKey(name);
  const existing = units.find(
    (unit) => normalizeUnitKey(unit.name) === targetKey
  );
  if (existing) {
    if (existing.name !== name) {
      try {
        await supabasePatch("/units?id=eq." + encodeURIComponent(existing.id), {
          name,
        });
        existing.name = name;
      } catch {
        // ignore rename failures
      }
    }
    return existing;
  }

  const now = new Date().toISOString();
  const createdId = "u_" + Date.now();
  try {
    const created = await supabasePost<UnitRow[]>("/units", [
      { id: createdId, name, createdat: now },
    ]);
    if (!created[0]) return null;
    const row = { id: createdId, name, createdat: now };
    units.push(row);
    return row;
  } catch (error) {
    if (isMissingRelation(error, "units")) return null;
    throw error;
  }
};

type ClassRow = {
  id: string;
  name: string;
  organization_id?: string | null;
  unit?: string;
  unit_id?: string | null;
  color_key?: string | null;
  modality?: string | null;
  ageband: string;
  gender?: string | null;
  starttime?: string;
  endtime?: string | null;
  end_time?: string | null;
  duration?: number;
  days?: number[];
  daysperweek: number;
  goal: string;
  equipment: string;
  level: number;
  mv_level?: string | null;
  cycle_start_date?: string | null;
  cycle_length_weeks?: number | null;
  acwr_low?: number | null;
  acwr_high?: number | null;
  createdat?: string | null;
};

type UnitRow = {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  createdat: string;
};

type TrainingPlanRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  applydays?: number[];
  applydate?: string;
  createdat: string;
};

type TrainingTemplateRow = {
  id: string;
  title: string;
  ageband: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  createdat: string;
};

type HiddenTemplateRow = {
  id: string;
  templateid: string;
  createdat: string;
};

type StudentRow = {
  id: string;
  name: string;
  organization_id?: string | null;
  photo_url?: string | null;
  classid: string;
  age: number;
  phone: string;
  login_email?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relation?: string | null;
  health_issue?: boolean | null;
  health_issue_notes?: string | null;
  medication_use?: boolean | null;
  medication_notes?: string | null;
  health_observations?: string | null;
  birthdate?: string | null;
  createdat: string;
};

type AttendanceRow = {
  id: string;
  classid: string;
  studentid: string;
  date: string;
  status: string;
  note: string;
  organization_id?: string | null;
  pain_score?: number | null;
  createdat: string;
};

type AbsenceNoticeRow = {
  id: string;
  student_id: string;
  class_id: string;
  organization_id?: string | null;
  session_date: string;
  reason: string;
  note?: string | null;
  status: string;
  created_at: string;
};

type ScoutingLogRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  unit?: string | null;
  mode?: string | null;
  client_id?: string | null;
  date: string;
  serve_0?: number | null;
  serve_1?: number | null;
  serve_2?: number | null;
  receive_0?: number | null;
  receive_1?: number | null;
  receive_2?: number | null;
  set_0?: number | null;
  set_1?: number | null;
  set_2?: number | null;
  attack_send_0?: number | null;
  attack_send_1?: number | null;
  attack_send_2?: number | null;
  createdat: string;
  updatedat?: string | null;
};

type StudentScoutingRow = {
  id: string;
  studentid: string;
  classid: string;
  date: string;
  serve_0?: number | null;
  serve_1?: number | null;
  serve_2?: number | null;
  receive_0?: number | null;
  receive_1?: number | null;
  receive_2?: number | null;
  set_0?: number | null;
  set_1?: number | null;
  set_2?: number | null;
  attack_send_0?: number | null;
  attack_send_1?: number | null;
  attack_send_2?: number | null;
  createdat: string;
  updatedat?: string | null;
};

type ClassPlanRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  startdate: string;
  weeknumber: number;
  phase: string;
  theme: string;
  technical_focus: string;
  physical_focus: string;
  constraints: string;
  mv_format: string;
  warmupprofile: string;
  ruleset?: string | null;
  jump_target?: string | null;
  rpe_target?: string | null;
  source: string;
  created_at?: string | null;
  updated_at?: string | null;
  createdat?: string | null;
  updatedat?: string | null;
};

type SessionLogRow = {
  id: string;
  client_id?: string | null;
  classid: string;
  organization_id?: string | null;
  rpe: number;
  technique: string;
  attendance: number;
  activity?: string | null;
  conclusion?: string | null;
  participants_count?: number | null;
  photos?: string | null;
  pain_score?: number | null;
  createdat: string;
};

type ExerciseRow = {
  id: string;
  title: string;
  tags: string[];
  videourl: string;
  source: string;
  description: string;
  publishedat: string;
  notes: string;
  createdat: string;
};

export async function seedIfEmpty() {
  if (!(await getSessionUserId())) return;
  try {
    const existing = await supabaseGet<ClassRow[]>(
      "/classes?select=id&limit=1"
    );
    if (existing.length > 0) return;

    const unitsCache = await safeGetUnits();

    const activeOrganizationId = await getActiveOrganizationId();

    const nowIso = new Date().toISOString();
    const classes: ClassRow[] = [
      {
        id: "c_re_f_8_11",
        name: "Feminino (8-11)",
        unit: "Rede Esperana",
        modality: "voleibol",
        ageband: "08-11",
        gender: "feminino",
        starttime: "14:00",
        end_time: computeEndTime("14:00", 60),
        duration: 60,
        days: [2, 4],
        daysperweek: 2,
        goal: "Fundamentos + jogo reduzido",
        equipment: "quadra",
        level: 1,
        mv_level: "MV1",
        cycle_start_date: formatIsoDate(new Date()),
        cycle_length_weeks: 4,
        created_at: nowIso,
      },
      {
        id: "c_re_m_8_11",
        name: "Masculino (8-11)",
        unit: "Rede Esperana",
        modality: "voleibol",
        ageband: "08-11",
        gender: "masculino",
        starttime: "15:30",
        end_time: computeEndTime("15:30", 60),
        duration: 60,
        days: [2, 4],
        daysperweek: 2,
        goal: "Fundamentos + jogo reduzido",
        equipment: "quadra",
        level: 1,
        mv_level: "MV1",
        cycle_start_date: formatIsoDate(new Date()),
        cycle_length_weeks: 4,
        created_at: nowIso,
      },
      {
        id: "c_rp_6_8",
        name: "6-8 anos",
        unit: "Rede Esportes Pinhais",
        modality: "voleibol",
        ageband: "06-08",
        gender: "misto",
        starttime: "09:00",
        end_time: computeEndTime("09:00", 60),
        duration: 60,
        days: [6],
        daysperweek: 1,
        goal: "Coordenação + bola + jogo",
        equipment: "quadra",
        level: 1,
        mv_level: "MV1",
        cycle_start_date: formatIsoDate(new Date()),
        cycle_length_weeks: 4,
        created_at: nowIso,
      },
      {
        id: "c_rp_9_11",
        name: "9-11 anos",
        unit: "Rede Esportes Pinhais",
        modality: "voleibol",
        ageband: "09-11",
        gender: "misto",
        starttime: "10:00",
        end_time: computeEndTime("10:00", 60),
        duration: 60,
        days: [6],
        daysperweek: 1,
        goal: "Fundamentos + continuidade",
        equipment: "quadra",
        level: 1,
        mv_level: "MV1",
        cycle_start_date: formatIsoDate(new Date()),
        cycle_length_weeks: 4,
        created_at: nowIso,
      },
      {
        id: "c_rp_12_14",
        name: "12-14 anos",
        unit: "Rede Esportes Pinhais",
        modality: "voleibol",
        ageband: "12-14",
        gender: "misto",
        starttime: "11:00",
        end_time: computeEndTime("11:00", 60),
        duration: 60,
        days: [6],
        daysperweek: 1,
        goal: "Fundamentos + jogo + ataque progressivo",
        equipment: "quadra",
        level: 2,
        mv_level: "MV2",
        cycle_start_date: formatIsoDate(new Date()),
        cycle_length_weeks: 4,
        created_at: nowIso,
      },
    ];

    if (activeOrganizationId) {
      for (const row of classes) {
        row.organization_id = activeOrganizationId;
      }
    }

    for (const row of classes) {
      const unit = await ensureUnit(row.unit, unitsCache);
      if (unit) row.unit_id = unit.id;
    }

    await supabasePost("/classes", classes);
  } catch (error) {
    if (isAuthError(error) || isPermissionError(error)) return;
    throw error;
  }
}

const calculateAge = (birthDate: string) => {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }
  return Math.max(age, 0);
};

const parseAgeBand = (value: string) => {
  const range = parseAgeBandRange(value);
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return null;
  return { start: range.start, end: range.end };
};

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const computeEndTime = (startTime?: string, duration?: number | null) => {
  if (!startTime) return null;
  const match = startTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = hours * 60 + minutes + (duration ?? 0);
  const endHour = Math.floor(total / 60) % 24;
  const endMinute = total % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
};

export async function seedStudentsIfEmpty() {
  if (!(await getSessionUserId())) return;
  try {
    const existing = await supabaseGet<StudentRow[]>(
      "/students?select=id&limit=1"
    );
    if (existing.length > 0) return;

    const classes = await getClasses();
    if (!classes.length) return;

    const firstNames = [
      "Gustavo",
      "Mariana",
      "Lucas",
      "Ana",
      "Pedro",
      "Beatriz",
      "Joao",
      "Julia",
      "Rafael",
      "Camila",
    ];
    const lastNames = [
      "Silva",
      "Souza",
      "Oliveira",
      "Pereira",
      "Costa",
      "Santos",
      "Almeida",
      "Ferreira",
      "Gomes",
      "Ribeiro",
    ];

    const rows: StudentRow[] = [];
    const nowIso = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 20; i += 1) {
      const cls = classes[i % classes.length];
      const band = parseAgeBand(cls.ageBand);
      const age =
        band ? Math.round((band.start + band.end) / 2) : 12 + (i % 5);
      const year = currentYear - age;
      const month = String((i % 12) + 1).padStart(2, "0");
      const day = String((i % 28) + 1).padStart(2, "0");
      const birthDate = `${year}-${month}-${day}`;
      const phone = `(41) 9${String(8000 + i).padStart(4, "0")}-${String(
        1000 + i
      ).padStart(4, "0")}`;
      const name =
        firstNames[i % firstNames.length] +
        " " +
        lastNames[i % lastNames.length];

      rows.push({
        id: "s_" + (Date.now() + i),
        name,
        classid: cls.id,
        age: calculateAge(birthDate),
        phone,
        birthdate: birthDate,
        createdat: nowIso,
      });
    }

    await supabasePost("/students", rows);
  } catch (error) {
    if (isAuthError(error) || isPermissionError(error)) return;
    throw error;
  }
}

const buildClassesCacheKey = (organizationId: string | null) =>
  organizationId ? `${CACHE_KEYS.classes}_${organizationId}` : CACHE_KEYS.classes;

export async function getClasses(
  options: { organizationId?: string | null } = {}
): Promise<ClassGroup[]> {
  try {
    const units = await safeGetUnits();
    const unitMap = new Map(
      units.map((unit) => [unit.id, canonicalizeUnitLabel(unit.name)])
    );
    const activeOrganizationId =
      options.organizationId ?? (await getActiveOrganizationId());
    const cacheKey = buildClassesCacheKey(activeOrganizationId ?? null);
    const rows = await supabaseGet<ClassRow[]>(
      activeOrganizationId
        ? `/classes?select=*&organization_id=eq.${encodeURIComponent(
            activeOrganizationId
          )}&order=name.asc`
        : "/classes?select=*&order=name.asc"
    );
    const mapped = sortClassesBySchedule(
      rows.map((row) => {
        const unitFromId = row.unit_id ? unitMap.get(row.unit_id) : undefined;
        const unitLabel =
          canonicalizeUnitLabel(unitFromId ?? row.unit) ??
          canonicalizeUnitLabel(row.unit ?? "") ??
          "Sem unidade";
        const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
        return {
          id: row.id,
          name: row.name,
          organizationId: resolvedOrganizationId,
          unit: unitLabel,
          unitId: row.unit_id ?? undefined,
          colorKey: row.color_key ?? undefined,
          modality:
            row.modality === "voleibol" || row.modality === "fitness" ? row.modality : undefined,
          ageBand: normalizeAgeBand(row.ageband),
          gender:
            row.gender === "masculino" || row.gender === "feminino" ? row.gender : "misto",
          startTime: row.starttime ?? "14:00",
          endTime:
            row.end_time ??
            row.endtime ??
            computeEndTime(row.starttime, row.duration ?? 60) ??
            undefined,
          durationMinutes: row.duration ?? 60,
          daysOfWeek:
            Array.isArray(row.days) && row.days.length
              ? row.days
              : row.daysperweek === 3
                ? [1, 3, 5]
                : [2, 4],
          daysPerWeek: row.daysperweek,
          goal: row.goal,
          equipment: row.equipment,
          level: row.level,
          mvLevel: row.mv_level ?? undefined,
          cycleStartDate: row.cycle_start_date ?? undefined,
          cycleLengthWeeks: row.cycle_length_weeks ?? undefined,
          acwrLow: row.acwr_low ?? undefined,
          acwrHigh: row.acwr_high ?? undefined,
          createdAt: row.createdat ?? undefined,
        };
      })
    );
    await writeCache(cacheKey, mapped);
    return mapped;
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId =
        options.organizationId ?? (await getActiveOrganizationId());
      const cacheKey = buildClassesCacheKey(activeOrganizationId ?? null);
      const cached = await readCache<ClassGroup[]>(cacheKey);
      if (cached) return cached;
      return [];
    }
    throw error;
  }
}

export async function getClassById(
  id: string,
  options: { organizationId?: string | null } = {}
): Promise<ClassGroup | null> {
  const units = await safeGetUnits();
  const unitMap = new Map(
    units.map((unit) => [unit.id, canonicalizeUnitLabel(unit.name)])
  );
  const activeOrganizationId =
    options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<ClassRow[]>(
    activeOrganizationId
      ? "/classes?select=*&id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(activeOrganizationId)
      : "/classes?select=*&id=eq." + encodeURIComponent(id)
  );
  const row = rows[0];
  if (!row) return null;
  const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
  return {
    id: row.id,
    name: row.name,
    organizationId: resolvedOrganizationId,
    unit:
      (row.unit_id ? unitMap.get(row.unit_id) : undefined) ??
      canonicalizeUnitLabel(row.unit) ??
      "Sem unidade",
    unitId: row.unit_id ?? undefined,
    colorKey: row.color_key ?? undefined,
    modality:
      row.modality === "voleibol" || row.modality === "fitness"
        ? row.modality
        : undefined,
    ageBand: normalizeAgeBand(row.ageband),
    gender:
      row.gender === "masculino" || row.gender === "feminino"
        ? row.gender
        : "misto",
    startTime: row.starttime ?? "14:00",
    endTime:
      row.end_time ??
      row.endtime ??
      computeEndTime(row.starttime, row.duration ?? 60) ??
      undefined,
    durationMinutes: row.duration ?? 60,
    daysOfWeek:
      Array.isArray(row.days) && row.days.length
        ? row.days
        : row.daysperweek === 3
          ? [1, 3, 5]
          : [2, 4],
    daysPerWeek: row.daysperweek,
    goal: row.goal,
    equipment: row.equipment,
    level: row.level,
    mvLevel: row.mv_level ?? undefined,
    cycleStartDate: row.cycle_start_date ?? undefined,
    cycleLengthWeeks: row.cycle_length_weeks ?? undefined,
    acwrLow: row.acwr_low ?? undefined,
    acwrHigh: row.acwr_high ?? undefined,
    createdAt: row.createdat ?? undefined,
  };
}

export async function updateClass(
  id: string,
  data: {
    name: string;
    unit: string;
    daysOfWeek: number[];
    goal: ClassGroup["goal"];
    ageBand: ClassGroup["ageBand"];
    gender: ClassGroup["gender"];
    modality?: ClassGroup["modality"];
    startTime: string;
    durationMinutes: number;
    unitId?: string;
    mvLevel?: string;
    colorKey?: string | null;
    cycleStartDate?: string;
    cycleLengthWeeks?: number;
    acwrLow?: number;
    acwrHigh?: number;
  }
) {
  const resolvedUnitRow = data.unitId
    ? { id: data.unitId, name: data.unit }
    : await ensureUnit(data.unit);
  const payload: Record<string, unknown> = {
    name: data.name,
    unit: resolvedUnitRow?.name ?? data.unit,
    days: data.daysOfWeek,
    goal: data.goal,
    ageband: normalizeAgeBand(data.ageBand),
    gender: data.gender,
    starttime: data.startTime,
    end_time: computeEndTime(data.startTime, data.durationMinutes),
    duration: data.durationMinutes,
  };
  if (data.modality) payload.modality = data.modality;

  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  if (resolvedUnit) payload.unit_id = resolvedUnit;
  if (data.colorKey !== undefined) payload.color_key = data.colorKey || null;
  if (data.mvLevel) payload.mv_level = data.mvLevel;
  if (data.cycleStartDate) payload.cycle_start_date = data.cycleStartDate;
  if (typeof data.cycleLengthWeeks === "number") {
    payload.cycle_length_weeks = data.cycleLengthWeeks;
  }
  if (typeof data.acwrLow === "number") payload.acwr_low = data.acwrLow;
  if (typeof data.acwrHigh === "number") payload.acwr_high = data.acwrHigh;

  await supabasePatch("/classes?id=eq." + encodeURIComponent(id), payload);
}

export async function updateClassColor(id: string, colorKey?: string | null) {
  await supabasePatch("/classes?id=eq." + encodeURIComponent(id), {
    color_key: colorKey ?? null,
  });
}

export async function updateClassAcwrLimits(
  id: string,
  limits: { low: number; high: number }
) {
  await supabasePatch("/classes?id=eq." + encodeURIComponent(id), {
    acwr_low: limits.low,
    acwr_high: limits.high,
  });
}

export async function saveClass(data: {
  name: string;
  unit: string;
  ageBand: ClassGroup["ageBand"];
  daysOfWeek: number[];
  goal: ClassGroup["goal"];
  gender: ClassGroup["gender"];
  modality?: ClassGroup["modality"];
  startTime: string;
  durationMinutes: number;
  unitId?: string;
  mvLevel?: string;
  cycleStartDate?: string;
  cycleLengthWeeks?: number;
  colorKey?: string | null;
  organizationId?: string | null;
}) {
  const resolvedUnitRow = data.unitId
    ? { id: data.unitId, name: data.unit }
    : await ensureUnit(data.unit);
  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  const activeOrganizationId =
    data.organizationId ?? (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    id: "c_" + Date.now(),
    name: data.name,
    unit: resolvedUnitRow?.name ?? data.unit,
    unit_id: resolvedUnit,
    color_key: data.colorKey ?? null,
    modality: data.modality ?? "fitness",
    ageband: normalizeAgeBand(data.ageBand),
    gender: data.gender,
    starttime: data.startTime,
    end_time: computeEndTime(data.startTime, data.durationMinutes),
    duration: data.durationMinutes,
    days: data.daysOfWeek,
    daysperweek: data.daysOfWeek.length,
    goal: data.goal,
    equipment: "misto",
    level: 1,
    mv_level: data.mvLevel,
    cycle_start_date: data.cycleStartDate,
    cycle_length_weeks: data.cycleLengthWeeks,
    created_at: new Date().toISOString(),
  };
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  await supabasePost("/classes", [
    payload,
  ]);
}

export async function duplicateClass(base: ClassGroup) {
  const resolvedUnitRow = base.unitId
    ? { id: base.unitId, name: base.unit }
    : await ensureUnit(base.unit);
  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  const activeOrganizationId =
    base.organizationId ?? (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    id: "c_" + Date.now(),
    name: base.name + " (cópia)",
    unit: resolvedUnitRow?.name ?? base.unit,
    unit_id: resolvedUnit,
    color_key: base.colorKey ?? null,
    modality: base.modality ?? "fitness",
    ageband: normalizeAgeBand(base.ageBand),
    gender: base.gender,
    starttime: base.startTime,
    end_time: computeEndTime(base.startTime, base.durationMinutes),
    duration: base.durationMinutes,
    days: base.daysOfWeek,
    daysperweek: base.daysOfWeek.length,
    goal: base.goal,
    equipment: base.equipment,
    level: base.level,
    mv_level: base.mvLevel,
    cycle_start_date: base.cycleStartDate,
    cycle_length_weeks: base.cycleLengthWeeks,
    acwr_low: base.acwrLow,
    acwr_high: base.acwrHigh,
    created_at: new Date().toISOString(),
  };
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  await supabasePost("/classes", [
    payload,
  ]);
}

export async function deleteClass(id: string) {
  await supabaseDelete("/classes?id=eq." + encodeURIComponent(id));
}

export async function deleteClassCascade(id: string) {
  await supabaseDelete(
    "/training_plans?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete(
    "/class_plans?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete(
    "/attendance_logs?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete(
    "/scouting_logs?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete("/students?classid=eq." + encodeURIComponent(id));
  await supabaseDelete(
    "/session_logs?classid=eq." + encodeURIComponent(id)
  );
  await deleteClass(id);
}

const scoutingRowToLog = (row: ScoutingLogRow): ScoutingLog => ({
  id: row.id,
  classId: row.classid,
  unit: row.unit ?? undefined,
  mode: row.mode === "jogo" ? "jogo" : "treino",
  clientId: row.client_id ?? undefined,
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
  updatedAt: row.updatedat ?? undefined,
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
  updatedAt: row.updatedat ?? undefined,
});


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
    throw error;
  }
}

export async function saveScoutingLog(
  log: ScoutingLog,
  options?: { allowQueue?: boolean; organizationId?: string }
) {
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
        "/session_logs?id=eq." + encodeURIComponent(log.id || ""),
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
      return;
    }
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
    clientId: row.client_id ?? undefined,
    classId: row.classid,
    PSE: row.rpe,
    technique: row.technique === "ruim" ? "ruim" : row.technique === "ok" ? "ok" : "boa",
    attendance: row.attendance,
    activity: row.activity ?? undefined,
    conclusion: row.conclusion ?? undefined,
    participantsCount: row.participants_count ?? undefined,
    photos: row.photos ?? undefined,
    painScore: row.pain_score ?? undefined,
    createdAt: row.createdat,
  };
}

export async function getSessionLogsByRange(
  startIso: string,
  endIso: string,
  options: { organizationId?: string | null } = {}
): Promise<SessionLog[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<SessionLogRow[]>(
    organizationId
      ? `/session_logs?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&createdat=gte.${encodeURIComponent(startIso)}&createdat=lt.${encodeURIComponent(endIso)}`
      : `/session_logs?select=*&createdat=gte.${encodeURIComponent(startIso)}&createdat=lt.${encodeURIComponent(endIso)}`
  );
  return rows.map((row) => ({
    classId: row.classid,
    PSE: row.rpe,
    technique: row.technique === "ruim" ? "ruim" : row.technique === "ok" ? "ok" : "boa",
    attendance: row.attendance,
    activity: row.activity ?? undefined,
    conclusion: row.conclusion ?? undefined,
    participantsCount: row.participants_count ?? undefined,
    photos: row.photos ?? undefined,
    painScore: row.pain_score ?? undefined,
    createdAt: row.createdat,
  }));
}

export async function getTrainingPlans(
  options: { organizationId?: string | null } = {}
): Promise<TrainingPlan[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<TrainingPlanRow[]>(
      organizationId
        ? `/training_plans?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=createdat.desc`
        : "/training_plans?select=*&order=createdat.desc"
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      title: row.title,
      tags: row.tags ?? [],
      warmup: row.warmup ?? [],
      main: row.main ?? [],
      cooldown: row.cooldown ?? [],
      warmupTime: row.warmuptime ?? "",
      mainTime: row.maintime ?? "",
      cooldownTime: row.cooldowntime ?? "",
      applyDays: row.applydays ?? [],
      applyDate: row.applydate ?? "",
      createdAt: row.createdat,
    }));
    await writeCache(CACHE_KEYS.trainingPlans, mapped);
    return mapped;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await readCache<TrainingPlan[]>(CACHE_KEYS.trainingPlans);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function saveTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePost("/training_plans", [
    {
      id: plan.id,
      classid: plan.classId,
      organization_id: organizationId ?? undefined,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    },
  ]);
}

export async function updateTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePatch(
    "/training_plans?id=eq." + encodeURIComponent(plan.id),
    {
      classid: plan.classId,
      organization_id: organizationId ?? undefined,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    }
  );
}

export async function deleteTrainingPlan(id: string) {
  await supabaseDelete(
    "/training_plans?id=eq." + encodeURIComponent(id)
  );
}

export async function deleteTrainingPlansByClassAndDate(
  classId: string,
  date: string
) {
  await supabaseDelete(
    "/training_plans?classid=eq." +
      encodeURIComponent(classId) +
      "&applydate=eq." +
      encodeURIComponent(date)
  );
}

export async function getClassPlansByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<ClassPlan[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<ClassPlanRow[]>(
      organizationId
        ? `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=weeknumber.asc`
        : `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}&order=weeknumber.asc`
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      startDate: row.startdate,
      weekNumber: row.weeknumber,
      phase: row.phase,
      theme: row.theme,
      technicalFocus: row.technical_focus ?? "",
      physicalFocus: row.physical_focus ?? "",
      constraints: row.constraints ?? row.ruleset ?? "",
      mvFormat: row.mv_format ?? "",
      warmupProfile: row.warmupprofile ?? "",
      jumpTarget: row.jump_target ?? "",
      rpeTarget: row.rpe_target ?? "",
      source: row.source === "MANUAL" ? "MANUAL" : "AUTO",
      createdAt: row.created_at ?? row.createdat ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? row.updatedat ?? undefined,
    }));
    const cache = (await readCache<Record<string, ClassPlan[]>>(CACHE_KEYS.classPlans)) ?? {};
    cache[classId] = mapped;
    await writeCache(CACHE_KEYS.classPlans, cache);
    return mapped;
  } catch (error) {
    if (isMissingRelation(error, "class_plans")) return [];
    if (isNetworkError(error)) {
      const cache = await readCache<Record<string, ClassPlan[]>>(CACHE_KEYS.classPlans);
      if (cache && cache[classId]) return cache[classId];
    }
    throw error;
  }
}

export async function createClassPlan(plan: ClassPlan) {
  try {
    await saveClassPlans([plan]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("23505")) {
      const existing = await getClassPlansByClass(plan.classId);
      const match = existing.find((item) => item.weekNumber === plan.weekNumber);
      if (match) {
        await updateClassPlan({ ...plan, id: match.id, createdAt: match.createdAt });
        return;
      }
    }
    throw error;
  }
}

export async function updateClassPlan(plan: ClassPlan) {
  await supabasePatch(
    "/class_plans?id=eq." + encodeURIComponent(plan.id),
    {
      classid: plan.classId,
      startdate: plan.startDate,
      weeknumber: plan.weekNumber,
      phase: plan.phase,
      theme: plan.theme,
      technical_focus: plan.technicalFocus,
      physical_focus: plan.physicalFocus,
      constraints: plan.constraints,
      ruleset: plan.constraints,
      mv_format: plan.mvFormat,
      warmupprofile: plan.warmupProfile,
      source: plan.source,
      jump_target: plan.jumpTarget,
      rpe_target: plan.rpeTarget,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt ?? plan.createdAt,
    }
  );
}

export async function saveClassPlans(plans: ClassPlan[], options?: { organizationId?: string }) {
  if (!plans.length) return;
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePost("/class_plans", plans.map((plan) => ({
    id: plan.id,
    classid: plan.classId,
    organization_id: organizationId ?? undefined,
    startdate: plan.startDate,
    weeknumber: plan.weekNumber,
    phase: plan.phase,
    theme: plan.theme,
    technical_focus: plan.technicalFocus,
    physical_focus: plan.physicalFocus,
    constraints: plan.constraints,
    ruleset: plan.constraints,
    mv_format: plan.mvFormat,
    warmupprofile: plan.warmupProfile,
    source: plan.source,
    jump_target: plan.jumpTarget,
    rpe_target: plan.rpeTarget,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt ?? plan.createdAt,
  })));
}

export async function deleteClassPlansByClass(classId: string) {
  await supabaseDelete(
    "/class_plans?classid=eq." + encodeURIComponent(classId)
  );
}

export async function getExercises(): Promise<Exercise[]> {
  const rows = await supabaseGet<ExerciseRow[]>(
    "/exercises?select=*&order=createdat.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags ?? [],
    videoUrl: row.videourl ?? "",
    source: row.source ?? "",
    description: row.description ?? "",
    publishedAt: row.publishedat ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdat,
  }));
}

export async function saveExercise(exercise: Exercise) {
  await supabasePost("/exercises", [
    {
      id: exercise.id,
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    },
  ]);
}

export async function updateExercise(exercise: Exercise) {
  await supabasePatch(
    "/exercises?id=eq." + encodeURIComponent(exercise.id),
    {
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    }
  );
}

export async function deleteExercise(id: string) {
  await supabaseDelete(
    "/exercises?id=eq." + encodeURIComponent(id)
  );
}

export async function getTrainingTemplates(): Promise<TrainingTemplate[]> {
  try {
    const rows = await supabaseGet<TrainingTemplateRow[]>(
      "/training_templates?select=*&order=createdat.desc"
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ageBand: normalizeAgeBand(row.ageband),
      tags: row.tags ?? [],
      warmup: row.warmup ?? [],
      main: row.main ?? [],
      cooldown: row.cooldown ?? [],
      warmupTime: row.warmuptime ?? "",
      mainTime: row.maintime ?? "",
      cooldownTime: row.cooldowntime ?? "",
      createdAt: row.createdat,
    }));
    await writeCache(CACHE_KEYS.trainingTemplates, mapped);
    return mapped;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await readCache<TrainingTemplate[]>(CACHE_KEYS.trainingTemplates);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function saveTrainingTemplate(
  template: TrainingTemplate
) {
  await supabasePost("/training_templates", [
    {
      id: template.id,
      title: template.title,
      ageband: normalizeAgeBand(template.ageBand),
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    },
  ]);
}

export async function updateTrainingTemplate(
  template: TrainingTemplate
) {
  await supabasePatch(
    "/training_templates?id=eq." + encodeURIComponent(template.id),
    {
      title: template.title,
      ageband: normalizeAgeBand(template.ageBand),
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    }
  );
}

export async function deleteTrainingTemplate(id: string) {
  await supabaseDelete(
    "/training_templates?id=eq." + encodeURIComponent(id)
  );
}

export async function getHiddenTemplates(): Promise<HiddenTemplate[]> {
  const rows = await supabaseGet<HiddenTemplateRow[]>(
    "/training_template_hides?select=*"
  );
  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateid,
    createdAt: row.createdat,
  }));
}

export async function hideTrainingTemplate(templateId: string) {
  await supabasePost("/training_template_hides", [
    {
      id: "hide_" + Date.now(),
      templateid: templateId,
      createdat: new Date().toISOString(),
    },
  ]);
}

export async function getLatestTrainingPlanByClass(
  classId: string
): Promise<TrainingPlan | null> {
  const rows = await supabaseGet<TrainingPlanRow[]>(
    "/training_plans?select=*&classid=eq." +
      encodeURIComponent(classId) +
      "&order=createdat.desc&limit=1"
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    classId: row.classid,
    title: row.title,
    tags: row.tags ?? [],
    warmup: row.warmup ?? [],
    main: row.main ?? [],
    cooldown: row.cooldown ?? [],
    warmupTime: row.warmuptime ?? "",
    mainTime: row.maintime ?? "",
    cooldownTime: row.cooldowntime ?? "",
    applyDays: row.applydays ?? [],
    applyDate: row.applydate ?? "",
    createdAt: row.createdat,
  };
}

const buildStudentsCacheKey = (organizationId: string | null) =>
  organizationId ? `${CACHE_KEYS.students}_${organizationId}` : CACHE_KEYS.students;

export async function getStudents(
  options: { organizationId?: string | null } = {}
): Promise<Student[]> {
  try {
    const activeOrganizationId =
      options.organizationId ?? (await getActiveOrganizationId());
    const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
    const rows = await supabaseGet<StudentRow[]>(
      activeOrganizationId
        ? `/students?select=*&organization_id=eq.${encodeURIComponent(
            activeOrganizationId
          )}&order=name.asc`
        : "/students?select=*&order=name.asc"
    );
    const mapped = rows.map((row) => {
      const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
      return {
        id: row.id,
        name: row.name,
        organizationId: resolvedOrganizationId,
        photoUrl: row.photo_url ?? undefined,
        classId: row.classid,
        age: row.age,
        phone: row.phone,
        loginEmail: row.login_email ?? undefined,
        guardianName: row.guardian_name ?? undefined,
        guardianPhone: row.guardian_phone ?? undefined,
        guardianRelation: row.guardian_relation ?? undefined,
        healthIssue: row.health_issue ?? undefined,
        healthIssueNotes: row.health_issue_notes ?? undefined,
        medicationUse: row.medication_use ?? undefined,
        medicationNotes: row.medication_notes ?? undefined,
        healthObservations: row.health_observations ?? undefined,
        birthDate: row.birthdate ?? "",
        createdAt: row.createdat,
      };
    });
    await writeCache(cacheKey, mapped);
    return mapped;
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId =
        options.organizationId ?? (await getActiveOrganizationId());
      const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
      const cached = await readCache<Student[]>(cacheKey);
      if (cached) return cached;
      return [];
    }
    throw error;
  }
}

export async function getStudentsByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<Student[]> {
  try {
    const activeOrganizationId =
      options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<StudentRow[]>(
      activeOrganizationId
        ? "/students?select=*&classid=eq." +
            encodeURIComponent(classId) +
            "&organization_id=eq." +
            encodeURIComponent(activeOrganizationId) +
            "&order=name.asc"
        : "/students?select=*&classid=eq." + encodeURIComponent(classId) + "&order=name.asc"
    );
    return rows.map((row) => {
      const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
      return {
        id: row.id,
        name: row.name,
        organizationId: resolvedOrganizationId,
        photoUrl: row.photo_url ?? undefined,
        classId: row.classid,
        age: row.age,
        phone: row.phone,
        loginEmail: row.login_email ?? undefined,
        guardianName: row.guardian_name ?? undefined,
        guardianPhone: row.guardian_phone ?? undefined,
        guardianRelation: row.guardian_relation ?? undefined,
        healthIssue: row.health_issue ?? undefined,
        healthIssueNotes: row.health_issue_notes ?? undefined,
        medicationUse: row.medication_use ?? undefined,
        medicationNotes: row.medication_notes ?? undefined,
        healthObservations: row.health_observations ?? undefined,
        birthDate: row.birthdate ?? "",
        createdAt: row.createdat,
      };
    });
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId =
        options.organizationId ?? (await getActiveOrganizationId());
      const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
      const cached = await readCache<Student[]>(cacheKey);
      if (cached) return cached.filter((item) => item.classId === classId);
      return [];
    }
    throw error;
  }
}

export async function getStudentById(
  id: string,
  options: { organizationId?: string | null } = {}
): Promise<Student | null> {
  const activeOrganizationId =
    options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<StudentRow[]>(
    activeOrganizationId
      ? "/students?select=*&id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(activeOrganizationId)
      : "/students?select=*&id=eq." + encodeURIComponent(id)
  );
  const row = rows[0];
  if (!row) return null;
  const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
  return {
    id: row.id,
    name: row.name,
    organizationId: resolvedOrganizationId,
    photoUrl: row.photo_url ?? undefined,
    classId: row.classid,
    age: row.age,
    phone: row.phone,
    loginEmail: row.login_email ?? undefined,
    guardianName: row.guardian_name ?? undefined,
    guardianPhone: row.guardian_phone ?? undefined,
    guardianRelation: row.guardian_relation ?? undefined,
    healthIssue: row.health_issue ?? undefined,
    healthIssueNotes: row.health_issue_notes ?? undefined,
    medicationUse: row.medication_use ?? undefined,
    medicationNotes: row.medication_notes ?? undefined,
    healthObservations: row.health_observations ?? undefined,
    birthDate: row.birthdate ?? "",
    createdAt: row.createdat,
  };
}

export async function saveStudent(student: Student) {
  const normalizedLoginEmail = student.loginEmail?.trim().toLowerCase() || null;
  const activeOrganizationId =
    student.organizationId || (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    id: student.id,
    name: student.name,
    classid: student.classId,
    age: student.age,
    phone: student.phone,
    login_email: normalizedLoginEmail,
    guardian_name: student.guardianName?.trim() || null,
    guardian_phone: student.guardianPhone?.trim() || null,
    guardian_relation: student.guardianRelation?.trim() || null,
    health_issue: student.healthIssue ?? false,
    health_issue_notes: student.healthIssue ? student.healthIssueNotes?.trim() || null : null,
    medication_use: student.medicationUse ?? false,
    medication_notes: student.medicationUse ? student.medicationNotes?.trim() || null : null,
    health_observations: student.healthObservations?.trim() || null,
    birthdate: student.birthDate ? student.birthDate : null,
    createdat: student.createdAt,
  };
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  await supabasePost("/students", [payload]);
}

export async function updateStudent(student: Student) {
  const normalizedLoginEmail = student.loginEmail?.trim().toLowerCase() || null;
  const activeOrganizationId =
    student.organizationId || (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    name: student.name,
    classid: student.classId,
    age: student.age,
    phone: student.phone,
    login_email: normalizedLoginEmail,
    guardian_name: student.guardianName?.trim() || null,
    guardian_phone: student.guardianPhone?.trim() || null,
    guardian_relation: student.guardianRelation?.trim() || null,
    health_issue: student.healthIssue ?? false,
    health_issue_notes: student.healthIssue ? student.healthIssueNotes?.trim() || null : null,
    medication_use: student.medicationUse ?? false,
    medication_notes: student.medicationUse ? student.medicationNotes?.trim() || null : null,
    health_observations: student.healthObservations?.trim() || null,
    birthdate: student.birthDate ? student.birthDate : null,
    createdat: student.createdAt,
  };
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  await supabasePatch(
    "/students?id=eq." + encodeURIComponent(student.id),
    payload
  );
}

export async function updateStudentPhoto(studentId: string, photoUrl: string | null) {
  await supabasePatch(
    "/students?id=eq." + encodeURIComponent(studentId),
    {
      photo_url: photoUrl?.trim() || null,
    }
  );
}

export async function deleteStudent(id: string) {
  await supabaseDelete("/students?id=eq." + encodeURIComponent(id));
}

export async function saveAttendanceRecords(
  classId: string,
  date: string,
  records: AttendanceRecord[],
  options?: { allowQueue?: boolean; organizationId?: string }
) {
  const allowQueue = options?.allowQueue !== false;
  try {
    const organizationId = options?.organizationId ?? (await getActiveOrganizationId());

    await supabaseDelete(
      "/attendance_logs?classid=eq." +
        encodeURIComponent(classId) +
        "&date=eq." +
        encodeURIComponent(date)
    );

    const rows: AttendanceRow[] = records.map((record) => ({
      id: record.id,
      classid: record.classId,
      studentid: record.studentId,
      date: record.date,
      status: record.status,
      note: record.note,
      organization_id: organizationId ?? undefined,
      pain_score:
        typeof record.painScore === "number" && Number.isFinite(record.painScore)
          ? record.painScore
          : null,
      createdat: record.createdAt,
    }));

    if (rows.length > 0) {
      await supabasePost("/attendance_logs", rows);
    }
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({
        id: "queue_att_" + Date.now(),
        kind: "attendance_records",
        payload: { classId, date, records },
        createdAt: new Date().toISOString(),
      });
      return;
    }
    throw error;
  }
}

export async function getAttendanceByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
      : `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&order=date.desc`
  );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      studentId: row.studentid,
      date: row.date,
      status: row.status === "faltou" ? "faltou" : "presente",
      note: row.note ?? "",
      painScore: row.pain_score ?? undefined,
      createdAt: row.createdat,
    }));
  }

export async function getAttendanceByDate(
  classId: string,
  date: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&date=eq.${encodeURIComponent(date)}&organization_id=eq.${encodeURIComponent(organizationId)}`
      : `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&date=eq.${encodeURIComponent(date)}`
  );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      studentId: row.studentid,
      date: row.date,
      status: row.status === "faltou" ? "faltou" : "presente",
      note: row.note ?? "",
      painScore: row.pain_score ?? undefined,
      createdAt: row.createdat,
    }));
  }

export async function getAttendanceByStudent(
  studentId: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<AttendanceRow[]>(
      organizationId
        ? `/attendance_logs?select=*&studentid=eq.${encodeURIComponent(studentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
        : `/attendance_logs?select=*&studentid=eq.${encodeURIComponent(studentId)}&order=date.desc`
    );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      studentId: row.studentid,
      date: row.date,
      status: row.status === "faltou" ? "faltou" : "presente",
      note: row.note ?? "",
      painScore: row.pain_score ?? undefined,
      createdAt: row.createdat,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("22P02") || message.includes("invalid input syntax for type uuid")) return [];
    throw error;
  }
}

export async function getAttendanceAll(
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
      : "/attendance_logs?select=*&order=date.desc"
  );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      studentId: row.studentid,
      date: row.date,
      status: row.status === "faltou" ? "faltou" : "presente",
      note: row.note ?? "",
      painScore: row.pain_score ?? undefined,
      createdAt: row.createdat,
    }));
  }

const mapAbsenceNotice = (row: AbsenceNoticeRow): AbsenceNotice => ({
  id: row.id,
  studentId: row.student_id,
  classId: row.class_id,
  date: row.session_date,
  reason: row.reason,
  note: row.note ?? undefined,
  status:
    row.status === "confirmed"
      ? "confirmed"
      : row.status === "ignored"
      ? "ignored"
      : "pending",
  createdAt: row.created_at,
});

type AbsenceNoticeInput = {
  studentId: string;
  classId: string;
  date: string;
  reason: string;
  note?: string;
  status?: AbsenceNotice["status"];
};

export async function getAbsenceNotices(
  options: { organizationId?: string | null } = {}
): Promise<AbsenceNotice[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AbsenceNoticeRow[]>(
    organizationId
      ? `/absence_notices?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.desc`
      : "/absence_notices?select=*&order=created_at.desc"
  );
  return rows.map(mapAbsenceNotice);
}

export async function createAbsenceNotice(notice: AbsenceNoticeInput, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePost("/absence_notices", [
    {
      student_id: notice.studentId,
      class_id: notice.classId,
      organization_id: organizationId ?? undefined,
      session_date: notice.date,
      reason: notice.reason,
      note: notice.note?.trim() || null,
      status: notice.status ?? "pending",
    },
  ]);
}

export async function updateAbsenceNoticeStatus(
  id: string,
  status: AbsenceNotice["status"]
) {
  await supabasePatch("/absence_notices?id=eq." + encodeURIComponent(id), {
    status,
  });
}
