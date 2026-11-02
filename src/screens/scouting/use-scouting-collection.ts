import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";
import type { ScoutingContact, ScoutingRallyOutcome } from "../../core/models";
import { createClientId } from "../../core/client-id";
import { parseScoutingRallyOutcome, validateRallyContacts, validateScoutingRally } from "../../core/scouting-rallies";
import { measureAsync } from "../../observability/perf";
import { applyScoutingCommand, loadScoutingDetail, type PendingScoutingCommand, type ScoutingCommand, type ScoutingDetail } from "../../db/scouting-collection";

type Draft = { version: 1 | 2; revision: number; contacts: ScoutingContact[]; outcome?: ScoutingRallyOutcome | null; pending: PendingScoutingCommand | null };
export function useScoutingCollection(org: string, sessionId: string, userId: string, onSaved: () => void) {
  const [detail, setDetail] = useState<ScoutingDetail | null>(null);
  const [draft, setDraft] = useState<Draft>({ version: 1, revision: 0, contacts: [], pending: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [readBlocked, setReadBlocked] = useState(true);
  const readBlockedRef = useRef(true);
  const loadEpoch = useRef(0);
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
    const epoch = ++loadEpoch.current;
    readBlockedRef.current = true; setReadBlocked(true);
    try {
      const [remote, stored] = await Promise.all([
        measureAsync("screen.class.scouting.load.detail", () => loadScoutingDetail(org, sessionId)),
        AsyncStorage.getItem(key),
      ]);
      if (!alive.current || epoch !== loadEpoch.current) return;
      let local: Draft | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Draft;
          if ([1, 2].includes(parsed.version) && Number.isInteger(parsed.revision) && Array.isArray(parsed.contacts) && !validateRallyContacts(parsed.contacts)) {
            const ownsOutcome = Object.prototype.hasOwnProperty.call(parsed, "outcome");
            const outcome = ownsOutcome ? parseScoutingRallyOutcome(parsed.outcome) : parsed.revision === (remote.session.revision ?? 0) ? remote.session.matchState?.recoveredOutcome ?? null : undefined;
            const mismatch = validateScoutingRally(parsed.contacts, undefined, outcome);
            if (mismatch) setError(mismatch);
            local = { ...parsed, ...(outcome !== undefined ? { outcome } : {}) };
          } else throw new Error("Invalid scouting draft");
        } catch { throw new Error("SCOUTING_DRAFT_INVALID"); }
      }
      const revision = remote.session.revision ?? 0;
      const localDraft = local && (local.contacts.length > 0 || local.outcome || local.pending ||
        (local.version === 2 && local.revision === revision && Object.prototype.hasOwnProperty.call(local, "outcome"))) ? local : null;
      const next: Draft = localDraft ?? { version: 2, revision, contacts: remote.session.matchState?.recoveredDraft ?? [], outcome: remote.session.matchState?.recoveredOutcome ?? null, pending: null };
      setDetail(remote); currentDraft.current = next; setDraft(next);
      setConflict(!!localDraft && localDraft.revision !== revision && !localDraft.pending);
      readBlockedRef.current = false; setReadBlocked(false);
    } catch (failure) { if (alive.current && epoch === loadEpoch.current) setError(/SCOUTING_DRAFT_INVALID/.test(String(failure)) ? "Não foi possível ler o rascunho deste aparelho. Ele foi preservado; não sobrescrevemos seus registros." : "Não foi possível carregar a análise. Tente novamente."); }
    finally { if (alive.current && epoch === loadEpoch.current) setLoading(false); }
  }, [key, org, sessionId]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(() => { if (alive.current) return load(); });
    return () => { alive.current = false; loadEpoch.current += 1; };
  }, [load]);

  const changeContacts = (contacts: ScoutingContact[]) => {
    if (readBlockedRef.current || lock.current || currentDraft.current.pending || conflict) return;
    const invalid = validateScoutingRally(contacts, undefined, currentDraft.current.outcome, detail?.session.matchState?.serve);
    if (invalid) { setError(invalid); return; }
    setError("");
    void write({ ...currentDraft.current, version: 2, contacts }).catch(() => {
      if (alive.current) setError("Rascunho somente na tela. Não feche antes de salvar o ponto.");
    });
  };
  const changeOutcome = (outcome: ScoutingRallyOutcome | null) => {
    if (readBlockedRef.current || lock.current || currentDraft.current.pending || conflict || (detail?.captureVersion ?? 2) < 3) return;
    const invalid = validateScoutingRally(currentDraft.current.contacts, undefined, outcome, detail?.session.matchState?.serve);
    if (invalid) { setError(invalid); return; }
    setError("");
    void write({ ...currentDraft.current, version: 2, outcome }).catch(() => {
      if (alive.current) setError("Rascunho somente na tela. Não feche antes de salvar o ponto.");
    });
  };
  const execute = async (command?: ScoutingCommand) => {
    if (readBlockedRef.current || !detail?.captureReady || lock.current || conflict) return false;
    if ((detail.captureVersion ?? 2) < 3 && (currentDraft.current.outcome != null || currentDraft.current.contacts.some(contact => ["freeball_devolvida", "bloqueio_continua"].includes(contact.resultKey)))) {
      setError("Estas marcações aguardam atualização da coleta. O rascunho foi preservado; nenhum ponto foi enviado."); return false;
    }
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
      const saved = await applyScoutingCommand(org, sessionId, pending, detail.captureVersion ?? 2);
      if (!alive.current) return false;
      const next: Draft = { version: 2, revision: saved.session.revision ?? 0,
        contacts: saved.session.matchState?.recoveredDraft ?? [], outcome: saved.session.matchState?.recoveredOutcome ?? null, pending: null };
      await write(next, false);
      if (!alive.current) return false;
      setDetail(saved); onSaved(); return true;
    } catch (failure) {
      if (!alive.current) return false;
      if (/SCOUTING_CAPTURE_UPDATE_REQUIRED/.test(String(failure))) {
        setError("Estas marcações aguardam atualização da coleta. O rascunho foi preservado; nenhum ponto foi enviado.");
      } else if (/40001/.test(String(failure))) {
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
    if (!detail || readBlockedRef.current) return;
    try {
      const contacts = keep ? currentDraft.current.contacts : detail.session.matchState?.recoveredDraft ?? [];
      const outcome = keep && Object.prototype.hasOwnProperty.call(currentDraft.current, "outcome") ? currentDraft.current.outcome ?? null : detail.session.matchState?.recoveredOutcome ?? null;
      const invalid = validateScoutingRally(contacts, undefined, outcome, detail.session.matchState?.serve);
      if (invalid) { setError(invalid); return; }
      await write({ version: 2, revision: detail.session.revision ?? 0, contacts, outcome, pending: null });
      setConflict(false); setError("");
    } catch { setError("Não foi possível guardar o rascunho neste aparelho."); }
  };
  const reload = () => { setLoading(true); setError(""); return load(); };
  return { detail, contacts: draft.contacts, outcome: draft.outcome ?? null, pending: draft.pending, loading, busy, conflict, error, readBlocked,
    setError, changeContacts, changeOutcome, execute, reconcile, reload };
}
