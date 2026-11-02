import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

export type ScoutingRosterPlayer = { studentId: string; jersey: string };
type RosterState = { key: string; players: ScoutingRosterPlayer[] | null; loading: boolean; error: string };
export function validateScoutingRoster(players: ScoutingRosterPlayer[]): string | null {
  if (!players.length) return "Selecione pelo menos um atleta.";
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const player of players) {
    if (!player.studentId || ids.has(player.studentId)) return "Atleta repetido no elenco.";
    ids.add(player.studentId);
    if (player.jersey && !/^\d{1,2}$/.test(player.jersey)) return "Use camisas de 0 a 99.";
    const number = player.jersey ? String(Number(player.jersey)) : "";
    if (number && numbers.has(number)) return "Há camisas repetidas no elenco.";
    if (number) numbers.add(number);
  }
  return null;
}

// A preference of this collector, never a mutation of a student or enrollment.
export function useScoutingRoster(userId: string, org: string, sessionId: string) {
  const key = `goatleta:scouting-roster:v1:${userId}:${org}:${sessionId}`;
  const [state, setState] = useState<RosterState>({ key, players: null, loading: true, error: "" });
  const [saving, setSaving] = useState(false);
  if (state.key !== key) setState({ key, players: null, loading: true, error: "" });
  // A different scope cannot expose the previous roster while its read is pending.
  const { players, loading, error } = state.key === key ? state : { players: null, loading: true, error: "" };
  const generation = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const token = ++generation.current;
    void AsyncStorage.getItem(key).then(raw => {
      if (token !== generation.current) return;
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (raw && (!Array.isArray(parsed) || parsed.some(p => !p || typeof p.studentId !== "string" || typeof p.jersey !== "string") || validateScoutingRoster(parsed))) throw new Error("Invalid roster");
      setState({ key, players: parsed as ScoutingRosterPlayer[] | null, loading: false, error: "" });
    }).catch(() => { if (token === generation.current) setState({ key, players: null, loading: false, error: "Não foi possível ler o elenco deste aparelho. Selecione o elenco novamente." }); });
    return () => { generation.current += 1; };
  }, [key]);
  const save = async (next: ScoutingRosterPlayer[]) => {
    if (locked.current || loading) return false;
    const invalid = validateScoutingRoster(next);
    if (invalid) { setState({ key, players, loading: false, error: invalid }); return false; }
    const token = generation.current;
    const normalized = next.map(p => ({ studentId: p.studentId, jersey: p.jersey ? String(Number(p.jersey)) : "" }));
    locked.current = true; setSaving(true); setState({ key, players, loading: false, error: "" });
    try {
      await AsyncStorage.setItem(key, JSON.stringify(normalized));
      if (token !== generation.current) return false;
      setState({ key, players: normalized, loading: false, error: "" }); return true;
    } catch { if (token === generation.current) setState({ key, players, loading: false, error: "Não foi possível salvar o elenco neste aparelho. Tente novamente." }); return false; }
    finally { locked.current = false; setSaving(false); }
  };
  return { players, loading, saving, error, save };
}
