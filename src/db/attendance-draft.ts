import AsyncStorage from "@react-native-async-storage/async-storage";

import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../auth/session";
import { createClientId } from "../core/client-id";
import type { AttendanceRecord } from "../core/models";
import { getReadCacheGeneration } from "./client";
import { getCurrentPendingWriteOrigin, samePendingWriteOrigin, type PendingWriteOrigin } from "./pending-write-identity";

const PREFIX = "@goatleta/attendance-draft/v1";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type AttendanceDraftValue = Pick<AttendanceRecord, "status" | "note" | "painScore">;
export type AttendanceDraftEdit = {
  studentId: string;
  before: AttendanceDraftValue | null;
  after: AttendanceDraftValue | null;
  offline: boolean;
};
export type AttendanceDraft = {
  version: 1;
  classId: string;
  date: string;
  revision: string;
  updatedAt: string;
  edits: AttendanceDraftEdit[];
  conflicted?: true;
};
export type AttendanceDraftScope = {
  origin: PendingWriteOrigin;
  classId: string;
  date: string;
};
export type OwnedAttendanceDraft = AttendanceDraft & { origin: PendingWriteOrigin };

const ownerPrefix = (origin: PendingWriteOrigin) =>
  [PREFIX, ...[origin.userId, origin.organizationId].map(encodeURIComponent)].join("/") + "/";
const keyPrefix = (origin: PendingWriteOrigin, classId: string) =>
  ownerPrefix(origin) + encodeURIComponent(classId) + "/";
const draftKey = ({ origin, classId, date }: AttendanceDraftScope) => keyPrefix(origin, classId) + date;
const pendingWrites = new Map<string, Promise<void>>();
const acknowledgementsInFlight = new Map<string, OwnedAttendanceDraft>();

async function captureDraftContext(expected?: PendingWriteOrigin) {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const origin = await getCurrentPendingWriteOrigin();
  if (expected && !samePendingWriteOrigin(expected, origin)) throw new SessionIdentityChangedError();
  if (!origin) return null;
  const assertCurrent = async () => {
    const active = await getCurrentPendingWriteOrigin();
    assertSessionIdentity(identity);
    if (!samePendingWriteOrigin(origin, active) || generation !== getReadCacheGeneration()) {
      throw new SessionIdentityChangedError();
    }
  };
  await assertCurrent();
  return { origin, assertCurrent };
}

const isDraftValue = (raw: unknown): raw is AttendanceDraftValue | null => {
  if (raw === null) return true;
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Partial<AttendanceDraftValue>;
  return (value.status === "presente" || value.status === "faltou") &&
    typeof value.note === "string" && Number.isFinite(value.painScore);
};

function decodeDraft(raw: string | null, classId: string, date: string): AttendanceDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<AttendanceDraft>;
    if (!draft || draft.version !== 1 || draft.classId !== classId || draft.date !== date ||
      !DAY.test(date) || typeof draft.revision !== "string" || !draft.revision ||
      typeof draft.updatedAt !== "string" || !Number.isFinite(Date.parse(draft.updatedAt)) ||
      (draft.conflicted !== undefined && draft.conflicted !== true) ||
      !Array.isArray(draft.edits) || !draft.edits.length ||
      new Set(draft.edits.map((edit) => edit?.studentId)).size !== draft.edits.length ||
      !draft.edits.every((edit) => typeof edit?.studentId === "string" && edit.studentId &&
        isDraftValue(edit.before) && isDraftValue(edit.after) && typeof edit.offline === "boolean")) return null;
    return draft as AttendanceDraft;
  } catch {
    return null;
  }
}

export async function getAttendanceDraft(classId: string, date?: string): Promise<OwnedAttendanceDraft | null> {
  if (!classId || (date !== undefined && !DAY.test(date))) return null;
  const context = await captureDraftContext();
  if (!context) return null;
  const prefix = keyPrefix(context.origin, classId);
  const keys = date === undefined
    ? (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix))
    : [prefix + date];
  let latest: AttendanceDraft | null = null;
  for (const key of keys) {
    await pendingWrites.get(key)?.catch(() => undefined);
    const draft = decodeDraft(await AsyncStorage.getItem(key), classId, key.slice(prefix.length));
    if (draft && (!latest || draft.updatedAt > latest.updatedAt)) latest = draft;
  }
  await context.assertCurrent();
  return latest && { ...latest, origin: context.origin };
}

type DraftMutation = (current: AttendanceDraft | null) => AttendanceDraft | null;

function mutateAttendanceDraft(
  scope: AttendanceDraftScope,
  mutate: DraftMutation,
): Promise<AttendanceDraft | null> {
  const key = draftKey(scope);
  const previous = pendingWrites.get(key);
  const change = async () => {
    const context = await captureDraftContext(scope.origin);
    if (!context) throw new SessionIdentityChangedError();
    const current = decodeDraft(await AsyncStorage.getItem(key), scope.classId, scope.date);
    const draft = mutate(current);
    if (draft === current) return current;
    await context.assertCurrent();
    if (draft) {
      const encoded = JSON.stringify(draft);
      if (!decodeDraft(encoded, scope.classId, scope.date)) throw new Error("Rascunho de chamada inválido.");
      await AsyncStorage.setItem(key, encoded);
    } else {
      await AsyncStorage.removeItem(key);
    }
    return draft;
  };
  const operation = Promise.resolve(previous).then(async () => {
    const locks = globalThis.navigator?.locks;
    return locks?.request ? locks.request(key, change) : change();
  });
  const completed = operation.then(() => undefined, () => undefined);
  pendingWrites.set(key, completed);
  void completed.then(() => { if (pendingWrites.get(key) === completed) pendingWrites.delete(key); });
  return operation;
}

function nextDraft(scope: AttendanceDraftScope, edits: AttendanceDraftEdit[]): AttendanceDraft | null {
  if (!edits.length) return null;
  return {
    version: 1, classId: scope.classId, date: scope.date,
    revision: createClientId(), updatedAt: new Date().toISOString(), edits,
  };
}

export function setAttendanceDraftEdit(input: AttendanceDraftScope & AttendanceDraftEdit & { rebase?: boolean }) {
  const acknowledged = acknowledgementsInFlight.get(draftKey(input))?.edits.find(({ studentId }) => studentId === input.studentId);
  return mutateAttendanceDraft(input, (current) => {
    const previous = current?.edits.find(({ studentId }) => studentId === input.studentId);
    let before = previous && !input.rebase ? previous.before : input.before;
    if (!previous && acknowledged && !input.rebase && sameAttendanceDraftValue(before, acknowledged.before)) {
      before = acknowledged.after;
    }
    const edits = current?.edits.filter(({ studentId }) => studentId !== input.studentId) ?? [];
    // Keep an explicit reversal when an earlier offline edit may already be
    // in flight. Its acknowledgement can rebase the reversal on the server.
    const changed = !sameAttendanceDraftValue(before, input.after);
    if (previous?.offline || changed) {
      edits.push({ studentId: input.studentId, before, after: input.after, offline: input.offline });
    }
    // Continuing the same draft offline includes the work already recorded
    // online. A draft awaiting review stays excluded from automatic sync.
    const promote = changed && input.offline && !current?.conflicted;
    const draft = nextDraft(input, promote ? edits.map((edit) => ({ ...edit, offline: true })) : edits);
    return draft && current?.conflicted && !input.rebase ? { ...draft, conflicted: true } : draft;
  });
}

export function discardAttendanceDraft(draft: OwnedAttendanceDraft) {
  return mutateAttendanceDraft(draft, (current) => current?.revision === draft.revision ? null : current);
}

export async function listOfflineAttendanceDrafts(): Promise<OwnedAttendanceDraft[]> {
  const context = await captureDraftContext();
  if (!context) return [];
  const prefix = ownerPrefix(context.origin);
  const keys = new Set([...(await AsyncStorage.getAllKeys()), ...pendingWrites.keys()].filter((key) => key.startsWith(prefix)));
  const drafts: OwnedAttendanceDraft[] = [];
  for (const key of keys) {
    const [classSegment, date, ...extra] = key.slice(prefix.length).split("/");
    if (!classSegment || !date || extra.length) continue;
    let classId: string;
    try { classId = decodeURIComponent(classSegment); } catch { continue; }
    await pendingWrites.get(key);
    const draft = decodeDraft(await AsyncStorage.getItem(key), classId, date);
    if (!draft || draft.conflicted) continue;
    const edits = draft.edits.filter(({ offline }) => offline);
    if (edits.length) drafts.push({ ...draft, origin: context.origin, edits });
  }
  await context.assertCurrent();
  return drafts;
}

type DraftListener = () => void;
const acknowledgementListeners = new Map<string, Set<DraftListener>>();

export function onAttendanceDraftAcknowledged(scope: AttendanceDraftScope, listener: DraftListener) {
  const key = draftKey(scope);
  const listeners = acknowledgementListeners.get(key) ?? new Set<DraftListener>();
  listeners.add(listener);
  acknowledgementListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) acknowledgementListeners.delete(key);
  };
}

export async function clearAttendanceDraftIfCurrent(draft: OwnedAttendanceDraft, notify = true) {
  let acknowledged = false;
  const key = draftKey(draft);
  acknowledgementsInFlight.set(key, draft);
  try {
    await mutateAttendanceDraft(draft, (current) => {
      if (!current) return null;
      const sent = new Map(draft.edits.map((edit) => [edit.studentId, edit]));
      const edits = current.edits.flatMap((edit) => {
        const submitted = sent.get(edit.studentId);
        if (!submitted || !sameAttendanceDraftValue(edit.before, submitted.before)) return [edit];
        acknowledged = true;
        return sameAttendanceDraftValue(edit.after, submitted.after) ? [] : [{ ...edit, before: submitted.after }];
      });
      return acknowledged ? nextDraft(draft, edits) : current;
    });
  } finally {
    if (acknowledgementsInFlight.get(key) === draft) acknowledgementsInFlight.delete(key);
  }
  if (acknowledged && notify) acknowledgementListeners.get(key)?.forEach((listener) => listener());
}

export async function markAttendanceDraftConflict(draft: OwnedAttendanceDraft) {
  let changed = false;
  await mutateAttendanceDraft(draft, (current) => {
    if (!current || current.revision !== draft.revision || current.conflicted) return current;
    changed = true;
    return { ...current, conflicted: true };
  });
  if (changed) acknowledgementListeners.get(draftKey(draft))?.forEach((listener) => listener());
}

export const attendanceDraftValue = (record?: AttendanceRecord): AttendanceDraftValue | null =>
  record ? { status: record.status, note: record.note ?? "", painScore: record.painScore ?? 0 } : null;

export const sameAttendanceDraftValue = (a: AttendanceDraftValue | null, b: AttendanceDraftValue | null) =>
  a === b || Boolean(a && b && a.status === b.status && a.note === b.note && a.painScore === b.painScore);

/** Overlay only the students changed by the owner, preserving all other rows. */
export function applyAttendanceDraftEdits(
  records: AttendanceRecord[],
  draft: Pick<AttendanceDraft, "classId" | "date" | "updatedAt" | "edits">,
): AttendanceRecord[] {
  const byStudent = new Map(records.map((record) => [record.studentId, record]));
  for (const { studentId, after } of draft.edits) {
    if (!after) {
      byStudent.delete(studentId);
      continue;
    }
    const existing = byStudent.get(studentId);
    byStudent.set(studentId, {
      id: existing?.id ?? `${draft.classId}_${studentId}_${draft.date}`,
      classId: draft.classId, date: draft.date, studentId,
      ...after, createdAt: existing?.createdAt ?? draft.updatedAt,
    });
  }
  return [...byStudent.values()];
}
