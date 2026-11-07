import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import type { Student } from "../../core/models";
import { emptyScoutingLineup, validScoutingLineup, visibleScoutingLineup, type ScoutingLineup } from "./scouting-bench";

type State = { key: string; lineup: ScoutingLineup; loading: boolean; error: string };
/** An explicit local selection, independent of roster order, automatic rotation and official match data. */
export function useScoutingLineup(userId: string, org: string, classId: string, sessionId: string, students: readonly Student[], enabled: boolean) {
  const key = `goatleta:scouting-lineup:v1:${[userId, org, classId, sessionId].map(encodeURIComponent).join(":")}`;
  const [state, setState] = useState<State>({ key, lineup: emptyScoutingLineup(), loading: enabled, error: "" });
  const [saving, setSaving] = useState(false);
  const generation = useRef(0), locked = useRef(false);
  if (state.key !== key) setState({ key, lineup: emptyScoutingLineup(), loading: enabled, error: "" });
  const current = state.key === key ? state : { key, lineup: emptyScoutingLineup(), loading: enabled, error: "" };
  useEffect(() => {
    const token = ++generation.current;
    if (enabled) void AsyncStorage.getItem(key).then(raw => {
      if (token !== generation.current) return;
      const parsed: unknown = raw ? JSON.parse(raw) : emptyScoutingLineup();
      if (!validScoutingLineup(parsed)) throw new Error("Invalid lineup");
      setState({ key, lineup: parsed, loading: false, error: "" });
    }).catch(() => { if (token === generation.current) setState({ key, lineup: emptyScoutingLineup(), loading: false, error: "Não foi possível ler a escalação. Defina os atletas em quadra novamente." }); });
    return () => { generation.current = token + 1; };
  }, [key, enabled]);
  const lineup = visibleScoutingLineup(current.lineup, students);
  const save = async (next: ScoutingLineup) => {
    if (!enabled || current.loading || locked.current) return false;
    if (!validScoutingLineup(next)) return false;
    const allowed = visibleScoutingLineup(next, students);
    if (allowed.some((id, index) => id !== next[index])) return false;
    const token = generation.current;
    locked.current = true; setSaving(true);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (token !== generation.current) return false;
      setState({ key, lineup: [...next], loading: false, error: "" }); return true;
    } catch { if (token === generation.current) setState({ key, lineup: current.lineup, loading: false, error: "Não foi possível salvar a escalação neste aparelho." }); return false; }
    finally { locked.current = false; setSaving(false); }
  };
  return { lineup, loading: enabled && current.loading, saving, error: current.error, save };
}
