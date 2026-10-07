import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";
import type { ScoutingContact } from "../../core/models";
import { createClientId } from "../../core/client-id";
import { validateRallyContacts } from "../../core/scouting-rallies";
import { measureAsync } from "../../observability/perf";
import { applyScoutingCommand, loadScoutingDetail, type PendingScoutingCommand, type ScoutingCommand, type ScoutingDetail } from "../../db/scouting-collection";

type Draft = { version: 1; revision: number; contacts: ScoutingContact[]; pending: PendingScoutingCommand | null };
export function useScoutingCollection(org: string, sessionId: string, userId: string, onSaved: () => void) {
  const [detail, setDetail] = useState<ScoutingDetail | null>(null);
  const [draft, setDraft] = useState<Draft>({ version: 1, revision: 0, contacts: [], pending: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const lock = useRef(false);
  const currentDraft = useRef(draft);
  const writes = useRef(Promise.resolve());
  const key = `goatleta:scouting-draft:v1:${userId}:${org}:${sessionId}`;
  const write = useCallback((value: Draft, optimistic = true) => {
    if (optimistic) { currentDraft.current = value; if (alive.current) setDraft(value); }
    writes.current = writes.current.catch(() => undefined).then(async () => {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      if (!optimistic) { currentDraft.current = value; if (alive.current) setDraft(value); }
    });
    return writes.current;
  }, [key]);
  const load = useCallback(async () => {
    try {
      const [remote, stored] = await Promise.all([
        measureAsync("screen.class.scouting.load.detail", () => loadScoutingDetail(org, sessionId)),
        AsyncStorage.getItem(key),
      ]);
      if (!alive.current) return;
      let local: Draft | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Draft;
          if (parsed.version === 1 && Number.isInteger(parsed.revision) && Array.isArray(parsed.contacts) && !validateRallyContacts(parsed.contacts)) local = parsed;
        } catch { setError("Não foi possível ler o rascunho deste aparelho."); }
      }
      const revision = remote.session.revision ?? 0;
      const localDraft = local && (local.contacts.length > 0 || local.pending) ? local : null;
      const next: Draft = localDraft ?? { version: 1, revision, contacts: remote.session.matchState?.recoveredDraft ?? [], pending: null };
      setDetail(remote); currentDraft.current = next; setDraft(next);
      setConflict(!!localDraft && localDraft.revision !== revision && !localDraft.pending);
    } catch { if (alive.current) setError("Não foi possível carregar a análise. Tente novamente."); }
    finally { if (alive.current) setLoading(false); }
  }, [key, org, sessionId]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(() => { if (alive.current) return load(); });
    return () => { alive.current = false; };
  }, [load]);

  const changeContacts = (contacts: ScoutingContact[]) => {
    if (lock.current || currentDraft.current.pending || conflict) return;
    const invalid = validateRallyContacts(contacts);
    if (invalid) { setError(invalid); return; }
    setError("");
    void write({ ...currentDraft.current, contacts }).catch(() => {
      if (alive.current) setError("Rascunho somente na tela. Não feche antes de salvar o ponto.");
    });
  };
  const execute = async (command?: ScoutingCommand) => {
    if (!detail?.captureReady || lock.current || conflict) return false;
    const pending = currentDraft.current.pending ?? (command ? { requestId: createClientId(), revision: currentDraft.current.revision, command } : null);
    if (!pending) return false;
    const identity = getSessionIdentity();
    lock.current = true; setBusy(true); setError("");
    try {
      // Persist the idempotency key BEFORE sending. Retrying after an unknown
      // outcome always uses the same intent, including after reopening the app.
      await write({ ...currentDraft.current, pending });
      assertSessionIdentity(identity);
      if (!alive.current) return false;
      const saved = await applyScoutingCommand(org, sessionId, pending);
      if (!alive.current) return false;
      const next: Draft = { version: 1, revision: saved.session.revision ?? 0,
        contacts: saved.session.matchState?.recoveredDraft ?? [], pending: null };
      await write(next, false);
      if (!alive.current) return false;
      setDetail(saved); onSaved(); return true;
    } catch (failure) {
      if (!alive.current) return false;
      if (/40001/.test(String(failure))) {
        // Retain the user's draft, but require explicit reconciliation against
        // the current score before sending a new command.
        try {
          const fresh = await loadScoutingDetail(org, sessionId);
          if (!alive.current) return false;
          setDetail(fresh); setConflict(true);
          await write({ ...currentDraft.current, pending: null });
          setError("Esta análise mudou em outro aparelho. Confira o placar antes de continuar.");
        } catch { setError("A análise mudou. Reabra para conferir o placar; seu rascunho foi preservado."); }
      } else if (/\b(42501|P0001|23514|22P02)\b/.test(String(failure))) {
        await write({ ...currentDraft.current, pending: null }).catch(() => undefined);
        setError("Registro recusado. Reabra a análise para conferir permissões, atletas e resultados.");
      } else {
        setError("Envio não confirmado. Tente novamente para conferir e salvar sem duplicar.");
      }
      return false;
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const reconcile = async (keep: boolean) => {
    if (!detail) return;
    try {
      await write({ version: 1, revision: detail.session.revision ?? 0, contacts: keep ? currentDraft.current.contacts : detail.session.matchState?.recoveredDraft ?? [], pending: null });
      setConflict(false); setError("");
    } catch { setError("Não foi possível guardar o rascunho neste aparelho."); }
  };
  const reload = () => { setLoading(true); setError(""); return load(); };
  return { detail, contacts: draft.contacts, pending: draft.pending, loading, busy, conflict, error,
    setError, changeContacts, execute, reconcile, reload };
}
