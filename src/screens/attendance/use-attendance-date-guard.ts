import { useCallback, useEffect, useRef } from "react";
import { useConfirmDialog } from "../../ui/confirm-dialog";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const displayDate = (date: string) => date.split("-").reverse().join("/");

/** Consent lasts only for the currently open class/date, never across navigation. */
export function useAttendanceDateGuard(classId: string, date: string, enabled: boolean, onGoToday?: (date: string) => void) {
  const { confirm } = useConfirmDialog();
  const approved = useRef<string | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    approved.current = null;
    pending.current = false;
    generation.current += 1;
    return () => { generation.current += 1; };
  }, [classId, date, enabled]);

  return useCallback(async (action: () => void) => {
    if (!enabled || !classId || !date || pending.current) return;
    const today = todayKey();
    const key = `${classId}:${date}:${today}`;
    if (date === today || approved.current === key) { action(); return; }
    const requestGeneration = generation.current;
    pending.current = true;
    try {
      await confirm({
        title: "Chamada fora de hoje",
        message: `Você está preenchendo a chamada de ${displayDate(date)}. Hoje é ${displayDate(today)}. Deseja continuar nessa data?`,
        confirmLabel: `Continuar em ${displayDate(date)}`,
        cancelLabel: onGoToday ? "Ir para hoje" : "Cancelar",
        onCancel: () => {
          if (generation.current === requestGeneration) onGoToday?.(todayKey());
        },
        onConfirm: () => {
          if (generation.current !== requestGeneration || todayKey() !== today) return;
          approved.current = key;
          action();
        },
      });
    } finally {
      if (generation.current === requestGeneration) pending.current = false;
    }
  }, [classId, date, enabled, confirm, onGoToday]);
}
