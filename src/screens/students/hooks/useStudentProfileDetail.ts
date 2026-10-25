import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getSessionIdentity } from "../../../auth/session";
import type { Student } from "../../../core/models";
import { getReadCacheGeneration } from "../../../db/client";
import { getStudentById } from "../../../db/students";

// A target must already have been resolved from the authorized directory.
export function useStudentProfileDetail(studentId: string | null, organizationId: string | null, focused: boolean) {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const key = JSON.stringify([identity.userId, identity.generation, generation, organizationId, studentId, focused]);
  const selection = useMemo(() => ({ key }), [key]);
  const context = useRef({ key, selection, epoch: 0 });
  const requireFresh = useRef<typeof selection | null>(null);
  const [retryNumber, setRetryNumber] = useState(0);
  const [state, setState] = useState<{ key: string; student: Student | null; loading: boolean; error: string }>({ key: "", student: null, loading: false, error: "" });
  useLayoutEffect(() => {
    context.current = { key, selection, epoch: context.current.epoch + 1 };
    return () => { context.current = { key: "", selection: { key: "" }, epoch: context.current.epoch + 1 }; };
  }, [key, selection]);
  useEffect(() => {
    if (!focused || !studentId || !organizationId || !identity.userId) return;
    const captured = { ...context.current };
    let active = true;
    const current = () => active && captured.selection === context.current.selection && captured.epoch === context.current.epoch &&
      getSessionIdentity().userId === identity.userId && getSessionIdentity().generation === identity.generation && getReadCacheGeneration() === generation;
    void Promise.resolve().then(async () => {
      if (!current()) return;
      setState({ key, student: null, loading: true, error: "" });
      try {
        const student = await getStudentById(studentId, { organizationId, allowCached: requireFresh.current !== captured.selection });
        if (!current()) return;
        if (!student || student.id !== studentId || student.organizationId !== organizationId) throw new Error("Atleta indisponível nesta organização.");
        setState({ key, student, loading: false, error: "" });
        requireFresh.current = null;
      } catch (error) {
        if (current()) setState({ key, student: null, loading: false, error: error instanceof Error ? error.message : "Não foi possível carregar a ficha." });
      }
    });
    return () => { active = false; };
  }, [key, focused, studentId, organizationId, identity.userId, identity.generation, generation, retryNumber]);
  const replace = useCallback((student: Student) => {
    if (context.current.selection === selection && focused && student.id === studentId && student.organizationId === organizationId &&
      getSessionIdentity().userId === identity.userId && getSessionIdentity().generation === identity.generation && getReadCacheGeneration() === generation) {
      setState({ key, student, loading: false, error: "" });
      requireFresh.current = null;
      return true;
    }
    return false;
  }, [key, selection, focused, studentId, organizationId, identity.userId, identity.generation, generation]);
  const invalidate = useCallback((error: string) => {
    if (context.current.selection !== selection || !focused || getSessionIdentity().userId !== identity.userId || getSessionIdentity().generation !== identity.generation || getReadCacheGeneration() !== generation) return false;
    requireFresh.current = selection;
    setState({ key, student: null, loading: false, error });
    return true;
  }, [key, selection, focused, identity.userId, identity.generation, generation]);
  const available = focused && studentId && state.key === key;
  return { student: available ? state.student : null, loading: Boolean(studentId && focused && (!available || state.loading)),
    error: available ? state.error : "", retry: useCallback(() => setRetryNumber(value => value + 1), []), replace, invalidate };
}
