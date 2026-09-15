import { useCallback, useEffect, useRef, useState } from "react";
import { getMyAthleteModalities, saveMyAthleteModalities } from "../../api/athlete-modalities";
import { mergeAthleteModalities, updatePersonalModalities } from "../../core/athlete-modalities";
import type { ClassModality } from "../../core/class-modality";

/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- async identity guards and account resets are intentional hook synchronization. */

export function useAthleteModalities(userId: string | undefined) {
  const identity = useRef(userId);
  identity.current = userId;
  const [automatic, setAutomatic] = useState<ClassModality[]>([]);
  const [personal, setPersonal] = useState<ClassModality[]>([]);
  const [baseline, setBaseline] = useState<ClassModality[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setAutomatic([]); setPersonal([]); setBaseline([]); setError(""); setLoading(true); setSaving(false); setReady(false);
    if (!userId) { setLoading(false); return; }
    void getMyAthleteModalities().then((data) => {
      if (!active) return;
      setAutomatic(data.automatic); setPersonal(data.personal); setBaseline(data.personal);
      setReady(true);
    }).catch(() => { if (active) setError("Não foi possível carregar as modalidades."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);
  const dirty = [...personal].sort().join() !== [...baseline].sort().join();
  const save = useCallback(async () => {
    if (!userId || !ready || loading || saving || !dirty) return false;
    const snapshot = [...personal];
    setSaving(true); setError("");
    try {
      await saveMyAthleteModalities(snapshot);
      if (identity.current !== userId) return false;
      setBaseline(snapshot); return true;
    } catch {
      if (identity.current === userId) setError("Não foi possível salvar as modalidades. Tente novamente.");
      return false;
    } finally { if (identity.current === userId) setSaving(false); }
  }, [userId, ready, personal, loading, saving, dirty]);
  return { automatic, selected: mergeAthleteModalities(automatic, personal), dirty, loading, saving, ready, error, save,
    reload: () => setRetry((value) => value + 1), discard: () => setPersonal(baseline),
    change: (selected: ClassModality[]) => setPersonal(updatePersonalModalities(automatic, personal, selected)) };
}
