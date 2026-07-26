import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  ScoutingLog,
  SessionLog,
  StudentScoutingLog,
} from "../core/models";
import { safeJsonParse } from "../utils/safe-json";
import { readCache, writeCache } from "./client";
import type { PendingWriteRow } from "./row-types";
import { db } from "./sqlite";

const WRITE_QUEUE_KEY = "pending_writes_v1";
const WRITE_QUEUE_MIGRATED_KEY = "pending_writes_sqlite_migrated_v1";

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

export const getPendingWriteDedupKey = (write: PendingWrite) => {
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

export const ensurePendingWritesMigrated = async () => {
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
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_requeuedAt ON pending_writes (requeuedAt)"
      );
      await db
        .runAsync("ALTER TABLE pending_writes ADD COLUMN requeuedAt TEXT")
        .catch(() => {});
      await db.runAsync(
        "CREATE TABLE IF NOT EXISTS pending_writes_dead (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, dedupKey TEXT NOT NULL DEFAULT '', retryCount INTEGER NOT NULL DEFAULT 0, finalError TEXT, errorKind TEXT NOT NULL DEFAULT 'unknown', deadAt TEXT NOT NULL, resolvedAt TEXT, resolutionNote TEXT)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_deadAt ON pending_writes_dead (deadAt)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_errorKind ON pending_writes_dead (errorKind)"
      );
      await db.runAsync(
        "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_dedupKey ON pending_writes_dead (dedupKey)"
      );
      await db
        .runAsync(
          "ALTER TABLE pending_writes_dead ADD COLUMN dedupKey TEXT NOT NULL DEFAULT ''"
        )
        .catch(() => {});
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

export const readWriteQueue = async () => {
  try {
    await ensurePendingWritesMigrated();
    const rows = await db.getAllAsync<PendingWriteRow>(
      "SELECT id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey FROM pending_writes ORDER BY createdAt ASC"
    );
    return rows
      .map((row) => {
        const payload = safeJsonParse<unknown | null>(
          row.payload,
          null
        );
        if (payload === null) return null;
        return {
          id: row.id,
          kind: row.kind,
          payload,
          createdAt: row.createdAt,
          requeuedAt: row.requeuedAt,
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
          JSON.stringify(item.payload),
          item.createdAt,
          dedupKey,
        ]
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
    if (dedupKey) {
      await db.runAsync(
        "DELETE FROM pending_writes WHERE dedupKey = ?",
        [dedupKey]
      );
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO pending_writes (id, kind, payload, createdAt, requeuedAt, retryCount, lastError, dedupKey) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?)",
      [
        write.id,
        write.kind,
        JSON.stringify(write.payload),
        write.createdAt,
        dedupKey,
      ]
    );
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
};
