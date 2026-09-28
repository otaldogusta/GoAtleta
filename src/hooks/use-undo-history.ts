import { useCallback, useMemo, useRef, useState } from "react";

/** Synchronous history commands with reactive availability for toolbar buttons. */
export function useUndoHistory<T>(limit = 20) {
  const entries = useRef<T[]>([]);
  const futureEntries = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const push = useCallback((entry: T) => {
    const retainedCount = Math.max(0, limit - 1);
    const retained = retainedCount > 0 ? entries.current.slice(-retainedCount) : [];
    entries.current = [...retained, entry];
    futureEntries.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [limit]);
  const pop = useCallback(() => {
    const entry = entries.current.pop();
    setCanUndo(entries.current.length > 0);
    return entry;
  }, []);
  const undo = useCallback((current: T) => {
    const entry = entries.current.pop();
    if (entry === undefined) return undefined;
    futureEntries.current.push(current);
    setCanUndo(entries.current.length > 0);
    setCanRedo(true);
    return entry;
  }, []);
  const redo = useCallback((current: T) => {
    const entry = futureEntries.current.pop();
    if (entry === undefined) return undefined;
    const retainedCount = Math.max(0, limit - 1);
    const retained = retainedCount > 0 ? entries.current.slice(-retainedCount) : [];
    entries.current = [...retained, current];
    setCanUndo(true);
    setCanRedo(futureEntries.current.length > 0);
    return entry;
  }, [limit]);
  const clear = useCallback(() => {
    entries.current = [];
    futureEntries.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);
  return useMemo(
    () => ({ canUndo, canRedo, push, pop, undo, redo, clear }),
    [canRedo, canUndo, clear, pop, push, redo, undo]
  );
}
