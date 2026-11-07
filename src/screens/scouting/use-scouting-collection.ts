import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";
import type { ScoutingContact, ScoutingRallyOutcome } from "../../core/models";
import { createClientId } from "../../core/client-id";
import { parseLiveCaptureStamp, type LiveCaptureStamp } from "../../core/scouting-live";
import { parseScoutingRallyOutcome, validateRallyContacts, validateScoutingRally } from "../../core/scouting-rallies";
import { measureAsync } from "../../observability/perf";
import { applyScoutingCommand, loadScoutingDetail, type PendingScoutingCommand, type ScoutingCommand, type ScoutingDetail } from "../../db/scouting-collection";
import type { CaptureTimingDraft, LiveRecordingReference, ScoutingCaptureBridge } from "./live/live-scouting-contract";

type ContactChange = { kind: "append" | "replace" | "remove"; index: number };
type PendingCapture = { requestId: string; timing: CaptureTimingDraft; before: ScoutingDetail; confirmed?: ScoutingDetail };
type Draft = { version: 1 | 2; revision: number; contacts: ScoutingContact[]; outcome?: ScoutingRallyOutcome | null; pending: PendingScoutingCommand | null;
  timing?: CaptureTimingDraft; pendingCapture?: PendingCapture };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function parseReference(value: LiveRecordingReference | null): LiveRecordingReference | null {
  if (value === null) return null;
  if (!value || typeof value.hostSessionId !== "string" || !value.hostSessionId || value.hostSessionId.length > 300
    || typeof value.recordingId !== "string" || !/^[-\w]{1,128}$/.test(value.recordingId)) throw new Error("Invalid capture reference");
  return { hostSessionId: value.hostSessionId, recordingId: value.recordingId };
}
function scopedStamp(value: unknown, userId: string, org: string, classId: string): LiveCaptureStamp | null {
  if (value === null) return null;
  const stamp = parseLiveCaptureStamp(value);
  if (stamp.scope.userId !== userId || stamp.scope.org !== org || stamp.scope.classId !== classId) throw new Error("Invalid capture scope");
  return stamp;
}
function parseTiming(value: CaptureTimingDraft, count: number, userId: string, org: string, classId: string): CaptureTimingDraft {
  if (!value || !Array.isArray(value.contacts) || value.contacts.length !== count || count > 100) throw new Error("Invalid contact timing");
  const ids = new Set<string>();
  const contacts = value.contacts.map(mark => {
    if (!mark || typeof mark.id !== "string" || !/^[-\w]{1,128}$/.test(mark.id) || ids.has(mark.id)) throw new Error("Invalid contact identity");
    ids.add(mark.id); return { id: mark.id, stamp: scopedStamp(mark.stamp, userId, org, classId) };
  });
  return { contacts, pointStamp: scopedStamp(value.pointStamp, userId, org, classId), ...(value.reference !== undefined ? { reference: parseReference(value.reference) } : {}) };
}
function scopedDetail(value: ScoutingDetail, org: string, sessionId: string, classId: string): ScoutingDetail {
  if (!value?.session || value.session.id !== sessionId || value.session.organizationId !== org || value.session.classId !== classId
    || !Number.isInteger(value.session.revision ?? 0) || !Array.isArray(value.actions) || !Array.isArray(value.rallies)) throw new Error("Invalid capture receipt");
  return clone(value);
}
function captureBefore(detail: ScoutingDetail, pending: PendingScoutingCommand): ScoutingDetail {
  return clone({ ...detail, actions: detail.actions.filter(action => pending.command.name === "undo_action" && action.id === pending.command.payload.actionId),
    rallies: detail.rallies.filter(rally => pending.command.name === "reopen_point" && rally.id === pending.command.payload.rallyId) });
}
export function useScoutingCollection(org: string, sessionId: string, userId: string, onSaved: () => void, captureBridge?: ScoutingCaptureBridge) {
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
  const execution = useRef(0);
  const currentDraft = useRef(draft);
  const writes = useRef(Promise.resolve());
  const key = `goatleta:scouting-draft:v1:${userId}:${org}:${sessionId}`;
  const write = useCallback((value: Draft, optimistic = true) => {
    const epoch = loadEpoch.current;
    if (optimistic) { currentDraft.current = value; if (alive.current) setDraft(value); }
    writes.current = writes.current.catch(() => undefined).then(async () => {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      if (!optimistic && alive.current && loadEpoch.current === epoch) { currentDraft.current = value; setDraft(value); }
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
            if (parsed.timing) local.timing = parseTiming(parsed.timing, parsed.contacts.length, userId, org, remote.session.classId);
            if (parsed.pendingCapture) {
              const capture = parsed.pendingCapture, command = parsed.pending?.command;
              if (!parsed.pending || capture.requestId !== parsed.pending.requestId || !command) throw new Error("Invalid capture retry");
              local.pendingCapture = { requestId: capture.requestId, timing: parseTiming(capture.timing, "contacts" in command.payload ? command.payload.contacts.length : 0, userId, org, remote.session.classId),
                before: scopedDetail(capture.before, org, sessionId, remote.session.classId), ...(capture.confirmed ? { confirmed: scopedDetail(capture.confirmed, org, sessionId, remote.session.classId) } : {}) };
            }
          } else throw new Error("Invalid scouting draft");
        } catch { throw new Error("SCOUTING_DRAFT_INVALID"); }
      }
      const revision = remote.session.revision ?? 0;
      const localDraft = local && (local.contacts.length > 0 || local.outcome || local.pending ||
        (local.version === 2 && local.revision === revision && Object.prototype.hasOwnProperty.call(local, "outcome"))) ? local : null;
      const next: Draft = localDraft ?? { version: 2, revision, contacts: remote.session.matchState?.recoveredDraft ?? [], outcome: remote.session.matchState?.recoveredOutcome ?? null, pending: null };
      setDetail(next.pendingCapture?.confirmed ?? remote); currentDraft.current = next; setDraft(next); setBusy(false);
      if (next.pendingCapture?.confirmed) setError("Registro confirmado. Tente novamente para sincronizar o vídeo.");
      setConflict(!!localDraft && localDraft.revision !== revision && !localDraft.pending);
      readBlockedRef.current = false; setReadBlocked(false);
    } catch (failure) { if (alive.current && epoch === loadEpoch.current) setError(/SCOUTING_DRAFT_INVALID/.test(String(failure)) ? "Não foi possível ler o rascunho deste aparelho. Ele foi preservado; não sobrescrevemos seus registros." : "Não foi possível carregar a análise. Tente novamente."); }
    finally { if (alive.current && epoch === loadEpoch.current) setLoading(false); }
  }, [key, org, sessionId, userId]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(() => { if (alive.current) return load(); });
    return () => { alive.current = false; loadEpoch.current += 1; execution.current += 1; lock.current = false; };
  }, [load]);

  const stampNow = (): LiveCaptureStamp | null => {
    if (!captureBridge || !detail) return null;
    try { return scopedStamp(captureBridge.captureStamp(), userId, org, detail.session.classId); } catch { return null; }
  };
  const referenceNow = (): LiveRecordingReference | null => {
    try { return parseReference(captureBridge?.captureReference?.() ?? null); } catch { return null; }
  };
  const changeContacts = (contacts: ScoutingContact[], change?: ContactChange) => {
    if (readBlockedRef.current || lock.current || currentDraft.current.pending || conflict) return;
    const invalid = validateScoutingRally(contacts, undefined, currentDraft.current.outcome, detail?.session.matchState?.serve);
    if (invalid) { setError(invalid); return; }
    setError("");
    let timing = currentDraft.current.timing;
    if (captureBridge || timing) {
      const previous = currentDraft.current.contacts, marks = timing?.contacts ?? previous.map(() => ({ id: createClientId(), stamp: null }));
      const removed = change?.kind === "remove" ? marks.filter((_, index) => index !== change.index) : marks;
      timing = { reference: timing?.reference !== undefined ? timing.reference : referenceNow(), pointStamp: timing?.pointStamp ?? null, contacts: contacts.map((_, index) => {
        if (removed[index] && !(change?.kind === "append" && index === change.index)) return removed[index];
        return { id: createClientId(), stamp: index >= previous.length || change?.kind === "append" ? stampNow() : null };
      }) };
    }
    void write({ ...currentDraft.current, version: 2, contacts, ...(timing ? { timing } : {}) }).catch(() => {
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
    let capture = currentDraft.current.pendingCapture;
    if (capture && !captureBridge) { setError("Reabra o estúdio para sincronizar o vídeo deste registro."); return false; }
    if (!capture && captureBridge) {
      const retry = !!currentDraft.current.pending, payload = pending.command.payload;
      const contacts = "contacts" in payload ? payload.contacts : [];
      const matchesDraft = pending.command.name === "point" && JSON.stringify(contacts) === JSON.stringify(currentDraft.current.contacts);
      const draftTiming = matchesDraft ? currentDraft.current.timing : undefined;
      const actionStamp = !retry && pending.command.name === "action" ? stampNow() : null;
      const timing: CaptureTimingDraft = { contacts: draftTiming?.contacts ?? contacts.map((_, index) => ({ id: `cc_${pending.requestId}_${index}`, stamp: actionStamp })),
        pointStamp: draftTiming?.pointStamp ?? (!retry && pending.command.name === "point" ? stampNow() : null),
        ...(draftTiming?.reference !== undefined ? { reference: draftTiming.reference } : !retry && ["point", "action"].includes(pending.command.name) ? { reference: referenceNow() } : {}) };
      capture = { requestId: pending.requestId, timing, before: captureBefore(detail, pending) };
    }
    const identity = getSessionIdentity();
    const epoch = loadEpoch.current, run = ++execution.current;
    const isCurrent = () => alive.current && loadEpoch.current === epoch && execution.current === run;
    let confirmed = capture?.confirmed;
    lock.current = true; setBusy(true); setError("");
    try {
      // Persist the idempotency key BEFORE sending. Retrying after an unknown
      // outcome always uses the same intent, including after reopening the app.
      await write({ ...currentDraft.current, pending, ...(capture ? { pendingCapture: capture } : {}) });
      assertSessionIdentity(identity);
      if (!isCurrent()) return false;
      const saved = confirmed ?? await applyScoutingCommand(org, sessionId, pending, detail.captureVersion ?? 2);
      assertSessionIdentity(identity);
      if (!isCurrent()) return false;
      confirmed = saved;
      let recoveredTiming: CaptureTimingDraft | undefined;
      if (capture && captureBridge) {
        if (!capture.confirmed) {
          capture = { ...capture, confirmed: scopedDetail(saved, org, sessionId, detail.session.classId) };
          setDetail(saved);
          await write({ ...currentDraft.current, pending, pendingCapture: capture });
          if (!isCurrent()) return false;
        }
        assertSessionIdentity(identity);
        const result = await captureBridge.applied({ userId, org, sessionId, pending: clone(pending), before: clone(capture.before), saved: clone(saved), timing: clone(capture.timing) });
        assertSessionIdentity(identity);
        if (!isCurrent()) return false;
        if (result?.recoveredTiming) recoveredTiming = parseTiming(result.recoveredTiming, saved.session.matchState?.recoveredDraft.length ?? 0, userId, org, detail.session.classId);
      }
      const next: Draft = { version: 2, revision: saved.session.revision ?? 0,
        contacts: saved.session.matchState?.recoveredDraft ?? [], outcome: saved.session.matchState?.recoveredOutcome ?? null, pending: null,
        ...(recoveredTiming ? { timing: recoveredTiming } : {}) };
      await write(next, false);
      assertSessionIdentity(identity);
      if (!isCurrent()) return false;
      setDetail(saved); onSaved(); return true;
    } catch (failure) {
      if (!isCurrent()) return false;
      if (confirmed && capture) {
        setDetail(confirmed); setError("Registro confirmado. Tente novamente para sincronizar o vídeo.");
      } else if (/SCOUTING_CAPTURE_UPDATE_REQUIRED/.test(String(failure))) {
        setError("Estas marcações aguardam atualização da coleta. O rascunho foi preservado; nenhum ponto foi enviado.");
      } else if (/40001/.test(String(failure))) {
        // Retain the user's draft, but require explicit reconciliation against
        // the current score before sending a new command.
        try {
          const fresh = await loadScoutingDetail(org, sessionId);
          if (!isCurrent()) return false;
          setDetail(fresh); setConflict(true);
          await write({ ...currentDraft.current, pending: null, pendingCapture: undefined });
          setError("Esta análise mudou em outro aparelho. Confira o placar antes de continuar.");
        } catch { setError("A análise mudou. Reabra para conferir o placar; seu rascunho foi preservado."); }
      } else if (/\b(42501|P0001|23514|22P02)\b/.test(String(failure))) {
        await write({ ...currentDraft.current, pending: null, pendingCapture: undefined }).catch(() => undefined);
        setError("Registro recusado. Reabra a análise para conferir permissões, atletas e resultados.");
      } else {
        setError("Envio não confirmado. Tente novamente para conferir e salvar sem duplicar.");
      }
      return false;
    } finally { if (execution.current === run) { lock.current = false; if (alive.current) setBusy(false); } }
  };
  const reconcile = async (keep: boolean) => {
    if (!detail || readBlockedRef.current) return;
    try {
      const contacts = keep ? currentDraft.current.contacts : detail.session.matchState?.recoveredDraft ?? [];
      const outcome = keep && Object.prototype.hasOwnProperty.call(currentDraft.current, "outcome") ? currentDraft.current.outcome ?? null : detail.session.matchState?.recoveredOutcome ?? null;
      const invalid = validateScoutingRally(contacts, undefined, outcome, detail.session.matchState?.serve);
      if (invalid) { setError(invalid); return; }
      await write({ version: 2, revision: detail.session.revision ?? 0, contacts, outcome, pending: null, ...(keep && currentDraft.current.timing ? { timing: currentDraft.current.timing } : {}) });
      setConflict(false); setError("");
    } catch { setError("Não foi possível guardar o rascunho neste aparelho."); }
  };
  const reload = () => { setLoading(true); setError(""); return load(); };
  return { detail, contacts: draft.contacts, outcome: draft.outcome ?? null, pending: draft.pending, loading, busy, conflict, error, readBlocked,
    setError, changeContacts, changeOutcome, execute, reconcile, reload };
}
