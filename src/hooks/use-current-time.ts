import { useEffect, useState } from "react";

/** A clock for relative UI calculations; time only advances on a timer tick. */
export function useCurrentTime(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
