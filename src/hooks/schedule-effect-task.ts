/**
 * Start an external operation after the commit finishes. React can cancel the
 * discarded Strict Mode setup before a request, dialog or loading state starts.
 * The caller still owns cancellation and error handling once the operation starts.
 */
export function scheduleEffectTask(start: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) start();
  });
  return () => { cancelled = true; };
}
