import { useEffect, useRef } from "react";
import { Platform } from "react-native";

export function isTransientRoleError(error: Error | null) {
  if (!error) return false;
  const status = (error as Error & { status?: number }).status;
  if (typeof status === "number") {
    return status === 0 || status === 408 || status === 429 || status >= 500;
  }
  return error.name === "AbortError" ||
    (error instanceof TypeError && /fetch|network|load failed/i.test(error.message));
}

/** Retry authorization reads; never restore a role from a failed response. */
export function useRoleRecovery(
  error: Error | null,
  loading: boolean,
  retry: () => Promise<void>,
  sessionKey: string,
) {
  const attempts = useRef(0);
  useEffect(() => { attempts.current = 0; }, [sessionKey]);
  useEffect(() => {
    if (!loading && !error) attempts.current = 0;
    if (loading || !isTransientRoleError(error)) return;

    const web = Platform.OS === "web" && typeof document !== "undefined";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    const recover = () => {
      if (started || (web && document.visibilityState === "hidden")) return;
      started = true;
      clearTimeout(timer);
      attempts.current += 1;
      void retry();
    };
    const schedule = () => {
      if (attempts.current < 2 && (!web || document.visibilityState !== "hidden")) {
        timer = setTimeout(recover, attempts.current === 0 ? 1000 : 3000);
      }
    };
    const resume = () => {
      if (started) return;
      // A new foreground/online event permits another bounded recovery cycle.
      if (web && document.visibilityState === "hidden") {
        clearTimeout(timer);
        return;
      }
      attempts.current = 0;
      recover();
    };
    schedule();
    if (web) {
      document.addEventListener("visibilitychange", resume);
      document.addEventListener("resume", resume);
      window.addEventListener("online", resume);
      window.addEventListener("pageshow", resume);
    }
    return () => {
      clearTimeout(timer);
      if (web) {
        document.removeEventListener("visibilitychange", resume);
        document.removeEventListener("resume", resume);
        window.removeEventListener("online", resume);
        window.removeEventListener("pageshow", resume);
      }
    };
  }, [error, loading, retry, sessionKey]);
}
