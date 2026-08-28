import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getStudentPhotoAccessUrl } from "../../api/student-photo-storage";
import type { AttendanceRecord, Student } from "../../core/models";
import { getAttendanceByDate, getStudentsByClass, saveAttendanceRecords } from "../../db/seed";
import {
  countMarkedAttendanceStudents,
  mergeAttendanceRecordsPreservingOpaque,
} from "./attendance-roster";

export type EmbeddedAttendanceStatus = "presente" | "faltou" | undefined;
export type EmbeddedAttendanceDetails = { note: string; painScore: number };

type UseEmbeddedClassAttendanceParams = {
  classId: string;
  date: string;
  enabled: boolean;
};

const emptyStatusMap = (students: Student[]) => Object.fromEntries(students.map((student) => [student.id, undefined])) as Record<string, EmbeddedAttendanceStatus>;

const emptyDetailsMap = (students: Student[]) => Object.fromEntries(students.map((student) => [student.id, { note: "", painScore: 0 }])) as Record<string, EmbeddedAttendanceDetails>;

export async function resolveEmbeddedAttendanceStudentPhotos(
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

export function useEmbeddedClassAttendance({ classId, date, enabled }: UseEmbeddedClassAttendanceParams) {
  const loadRequestId = useRef(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusById, setStatusById] = useState<Record<string, EmbeddedAttendanceStatus>>({});
  const [baselineStatusById, setBaselineStatusById] = useState<Record<string, EmbeddedAttendanceStatus>>({});
  const [detailsById, setDetailsById] = useState<Record<string, EmbeddedAttendanceDetails>>({});
  const [baselineDetailsById, setBaselineDetailsById] = useState<Record<string, EmbeddedAttendanceDetails>>({});
  const [recordByStudentId, setRecordByStudentId] = useState<Record<string, AttendanceRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !classId || !date) return;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setIsLoading(true);
    setLoadFailed(false);
    setError(null);

    try {
      const [nextStudents, records] = await Promise.all([getStudentsByClass(classId), getAttendanceByDate(classId, date)]);
      if (loadRequestId.current !== requestId) return;
      const studentsWithAccessiblePhotos = await resolveEmbeddedAttendanceStudentPhotos(nextStudents);
      if (loadRequestId.current !== requestId) return;

      const nextStatus = emptyStatusMap(studentsWithAccessiblePhotos);
      const nextDetails = emptyDetailsMap(studentsWithAccessiblePhotos);
      const nextRecordByStudentId: Record<string, AttendanceRecord> = {};
      records.forEach((record) => {
        nextStatus[record.studentId] = record.status;
        nextDetails[record.studentId] = {
          note: record.note ?? "",
          painScore: record.painScore ?? 0,
        };
        nextRecordByStudentId[record.studentId] = record;
      });

      setStudents(studentsWithAccessiblePhotos);
      setStatusById(nextStatus);
      setBaselineStatusById(nextStatus);
      setDetailsById(nextDetails);
      setBaselineDetailsById(nextDetails);
      setRecordByStudentId(nextRecordByStudentId);
    } catch {
      if (loadRequestId.current !== requestId) return;
      setLoadFailed(true);
      setError("Não foi possível carregar a chamada.");
    } finally {
      if (loadRequestId.current === requestId) setIsLoading(false);
    }
  }, [classId, date, enabled]);

  useEffect(() => {
    void load();
    return () => {
      loadRequestId.current += 1;
    };
  }, [load]);

  const hasChanges = useMemo(() => !sameStatusMap(statusById, baselineStatusById) || !sameDetailsMap(detailsById, baselineDetailsById), [baselineDetailsById, baselineStatusById, detailsById, statusById]);

  const markedCount = useMemo(
    () => countMarkedAttendanceStudents(students, statusById),
    [statusById, students],
  );

  const setStudentStatus = useCallback((studentId: string, status: Exclude<EmbeddedAttendanceStatus, undefined>) => {
    setStatusById((current) => ({
      ...current,
      [studentId]: current[studentId] === status ? undefined : status,
    }));
  }, []);

  const setStudentDetails = useCallback((studentId: string, details: EmbeddedAttendanceDetails) => {
    setDetailsById((current) => ({ ...current, [studentId]: details }));
  }, []);

  const discardChanges = useCallback(() => {
    setStatusById({ ...baselineStatusById });
    setDetailsById({ ...baselineDetailsById });
  }, [baselineDetailsById, baselineStatusById]);

  const save = useCallback(async () => {
    if (!classId || !date || isLoading || isSaving || loadFailed) return null;
    setIsSaving(true);
    setError(null);
    try {
      const createdAt = new Date().toISOString();
      const nextDetails = emptyDetailsMap(students);
      const visibleRecords = students.flatMap((student) => {
        const status = statusById[student.id];
        if (!status) return [];
        const existing = recordByStudentId[student.id];
        const details = detailsById[student.id] ?? { note: "", painScore: 0 };
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
      const result = await saveAttendanceRecords(classId, date, records);
      setBaselineStatusById({ ...statusById });
      setDetailsById(nextDetails);
      setBaselineDetailsById(nextDetails);
      setRecordByStudentId(Object.fromEntries(records.map((record) => [record.studentId, record])));
      return result;
    } catch (saveError) {
      setError("Não foi possível salvar a chamada.");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, [classId, date, detailsById, isLoading, isSaving, loadFailed, recordByStudentId, statusById, students]);

  return {
    students,
    statusById,
    detailsById,
    markedCount,
    hasChanges,
    isLoading,
    isSaving,
    loadFailed,
    error,
    setStudentStatus,
    setStudentDetails,
    discardChanges,
    save,
    reload: load,
  };
}
