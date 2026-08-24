import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AttendanceRecord, Student } from "../../core/models";
import {
  getAttendanceByDate,
  getStudentsByClass,
  saveAttendanceRecords,
} from "../../db/seed";

export type EmbeddedAttendanceStatus = "presente" | "faltou" | undefined;

type UseEmbeddedClassAttendanceParams = {
  classId: string;
  date: string;
  enabled: boolean;
};

const emptyStatusMap = (students: Student[]) =>
  Object.fromEntries(students.map((student) => [student.id, undefined])) as Record<
    string,
    EmbeddedAttendanceStatus
  >;

const sameStatusMap = (
  left: Record<string, EmbeddedAttendanceStatus>,
  right: Record<string, EmbeddedAttendanceStatus>
) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? undefined) !== (right[key] ?? undefined)) return false;
  }
  return true;
};

export function useEmbeddedClassAttendance({
  classId,
  date,
  enabled,
}: UseEmbeddedClassAttendanceParams) {
  const loadRequestId = useRef(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusById, setStatusById] = useState<Record<string, EmbeddedAttendanceStatus>>({});
  const [baselineStatusById, setBaselineStatusById] = useState<
    Record<string, EmbeddedAttendanceStatus>
  >({});
  const [recordByStudentId, setRecordByStudentId] = useState<Record<string, AttendanceRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !classId || !date) return;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const [nextStudents, records] = await Promise.all([
        getStudentsByClass(classId),
        getAttendanceByDate(classId, date),
      ]);
      if (loadRequestId.current !== requestId) return;

      const nextStatus = emptyStatusMap(nextStudents);
      const nextRecordByStudentId: Record<string, AttendanceRecord> = {};
      records.forEach((record) => {
        nextStatus[record.studentId] = record.status;
        nextRecordByStudentId[record.studentId] = record;
      });

      setStudents(nextStudents);
      setStatusById(nextStatus);
      setBaselineStatusById(nextStatus);
      setRecordByStudentId(nextRecordByStudentId);
    } catch {
      if (loadRequestId.current !== requestId) return;
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

  const hasChanges = useMemo(
    () => !sameStatusMap(statusById, baselineStatusById),
    [baselineStatusById, statusById]
  );

  const markedCount = useMemo(
    () => Object.values(statusById).filter(Boolean).length,
    [statusById]
  );

  const setStudentStatus = useCallback((studentId: string, status: Exclude<EmbeddedAttendanceStatus, undefined>) => {
    setStatusById((current) => ({
      ...current,
      [studentId]: current[studentId] === status ? undefined : status,
    }));
  }, []);

  const discardChanges = useCallback(() => {
    setStatusById({ ...baselineStatusById });
  }, [baselineStatusById]);

  const save = useCallback(async () => {
    if (!classId || !date || isSaving) return null;
    setIsSaving(true);
    setError(null);
    try {
      const createdAt = new Date().toISOString();
      const records = students.flatMap((student) => {
        const status = statusById[student.id];
        if (!status) return [];
        const existing = recordByStudentId[student.id];
        return [{
          id: existing?.id ?? `${classId}_${student.id}_${date}`,
          classId,
          studentId: student.id,
          date,
          status,
          note: existing?.note ?? "",
          painScore: existing?.painScore ?? 0,
          createdAt: existing?.createdAt ?? createdAt,
        } satisfies AttendanceRecord];
      });
      const result = await saveAttendanceRecords(classId, date, records);
      setBaselineStatusById({ ...statusById });
      setRecordByStudentId(
        Object.fromEntries(records.map((record) => [record.studentId, record]))
      );
      return result;
    } catch (saveError) {
      setError("Não foi possível salvar a chamada.");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, [classId, date, isSaving, recordByStudentId, statusById, students]);

  return {
    students,
    statusById,
    markedCount,
    hasChanges,
    isLoading,
    isSaving,
    error,
    setStudentStatus,
    discardChanges,
    save,
    reload: load,
  };
}
