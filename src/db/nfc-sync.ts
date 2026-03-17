// ---------------------------------------------------------------------------
// NFC checkin + pending writes queue
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { AttendanceRecord, ScoutingLog, SessionLog, StudentScoutingLog } from "../core/models";
import { safeJsonParse } from "../utils/safe-json";
import {
  buildSyncPauseError,
  classifyPendingWriteError,
  isNetworkError,
  type PendingWriteErrorKind,
  readCache,
  SYNC_PAUSE_PREFIX,
  supabasePost,
  writeCache,
} from "./client";
import type { PendingWriteRow } from "./row-types";
import { db } from "./sqlite";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WRITE_QUEUE_KEY = "pending_writes_v1";
const WRITE_QUEUE_MIGRATED_KEY = "pending_writes_sqlite_migrated_v1";
const WRITE_FLUSH_BATCH_SIZE = 20;
const WRITE_ITEM_TIMEOUT_MS = 15000;
const WRITE_STRICT_PER_STREAM =
  String(process.env.EXPO_PUBLIC_SYNC_STRICT_PER_STREAM ?? "").toLowerCase() === "true" ||
  String(process.env.EXPO_PUBLIC_SYNC_STRICT_PER_STREAM ?? "") === "1";
const WRITE_STRICT_PER_STREAM_LIMIT = (() => {
  const parsed = Number(process.env.EXPO_PUBLIC_SYNC_STRICT_PER_STREAM_LIMIT ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return WRITE_FLUSH_BATCH_SIZE;
  return Math.min(Math.floor(parsed), WRITE_FLUSH_BATCH_SIZE);
})();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NfcCheckinPendingPayload = {
  organizationId: string;
  classId: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt: string;
  localRef: string;
};

export type PendingWriteDeadRow = {
  id: string;
  kind: PendingWrite["kind"];
  payload: string;
  createdAt: string;
  dedupKey: string;
  retryCount: number;
  finalError: string | null;
  errorKind: PendingWriteErrorKind;
  deadAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type PendingWritesDiagnostics = {
  total: number;
  highRetry: number;
  maxRetry: number;
  deadLetterCandidates: number;
  deadLetterStored: number;
};

export type SyncHealthReport = {
  generatedAt: string;
  organizationId: string | null;
  pendingWrites: PendingWritesDiagnostics;
  recentQueueErrors: { id: string; kind: string; retryCount: number; lastError: string | null }[];
  deadLetterRecent: PendingWriteDeadRow[];
};

export type PendingWriteFailureRow = {
  id: string;
  kind: PendingWrite["kind"];
  dedupKey: string;
  createdAt: string;
  requeuedAt: string | null;
  retryCount: number;
  lastError: string | null;
  streamKey: string;
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PendingWrite = {
  id: string;
  kind:
    | "session_log"
    | "attendance_records"
    | "scouting_log"
    | "student_scouting_log"
    | "nfc_checkin";
  payload: unknown;
  createdAt: string;
  requeuedAt?: string | null;
};

// ---------------------------------------------------------------------------
// Module-level init promise
// ---------------------------------------------------------------------------

let pendingWritesInitPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Dedup key helpers
// ---------------------------------------------------------------------------

export const buildNfcCheckinPendingWriteDedupKey = (
  payload: Pick<NfcCheckinPendingPayload, "organizationId" | "tagUid" | "checkedInAt">,
  fallbackCreatedAt: string
) => {
  if (!payload.organizationId || !payload.tagUid) return null;
  const parsed = Date.parse(payload.checkedInAt || fallbackCreatedAt);
  const baseMs = Number.isFinite(parsed) ? parsed : Date.now();
  const bucket20s = Math.floor(baseMs / 20000);
  return `nfc_checkin:${payload.organizationId}:${payload.tagUid}:${bucket20s}`;
};

const getPendingWriteDedupKey = (write: PendingWrite) => {
  if (write.kind === "session_log") {
    const payload = write.payload as SessionLog;
    if (!payload.classId || !payload.createdAt) return null;
    return `${write.kind}:${payload.classId}:${payload.createdAt.slice(0, 10)}`;
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
  if (write.kind === "nfc_checkin") {
    const payload = write.payload as NfcCheckinPendingPayload;
    return buildNfcCheckinPendingWriteDedupKey(payload, write.createdAt);
  }
  return null;
};

const getPendingWriteStreamKey = (write: PendingWrite) => {
  if (write.kind === "session_log") {
    const payload = write.payload as SessionLog;
    return payload.classId ? `class:${payload.classId}` : `session:${write.id}`;
  }
  if (write.kind === "attendance_records") {
    const payload = write.payload as { classId?: string };
    return payload.classId ? `class:${payload.classId}` : `attendance:${write.id}`;
  }
  if (write.kind === "scouting_log") {
    const payload = write.payload as ScoutingLog;
    return payload.classId ? `class:${payload.classId}` : `scouting:${write.id}`;
  }
  if (write.kind === "student_scouting_log") {
    const payload = write.payload as StudentScoutingLog;
    if (payload.studentId) return `student:${payload.studentId}`;
    if (payload.classId) return `class:${payload.classId}`;
    return `student_scout:${write.id}`;
  }
  if (write.kind === "nfc_checkin") {
    const payload = write.payload as NfcCheckinPendingPayload;
    if (payload.classId) return `class:${payload.classId}`;
    if (payload.organizationId) return `org:${payload.organizationId}`;
    return `nfc_checkin:${write.id}`;
  }
  return `unknown:${write.id}`;
};

// ---------------------------------------------------------------------------
// Sort + batch selection
// ---------------------------------------------------------------------------

const sortPendingWritesForFlush = (left: PendingWrite, right: PendingWrite) => {
  const leftRequeued = left.requeuedAt ? 1 : 0;
  const rightRequeued = right.requeuedAt ? 1 : 0;
  if (leftRequeued !== rightRequeued) return rightRequeued - leftRequeued;
  if (left.requeuedAt && right.requeuedAt) {
    const requeueDiff = left.requeuedAt.localeCompare(right.requeuedAt);
    if (requeueDiff !== 0) return requeueDiff;
  }
  const createdDiff = left.createdAt.localeCompare(right.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return getPendingWriteStreamKey(left).localeCompare(getPendingWriteStreamKey(right));
};

const selectStrictPerStreamBatch = (items: PendingWrite[]) => {
  if (!WRITE_STRICT_PER_STREAM || items.length <= 1) {
    return { selected: items, deferred: [] as PendingWrite[] };
  }
  const head = items[0];
  const stream = getPendingWriteStreamKey(head);
  const selected: PendingWrite[] = [];
  const deferred: PendingWrite[] = [];
  for (const item of items) {
    if (getPendingWriteStreamKey(item) === stream && selected.length < WRITE_STRICT_PER_STREAM_LIMIT) {
      selected.push(item);
    } else {
      deferred.push(item);
    }
  }
  return { selected, deferred };
};

// ---------------------------------------------------------------------------
// Client ID builders (used by session.ts)
// ---------------------------------------------------------------------------

export const buildSessionLogClientId = (log: SessionLog) => {
  const existing = (log.clientId || log.id || "").trim();
  if (existing) return existing;
  const timestamp = Number.isFinite(Date.parse(log.createdAt)) ? Date.parse(log.createdAt) : Date.now();
  const suffix = Number.isFinite(Date.parse(log.createdAt)) ? "" : `_${Math.random().toString(16).slice(2, 6)}`;
  return `session_${log.classId}_${timestamp}${suffix}`;
};

export const buildScoutingLogClientId = (log: ScoutingLog) => {
  const existing = (log.clientId || log.id || "").trim();
  if (existing) return existing;
  const datePart = log.date ? log.date.trim() : "unknown";
  const mode = log.mode === "jogo" ? "jogo" : "treino";
  return `scout_${log.classId}_${datePart}_${mode}`;
};

export const buildStudentScoutingClientId = (log: StudentScoutingLog) => {
  const existing = (log.id || "").trim();
  if (existing) return existing;
  const datePart = log.date ? log.date.trim() : "unknown";
  return `student_scout_${log.studentId}_${log.classId}_${datePart}`;
};

// ---------------------------------------------------------------------------
// SQLite queue helpers
// ---------------------------------------------------------------------------

const ensurePendingWritesMigrated = async () => {
  if (!pendingWritesInitPromise) {
    pendingWritesInitPromise = (async () => {
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, requeuedAt TEXT, retryCount INTEGER NOT NULL DEFAULT 0, lastError TEXT, dedupKey TEXT NOT NULL DEFAULT '')"
      );
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_createdAt ON pending_writes (createdAt)");
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_dedupKey ON pending_writes (dedupKey)");
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_requeuedAt ON pending_writes (requeuedAt)");
      await db.runAsync("ALTER TABLE pending_writes ADD COLUMN requeuedAt TEXT").catch(() => {});
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes_dead (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, dedupKey TEXT NOT NULL DEFAULT '', retryCount INTEGER NOT NULL DEFAULT 0, finalError TEXT, errorKind TEXT NOT NULL DEFAULT 'unknown', deadAt TEXT NOT NULL, resolvedAt TEXT, resolutionNote TEXT)"
      );
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_deadAt ON pending_writes_dead (deadAt)");
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_errorKind ON pending_writes_dead (errorKind)");
      await db.runAsync("CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_dedupKey ON pending_writes_dead (dedupKey)");
      await db.runAsync("ALTER TABLE pending_writes_dead ADD COLUMN dedupKey TEXT NOT NULL DEFAULT ''").catch(() => {});
      await db.runAsync("ALTER TABLE pending_writes_dead ADD COLUMN resolvedAt TEXT").catch(() => {});
      await db.runAsync("ALTER TABLE pending_writes_dead ADD COLUMN resolutionNote TEXT").catch(() => {});

      const migrated = await AsyncStorage.getItem(WRITE_QUEUE_MIGRATED_KEY);
      if (migrated === "1") return;

      const legacy = await readCache<PendingWrite[]>(WRITE_QUEUE_KEY);
      if (legacy?.length) {
        for (const item of legacy) {
          const dedupKey = getPendingWriteDedupKey(item) ?? "";
          await db.runAsync(
            "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
            [item.id, item.kind, JSON.stringify(item.payload), item.createdAt, dedupKey]
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

const readWriteQueue = async () => {
  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC"
    );
    return rows
      .map((row) => {
        const payload = safeJsonParse<unknown | null>(row.payload, null);
        if (payload === null) return null;
        return { id: row.id, kind: row.kind, payload, createdAt: row.createdAt, requeuedAt: row.requeuedAt } as PendingWrite;
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
        "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
        [item.id, item.kind, JSON.stringify(item.payload), item.createdAt, dedupKey]
      );
    }
  } catch {
    await writeCache(WRITE_QUEUE_KEY, queue);
  }
};

export const enqueueWrite = async (write: PendingWrite) => {
  const dedupKey = getPendingWriteDedupKey(write) ?? "";
  try {
    await ensurePendingWritesMigrated();
    if (dedupKey) await db.runAsync("DELETE FROM pending_writes WHERE dedupKey = ?", [dedupKey]);
    await db.runAsync(
      "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
      [write.id, write.kind, JSON.stringify(write.payload), write.createdAt, dedupKey]
    );
  } catch {
    const queue = await readWriteQueue();
    const nextQueue = dedupKey ? queue.filter((item) => getPendingWriteDedupKey(item) !== dedupKey) : queue;
    nextQueue.push(write);
    await writeQueue(nextQueue);
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const movePendingWriteToDead = async (row: PendingWriteRow, errorKind: PendingWriteErrorKind, finalError: string) => {
  await db.runAsync(
    "INSERT OR REPLACE INTO pending_writes_dead (id, kind, payload, createdAt, dedupKey, retryCount, finalError, errorKind, deadAt, resolvedAt, resolutionNote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
    [row.id, row.kind, row.payload, row.createdAt, row.dedupKey, row.retryCount, finalError, errorKind, new Date().toISOString()]
  );
};

// ---------------------------------------------------------------------------
// NFC checkin
// ---------------------------------------------------------------------------

const buildNfcCheckinIdempotencyKey = (payload: NfcCheckinPendingPayload) => {
  const parsed = Date.parse(payload.checkedInAt || "");
  const day = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${payload.organizationId}:${payload.classId ?? "__none__"}:${payload.studentId}:${day}`;
};

const saveNfcCheckinFromQueue = async (payload: NfcCheckinPendingPayload, options?: { allowQueue?: boolean }) => {
  const allowQueue = options?.allowQueue !== false;
  try {
    const idempotencyKey = buildNfcCheckinIdempotencyKey(payload);
    await supabasePost(
      "/attendance_checkins?on_conflict=idempotency_key",
      [{ organization_id: payload.organizationId, class_id: payload.classId ?? null, student_id: payload.studentId, tag_uid: payload.tagUid, source: "nfc", checked_in_at: payload.checkedInAt, idempotency_key: idempotencyKey }],
      { Prefer: "resolution=ignore-duplicates,return=minimal" }
    );
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({ id: payload.localRef || "queue_nfc_" + Date.now(), kind: "nfc_checkin", payload, createdAt: payload.checkedInAt || new Date().toISOString() });
      return;
    }
    throw error;
  }
};

export async function queueNfcCheckinWrite(payload: NfcCheckinPendingPayload) {
  await enqueueWrite({ id: payload.localRef || "queue_nfc_" + Date.now(), kind: "nfc_checkin", payload, createdAt: payload.checkedInAt || new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Public diagnostics
// ---------------------------------------------------------------------------

export async function getPendingWritesCount() {
  try {
    await ensurePendingWritesMigrated();
    const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM pending_writes");
    return row?.count ?? 0;
  } catch {
    return (await readWriteQueue()).length;
  }
}

export async function getPendingWritesDiagnostics(highRetryThreshold = 10): Promise<PendingWritesDiagnostics> {
  try {
    await ensurePendingWritesMigrated();
    const row = await db.getFirstAsync<{ total: number; highRetry: number; maxRetry: number | null }>(
      "SELECT COUNT(*) as total, SUM(CASE WHEN retryCount >= ? THEN 1 ELSE 0 END) as highRetry, MAX(retryCount) as maxRetry FROM pending_writes",
      [highRetryThreshold]
    );
    const deadRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM pending_writes_dead");
    return { total: row?.total ?? 0, highRetry: row?.highRetry ?? 0, maxRetry: row?.maxRetry ?? 0, deadLetterCandidates: row?.highRetry ?? 0, deadLetterStored: deadRow?.count ?? 0 };
  } catch {
    const queue = await readWriteQueue();
    return { total: queue.length, highRetry: 0, maxRetry: 0, deadLetterCandidates: 0, deadLetterStored: 0 };
  }
}

export async function listPendingWriteFailures(limit = 20): Promise<PendingWriteFailureRow[]> {
  try {
    await ensurePendingWritesMigrated();
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes WHERE lastError IS NOT NULL ORDER BY retryCount DESC, createdAt ASC LIMIT ?",
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id, kind: row.kind, dedupKey: row.dedupKey, createdAt: row.createdAt,
      requeuedAt: row.requeuedAt, retryCount: row.retryCount, lastError: row.lastError,
      streamKey: getPendingWriteStreamKey({ id: row.id, kind: row.kind, payload: safeJsonParse<unknown | null>(row.payload, null), createdAt: row.createdAt, requeuedAt: row.requeuedAt }),
    }));
  } catch {
    return [];
  }
}

export async function getPendingWritePayloadById(id: string): Promise<string | null> {
  try {
    await ensurePendingWritesMigrated();
    const row = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM pending_writes WHERE id = ?", [id]);
    return row?.payload ?? null;
  } catch {
    return null;
  }
}

export async function reprocessPendingWriteById(id: string) {
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync("UPDATE pending_writes SET retryCount = 0, lastError = NULL, requeuedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
  } catch {
    return { flushed: 0, remaining: await getPendingWritesCount() };
  }
  return flushPendingWrites();
}

export async function reprocessPendingWritesNetworkFailures(limit = WRITE_FLUSH_BATCH_SIZE) {
  try {
    await ensurePendingWritesMigrated();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const candidates = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM pending_writes WHERE lastError LIKE '[network]%' ORDER BY retryCount DESC, createdAt ASC LIMIT ?",
      [safeLimit]
    );
    if (!candidates.length) return { flushed: 0, remaining: await getPendingWritesCount(), selected: 0 };
    for (const row of candidates) {
      await db.runAsync("UPDATE pending_writes SET retryCount = 0, lastError = NULL, requeuedAt = ? WHERE id = ?", [new Date().toISOString(), row.id]);
    }
    const result = await flushPendingWrites();
    return { ...result, selected: candidates.length };
  } catch {
    return { ...(await flushPendingWrites()), selected: 0 };
  }
}

export async function listPendingWritesDeadLetter(limit = 100): Promise<PendingWriteDeadRow[]> {
  try {
    await ensurePendingWritesMigrated();
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    return await db.getAllAsync<PendingWriteDeadRow>(
      "SELECT id, kind, payload, createdAt, dedupKey, retryCount, finalError, errorKind, deadAt, resolvedAt, resolutionNote FROM pending_writes_dead ORDER BY deadAt DESC LIMIT ?",
      [safeLimit]
    );
  } catch {
    return [];
  }
}

export async function buildSyncHealthReport(options?: { deadLetterLimit?: number; queueErrorLimit?: number; organizationId?: string | null }): Promise<SyncHealthReport> {
  const { getActiveOrganizationId } = await import("./client");
  const deadLetterLimit = Math.max(1, Math.min(options?.deadLetterLimit ?? 25, 1000));
  const queueErrorLimit = Math.max(1, Math.min(options?.queueErrorLimit ?? 15, 500));
  const fallback: SyncHealthReport = {
    generatedAt: new Date().toISOString(),
    organizationId: options?.organizationId ?? (await getActiveOrganizationId()),
    pendingWrites: { total: 0, highRetry: 0, maxRetry: 0, deadLetterCandidates: 0, deadLetterStored: 0 },
    recentQueueErrors: [],
    deadLetterRecent: [],
  };
  try {
    await ensurePendingWritesMigrated();
    const [pendingWrites, deadLetterRecent] = await Promise.all([getPendingWritesDiagnostics(10), listPendingWritesDeadLetter(deadLetterLimit)]);
    const recentQueueErrors = await db.getAllAsync<{ id: string; kind: string; retryCount: number; lastError: string | null }>(
      "SELECT id, kind, retryCount, lastError FROM pending_writes WHERE lastError IS NOT NULL ORDER BY retryCount DESC, createdAt DESC LIMIT ?",
      [queueErrorLimit]
    );
    return { generatedAt: new Date().toISOString(), organizationId: options?.organizationId ?? (await getActiveOrganizationId()), pendingWrites, recentQueueErrors, deadLetterRecent };
  } catch {
    return fallback;
  }
}

export async function exportSyncHealthReportJson(options?: { deadLetterLimit?: number; queueErrorLimit?: number; organizationId?: string | null }) {
  return JSON.stringify(await buildSyncHealthReport(options), null, 2);
}

export async function clearPendingWritesDeadLetterCandidates(highRetryThreshold = 10): Promise<{ removed: number; remaining: number }> {
  try {
    await ensurePendingWritesMigrated();
    const candidates = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes WHERE retryCount >= ?",
      [highRetryThreshold]
    );
    if (candidates.length > 0) {
      for (const row of candidates) await movePendingWriteToDead(row, "unknown", row.lastError ?? "Moved to dead letter by admin action");
      await db.runAsync("DELETE FROM pending_writes WHERE retryCount >= ?", [highRetryThreshold]);
    }
    const remainingRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM pending_writes");
    return { removed: candidates.length, remaining: remainingRow?.count ?? 0 };
  } catch {
    return { removed: 0, remaining: (await readWriteQueue()).length };
  }
}

// ---------------------------------------------------------------------------
// flushPendingWrites — dispatches queued items to their respective save fns
// Uses lazy imports to avoid circular dependencies
// ---------------------------------------------------------------------------

export async function flushPendingWrites() {
  const { saveSessionLog } = await import("./session");
  const { saveScoutingLog, saveStudentScoutingLog } = await import("./session");
  const { saveAttendanceRecords } = await import("./students");

  const flushStartedAt = Date.now();
  let batch: PendingWrite[] = [];
  let deferredBatch: PendingWrite[] = [];
  let usingSqlite = false;
  const batchRowsById = new Map<string, PendingWriteRow>();

  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC LIMIT ?",
      [WRITE_FLUSH_BATCH_SIZE]
    );
    rows.forEach((row) => batchRowsById.set(row.id, row));
    batch = rows
      .map((row) => {
        const payload = safeJsonParse<unknown | null>(row.payload, null);
        if (payload === null) return null;
        return { id: row.id, kind: row.kind, payload, createdAt: row.createdAt, requeuedAt: row.requeuedAt } as PendingWrite;
      })
      .filter((item): item is PendingWrite => Boolean(item));
    batch.sort(sortPendingWritesForFlush);
    const strictSelection = selectStrictPerStreamBatch(batch);
    batch = strictSelection.selected;
    deferredBatch = strictSelection.deferred;
    usingSqlite = true;
  } catch {
    const queue = await readWriteQueue();
    batch = queue.slice(0, WRITE_FLUSH_BATCH_SIZE);
    batch.sort(sortPendingWritesForFlush);
    const strictSelection = selectStrictPerStreamBatch(batch);
    batch = strictSelection.selected;
    deferredBatch = strictSelection.deferred;
  }

  if (!batch.length) {
    Sentry.addBreadcrumb({ category: "sync", message: "flushPendingWrites: empty", level: "info", data: { ms: Date.now() - flushStartedAt } });
    return { flushed: 0, remaining: 0 };
  }

  const remainingBatch: PendingWrite[] = [];
  const failedErrors = new Map<string, string>();
  const deadLetterErrors = new Map<string, { classification: PendingWriteErrorKind; message: string }>();
  const failureByClass: Record<PendingWriteErrorKind, number> = { network: 0, retryable_server: 0, auth: 0, permission: 0, bad_request: 0, unknown: 0 };
  let pauseKind: "auth" | "permission" | null = null;

  for (const item of batch) {
    try {
      if (item.kind === "session_log") {
        await withTimeout(saveSessionLog(item.payload as SessionLog, { allowQueue: false }), WRITE_ITEM_TIMEOUT_MS);
      } else if (item.kind === "attendance_records") {
        const payload = item.payload as { classId: string; date: string; records: AttendanceRecord[] };
        await withTimeout(saveAttendanceRecords(payload.classId, payload.date, payload.records, { allowQueue: false }), WRITE_ITEM_TIMEOUT_MS);
      } else if (item.kind === "scouting_log") {
        await withTimeout(saveScoutingLog(item.payload as ScoutingLog, { allowQueue: false }), WRITE_ITEM_TIMEOUT_MS);
      } else if (item.kind === "student_scouting_log") {
        await withTimeout(saveStudentScoutingLog(item.payload as StudentScoutingLog, { allowQueue: false }), WRITE_ITEM_TIMEOUT_MS);
      } else if (item.kind === "nfc_checkin") {
        await withTimeout(saveNfcCheckinFromQueue(item.payload as NfcCheckinPendingPayload, { allowQueue: false }), WRITE_ITEM_TIMEOUT_MS);
      }
    } catch (error) {
      const classification = classifyPendingWriteError(error);
      failureByClass[classification] += 1;
      if (classification === "bad_request") {
        deadLetterErrors.set(item.id, { classification, message: error instanceof Error ? error.message : String(error) });
      } else {
        remainingBatch.push(item);
        failedErrors.set(item.id, `[${classification}] ${error instanceof Error ? error.message : String(error)}`);
        if (classification === "auth" || classification === "permission") pauseKind = classification;
      }
      Sentry.captureException(error);
    }
  }

  if (usingSqlite) {
    for (const item of batch) {
      const failed = failedErrors.get(item.id);
      if (failed) {
        await db.runAsync("UPDATE pending_writes SET retryCount = retryCount + 1, lastError = ?, requeuedAt = NULL WHERE id = ?", [failed, item.id]);
      } else if (deadLetterErrors.has(item.id)) {
        const originalRow = batchRowsById.get(item.id);
        if (originalRow) {
          const dead = deadLetterErrors.get(item.id)!;
          await movePendingWriteToDead(originalRow, dead.classification, dead.message);
        }
        await db.runAsync("DELETE FROM pending_writes WHERE id = ?", [item.id]);
      } else {
        await db.runAsync("DELETE FROM pending_writes WHERE id = ?", [item.id]);
      }
    }
    const countRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM pending_writes");
    const remaining = countRow?.count ?? 0;
    const elapsedMs = Date.now() - flushStartedAt;
    Sentry.addBreadcrumb({ category: "sync", message: "flushPendingWrites: sqlite", level: "info", data: { ms: elapsedMs, batchSize: batch.length, flushed: batch.length - remainingBatch.length, remaining, failures: failureByClass, deadLettered: deadLetterErrors.size } });
    if (pauseKind) throw buildSyncPauseError(pauseKind);
    return { flushed: batch.length - remainingBatch.length, remaining };
  }

  const queue = await readWriteQueue();
  const untouched = queue.slice(WRITE_FLUSH_BATCH_SIZE);
  const nextQueue = [...remainingBatch, ...deferredBatch, ...untouched];
  await writeQueue(nextQueue);
  Sentry.addBreadcrumb({ category: "sync", message: "flushPendingWrites: fallback", level: "info", data: { ms: Date.now() - flushStartedAt, batchSize: batch.length, flushed: batch.length - remainingBatch.length, remaining: nextQueue.length, failures: failureByClass, deadLettered: deadLetterErrors.size } });
  if (pauseKind) throw buildSyncPauseError(pauseKind);
  return { flushed: batch.length - remainingBatch.length, remaining: nextQueue.length };
}
