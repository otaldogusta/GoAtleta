import { useCallback, useMemo, useRef, useState } from "react";

/** Synchronous history commands with reactive availability for toolbar buttons. */
export function useUndoHistory<T>(limit = 20) {
  const entries = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const push = useCallback((entry: T) => {
    const retainedCount = Math.max(0, limit - 1);
    const retained = retainedCount > 0 ? entries.current.slice(-retainedCount) : [];
    entries.current = [...retained, entry];
    setCanUndo(true);
  }, [limit]);
  const pop = useCallback(() => {
    const entry = entries.current.pop();
    setCanUndo(entries.current.length > 0);
    return entry;
  }, []);
  const clear = useCallback(() => {
    entries.current = [];
    setCanUndo(false);
  }, []);
  return useMemo(() => ({ canUndo, push, pop, clear }), [canUndo, push, pop, clear]);
}
