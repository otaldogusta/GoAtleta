import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/auth";
import { measureAsync } from "../../observability/perf";
import { getClassById, getStudentsByClass, listTechnicalVisualsByClass, saveTechnicalVisual } from "../../db/seed";
import type { ClassGroup, Student } from "../../core/models";
import { buildEditable5x1ReceptionPreset, type CourtVisualDocument, type CourtVisualPayload } from "../../core/visual-court";
import { editorId, newCourtBoard, upgradeCourtEditor, type EditorSnapshot } from "../../core/visual-court-editor";

type History = { present: EditorSnapshot; past: EditorSnapshot[]; future: EditorSnapshot[] };
const initial = (): History => ({ present: { payload: newCourtBoard(), stepIndex: 0 }, past: [], future: [] });
export function useCourtEditor(classId: string) {
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedSignature, setSavedSignature] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftError, setDraftError] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const generation = useRef(0);
  const savingRef = useRef(false);
  const activeDocumentRef = useRef<string | null>(null);
  const signature = JSON.stringify(history.present.payload);
  const dirty = signature !== savedSignature;
  const needsSync = !activeDocumentId || activeDocumentId.startsWith("local_") || activeDocumentId.startsWith("template_");
  const canSave = !loading && !saving && !opening && Boolean(cls?.organizationId) && (dirty || needsSync);
  const draftKey = cls?.organizationId && userId ? `goatleta:court-draft:v2:${userId}:${cls.organizationId}:${classId}` : null;
  const current = useRef(history.present);
  const setHistory = useCallback((change: History | ((old: History) => History)) => {
    const next = typeof change === "function" ? change(historyRef.current) : change;
    historyRef.current = next;
    current.current = next.present;
    setHistoryState(next);
  }, []);
  useEffect(() => {
    const run = ++generation.current;
    let active = true;
    Promise.resolve().then(() => { if (active) { setLoading(true); setError(""); setClass(null); setRoster([]); setDocuments([]); } });
    if (!userId || !classId) { Promise.resolve().then(() => { if (active) { setLoading(false); setError("Entre na sua conta para abrir a turma."); } }); return () => { active = false; }; }
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
        const templates = [["5×1 · Recepção", buildEditable5x1ReceptionPreset()]] as [string, CourtVisualPayload][];
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
        let openedDocumentId = preferred?.id ?? null;
        let recovered = false;
        try {
          const raw = await AsyncStorage.getItem(`goatleta:court-draft:v2:${userId}:${classData.organizationId}:${classId}`);
          if (raw) { const stored = JSON.parse(raw); if (stored.payload?.editor?.version === 1 && stored.payload.timeline?.steps?.length) { snapshot = { payload: upgradeCourtEditor(stored.payload, stored.payload.editor.title || "Jogada"), stepIndex: Math.min(stored.stepIndex || 0, stored.payload.timeline.steps.length - 1) }; openedDocumentId = typeof stored.documentId === "string" ? stored.documentId : openedDocumentId; recovered = stored.unsaved !== false; } }
        } catch { /* Broken cache never prevents opening an authorized remote document. */ }
        if (!active || run !== generation.current) return;
        setClass(classData); setRoster(students); setDocuments(all);
        setHistory({ present: snapshot, past: [], future: [] });
        activeDocumentRef.current = openedDocumentId;
        setActiveDocumentId(openedDocumentId);
        setSavedSignature(recovered ? "" : JSON.stringify(snapshot.payload));
        setDraftStatus(""); setDraftError("");
        setNotice(recovered ? "Rascunho recuperado neste dispositivo." : "");
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir a quadra."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [classId, userId, setHistory]);

  useEffect(() => {
    if (!draftKey || loading || opening || !dirty) return;
    let active = true;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, JSON.stringify({ ...history.present, documentId: activeDocumentRef.current })).then(() => { if (active) { setDraftStatus("Neste dispositivo"); setDraftError(""); } }).catch(() => { if (active) setDraftError("Falha no rascunho. Exporte uma cópia."); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [draftKey, dirty, history.present, loading, opening]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const before = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);

  const commit = useCallback((update: (p: CourtVisualPayload) => CourtVisualPayload, stepIndex?: number) => {
    setHistory(h => {
      const payload = update(h.present.payload);
      if (payload === h.present.payload && stepIndex === undefined) return h;
      return { present: { payload, stepIndex: Math.min(stepIndex ?? h.present.stepIndex, payload.timeline.steps.length - 1) }, past: [...h.past.slice(-79), h.present], future: [] };
    });
    setDraftStatus(""); setNotice(""); setError("");
  }, [setHistory]);
  const selectStep = useCallback((i: number) => setHistory(h => ({ ...h, present: { ...h.present, stepIndex: Math.max(0, Math.min(i, h.present.payload.timeline.steps.length - 1)) } })), [setHistory]);
  const undo = useCallback(() => { setDraftStatus(""); setHistory(h => h.past.length ? { present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future] } : h); }, [setHistory]);
  const redo = useCallback(() => { setDraftStatus(""); setHistory(h => h.future.length ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) } : h); }, [setHistory]);
  const open = async (payload: CourtVisualPayload, documentId?: string | null) => {
    if (savingRef.current || openingRef.current) return false;
    if (documentId && documentId === activeDocumentRef.current) return true;
    const run = generation.current;
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
      // Only selection is persisted when opening an untouched file.
      if (draftKey) await AsyncStorage.setItem(draftKey, JSON.stringify({ payload, stepIndex: 0, documentId: documentId ?? null, unsaved: false }));
      if (run !== generation.current) return false;
      setHistory({ present: { payload, stepIndex: 0 }, past: [], future: [] });
      activeDocumentRef.current = documentId ?? null;
      setActiveDocumentId(documentId ?? null);
      setSavedSignature(JSON.stringify(payload)); setDraftStatus(""); setDraftError(""); setError(""); setNotice("");
      return true;
    } finally { openingRef.current = false; setOpening(false); }
  };
  const save = async (title?: string) => {
    if (!cls?.organizationId || savingRef.current || openingRef.current) return false;
    const currentSnapshot = current.current;
    const snapshot = title ? { ...currentSnapshot, payload: { ...currentSnapshot.payload, editor: { ...currentSnapshot.payload.editor!, title: title.trim() } } } : currentSnapshot;
    if (JSON.stringify(snapshot.payload) === savedSignature && activeDocumentRef.current && !activeDocumentRef.current.startsWith("local_") && !activeDocumentRef.current.startsWith("template_")) return true;
    const run = generation.current;
    savingRef.current = true;
    setSaving(true); setError("");
    try {
      const currentDocumentId = activeDocumentRef.current;
      const existing = documents.find(document => document.id === currentDocumentId);
      const updateId = currentDocumentId && !currentDocumentId.startsWith("template_") && !currentDocumentId.startsWith("local_") ? currentDocumentId : undefined;
      const sourceId = existing?.sourceId ?? (currentDocumentId === "template_0" ? "goatleta:5x1-reception" : editorId());
      const saved = await saveTechnicalVisual({ id: updateId, classId, organizationId: cls.organizationId, sourceKind: "free", sourceId, title: snapshot.payload.editor!.title.trim() || "Jogada", payload: snapshot.payload });
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
      setNotice(saved.id.startsWith("local_") ? "Jogada salva neste dispositivo; sincronização pendente." : updateId ? "Jogada atualizada na turma." : "Jogada salva na turma.");
      if (draftKey && JSON.stringify(current.current.payload) === JSON.stringify(snapshot.payload)) {
        try {
          if (saved.id.startsWith("local_")) await AsyncStorage.setItem(draftKey, JSON.stringify({ ...snapshot, documentId: saved.id, unsaved: false }));
          else {
            await AsyncStorage.removeItem(draftKey);
            if (currentDocumentId?.startsWith("local_")) await AsyncStorage.removeItem(`${draftKey}:backup:${currentDocumentId}`);
          }
          setDraftError("");
        } catch { setDraftError("Falha no rascunho. Exporte uma cópia."); }
      }
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const preserveDraft = async () => {
    if (!draftKey) return false;
    try { await AsyncStorage.setItem(draftKey, JSON.stringify({ ...current.current, documentId: activeDocumentRef.current })); setDraftError(""); return true; }
    catch { setError("Não foi possível guardar o rascunho. Exporte uma cópia antes de sair."); return false; }
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
  return { ...history.present, cls, roster, documents, trashedIds, activeDocumentId, setDocumentTrashed, loading, opening, saving, error, notice, dirty, needsSync, canSave, draftStatus, draftError, canUndo: !!history.past.length, canRedo: !!history.future.length, commit, selectStep, undo, redo, open, save, preserveDraft, setError, setNotice };
}
