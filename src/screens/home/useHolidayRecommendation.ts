import { useCallback, useEffect, useState } from "react";
import { decideHoliday, getHolidayDecision, listCalendarPauses } from "../../api/holiday-decisions";
import { brazilDateKey, nationalHoliday, type CalendarPause } from "../../core/holidays";
const EMPTY_PAUSES: CalendarPause[] = [];

export function useHolidayRecommendation(organizationId: string | undefined, enabled: boolean, now: Date) {
  const date = brazilDateKey(now);
  const holiday = nationalHoliday(date);
  const [state, setState] = useState<{ scope: string; pauses: CalendarPause[]; decided: boolean; ready: boolean }>({ scope: "", pauses: [], decided: false, ready: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const key = `${organizationId}:${date}`;
  const refresh = useCallback(async () => {
    if (!organizationId) return;
    const pauses = await listCalendarPauses(organizationId);
    const decisions = enabled && holiday ? await getHolidayDecision(organizationId, date) : [];
    setState({ scope: key, pauses, decided: decisions.length > 0, ready: true });
  }, [organizationId, date, enabled, holiday, key]);
  useEffect(() => {
    let active = true;
    if (!organizationId) return;
    void Promise.allSettled([listCalendarPauses(organizationId), enabled && holiday ? getHolidayDecision(organizationId, date) : Promise.resolve([])])
      .then(([pauses, decisions]) => {
        if (!active) return;
        setState({ scope: key, pauses: pauses.status === "fulfilled" ? pauses.value : EMPTY_PAUSES,
          decided: decisions.status === "fulfilled" && decisions.value.length > 0,
          ready: pauses.status === "fulfilled" && decisions.status === "fulfilled" });
        setError(pauses.status === "rejected" || decisions.status === "rejected" ? "Não foi possível consultar o calendário." : "");
      });
    return () => { active = false; };
  }, [organizationId, date, enabled, holiday, key]);
  const save = async (ids: string[]) => {
    if (!organizationId || saving) return;
    setSaving(true); setError("");
    try { await decideHoliday(organizationId, date, ids); await refresh(); }
    catch {
      // Another coordinator may have decided concurrently; reload authoritative state.
      await refresh().catch(() => undefined);
      setError("Não foi possível confirmar. Tente novamente.");
    }
    finally { setSaving(false); }
  };
  return { date, holiday, pauses: state.scope === key ? state.pauses : EMPTY_PAUSES, visible: enabled && Boolean(holiday) && state.scope === key && state.ready && !state.decided, saving, error, save, refresh };
}
