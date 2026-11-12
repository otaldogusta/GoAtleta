import { scheduleEffectTask } from "../../hooks/schedule-effect-task";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getStudentPhotoAccessUrl } from "../../api/student-photo-storage";
import type { AttendanceRecord } from "../../core/models";
import { smartSync } from "../../core/smart-sync";
import {
  applyAttendanceDraftEdits, attendanceDraftValue, clearAttendanceDraftIfCurrent, discardAttendanceDraft,
  getAttendanceDraft, onAttendanceDraftAcknowledged, sameAttendanceDraftValue, setAttendanceDraftEdit,
  type AttendanceDraft, type AttendanceDraftScope, type OwnedAttendanceDraft,
} from "../../db/attendance-draft";
import { useIsOnline } from "../../hooks/use-is-online";
import { useAttendanceDateGuard } from "./use-attendance-date-guard";
import { loadEmbeddedAttendance, saveAttendanceRecords, type AttendanceEditorStudent } from "../../db/seed";
import type { getCachedAttendanceEditor } from "../../db/students";
import {
  countMarkedAttendanceStudents,
  mergeAttendanceRecordsPreservingOpaque,
  resolveAttendanceStudentsForDate,
} from "./attendance-roster";

export type EmbeddedAttendanceStatus = "presente" | "faltou" | undefined;
export type EmbeddedAttendanceDetails = { note: string; painScore: number };
export type EmbeddedAttendanceStudent = AttendanceEditorStudent;

type UseEmbeddedClassAttendanceParams = {
  classId: string;
  date: string;
  enabled: boolean;
  onGoToday?: (date: string) => void;
  localSnapshot?: NonNullable<Awaited<ReturnType<typeof getCachedAttendanceEditor>>>;
};

const emptyStatusMap = (students: EmbeddedAttendanceStudent[]) => Object.fromEntries(students.map((student) => [student.id, undefined])) as Record<string, EmbeddedAttendanceStatus>;

const emptyDetailsMap = (students: EmbeddedAttendanceStudent[]) => Object.fromEntries(students.map((student) => [student.id, { note: "", painScore: 0 }])) as Record<string, EmbeddedAttendanceDetails>;

export async function resolveEmbeddedAttendanceStudentPhotos<Student extends EmbeddedAttendanceStudent>(
  students: Student[],
  resolvePhotoAccessUrl: (photoUrl: string | null | undefined) => Promise<string | null> = getStudentPhotoAccessUrl,
) {
  return Promise.all(
    students.map(async (student) => {
      if (!student.photoUrl?.trim()) return student;
      try {
        const photoUrl = await resolvePhotoAccessUrl(student.photoUrl);
        return { ...student, photoUrl: photoUrl ?? undefined };
      } catch {
        return { ...student, photoUrl: undefined };
      }
    }),
  );
}

const sameStatusMap = (left: Record<string, EmbeddedAttendanceStatus>, right: Record<string, EmbeddedAttendanceStatus>) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? undefined) !== (right[key] ?? undefined)) return false;
  }
  return true;
};

const sameDetailsMap = (left: Record<string, EmbeddedAttendanceDetails>, right: Record<string, EmbeddedAttendanceDetails>) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key]?.note ?? "") !== (right[key]?.note ?? "")) return false;
    if ((left[key]?.painScore ?? 0) !== (right[key]?.painScore ?? 0)) return false;
  }
  return true;
};

const DRAFT_CONFLICT = "A chamada foi alterada no servidor. Revise o rascunho antes de salvar.";
const DRAFT_WRITE_FAILED = "Não foi possível guardar o rascunho no dispositivo.";

type AttendanceDraftWrite = {
  operation: Promise<AttendanceDraft | null>;
  offline: boolean;
};

type AttendanceEditorScope = AttendanceDraftScope & {
  assertCurrent: () => Promise<void>;
  visibleStudentIds: Set<string>;
  offline: boolean;
  draft: OwnedAttendanceDraft | null;
  latestWrite: Promise<AttendanceDraft | null> | null;
  discardInFlight?: Promise<AttendanceDraft | null>;
  unstoredWrites: Map<string, AttendanceDraftWrite>;
};

function hasAttendanceDraftConflict(draft: AttendanceDraft | null, records: Record<string, AttendanceRecord>) {
  return Boolean(draft?.conflicted || draft?.edits.some((edit) => {
    const current = attendanceDraftValue(records[edit.studentId]);
    return !sameAttendanceDraftValue(current, edit.before) && !sameAttendanceDraftValue(current, edit.after);
  }));
}

function buildEditorValues(students: EmbeddedAttendanceStudent[], records: AttendanceRecord[]) {
  const status = emptyStatusMap(students);
  const details = emptyDetailsMap(students);
  for (const record of records) {
    status[record.studentId] = record.status;
    details[record.studentId] = { note: record.note ?? "", painScore: record.painScore ?? 0 };
  }
  return { status, details };
}

export function useEmbeddedClassAttendance({ classId, date, enabled, onGoToday, localSnapshot }: UseEmbeddedClassAttendanceParams) {
  const guardDate = useAttendanceDateGuard(classId, date, enabled, onGoToday);
  const isOnline = useIsOnline();
  const latestOnline = useRef(isOnline);
  const loadRequestId = useRef(0);
  const loadedScope = useRef<AttendanceEditorScope | null>(null);
  const editorValues = useRef<ReturnType<typeof buildEditorValues>>({ status: {}, details: {} });
  const stopDraftListener = useRef<() => void>(undefined);
  const saving = useRef(false);
  const [students, setStudents] = useState<EmbeddedAttendanceStudent[]>([]);
  const [statusById, setStatusById] = useState<Record<string, EmbeddedAttendanceStatus>>({});
  const [baselineStatusById, setBaselineStatusById] = useState<Record<string, EmbeddedAttendanceStatus>>({});
  const [detailsById, setDetailsById] = useState<Record<string, EmbeddedAttendanceDetails>>({});
  const [baselineDetailsById, setBaselineDetailsById] = useState<Record<string, EmbeddedAttendanceDetails>>({});
  const [recordByStudentId, setRecordByStudentId] = useState<Record<string, AttendanceRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isDraftDurable, setIsDraftDurable] = useState(true);
  const [draftConflict, setDraftConflict] = useState(false);
  const [draftPendingSync, setDraftPendingSync] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async function loadAttendance(): Promise<void> {
    if (!enabled || !classId || !date) return;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    loadedScope.current = null;
    stopDraftListener.current?.();
    stopDraftListener.current = undefined;
    setIsLoading(true);
    setLoadFailed(false);
    setError(null);

    try {
      if (localSnapshot && localSnapshot.date !== date) throw new Error("Data da cópia local inválida.");
      const snapshot = localSnapshot ? { ...localSnapshot, offline: true }
        : await loadEmbeddedAttendance(classId, date, resolveAttendanceStudentsForDate);
      if (loadRequestId.current !== requestId) return;
      const [studentsWithAccessiblePhotos, draftRead] = await Promise.all([
        localSnapshot ? snapshot.students : resolveEmbeddedAttendanceStudentPhotos(
          snapshot.students,
          (url) => getStudentPhotoAccessUrl(url, { organizationId: snapshot.origin.organizationId }),
        ),
        getAttendanceDraft(classId, date).then(
          (draft) => ({ draft, available: true }),
          () => ({ draft: null, available: false }),
        ),
      ]);
      await snapshot.assertCurrent();
      if (loadRequestId.current !== requestId) return;

      const { draft, available } = draftRead;
      const visibleStudentIds = new Set(studentsWithAccessiblePhotos.map(({ id }) => id));
      const activeDraft = draft && draft.origin.userId === snapshot.origin.userId &&
        draft.origin.organizationId === snapshot.origin.organizationId
        ? { ...draft, edits: draft.edits.filter(({ studentId }) => visibleStudentIds.has(studentId)) }
        : null;
      const baseline = buildEditorValues(studentsWithAccessiblePhotos, snapshot.records);
      const effective = activeDraft
        ? buildEditorValues(studentsWithAccessiblePhotos, applyAttendanceDraftEdits(snapshot.records, activeDraft))
        : baseline;
      const nextRecordByStudentId = Object.fromEntries(snapshot.records.map((record) => [record.studentId, record]));
      const scope: AttendanceEditorScope = {
        classId, date, origin: snapshot.origin, assertCurrent: snapshot.assertCurrent,
        visibleStudentIds, offline: snapshot.offline,
        draft: activeDraft ? draft : null,
        latestWrite: null,
        unstoredWrites: new Map(),
      };
      loadedScope.current = scope;
      if (!localSnapshot) {
        stopDraftListener.current = onAttendanceDraftAcknowledged(scope, () => {
          const write = scope.latestWrite;
          const refresh = () => {
            if (loadedScope.current === scope && scope.latestWrite === write &&
              !scope.unstoredWrites.size && !scope.discardInFlight && !saving.current) void loadAttendance();
          };
          if (write) void write.then(refresh, () => undefined);
          else refresh();
        });
      }
      editorValues.current = effective;
      setIsDraftDurable(available);
      setStudents(studentsWithAccessiblePhotos);
      setStatusById(effective.status);
      setBaselineStatusById(baseline.status);
      setDetailsById(effective.details);
      setBaselineDetailsById(baseline.details);
      setRecordByStudentId(nextRecordByStudentId);
      const hasConflict = hasAttendanceDraftConflict(activeDraft, nextRecordByStudentId);
      setDraftConflict(hasConflict);
      setDraftPendingSync(!hasConflict && Boolean(activeDraft?.edits.some((edit) => edit.offline)));
      if (hasConflict) setError(DRAFT_CONFLICT);
      else if (!available) setError("Não foi possível ler a última cópia do rascunho no dispositivo.");
    } catch {
      if (loadRequestId.current !== requestId) return;
      setStudents([]);
      setStatusById({});
      setBaselineStatusById({});
      setDetailsById({});
      setBaselineDetailsById({});
      setRecordByStudentId({});
      setDraftPendingSync(false);
      setLoadFailed(true);
      setError("Não foi possível carregar a chamada.");
    } finally {
      if (loadRequestId.current === requestId) setIsLoading(false);
    }
  }, [classId, date, enabled, localSnapshot]);

  useEffect(() => {
    const cancelStart = scheduleEffectTask(() => { void load(); });
    return () => {
      cancelStart();
      loadRequestId.current += 1;
      loadedScope.current = null;
      stopDraftListener.current?.();
      stopDraftListener.current = undefined;
    };
  }, [load]);

  useEffect(() => {
    const reconnected = !latestOnline.current && isOnline;
    latestOnline.current = isOnline;
    if (reconnected) {
      smartSync.scheduleSyncAfterWrite();
      const scope = loadedScope.current;
      if (scope?.offline && !scope.unstoredWrites.size && !scope.discardInFlight && !localSnapshot && !saving.current) void load();
    }
  }, [isOnline, load, localSnapshot]);

  const hasChanges = useMemo(() => !sameStatusMap(statusById, baselineStatusById) || !sameDetailsMap(detailsById, baselineDetailsById), [baselineDetailsById, baselineStatusById, detailsById, statusById]);

  const markedCount = useMemo(
    () => countMarkedAttendanceStudents(students, statusById),
    [statusById, students],
  );
  const hasPersistedAttendance = Object.keys(recordByStudentId).length > 0;

  const editStudent = useCallback((
    studentId: string,
    status: EmbeddedAttendanceStatus,
    details: EmbeddedAttendanceDetails,
  ) => {
    const scope = loadedScope.current;
    if (!enabled || saving.current || !scope || scope.classId !== classId || scope.date !== date ||
      !scope.visibleStudentIds.has(studentId)) return;
    const next = {
      status: { ...editorValues.current.status, [studentId]: status },
      details: { ...editorValues.current.details, [studentId]: details },
    };
    editorValues.current = next;
    setStatusById(next.status);
    setDetailsById(next.details);
    const offline = scope.offline || !isOnline || globalThis.navigator?.onLine === false ||
      scope.unstoredWrites.get(studentId)?.offline === true;
    setIsDraftDurable(false);
    const input = {
      ...scope, studentId, offline,
      before: attendanceDraftValue(recordByStudentId[studentId]),
      after: status ? { status, ...details } : null,
      rebase: draftConflict && !offline,
    };
    const write = () => setAttendanceDraftEdit(input);
    const operation = scope.discardInFlight ? scope.discardInFlight.then(write, write) : write();
    scope.latestWrite = operation;
    scope.unstoredWrites.set(studentId, { operation, offline });
    void operation.then((draft) => {
      scope.draft = draft && { ...draft, origin: scope.origin };
      if (scope.unstoredWrites.get(studentId)?.operation !== operation) return;
      scope.unstoredWrites.delete(studentId);
      const durable = scope.unstoredWrites.size === 0;
      const hasOfflineEdits = Boolean(draft?.edits.some((edit) => edit.offline));
      const hasConflict = hasAttendanceDraftConflict(draft, recordByStudentId);
      if (durable && hasOfflineEdits && !hasConflict && latestOnline.current &&
        globalThis.navigator?.onLine !== false) smartSync.scheduleSyncAfterWrite();
      if (loadedScope.current === scope) {
        setIsDraftDurable(durable);
        setDraftConflict(hasConflict);
        setDraftPendingSync(!hasConflict && hasOfflineEdits);
        if (durable) setError(hasConflict ? DRAFT_CONFLICT : null);
      }
    }, () => {
      if (loadedScope.current === scope && scope.unstoredWrites.get(studentId)?.operation === operation) {
        setError(DRAFT_WRITE_FAILED);
      }
    });
  }, [classId, date, draftConflict, enabled, isOnline, recordByStudentId]);

  const setStudentStatus = useCallback((studentId: string, status: Exclude<EmbeddedAttendanceStatus, undefined>) => {
    const next = editorValues.current.status[studentId] === status ? undefined : status;
    const details = next ? editorValues.current.details[studentId] : undefined;
    editStudent(studentId, next, details ?? { note: "", painScore: 0 });
  }, [editStudent]);

  const setStudentDetails = useCallback((studentId: string, details: EmbeddedAttendanceDetails) => {
    const status = editorValues.current.status[studentId];
    if (status) editStudent(studentId, status, details);
  }, [editStudent]);

  const discardChanges = useCallback(() => {
    const scope = loadedScope.current;
    if (!scope || scope.discardInFlight) return;
    const previousWrite = scope.latestWrite;
    scope.unstoredWrites.clear();
    const next = { status: { ...baselineStatusById }, details: { ...baselineDetailsById } };
    editorValues.current = next;
    setStatusById(next.status);
    setDetailsById(next.details);
    setIsDraftDurable(false);
    const discard = Promise.resolve(previousWrite).catch(() => null).then(async () => {
      const draft = scope.draft;
      return draft ? discardAttendanceDraft(draft) : null;
    });
    scope.discardInFlight = discard;
    void discard.then((remaining) => {
      scope.discardInFlight = undefined;
      scope.draft = remaining && { ...remaining, origin: scope.origin };
      if (loadedScope.current !== scope || scope.latestWrite !== previousWrite) return;
      const activeDraft = remaining && {
        ...remaining,
        edits: remaining.edits.filter(({ studentId }) => scope.visibleStudentIds.has(studentId)),
      };
      if (activeDraft) {
        const effective = buildEditorValues(students, applyAttendanceDraftEdits(Object.values(recordByStudentId), activeDraft));
        editorValues.current = effective;
        setStatusById(effective.status);
        setDetailsById(effective.details);
      }
      const hasConflict = hasAttendanceDraftConflict(activeDraft, recordByStudentId);
      setIsDraftDurable(true);
      setDraftConflict(hasConflict);
      setDraftPendingSync(!hasConflict && Boolean(activeDraft?.edits.some((edit) => edit.offline)));
      setError(remaining ? "O rascunho mudou enquanto você descartava. Confira as marcações." : null);
    }, () => {
      scope.discardInFlight = undefined;
      if (loadedScope.current === scope && scope.latestWrite === previousWrite) {
        setError("Não foi possível descartar o rascunho no dispositivo.");
      }
    });
  }, [baselineDetailsById, baselineStatusById, recordByStudentId, students]);

  const save = useCallback(async () => {
    const scope = loadedScope.current;
    if (!enabled || localSnapshot || !scope || scope.classId !== classId || scope.date !== date || isLoading || saving.current || loadFailed) return null;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await scope.latestWrite?.catch(() => null);
      await scope.discardInFlight?.catch(() => null);
      const draft = await getAttendanceDraft(classId, date).catch(() => null);
      await scope.assertCurrent();
      if (scope !== loadedScope.current) return null;
      if (draftConflict || hasAttendanceDraftConflict(draft, recordByStudentId)) {
        setDraftConflict(true);
        setError(DRAFT_CONFLICT);
        return null;
      }
      if ([...scope.unstoredWrites.values()].some(({ offline }) => offline)) {
        setError(DRAFT_WRITE_FAILED);
        return null;
      }
      if (draft?.edits.some((edit) => edit.offline) || (draftPendingSync && !draft)) {
        // The conditional draft RPC owns this version. The older whole-day
        // replacement cannot confirm it against a concurrently changed day.
        if (latestOnline.current && globalThis.navigator?.onLine !== false) smartSync.scheduleSyncAfterWrite();
        return null;
      }
      const { status: saveStatus, details: saveDetails } = editorValues.current;
      const createdAt = new Date().toISOString();
      const nextDetails = emptyDetailsMap(students);
      const visibleRecords = students.flatMap((student) => {
        const status = saveStatus[student.id];
        if (!status) return [];
        const existing = recordByStudentId[student.id];
        const details = saveDetails[student.id] ?? { note: "", painScore: 0 };
        nextDetails[student.id] = {
          note: details.note.trim(),
          painScore: details.painScore,
        };
        return [
          {
          id: existing?.id ?? `${classId}_${student.id}_${date}`,
          classId,
          studentId: student.id,
          date,
          status,
            note: details.note.trim(),
            painScore: details.painScore,
          createdAt: existing?.createdAt ?? createdAt,
          } satisfies AttendanceRecord,
        ];
      });
      const records = mergeAttendanceRecordsPreservingOpaque(
        students.map((student) => student.id),
        visibleRecords,
        Object.values(recordByStudentId),
      );
      const result = await saveAttendanceRecords(classId, date, records, { origin: scope.origin });
      if (scope !== loadedScope.current) return result;
      if (draft && draft.origin.userId === scope.origin.userId && draft.origin.organizationId === scope.origin.organizationId) {
        const savedByStudent = new Map(records.map((record) => [record.studentId, record]));
        const submitted = { ...draft, edits: draft.edits.filter(({ studentId, after }) =>
          scope.visibleStudentIds.has(studentId) && sameAttendanceDraftValue(
            attendanceDraftValue(savedByStudent.get(studentId)), after && { ...after, note: after.note.trim() },
          )) };
        await clearAttendanceDraftIfCurrent(submitted, false).catch(() => {
          if (scope === loadedScope.current) setError("Chamada salva, mas o rascunho ainda está no dispositivo.");
        });
      }
      if (scope !== loadedScope.current) return result;
      scope.unstoredWrites.clear();
      scope.draft = null;
      editorValues.current = { status: saveStatus, details: nextDetails };
      setIsDraftDurable(true);
      setDraftConflict(false);
      setDraftPendingSync(false);
      setBaselineStatusById({ ...saveStatus });
      setDetailsById(nextDetails);
      setBaselineDetailsById(nextDetails);
      setRecordByStudentId(Object.fromEntries(records.map((record) => [record.studentId, record])));
      return result;
    } catch (saveError) {
      setError("Não foi possível salvar a chamada.");
      throw saveError;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }, [classId, date, draftConflict, draftPendingSync, enabled, isLoading, loadFailed, localSnapshot, recordByStudentId, students]);

  return {
    students,
    statusById,
    detailsById,
    markedCount,
    hasPersistedAttendance,
    hasChanges,
    isDraftDurable,
    draftConflict,
    draftPendingSync,
    isLoading,
    isSaving,
    loadFailed,
    error,
    setStudentStatus: (studentId: string, status: Exclude<EmbeddedAttendanceStatus, undefined>) => { void guardDate(() => setStudentStatus(studentId, status)); },
    setStudentDetails: (studentId: string, details: EmbeddedAttendanceDetails) => { void guardDate(() => setStudentDetails(studentId, details)); },
    discardChanges,
    save,
    reload: load,
  };
}
