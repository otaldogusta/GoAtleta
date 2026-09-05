import { useEffect, useRef } from "react";
import { scheduleEffectTask } from "./schedule-effect-task";

/** Consume each explicit action signal once, when its required data is ready. */
export function useActionSignal(signal: number | undefined, enabled: boolean, action: () => void) {
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!signal || !enabled || handled.current === signal) return;
    return scheduleEffectTask(() => {
      handled.current = signal;
      action();
    });
  }, [action, enabled, signal]);
}
