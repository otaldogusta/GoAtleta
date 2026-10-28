import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../../auth/auth";
import { measureAsync } from "../../observability/perf";
import { isAuthError, isNetworkError, isPermissionError } from "../../db/client";
import { buildTechnicalVisualId, getClassById, getStudentsByClass, listTechnicalVisualsByClass, saveTechnicalVisual } from "../../db/seed";
import type { ClassGroup, Student } from "../../core/models";
import { type CourtVisualDocument, type CourtVisualPayload } from "../../core/visual-court";
import { buildSimulatedReceptionRotationPreset } from "../../core/court-simulation-sequence";
import { editorId, newCourtBoard, upgradeCourtEditor, type EditorSnapshot } from "../../core/visual-court-editor";

export type CourtAutosaveStatus = "idle" | "pending" | "saving" | "saved" | "local" | "error";

type History = { present: EditorSnapshot; past: EditorSnapshot[]; future: EditorSnapshot[] };
const canRetryAutosave = (failure: unknown) => {
  if (isAuthError(failure) || isPermissionError(failure)) return false;
  const status = typeof failure === "object" && failure !== null && "status" in failure ? failure.status : undefined;
  if (typeof status === "number" && status >= 400 && status < 500) return false;
  const message = failure instanceof Error ? failure.message : String(failure);
  if (/\b(?:400|401|403|404|409|422)\b/.test(message)) return false;
  return isNetworkError(failure);
};
const initial = (): History => ({ present: { payload: newCourtBoard(), stepIndex: 0 }, past: [], future: [] });
const newLocalDocumentId = () => `local_draft_${editorId()}`;
export function useCourtEditor(classId: string, { autosavePaused = false }: { autosavePaused?: boolean } = {}) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [cls, setClass] = useState<ClassGroup | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<CourtVisualDocument[]>([]);
  const [trashedIds, setTrashedIds] = useState<string[]>([]);
  const [history, setHistoryState] = useState(initial);
  const historyRef = useRef(history);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [departing, setDeparting] = useState(false);
  const departureRef = useRef(false);
  const protectedDepartureRef = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWrite = useRef<Promise<void>>(Promise.resolve());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedSignature, setSavedSignatureState] = useState("");
  const savedSignatureRef = useRef("");
  const setSavedSignature = useCallback((value: string) => { savedSignatureRef.current = value; setSavedSignatureState(value); }, []);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftError, setDraftError] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const generation = useRef(0);
  const savingRef = useRef(false);
  const [autosaveStatus, setAutosaveStatus] = useState<CourtAutosaveStatus>("idle");
  const [autosaveError, setAutosaveError] = useState("");
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const [foreground, setForeground] = useState(() => typeof document === "undefined" || !document.hidden);
  const foregroundRef = useRef(foreground);
  const autosaveArmed = useRef(false), autosaveBlocked = useRef(false), autosaveForce = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRound = useRef(0), autosaveAttempts = useRef(0), autosaveBackoff = useRef(false);
  const autosaveTarget = useRef<{ id: string; sourceId: string } | null>(null);
  const cancelAutosave = useCallback(() => { if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; } }, []);
  const activeDocumentRef = useRef<string | null>(null);
  const signature = JSON.stringify(history.present.payload);
  const dirty = signature !== savedSignature;
  const needsSync = !activeDocumentId || activeDocumentId.startsWith("local_") || activeDocumentId.startsWith("template_");
  const canSave = !loading && !saving && !opening && !departing && Boolean(cls?.organizationId) && (dirty || needsSync);
  const draftKey = cls?.organizationId && userId ? `goatleta:court-draft:v2:${userId}:${cls.organizationId}:${classId}` : null;
  const current = useRef(history.present);
  const setHistory = useCallback((change: History | ((old: History) => History)) => {
    const next = typeof change === "function" ? change(historyRef.current) : change;
    if (next.present !== historyRef.current.present) protectedDepartureRef.current = false;
    historyRef.current = next;
    current.current = next.present;
    setHistoryState(next);
  }, []);
  const writeDraft = useCallback((key: string, value: string, shouldWrite: () => boolean = () => true) => {
    const write = draftWrite.current.catch(() => undefined).then(() => shouldWrite() ? AsyncStorage.setItem(key, value) : undefined);
    draftWrite.current = write;
    return write;
  }, []);
  const armAutosave = useCallback(() => {
    autosaveArmed.current = true; autosaveBlocked.current = false; autosaveForce.current = false;
    autosaveRound.current++; autosaveAttempts.current = 0; autosaveBackoff.current = false;
    const changed = JSON.stringify(current.current.payload) !== savedSignatureRef.current;
    const documentId = activeDocumentRef.current;
    const nextStatus = changed ? "pending" : !documentId || documentId.startsWith("template_") ? "idle" : documentId.startsWith("local_") ? "local" : "saved";
    setAutosaveError(""); setAutosaveStatus(status => status === "saving" ? status : nextStatus);
    setAutosaveRevision(value => value + 1);
  }, []);
  useEffect(() => {
    const run = ++generation.current;
    cancelAutosave(); autosaveArmed.current = false; autosaveBlocked.current = false; autosaveForce.current = false; autosaveTarget.current = null;
    autosaveRound.current++; autosaveAttempts.current = 0; autosaveBackoff.current = false;
    savingRef.current = false; openingRef.current = false;
    protectedDepartureRef.current = false;
    departureRef.current = false;
    let active = true;
    Promise.resolve().then(() => { if (active) { setLoading(true); setOpening(false); setSaving(false); setAutosaveStatus("idle"); setAutosaveError(""); setDeparting(false); setError(""); setClass(null); setRoster([]); setDocuments([]); } });
    if (!userId || !classId) { Promise.resolve().then(() => { if (active) { setLoading(false); setError("Entre na sua conta para abrir a turma."); } }); return () => { active = false; generation.current = run + 1; }; }
    void (async () => {
      try {
        const classData = await measureAsync("screen.visualCourt.load.class", () => getClassById(classId));
        if (!classData?.organizationId) throw new Error("Turma indisponível para esta conta.");
        const [docs, students] = await measureAsync("screen.visualCourt.load.documents", () => Promise.all([listTechnicalVisualsByClass(classId, { organizationId: classData.organizationId, limit: 200 }), getStudentsByClass(classId, { organizationId: classData.organizationId })]));
        if (!active || run !== generation.current) return;
        const trashRaw = await AsyncStorage.getItem(`goatleta:court-trash:v1:${userId}:${classData.organizationId}:${classId}`);
        let trash: string[] = [];
        try { const parsed: unknown = JSON.parse(trashRaw || "[]"); if (Array.isArray(parsed)) trash = parsed.filter((id): id is string => typeof id === "string"); } catch { /* Keep the library accessible if preferences are damaged. */ }
        if (!active || run !== generation.current) return;
        setTrashedIds(trash);
        const templates = [["5×1 · Recepção", buildSimulatedReceptionRotationPreset()]] as [string, CourtVisualPayload][];
        const locals: CourtVisualDocument[] = templates.map(([title, payload], i) => ({ id: `template_${i}`, classId, organizationId: classData.organizationId!, sourceKind: "rotation", title, payload, createdAt: "", updatedAt: "" }));
        const backupPrefix = `goatleta:court-draft:v2:${userId}:${classData.organizationId}:${classId}:backup:`;
        const backups: CourtVisualDocument[] = [];
        try {
          const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(backupPrefix)).slice(-100);
          const entries = await AsyncStorage.multiGet(keys);
          for (const [, raw] of entries) {
            try { const d = raw ? JSON.parse(raw) as CourtVisualDocument : null; if (d?.organizationId === classData.organizationId && d.classId === classId && d.payload?.editor?.version === 1) backups.push(d); } catch { /* Ignore a corrupt backup. */ }
          }
        } catch { /* Remote library remains available if local storage fails. */ }
        const all = [...backups.reverse(), ...docs, ...locals].map(d => ({ ...d, payload: upgradeCourtEditor(d.payload, d.title) }));
        const preferred = all.find(d => d.sourceId === "goatleta:5x1-reception" && !trash.includes(d.id))
          ?? all.find(d => d.id === "template_0" && !trash.includes(d.id))
          ?? all.find(d => !trash.includes(d.id));
        let snapshot = { payload: preferred?.payload ?? newCourtBoard(), stepIndex: 0 };
        let openedDocumentId = preferred?.id ?? newLocalDocumentId();
        let recovered = false;
        try {
          const raw = await AsyncStorage.getItem(`goatleta:court-draft:v2:${userId}:${classData.organizationId}:${classId}`);
          if (raw) {
            const stored = JSON.parse(raw);
            if (stored.payload?.editor?.version === 1 && stored.payload.timeline?.steps?.length) {
              snapshot = { payload: upgradeCourtEditor(stored.payload, stored.payload.editor.title || "Jogada"), stepIndex: Math.min(stored.stepIndex || 0, stored.payload.timeline.steps.length - 1) };
              openedDocumentId = typeof stored.documentId === "string" && stored.documentId ? stored.documentId : newLocalDocumentId();
              recovered = stored.unsaved !== false;
              // Older new/imported drafts had no identity. Reserve one before
              // any retry so a reload cannot select or overwrite the template.
              if (!active || run !== generation.current) return;
              if (openedDocumentId !== stored.documentId) await AsyncStorage.setItem(`goatleta:court-draft:v2:${userId}:${classData.organizationId}:${classId}`, JSON.stringify({ ...snapshot, documentId: openedDocumentId, unsaved: recovered }));
            }
          }
        } catch { /* Broken cache never prevents opening an authorized remote document. */ }
        if (!active || run !== generation.current) return;
        setClass(classData); setRoster(students); setDocuments(all);
        setHistory({ present: snapshot, past: [], future: [] });
        activeDocumentRef.current = openedDocumentId;
        setActiveDocumentId(openedDocumentId);
        setSavedSignature(recovered ? "" : JSON.stringify(snapshot.payload));
        setDraftStatus(""); setDraftError("");
        setAutosaveStatus(recovered || openedDocumentId?.startsWith("local_") ? "local" : "idle");
        setNotice(recovered ? "Rascunho recuperado neste dispositivo." : "");
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir a quadra."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; generation.current = run + 1; cancelAutosave(); };
  }, [classId, userId, setHistory, setSavedSignature, cancelAutosave]);

  useEffect(() => {
    if (!draftKey || loading || opening || departing) return;
    const run = generation.current, snapshot = history.present, documentId = activeDocumentRef.current;
    let active = true;
    const canWrite = () => active && run === generation.current && snapshot === current.current && documentId === activeDocumentRef.current && !openingRef.current && !departureRef.current;
    const timer = setTimeout(() => {
      draftTimer.current = null;
      if (!canWrite()) return;
      // Returning to the saved baseline must replace the older dirty draft too.
      // The same snapshot also preserves the selected step of an untouched board.
      void writeDraft(draftKey, JSON.stringify({ ...snapshot, documentId, unsaved: dirty }), canWrite).then(() => { if (canWrite()) { setDraftStatus(dirty ? "Neste dispositivo" : ""); setDraftError(""); } }).catch(() => { if (canWrite()) setDraftError("Falha no rascunho. Exporte uma cópia."); });
    }, 300);
    draftTimer.current = timer;
    return () => { active = false; clearTimeout(timer); if (draftTimer.current === timer) draftTimer.current = null; };
  }, [draftKey, dirty, history.present, loading, opening, departing, writeDraft]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const before = (e: BeforeUnloadEvent) => { if (dirty && !protectedDepartureRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const resume = () => { protectedDepartureRef.current = false; };
    window.addEventListener("beforeunload", before);
    window.addEventListener("pageshow", resume);
    return () => { window.removeEventListener("beforeunload", before); window.removeEventListener("pageshow", resume); };
  }, [dirty]);

  const commit = useCallback((update: (p: CourtVisualPayload) => CourtVisualPayload, stepIndex?: number) => {
    const before = current.current.payload;
    setHistory(h => {
      const payload = update(h.present.payload);
      if (payload === h.present.payload && stepIndex === undefined) return h;
      return { present: { payload, stepIndex: Math.min(stepIndex ?? h.present.stepIndex, payload.timeline.steps.length - 1) }, past: [...h.past.slice(-79), h.present], future: [] };
    });
    if (current.current.payload !== before) armAutosave();
    setDraftStatus(""); setNotice(""); setError("");
  }, [setHistory, armAutosave]);
  const selectStep = useCallback((i: number) => setHistory(h => ({ ...h, present: { ...h.present, stepIndex: Math.max(0, Math.min(i, h.present.payload.timeline.steps.length - 1)) } })), [setHistory]);
  const undo = useCallback(() => {
    const before = current.current.payload; setDraftStatus("");
    setHistory(h => h.past.length ? { present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future] } : h);
    if (current.current.payload !== before) armAutosave();
  }, [setHistory, armAutosave]);
  const redo = useCallback(() => {
    const before = current.current.payload; setDraftStatus("");
    setHistory(h => h.future.length ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) } : h);
    if (current.current.payload !== before) armAutosave();
  }, [setHistory, armAutosave]);
  const open = async (payload: CourtVisualPayload, documentId?: string | null) => {
    if (savingRef.current || openingRef.current || departureRef.current) return false;
    if (documentId && documentId === activeDocumentRef.current) return true;
    const run = generation.current;
    cancelAutosave();
    openingRef.current = true;
    setOpening(true);
    try {
      const previous = current.current;
      if (JSON.stringify(previous.payload) !== savedSignature && draftKey) {
        const existing = documents.find(document => document.id === activeDocumentRef.current);
        // A local file keeps its identity while edited. A model/remote source
        // retains its original row and receives a separate recoverable local draft.
        const local = existing?.id.startsWith("local_") ? existing : undefined;
        const id = activeDocumentRef.current?.startsWith("local_") ? activeDocumentRef.current : `local_${editorId()}`;
        const timestamp = new Date().toISOString();
        const backup: CourtVisualDocument = { ...local, id, classId, organizationId: cls!.organizationId!, title: previous.payload.editor!.title, sourceKind: local?.sourceKind ?? "free", payload: previous.payload, createdAt: local?.createdAt || timestamp, updatedAt: timestamp };
        await AsyncStorage.setItem(`${draftKey}:backup:${id}`, JSON.stringify(backup));
        if (run !== generation.current) return false;
        setDocuments(list => list.some(document => document.id === id)
          ? list.map(document => document.id === id ? backup : document)
          : [...list, backup]);
      }
      const openedDocumentId = documentId || newLocalDocumentId();
      // New/imported boards reserve a durable identity before their first edit.
      if (draftKey) await AsyncStorage.setItem(draftKey, JSON.stringify({ payload, stepIndex: 0, documentId: openedDocumentId, unsaved: false }));
      if (run !== generation.current) return false;
      setHistory({ present: { payload, stepIndex: 0 }, past: [], future: [] });
      activeDocumentRef.current = openedDocumentId;
      setActiveDocumentId(openedDocumentId);
      autosaveArmed.current = false; autosaveBlocked.current = false; autosaveForce.current = false; autosaveTarget.current = null;
      autosaveRound.current++; autosaveAttempts.current = 0; autosaveBackoff.current = false;
      setAutosaveStatus(openedDocumentId.startsWith("local_") ? "local" : "idle"); setAutosaveError("");
      setSavedSignature(JSON.stringify(payload)); setDraftStatus(""); setDraftError(""); setError(""); setNotice("");
      return true;
    } finally { if (run === generation.current) { openingRef.current = false; setOpening(false); } }
  };
  const save = async (title?: string, automatic = false) => {
    if (!cls?.organizationId || savingRef.current || openingRef.current || departureRef.current) return false;
    const currentSnapshot = current.current;
    const snapshot = title ? { ...currentSnapshot, payload: { ...currentSnapshot.payload, editor: { ...currentSnapshot.payload.editor!, title: title.trim() } } } : currentSnapshot;
    if (JSON.stringify(snapshot.payload) === savedSignature && activeDocumentRef.current && !activeDocumentRef.current.startsWith("local_") && !activeDocumentRef.current.startsWith("template_")) return true;
    const run = generation.current, round = autosaveRound.current;
    const attempt = automatic ? ++autosaveAttempts.current : 0;
    autosaveBackoff.current = false;
    cancelAutosave(); savingRef.current = true;
    setSaving(true); setError(""); setAutosaveError(""); setAutosaveStatus(automatic ? "saving" : "pending");
    try {
      const currentDocumentId = activeDocumentRef.current;
      const existing = documents.find(document => document.id === currentDocumentId);
      const updateId = currentDocumentId && !currentDocumentId.startsWith("template_") && !currentDocumentId.startsWith("local_") ? currentDocumentId : undefined;
      const sourceId = existing?.sourceId ?? (currentDocumentId === "template_0" ? "goatleta:5x1-reception" : autosaveTarget.current?.sourceId ?? currentDocumentId ?? editorId());
      const name = snapshot.payload.editor!.title.trim() || "Jogada";
      const localDocument = currentDocumentId?.startsWith("local_");
      if ((automatic || localDocument) && !autosaveTarget.current) autosaveTarget.current = {
        id: updateId ?? buildTechnicalVisualId({ organizationId: cls.organizationId, classId, sourceKind: "free", title: localDocument ? `document:${currentDocumentId}` : existing?.title ?? name }), sourceId,
      };
      if (localDocument && draftKey) {
        // The destination derives from this persisted ID, never from its title
        // or a hook ref that would disappear after an uncertain write/reload.
        await writeDraft(draftKey, JSON.stringify({ ...snapshot, documentId: currentDocumentId, unsaved: true }), () => run === generation.current && currentDocumentId === activeDocumentRef.current);
        if (run !== generation.current || currentDocumentId !== activeDocumentRef.current) return false;
      }
      const saved = await saveTechnicalVisual({ id: automatic ? autosaveTarget.current!.id : updateId ?? autosaveTarget.current?.id, classId, organizationId: cls.organizationId, sourceKind: "free", sourceId: automatic ? autosaveTarget.current!.sourceId : sourceId, title: name, payload: snapshot.payload }, automatic || autosaveTarget.current ? { requireRemote: true } : undefined);
      if (run !== generation.current) return;
      if (!saved) throw new Error("Não foi possível salvar. Seu rascunho permanece no dispositivo.");
      if (title) setHistory(h => h.present.payload === currentSnapshot.payload ? { ...h, present: snapshot } : h);
      setDocuments(list => list.some(document => document.id === saved.id || (currentDocumentId?.startsWith("local_") && document.id === currentDocumentId))
        ? list.map(document => document.id === saved.id || (currentDocumentId?.startsWith("local_") && document.id === currentDocumentId) ? saved : document)
        : [...list, saved]);
      activeDocumentRef.current = saved.id;
      setActiveDocumentId(saved.id);
      setSavedSignature(JSON.stringify(snapshot.payload));
      setDraftStatus("");
      autosaveTarget.current = saved.id.startsWith("local_") ? autosaveTarget.current : { id: saved.id, sourceId };
      autosaveBlocked.current = saved.id.startsWith("local_"); autosaveForce.current = false;
      if (round === autosaveRound.current) { autosaveAttempts.current = 0; autosaveBackoff.current = false; }
      setAutosaveStatus(saved.id.startsWith("local_") ? "local" : JSON.stringify(current.current.payload) === JSON.stringify(snapshot.payload) ? "saved" : "pending");
      if (!automatic) setNotice(saved.id.startsWith("local_") ? "Jogada salva neste dispositivo; sincronização pendente." : updateId ? "Jogada atualizada na turma." : "Jogada salva na turma.");
      if (draftKey && JSON.stringify(current.current.payload) === JSON.stringify(snapshot.payload)) {
        try {
          // The next debounced draft must run after this cleanup, including
          // edits made while AsyncStorage is still removing the saved snapshot.
          const cleanup = draftWrite.current.catch(() => undefined).then(async () => {
            if (run !== generation.current || activeDocumentRef.current !== saved.id || JSON.stringify(current.current.payload) !== JSON.stringify(snapshot.payload)) return;
            if (saved.id.startsWith("local_")) await AsyncStorage.setItem(draftKey, JSON.stringify({ ...snapshot, documentId: saved.id, unsaved: false }));
            else {
              await AsyncStorage.removeItem(draftKey);
              if (currentDocumentId?.startsWith("local_")) await AsyncStorage.removeItem(`${draftKey}:backup:${currentDocumentId}`);
            }
          });
          draftWrite.current = cleanup;
          await cleanup;
          if (run === generation.current) setDraftError("");
        } catch { if (run === generation.current) setDraftError("Falha no rascunho. Exporte uma cópia."); }
      }
      return true;
    } catch (e) {
      if (run === generation.current) {
        const message = e instanceof Error ? e.message : "Falha ao salvar.";
        const retry = automatic && canRetryAutosave(e) && (round !== autosaveRound.current || attempt < 2);
        autosaveBlocked.current = !retry;
        autosaveBackoff.current = retry && round === autosaveRound.current;
        setAutosaveError(retry ? "" : message); setAutosaveStatus(retry ? "pending" : "error");
        if (retry) setAutosaveRevision(value => value + 1);
        // A timed-out write may have reached the server. Keep even an undo to
        // the former baseline dirty until the current snapshot is confirmed.
        if (automatic) setSavedSignature("");
        else setError(message);
      }
      return false;
    } finally { if (run === generation.current) { savingRef.current = false; setSaving(false); } }
  };
  const saveLatest = useRef<typeof save | null>(null);
  useEffect(() => { saveLatest.current = save; });
  const retryAutosave = useCallback(() => {
    autosaveArmed.current = true; autosaveBlocked.current = false; autosaveForce.current = true;
    autosaveRound.current++; autosaveAttempts.current = 0; autosaveBackoff.current = false;
    setAutosaveError(""); setAutosaveStatus("pending"); setAutosaveRevision(value => value + 1);
  }, []);
  useEffect(() => {
    if (!autosaveArmed.current || autosaveBlocked.current || loading || opening || saving || departing || autosavePaused || !foreground || !cls?.organizationId || !(dirty || (needsSync && autosaveForce.current))) return;
    const run = generation.current;
    const timer = setTimeout(() => {
      if (autosaveTimer.current === timer) autosaveTimer.current = null;
      if (run !== generation.current || !foregroundRef.current || autosaveBlocked.current || !autosaveArmed.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) { autosaveBlocked.current = true; setAutosaveStatus("local"); return; }
      void saveLatest.current?.(undefined, true);
    }, autosaveBackoff.current ? 1500 : 800);
    autosaveTimer.current = timer;
    return cancelAutosave;
  }, [signature, autosaveRevision, loading, opening, saving, departing, autosavePaused, foreground, cls?.organizationId, dirty, needsSync, cancelAutosave]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const active = () => {
      const visible = typeof document === "undefined" || !document.hidden;
      foregroundRef.current = visible; setForeground(visible);
      if (visible && autosaveArmed.current && !autosaveBlocked.current) setAutosaveRevision(value => value + 1);
      if (!visible) cancelAutosave();
    };
    const online = () => {
      if (autosaveArmed.current) {
        autosaveRound.current++; autosaveAttempts.current = 0; autosaveBackoff.current = false;
        autosaveBlocked.current = false; setAutosaveError(""); setAutosaveStatus("pending");
      }
      active();
    };
    const hidden = () => { foregroundRef.current = false; setForeground(false); cancelAutosave(); };
    window.addEventListener("online", online); window.addEventListener("pageshow", active); window.addEventListener("pagehide", hidden);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", active);
    return () => { window.removeEventListener("online", online); window.removeEventListener("pageshow", active); window.removeEventListener("pagehide", hidden); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", active); };
  }, [cancelAutosave]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", state => {
      const visible = state === "active";
      foregroundRef.current = visible; setForeground(visible);
      if (!visible) cancelAutosave();
      else if (autosaveArmed.current && !autosaveBlocked.current) setAutosaveRevision(value => value + 1);
    });
    return () => subscription.remove();
  }, [cancelAutosave]);
  const preserveDraft = async () => {
    if (!draftKey) { setError("Não foi possível guardar o rascunho. Aguarde a abertura da turma."); return false; }
    const run = generation.current, snapshot = current.current, documentId = activeDocumentRef.current;
    if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; }
    try {
      await writeDraft(draftKey, JSON.stringify({ ...snapshot, documentId, unsaved: JSON.stringify(snapshot.payload) !== savedSignatureRef.current }));
      if (run !== generation.current) return false;
      if (snapshot !== current.current || documentId !== activeDocumentRef.current) { setError("A jogada mudou enquanto o rascunho era guardado. Tente novamente."); return false; }
      setDraftError(""); return true;
    }
    catch { if (run === generation.current) setError("Não foi possível guardar o rascunho. Exporte uma cópia antes de sair."); return false; }
  };
  const leaveWithDraft = async (navigate: () => void): Promise<boolean> => {
    if (loading || savingRef.current || openingRef.current || departureRef.current) return false;
    const run = generation.current;
    departureRef.current = true;
    setDeparting(true);
    protectedDepartureRef.current = false;
    try {
      if (!await preserveDraft() || run !== generation.current) return false;
      protectedDepartureRef.current = true;
      navigate();
      return true;
    } catch {
      protectedDepartureRef.current = false;
      if (run === generation.current) setError("Não foi possível sair da quadra. Seu rascunho está neste dispositivo.");
      return false;
    } finally {
      if (run === generation.current) { departureRef.current = false; setDeparting(false); }
    }
  };
  const trashBusy = useRef(false);
  const setDocumentTrashed = async (id: string, removed: boolean) => {
    if (!userId || !cls?.organizationId || trashBusy.current || !documents.some(d => d.id === id)) return;
    trashBusy.current = true;
    const run = generation.current;
    try {
      const next = removed ? [...new Set([...trashedIds, id])] : trashedIds.filter(item => item !== id);
      await AsyncStorage.setItem(`goatleta:court-trash:v1:${userId}:${cls.organizationId}:${classId}`, JSON.stringify(next));
      if (run !== generation.current) return;
      setTrashedIds(next);
      setNotice(removed ? "Movido para a lixeira deste dispositivo." : "Item restaurado na biblioteca.");
    } catch { setError("Não foi possível atualizar a lixeira. Tente novamente."); }
    finally { trashBusy.current = false; }
  };
  return { ...history.present, cls, roster, documents, trashedIds, activeDocumentId, setDocumentTrashed, loading, opening, saving, departing, error, notice, dirty, needsSync, canSave, draftStatus, draftError, autosaveStatus, autosaveError, retryAutosave, canUndo: !!history.past.length, canRedo: !!history.future.length, commit, selectStep, undo, redo, open, save, preserveDraft, leaveWithDraft, setError, setNotice };
}
