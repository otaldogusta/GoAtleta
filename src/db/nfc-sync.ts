// ---------------------------------------------------------------------------
// NFC checkin + pending writes queue
// ---------------------------------------------------------------------------

import type { AttendanceRecord, ScoutingLog, SessionLog, StudentScoutingLog } from "../core/models";
import {
  buildSyncPauseError,
  getActiveOrganizationId,
  classifyPendingWriteError,
  isDeferredWriteError,
  type PendingWriteErrorKind,
  supabasePost,
} from "./client";
import {
  enqueueWrite,
  archivePendingWrite,
  readArchivedPendingWrites,
  completePendingWrite,
  decodePendingWritePayload,
  isPendingWriteEligible,
  recordPendingWriteFailure,
  serializePendingWritePayload,
  getPendingWriteQuarantineSummary,
  getPendingWriteDedupKey,
  ensurePendingWritesMigrated,
  readWriteQueue,
  type NfcCheckinPendingPayload,
  type PendingWrite,
} from "./pending-write-storage";
import type { PendingWriteRow } from "./row-types";
import { db } from "./sqlite";
import { capturePendingWriteContext, getCurrentPendingWriteOrigin, samePendingWriteOrigin, type PendingWriteOrigin } from "./pending-write-identity";
import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
import { saveSessionLog, saveScoutingLog, saveStudentScoutingLog } from "./session";
import { saveAttendanceRecords } from "./students";

export {
  buildNfcCheckinPendingWriteDedupKey,
  enqueueWrite,
} from "./pending-write-storage";
export type { NfcCheckinPendingPayload } from "./pending-write-storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WRITE_FLUSH_BATCH_SIZE = 20;
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
  quarantinedMissingOrigin?: number;
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

const saveNfcCheckinFromQueue = async (payload: NfcCheckinPendingPayload, options?: { allowQueue?: boolean; origin?: PendingWriteOrigin }) => {
  const allowQueue = options?.allowQueue !== false;
  const context = await capturePendingWriteContext(payload.organizationId, options?.origin);
  try {
    const idempotencyKey = buildNfcCheckinIdempotencyKey(payload);
    await supabasePost(
      "/attendance_checkins?on_conflict=idempotency_key",
      [{ organization_id: payload.organizationId, class_id: payload.classId ?? null, student_id: payload.studentId, tag_uid: payload.tagUid, source: "nfc", checked_in_at: payload.checkedInAt, idempotency_key: idempotencyKey }],
      { Prefer: "resolution=ignore-duplicates,return=minimal" }, context.identity,
    );
  } catch (error) {
    if (allowQueue && isDeferredWriteError(error)) {
      await enqueueWrite({ id: payload.localRef || "queue_nfc_" + Date.now(), kind: "nfc_checkin", origin: context.origin, payload, createdAt: payload.checkedInAt || new Date().toISOString() });
      return;
    }
    throw error;
  }
};

export async function queueNfcCheckinWrite(payload: NfcCheckinPendingPayload) {
  const context = await capturePendingWriteContext(payload.organizationId);
  await enqueueWrite({ id: payload.localRef || "queue_nfc_" + Date.now(), kind: "nfc_checkin", origin: context.origin, payload, createdAt: payload.checkedInAt || new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Public diagnostics
// ---------------------------------------------------------------------------

const readOwnedWriteQueue = async () => {
  const identity = getSessionIdentity();
  const origin = await getCurrentPendingWriteOrigin();
  const queue = await readWriteQueue();
  assertSessionIdentity(identity);
  return queue.filter((item) => isPendingWriteEligible(item, origin));
};

export async function getPendingWritesCount() {
  return (await readOwnedWriteQueue()).length;
}

export async function getPendingWritesDiagnostics(highRetryThreshold = 10): Promise<PendingWritesDiagnostics> {
  const queue = await readOwnedWriteQueue();
  const highRetry = queue.filter((item) => (item.retryCount ?? 0) >= highRetryThreshold).length;
  const quarantine = await getPendingWriteQuarantineSummary();
  return { total: queue.length, highRetry, maxRetry: Math.max(0, ...queue.map((item) => item.retryCount ?? 0)),
    deadLetterCandidates: highRetry, deadLetterStored: (await listPendingWritesDeadLetter(1000)).length,
    quarantinedMissingOrigin: quarantine.missingOrigin };
}

export async function listPendingWriteFailures(limit = 20): Promise<PendingWriteFailureRow[]> {
  const queue = await readOwnedWriteQueue();
  return queue.filter((item) => item.lastError).sort((a, b) => (b.retryCount ?? 0) - (a.retryCount ?? 0))
    .slice(0, Math.max(1, Math.min(limit, 200))).map((item) => ({
      id: item.id, kind: item.kind, dedupKey: getPendingWriteDedupKey(item) ?? "", createdAt: item.createdAt,
      requeuedAt: item.requeuedAt ?? null, retryCount: item.retryCount ?? 0,
      lastError: item.lastError ?? null, streamKey: getPendingWriteStreamKey(item),
    }));
}

export async function getPendingWritePayloadById(id: string): Promise<string | null> {
  const item = (await readOwnedWriteQueue()).find((write) => write.id === id);
  return item ? JSON.stringify(item.payload) : null;
}

export async function reprocessPendingWriteById(id: string) {
  if (!(await readOwnedWriteQueue()).some((item) => item.id === id)) {
    return { flushed: 0, remaining: await getPendingWritesCount() };
  }
  return flushPendingWrites();
}

export async function reprocessPendingWritesNetworkFailures(limit = WRITE_FLUSH_BATCH_SIZE) {
  const candidates = (await listPendingWriteFailures(limit)).filter((item) => item.lastError?.startsWith("[network]"));
  if (!candidates.length) return { flushed: 0, remaining: await getPendingWritesCount(), selected: 0 };
  return { ...await flushPendingWrites(), selected: candidates.length };
}

export async function listPendingWritesDeadLetter(limit = 100): Promise<PendingWriteDeadRow[]> {
  const archiveIdentity = getSessionIdentity();
  const currentOrigin = await getCurrentPendingWriteOrigin();
  const archive = (await readArchivedPendingWrites()).filter((item) => samePendingWriteOrigin(item.write.origin, currentOrigin))
    .map(({ write, errorKind, archivedAt }) => ({
      id: write.id, kind: write.kind, payload: JSON.stringify(write.payload), createdAt: write.createdAt,
      dedupKey: getPendingWriteDedupKey(write) ?? "", retryCount: write.retryCount ?? 0,
      finalError: "Falha de validação; conteúdo preservado para revisão.", errorKind,
      deadAt: archivedAt, resolvedAt: null, resolutionNote: null,
    }));
  assertSessionIdentity(archiveIdentity);
  try {
    await ensurePendingWritesMigrated();
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const origin = await getCurrentPendingWriteOrigin();
    const identity = getSessionIdentity();
    const rows = await db.getAllAsync<PendingWriteDeadRow>(
      "SELECT id, kind, payload, createdAt, dedupKey, retryCount, finalError, errorKind, deadAt, resolvedAt, resolutionNote FROM pending_writes_dead ORDER BY deadAt DESC LIMIT ?",
      [safeLimit]
    );
    assertSessionIdentity(identity);
    return [...archive, ...rows.filter((row) => samePendingWriteOrigin(decodePendingWritePayload(row.payload).origin, origin))
      .map((row) => ({ ...row, payload: JSON.stringify(decodePendingWritePayload(row.payload).payload) }))].slice(0, safeLimit);
  } catch {
    assertSessionIdentity(archiveIdentity);
    return archive.slice(0, Math.max(1, Math.min(limit, 1000)));
  }
}

export async function buildSyncHealthReport(options?: { deadLetterLimit?: number; queueErrorLimit?: number; organizationId?: string | null }): Promise<SyncHealthReport> {
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
    const recentQueueErrors = await listPendingWriteFailures(queueErrorLimit);
    return { generatedAt: new Date().toISOString(), organizationId: options?.organizationId ?? (await getActiveOrganizationId()), pendingWrites, recentQueueErrors, deadLetterRecent };
  } catch {
    return fallback;
  }
}

export async function exportSyncHealthReportJson(options?: { deadLetterLimit?: number; queueErrorLimit?: number; organizationId?: string | null }) {
  return JSON.stringify(await buildSyncHealthReport(options), null, 2);
}

export async function clearPendingWritesDeadLetterCandidates(highRetryThreshold = 10): Promise<{ removed: number; remaining: number }> {
  const candidates = (await readOwnedWriteQueue()).filter((item) => (item.retryCount ?? 0) >= highRetryThreshold);
  let removed = 0;
  for (const item of candidates) {
    try {
      await ensurePendingWritesMigrated();
      await movePendingWriteToDead({ id: item.id, kind: item.kind, payload: serializePendingWritePayload(item),
        createdAt: item.createdAt, requeuedAt: item.requeuedAt ?? null, retryCount: item.retryCount ?? 0,
        lastError: item.lastError ?? null, dedupKey: getPendingWriteDedupKey(item) ?? "" },
        "unknown", "Arquivado por ação explícita do titular.");
      await completePendingWrite(item);
      removed += 1;
    } catch {
      // Unsupported web dead-letter storage: retain the original pending data.
    }
  }
  return { removed, remaining: await getPendingWritesCount() };
}

// ---------------------------------------------------------------------------
// flushPendingWrites — dispatches queued items to their respective save fns
// Queue storage is independent of domain save functions, so dispatch needs no
// dynamic import cycle or global registration.
// ---------------------------------------------------------------------------

let flushInFlight: Promise<{ flushed: number; remaining: number }> | null = null;

export async function flushPendingWrites() {
  if (flushInFlight) return flushInFlight;
  const operation = flushOwnedPendingWrites();
  flushInFlight = operation;
  try { return await operation; }
  finally { if (flushInFlight === operation) flushInFlight = null; }
}

async function flushOwnedPendingWrites() {
  const origin = await getCurrentPendingWriteOrigin();
  if (!origin) throw buildSyncPauseError("auth");
  const identity = getSessionIdentity();
  const queue = await readWriteQueue();
  const eligible = queue.filter((item) => isPendingWriteEligible(item, origin));
  eligible.sort(sortPendingWritesForFlush);
  const { selected: batch } = selectStrictPerStreamBatch(eligible.slice(0, WRITE_FLUSH_BATCH_SIZE));
  let flushed = 0;
  let pauseKind: "auth" | "permission" | null = null;

  for (const item of batch) {
    assertSessionIdentity(identity);
    // Organization switches must stop the batch before the next write. Unknown
    // legacy ownership is deliberately excluded instead of adopted by this user.
    if (!samePendingWriteOrigin(origin, await getCurrentPendingWriteOrigin())) break;
    const options = { allowQueue: false, organizationId: origin.organizationId, origin };
    try {
      if (item.kind === "session_log") {
        await saveSessionLog(item.payload as SessionLog, options);
      } else if (item.kind === "attendance_records") {
        const payload = item.payload as { classId: string; date: string; records: AttendanceRecord[] };
        await saveAttendanceRecords(payload.classId, payload.date, payload.records, options);
      } else if (item.kind === "scouting_log") {
        await saveScoutingLog(item.payload as ScoutingLog, options);
      } else if (item.kind === "student_scouting_log") {
        await saveStudentScoutingLog(item.payload as StudentScoutingLog, options);
      } else if (item.kind === "nfc_checkin") {
        await saveNfcCheckinFromQueue(item.payload as NfcCheckinPendingPayload, options);
      } else {
        continue; // Preserve future/unknown operations, never acknowledge blindly.
      }
      await completePendingWrite(item);
      flushed += 1;
    } catch (error) {
      const classification = classifyPendingWriteError(error);
      if (classification === "bad_request") {
        await archivePendingWrite(item, classification);
        continue;
      }
      await recordPendingWriteFailure(item, `[${classification}] Falha ao sincronizar (${item.kind}).`);
      if (classification === "auth" || classification === "permission") {
        pauseKind = classification;
        break;
      }
      // Retryable writes remain pending. Invalid writes were durably archived
      // above and are never counted as a successful synchronization.
    }
  }
  const remaining = (await readWriteQueue()).filter((item) => isPendingWriteEligible(item, origin)).length;
  if (pauseKind) throw buildSyncPauseError(pauseKind);
  return { flushed, remaining };
}
