import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type {
  ScoutingLog,
  SessionLog,
  StudentScoutingLog,
} from "../core/models";
import { safeJsonParse } from "../utils/safe-json";
import { readCache, writeCache, type PendingWriteErrorKind } from "./client";
import type { PendingWriteRow } from "./row-types";
import { db } from "./sqlite";
import { samePendingWriteOrigin, type PendingWriteOrigin } from "./pending-write-identity";

const WRITE_QUEUE_KEY = "pending_writes_v1";
const WRITE_QUEUE_MIGRATED_KEY = "pending_writes_sqlite_migrated_v1";
const WRITE_ARCHIVE_KEY = "pending_writes_archive_v2";

export type NfcCheckinPendingPayload = {
  organizationId: string;
  classId: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt: string;
  localRef: string;
};

export type PendingWrite = {
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
  // Missing origin means legacy quarantine. Never infer ownership on migration.
  origin?: PendingWriteOrigin;
  retryCount?: number;
  lastError?: string | null;
};

export const serializePendingWritePayload = (write: PendingWrite) =>
  JSON.stringify(write.origin ? { queueVersion: 2, origin: write.origin, data: write.payload } : write.payload);

export const decodePendingWritePayload = (raw: string): Pick<PendingWrite, "payload" | "origin"> => {
  const decoded = safeJsonParse<unknown>(raw, null);
  if (decoded && typeof decoded === "object" && "queueVersion" in decoded) {
    const envelope = decoded as { queueVersion: unknown; origin?: Partial<PendingWriteOrigin>; data?: unknown };
    if (envelope.queueVersion === 2 && typeof envelope.origin?.userId === "string" &&
      envelope.origin.userId && typeof envelope.origin.organizationId === "string" && envelope.origin.organizationId) {
      return { payload: envelope.data, origin: envelope.origin as PendingWriteOrigin };
    }
    // Malformed/future envelopes remain preserved and are not eligible to run.
    return { payload: decoded };
  }
  return { payload: decoded };
};

export const isPendingWriteEligible = (write: PendingWrite, origin: PendingWriteOrigin | null) =>
  samePendingWriteOrigin(write.origin, origin);

// Serialize read-modify-write on the web fallback and native replacement writes.
let queueMutationTail: Promise<unknown> = Promise.resolve();
export const withPendingWriteLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = queueMutationTail.then(operation, operation);
  queueMutationTail = result.catch(() => {});
  return result;
};

let pendingWritesInitPromise: Promise<void> | null = null;

export const buildNfcCheckinPendingWriteDedupKey = (
  payload: Pick<
    NfcCheckinPendingPayload,
    "organizationId" | "tagUid" | "checkedInAt"
  >,
  fallbackCreatedAt: string
) => {
  if (!payload.organizationId || !payload.tagUid) return null;
  const parsed = Date.parse(payload.checkedInAt || fallbackCreatedAt);
  const baseMs = Number.isFinite(parsed) ? parsed : Date.now();
  const bucket20s = Math.floor(baseMs / 20000);
  return `nfc_checkin:${payload.organizationId}:${payload.tagUid}:${bucket20s}`;
};

const getEntityDedupKey = (write: PendingWrite) => {
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
    return buildNfcCheckinPendingWriteDedupKey(
      payload,
      write.createdAt
    );
  }
  return null;
};

export const getPendingWriteDedupKey = (write: PendingWrite) => {
  const entityKey = getEntityDedupKey(write);
  if (!entityKey) return null;
  return write.origin ? `${write.origin.userId}:${write.origin.organizationId}:${entityKey}` : `legacy:${entityKey}`;
};

export const ensurePendingWritesMigrated = async () => {
  // The browser SQL adapter is not a persistent queue backend.
  if (Platform.OS === "web") throw new Error("Pending writes use browser storage");
  if (!pendingWritesInitPromise) {
    pendingWritesInitPromise = (async () => {
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, requeuedAt TEXT, retryCount INTEGER NOT NULL DEFAULT 0, lastError TEXT, dedupKey TEXT NOT NULL DEFAULT '')"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_createdAt ON pending_writes (createdAt)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dedupKey ON pending_writes (dedupKey)"
      );
      await db
        .runAsync("ALTER TABLE pending_writes ADD COLUMN requeuedAt TEXT")
        .catch(() => {});
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_requeuedAt ON pending_writes (requeuedAt)"
      );
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes_dead (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, dedupKey TEXT NOT NULL DEFAULT '', retryCount INTEGER NOT NULL DEFAULT 0, finalError TEXT, errorKind TEXT NOT NULL DEFAULT 'unknown', deadAt TEXT NOT NULL, resolvedAt TEXT, resolutionNote TEXT)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_deadAt ON pending_writes_dead (deadAt)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_errorKind ON pending_writes_dead (errorKind)"
      );
      await db
        .runAsync(
          "ALTER TABLE pending_writes_dead ADD COLUMN dedupKey TEXT NOT NULL DEFAULT ''"
        )
        .catch(() => {});
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_dedupKey ON pending_writes_dead (dedupKey)"
      );
      await db
        .runAsync(
          "ALTER TABLE pending_writes_dead ADD COLUMN resolvedAt TEXT"
        )
        .catch(() => {});
      await db
        .runAsync(
          "ALTER TABLE pending_writes_dead ADD COLUMN resolutionNote TEXT"
        )
        .catch(() => {});

      const migrated = await AsyncStorage.getItem(
        WRITE_QUEUE_MIGRATED_KEY
      );
      if (migrated === "1") return;

      const legacy = await readCache<PendingWrite[]>(WRITE_QUEUE_KEY);
      if (legacy?.length) {
        for (const item of legacy) {
          const dedupKey = getPendingWriteDedupKey(item) ?? "";
          await db.runAsync(
            "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
            [
              item.id,
              item.kind,
              serializePendingWritePayload(item),
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

export const readWriteQueue = async () => {
  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC"
    );
    return rows
      .map((row) => {
        const decoded = decodePendingWritePayload(row.payload);
        return {
          id: row.id,
          kind: row.kind,
          ...decoded,
          createdAt: row.createdAt,
          requeuedAt: row.requeuedAt,
          retryCount: row.retryCount,
          lastError: row.lastError,
        } as PendingWrite;
      })
      .filter((item): item is PendingWrite => Boolean(item));
  } catch {
    const stored = await readCache<PendingWrite[]>(WRITE_QUEUE_KEY);
    return stored ?? [];
  }
};

export const writeQueue = async (queue: PendingWrite[]) => {
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync("DELETE FROM pending_writes");
    for (const item of queue) {
      const dedupKey = getPendingWriteDedupKey(item) ?? "";
      await db.runAsync(
        "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
        [
          item.id,
          item.kind,
          serializePendingWritePayload(item),
          item.createdAt,
          dedupKey,
        ]
      );
    }
  } catch {
    await writeCache(WRITE_QUEUE_KEY, queue);
  }
};

export const enqueueWrite = (write: PendingWrite) => withPendingWriteLock(async () => {
  if (write.origin) {
    const prefix = `owned:${encodeURIComponent(write.origin.userId)}:${encodeURIComponent(write.origin.organizationId)}:`;
    if (!write.id.startsWith(prefix)) write = { ...write, id: `${prefix}${write.id}` };
  }
  const dedupKey = getPendingWriteDedupKey(write) ?? "";
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync(
      "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
      [
        write.id,
        write.kind,
        serializePendingWritePayload(write),
        write.createdAt,
        dedupKey,
      ]
    );
    // Write the replacement first so a storage error cannot erase the draft.
    if (dedupKey) {
      await db.runAsync("DELETE FROM pending_writes WHERE dedupKey = ? AND id <> ?", [dedupKey, write.id]);
    }
  } catch {
    const queue = await readWriteQueue();
    const nextQueue = dedupKey
      ? queue.filter(
          (item) => getPendingWriteDedupKey(item) !== dedupKey
        )
      : queue;
    nextQueue.push(write);
    await writeQueue(nextQueue);
  }
});

/** Removes only the version that was sent; preserves new edits made mid-flight. */
export const completePendingWrite = (write: PendingWrite) => withPendingWriteLock(async () => {
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync("DELETE FROM pending_writes WHERE id = ? AND payload = ?", [write.id, serializePendingWritePayload(write)]);
  } catch {
    const queue = await readWriteQueue();
    await writeQueue(queue.filter((item) => item.id !== write.id || serializePendingWritePayload(item) !== serializePendingWritePayload(write)));
  }
});

export const recordPendingWriteFailure = (write: PendingWrite, lastError: string) => withPendingWriteLock(async () => {
  try {
    await ensurePendingWritesMigrated();
    await db.runAsync("UPDATE pending_writes SET retryCount = retryCount + 1, lastError = ?, requeuedAt = NULL WHERE id = ? AND payload = ?",
      [lastError, write.id, serializePendingWritePayload(write)]);
  } catch {
    const queue = await readWriteQueue();
    await writeQueue(queue.map((item) => item.id === write.id && serializePendingWritePayload(item) === serializePendingWritePayload(write)
      ? { ...item, retryCount: (item.retryCount ?? 0) + 1, lastError } : item));
  }
});

export const getPendingWriteQuarantineSummary = async () => {
  const queue = await readWriteQueue();
  return { missingOrigin: queue.filter((item) => !item.origin).length };
};

export type ArchivedPendingWrite = { write: PendingWrite; errorKind: PendingWriteErrorKind; archivedAt: string };
export const readArchivedPendingWrites = async (): Promise<ArchivedPendingWrite[]> =>
  (await readCache<ArchivedPendingWrite[]>(WRITE_ARCHIVE_KEY)) ?? [];

/** Durable repair archive on both platforms. Persist before acknowledging. */
export const archivePendingWrite = async (write: PendingWrite, errorKind: PendingWriteErrorKind) => {
  await withPendingWriteLock(async () => {
    const archive = await readArchivedPendingWrites();
    const existing = archive.some((item) => item.write.id === write.id &&
      serializePendingWritePayload(item.write) === serializePendingWritePayload(write));
    if (!existing) {
      archive.push({ write, errorKind, archivedAt: new Date().toISOString() });
      await AsyncStorage.setItem(WRITE_ARCHIVE_KEY, JSON.stringify(archive));
    }
  });
  await completePendingWrite(write);
};
