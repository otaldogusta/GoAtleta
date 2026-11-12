import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../auth/session";
import type { AttendanceRecord } from "../core/models";
import { getReadCacheGeneration } from "./client";
import { getCurrentPendingWriteOrigin, samePendingWriteOrigin } from "./pending-write-identity";
import { isPendingWriteEligible, readWriteQueue } from "./pending-write-storage";

type PendingAttendance = { classId: string; date: string; records: AttendanceRecord[] };

function matchesAttendanceScope(payload: unknown, classId: string, date?: string): payload is PendingAttendance {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<PendingAttendance>;
  return candidate.classId === classId && typeof candidate.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date) && (!date || candidate.date === date) &&
    Array.isArray(candidate.records) && candidate.records.every((record) =>
      record?.classId === classId && record.date === candidate.date &&
      typeof record.id === "string" && typeof record.studentId === "string" &&
      (record.status === "presente" || record.status === "faltou"));
}

export async function getPendingAttendanceRecords(classId: string, date?: string): Promise<PendingAttendance | null> {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const origin = await getCurrentPendingWriteOrigin();
  if (!origin) return null;

  const queue = await readWriteQueue();
  if (!samePendingWriteOrigin(origin, await getCurrentPendingWriteOrigin()) ||
    generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  assertSessionIdentity(identity);

  // There can be one pending replacement per date. With no date in the route,
  // recover the most recently saved replacement for this class.
  let latest: { createdAt: string; payload: PendingAttendance } | null = null;
  for (const write of queue) {
    if (write.kind !== "attendance_records" || !isPendingWriteEligible(write, origin) ||
      !matchesAttendanceScope(write.payload, classId, date)) continue;
    if (!latest || write.createdAt >= latest.createdAt) {
      latest = { createdAt: write.createdAt, payload: write.payload };
    }
  }
  return latest?.payload ?? null;
}
