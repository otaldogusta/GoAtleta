import { CourtTimelineScrubber } from "./CourtTimelineScrubber";
import { courtRoster } from "../../core/court-roster";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { useSaveToast } from "../../ui/save-toast";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { createWebPortal } from "../../ui/web-portal";
import { addBlankStep, alignSelection, resetStepAnimation, actorPoint, changeDrawings, changeStep, continueStepFromEnd, copyStepSelection, deleteSelection, duplicateSelection, duplicateStep, editorId, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, removeStep, reorderStep, reorderStepToIndex, type CourtDrawing, type CourtSelectionClipboard, type EditorSnapshot } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualActorRole, CourtVisualPayload } from "../../core/visual-court";
import type { CourtTool } from "./CourtEditorCanvas";
import { VisualCourtCanvas } from "./VisualCourtCanvas";
import { CourtEditorScene } from "./CourtEditorScene";
import { useCourtEditor } from "./useCourtEditor";
import { CourtActionButton, CourtSwitchRow, CourtSizeControl, CourtRosterPicker, type CourtActionIcon } from "./CourtEditorControls";
import { exportCourt } from "./court-export";

const TOOLS: { id: CourtTool; label: string; icon: CourtActionIcon }[] = [
  { id: "select", label: "Selecionar e mover", icon: "navigate" },
  { id: "player", label: "Adicionar jogador", icon: "profile" },
  { id: "ball", label: "Adicionar bola", icon: "courtBall" },
  { id: "cone", label: "Materiais de treino", icon: "courtCone" },
  { id: "arrow", label: "Desenhar seta", icon: "courtArrow" },
  { id: "pen", label: "Desenho livre", icon: "pencil" },
  { id: "text", label: "Adicionar texto", icon: "courtText" },
  { id: "animate", label: "Animar movimento", icon: "compare" },
];
const COLORS = ["#19c87b", "#4389ff", "#c5fff0", "#b19cff", "#ff6c71", "#ffdc53", "#ffffff", "#172437"];
const ROLES: [CourtVisualActorRole, string][] = [["setter", "Levantador"], ["outside", "Ponteiro"], ["middle", "Central"], ["opposite", "Oposto"], ["libero", "Líbero"], ["athlete", "Atleta"]];

function DraggableStepFrame({ index, active, over, onDragState, onMove, children }: { index: number; active: boolean; over: boolean; onDragState: (dragged: number | null | undefined, target?: number | null) => void; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    node.draggable = true;
    const start = (event: DragEvent) => {
      event.dataTransfer?.setData("application/x-goatleta-court-step", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      onDragState(index, index);
    };
    const enter = (event: DragEvent) => { event.preventDefault(); onDragState(undefined, index); };
    const dragOver = (event: DragEvent) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const from = Number(event.dataTransfer?.getData("application/x-goatleta-court-step"));
      if (Number.isFinite(from)) onMove(from, index);
      onDragState(null, null);
    };
    const end = () => onDragState(null, null);
    node.addEventListener("dragstart", start); node.addEventListener("dragenter", enter); node.addEventListener("dragover", dragOver); node.addEventListener("drop", drop); node.addEventListener("dragend", end);
    return () => { node.draggable = false; node.removeEventListener("dragstart", start); node.removeEventListener("dragenter", enter); node.removeEventListener("dragover", dragOver); node.removeEventListener("drop", drop); node.removeEventListener("dragend", end); };
  }, [index, onDragState, onMove]);
  return <View ref={ref} style={[styles.stepCard, over && !active ? { transform: [{ translateY: -4 }], borderColor: "#28d78b" } : null, active ? { opacity: 0.5, transform: [{ scale: 0.96 }] } : null, Platform.OS === "web" ? { cursor: "grab", transition: "transform 160ms ease, opacity 160ms ease, border-color 160ms ease" } as never : null]}>{children}</View>;
}

export function CourtEditorWorkspace({ classId, documentId, lessonDate, planId, onBack }: { classId: string; documentId?: string; lessonDate?: string; planId?: string; onBack: () => void }) {
  const editor = useCourtEditor(classId);
  const { showSaveToast } = useSaveToast();
  const { notice, error, setNotice, setError } = editor;
  useEffect(() => {
    if (!error && !notice) return;
    showSaveToast({ message: error || notice, variant: error ? "error" : "info" });
    setNotice("");
    setError("");
  }, [error, notice, setError, setNotice, showSaveToast]);
  const { payload, stepIndex, commit } = editor;
  const { colors, mode } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [topOpen, setTopOpen] = useState(false);
  const [topPinned, setTopPinned] = useState(false);
  const [bottomPinned, setBottomPinned] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [panel, setPanel] = useState<"properties" | "library" | "export" | "tools" | "settings" | "step" | "players" | null>(null);
  const [motionMode, setMotionMode] = useState<"free" | "straight">("free");
  const [tool, setTool] = useState<CourtTool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [color, setColor] = useState("#19c87b");
  const [dashed, setDashed] = useState(true);
  const [grid, setGrid] = useState(false);
  const [half, setHalf] = useState(false);
  const [plain, setPlain] = useState(false);
  const [orientation, setOrientation] = useState<"auto" | "landscape" | "portrait">("auto");
  const [zoom, setZoom] = useState(1);
  const [zoomHintVisible, setZoomHintVisible] = useState(false);
  const previousZoom = useRef(zoom);
  useEffect(() => {
    if (previousZoom.current === zoom) return;
    previousZoom.current = zoom;
    setZoomHintVisible(true);
    const timer = setTimeout(() => setZoomHintVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [zoom]);
  const [pan, setPan] = useState<CourtPoint>({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const playhead = useRef(0);
  useEffect(() => { playhead.current = progress ?? 0; }, [progress]);
  const [speed, setSpeed] = useState(1);
  const selectionClipboard = useRef<CourtSelectionClipboard | null>(null);
  const [draggedStep, setDraggedStep] = useState<number | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [libraryTab, setLibraryTab] = useState<"plays" | "systems" | "details" | "trash">("plays");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyLesson, setOnlyLesson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [multi, setMulti] = useState(false);
  const [team, setTeam] = useState<"A" | "B">("A");
  const [substitute, setSubstitute] = useState(false);
  const landscape = orientation === "auto" ? width > height : orientation === "landscape";
  const compact = width < 700;
  const short = height < 580;
  const timelineVisible = bottomOpen && panel !== "step";
  const [timelineHeight, setTimelineHeight] = useState(240);
  const historyBottom = insets.bottom + (compact && timelineVisible ? timelineHeight + 8 : compact ? 0 : 12);
  const toolsTop = insets.top + 70;
  const toolsSpace = Math.max(44, height - toolsTop - insets.bottom - 70);
  const toolsHeight = Math.min(520, toolsSpace);
  const timelineWidth = compact
    ? Math.max(280, width - insets.left - insets.right - 16)
    : Math.min(640, Math.max(360, width - insets.left - insets.right - 620));
  const stepListRef = useRef<ScrollView>(null);
  const surface = mode === "dark" ? "rgba(10,25,43,0.94)" : "rgba(247,251,255,0.96)";
  const ink = colors.text;
  const step = payload.timeline.steps[stepIndex];
  const payloadRef = useRef(payload);
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  const actor = payload.actors.find(a => a.id === selected[0]);
  const object = frameDrawings(payload, stepIndex).find(d => d.id === selected[0]);
  const effectiveTitle = payload.editor!.title;
  const linkedOpened = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const app = document.getElementById("root");
    const previous = app?.inert;
    if (app) app.inert = true;
    return () => { if (app) app.inert = previous ?? false; };
  }, []);
  useEffect(() => {
    if (editor.loading || !documentId || linkedOpened.current) return;
    const found = editor.documents.find(d => d.id === documentId);
    linkedOpened.current = true;
    if (found) void editor.open(found.payload, found.id).catch(() => editor.setError("Não foi possível abrir esta versão."));
    else editor.setError("Versão indisponível nesta turma ou para esta conta.");
  }, [documentId, editor]);
  const stop = useCallback(() => { setPlaying(false); }, []);
  const resetPlayback = useCallback(() => { setPlaying(false); setProgress(0); }, []);
  const edit = (update: (p: CourtVisualPayload) => CourtVisualPayload, index?: number) => { stop(); commit(update, index); };
  const metadata = (changes: Partial<NonNullable<CourtVisualPayload["editor"]>>) => edit(p => ({ ...p, editor: { ...p.editor!, ...changes } }));
  const selectStep = (i: number) => { resetPlayback(); setSelected([]); editor.selectStep(i); };
  const mutateStep = (result: EditorSnapshot) => { resetPlayback(); setSelected([]); commit(() => result.payload, result.stepIndex); };
  const select = (ids: string[]) => { if (ids.length && width >= 768) setPanel("properties"); else if (panel === "properties") setPanel(null); setSelected(ids); };
  const remove = () => { edit(p => deleteSelection(p, stepIndex, selected)); setSelected([]); };
  const duplicate = () => { const result = duplicateSelection(payload, stepIndex, selected); edit(() => result.payload); setSelected(result.selected); };
  const selectAll = () => setSelected([...(step.visibleActorIds ?? payload.actors.map(a => a.id)), ...frameDrawings(payload, stepIndex).map(d => d.id)]);
  const copySelection = () => {
    const ids = selected.length ? selected : [...(step.visibleActorIds ?? payload.actors.map(a => a.id)), ...frameDrawings(payload, stepIndex).map(d => d.id)];
    selectionClipboard.current = copyStepSelection(payload, stepIndex, ids);
    editor.setNotice(ids.length ? "Seleção copiada. Abra outra etapa e cole." : "Não há itens para copiar nesta etapa.");
  };
  const pasteSelection = () => {
    if (!selectionClipboard.current) { editor.setNotice("Copie uma seleção antes de colar."); return; }
    const result = pasteStepSelection(payload, stepIndex, selectionClipboard.current);
    edit(() => result.payload);
    setSelected(result.selected);
    editor.setNotice("Seleção colada nesta etapa.");
  };
  const move = (ids: string[], delta: CourtPoint, path?: CourtPoint[]) => { edit(p => moveSelection(p, stepIndex, ids, delta, tool === "animate", path)); if (tool === "animate") setProgress(1); };
  const draw = (d: CourtDrawing) => { edit(p => changeDrawings(p, stepIndex, [...frameDrawings(p, stepIndex), d])); setSelected([d.id]); if (["text", "ball", "cone", "target", "ladder"].includes(d.kind)) setTool("select"); };
  const addPlayer = (point: CourtPoint) => {
    const id = editorId();
    const a = { id, role: "athlete" as const, label: String(payload.actors.length + 1), number: payload.actors.length + 1, color: team === "A" ? "#19c87b" : "#4389ff", initialPosition: point };
    edit(p => ({ ...p, actors: [...p.actors, a], editor: { ...p.editor!, actorMeta: { ...p.editor!.actorMeta, [id]: { team } } }, timeline: { steps: p.timeline.steps.map((s, i) => ({ ...s, actorPositions: i === stepIndex ? { ...s.actorPositions, [id]: point } : s.actorPositions, visibleActorIds: [...(s.visibleActorIds ?? p.actors.map(a => a.id)), ...(i === stepIndex ? [id] : [])] })) } }));
    setSelected([id]); setTool("select");
  };
  const changeActor = (changes: Partial<NonNullable<typeof actor>>) => { if (actor) edit(p => ({ ...p, actors: p.actors.map(a => a.id === actor.id ? { ...a, ...changes } : a) })); };
  const changeObject = (changes: Partial<CourtDrawing>) => { if (object) edit(p => changeDrawings(p, stepIndex, frameDrawings(p, stepIndex).map(d => d.id === object.id ? { ...d, ...changes } : d))); };
  const setActorMeta = (changes: { team?: "A" | "B"; locked?: boolean; studentId?: string }) => { if (actor) metadata({ actorMeta: { ...payload.editor!.actorMeta, [actor.id]: { ...payload.editor!.actorMeta[actor.id], ...changes } } }); };
  useEffect(() => {
    if (!playing) return;
    const duration = Math.max(450, step.durationMs / speed);
    let start = Date.now() - (playhead.current >= 1 ? 0 : playhead.current) * duration;
    const timer = setInterval(() => {
      const fraction = Math.min(1, (Date.now() - start) / duration);
      setProgress(fraction);
      if (fraction >= 1) {
        setPlaying(false);
        playhead.current = 1;
        setProgress(1);
      }
    }, 32);
    return () => clearInterval(timer);
  }, [playing, step.durationMs, speed]);
  const keyboard = useRef({ remove, move, save: editor.save, undo: editor.undo, redo: editor.redo, stop, selectAll, copySelection, pasteSelection, selected, landscape });
  useEffect(() => { keyboard.current = { remove, move, save: editor.save, undo: editor.undo, redo: editor.redo, stop, selectAll, copySelection, pasteSelection, selected, landscape }; });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.("input,textarea,[contenteditable=true]")) return;
      if (e.key === "Escape") { setExitOpen(false); setTopPinned(false); setBottomPinned(false); setPanel(null); setTopOpen(false); setBottomOpen(false); keyboard.current.stop(); return; }
      if ((e.ctrlKey || e.metaKey) && ["s", "z", "y", "a", "c", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault(); keyboard.current.stop();
        if (e.key.toLowerCase() === "s") void keyboard.current.save();
        else if (e.key.toLowerCase() === "a") keyboard.current.selectAll();
        else if (e.key.toLowerCase() === "c") keyboard.current.copySelection();
        else if (e.key.toLowerCase() === "v") keyboard.current.pasteSelection();
        else if (e.shiftKey || e.key.toLowerCase() === "y") keyboard.current.redo(); else keyboard.current.undo();
      } else if (["Delete", "Backspace"].includes(e.key) && keyboard.current.selected.length) { e.preventDefault(); keyboard.current.remove(); }
      else if (e.key.startsWith("Arrow") && keyboard.current.selected.length) { e.preventDefault(); const n = e.shiftKey ? 0.03 : 0.01; const dx = e.key === "ArrowLeft" ? -n : e.key === "ArrowRight" ? n : 0, dy = e.key === "ArrowUp" ? -n : e.key === "ArrowDown" ? n : 0; keyboard.current.move(keyboard.current.selected, keyboard.current.landscape ? { x: dy, y: -dx } : { x: dx, y: dy }); }
      else if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); keyboard.current.stop(); setTool("select"); setPanel(null); }

    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  const playCurrentStep = () => {
    if (playing) { setPlaying(false); return; }
    if (progress >= 1) { playhead.current = 0; setProgress(0); }
    setPlaying(true);
  };
  const restartCurrentStep = () => {
    setPlaying(false);
    playhead.current = 0;
    setProgress(0);
  };
  const openStepEditor = () => {
    stop();
    setBottomPinned(false);
    setBottomOpen(false);
    setPanel("step");
  };
  const moveStepTo = useCallback((from: number, to: number) => {
    if (from === to) return;
    const result = reorderStepToIndex(payloadRef.current, from, to);
    resetPlayback();
    setSelected([]);
    commit(() => result.payload, result.stepIndex);
  }, [commit, resetPlayback]);
  const updateStepDrag = useCallback((dragged: number | null | undefined, target: number | null = null) => {
    if (dragged !== undefined) setDraggedStep(dragged);
    setDragOverStep(target);
  }, []);
  const scrollCurrentStep = useCallback((animated = true) => {
    const cardWidth = short ? 105 : 135;
    const x = Math.max(0, stepIndex * (cardWidth + 8) - timelineWidth / 2 + cardWidth / 2);
    stepListRef.current?.scrollTo({ x, y: 0, animated });
  }, [short, stepIndex, timelineWidth]);
  useEffect(() => { if (timelineVisible) requestAnimationFrame(() => scrollCurrentStep(false)); }, [scrollCurrentStep, timelineVisible]);
  const action = (label: string, icon: CourtActionIcon, fn: () => void, active = false, disabled = false, text = false, dragKind?: string) => <CourtActionButton key={label} label={label} icon={icon} onPress={fn} active={active} disabled={disabled} text={text} dragKind={dragKind} danger={label === "Excluir etapa"} />;
  const toggle = (label: string, value: boolean, onChange: (value: boolean) => void) => <CourtSwitchRow key={label} label={label} value={value} onChange={onChange} />;
  const toolGrid = (items: [CourtTool, string, CourtActionIcon][]) => <View style={styles.wrap}>{items.map(([id, label, icon]) => <CourtActionButton key={id} label={label} icon={icon} tile onAdd={() => {
      stop();
      const kind = id as CourtDrawing["kind"];
      const point = { x: 0.5, y: 0.7 };
      const points = kind === "curve" ? [point, { x: 0.35, y: 0.6 }, { x: 0.55, y: 0.52 }] : ["arrow", "pen", "area"].includes(kind) ? [point, { x: 0.65, y: 0.55 }] : [point];
      draw({ id: editorId(), kind, points, color, dashed, size: 32, rotation: 0, ...(kind === "text" ? { text: "Anotação" } : {}) });
      setTool("select");
      setPanel(null);
    }} dragKind={["ball", "cone", "target", "ladder"].includes(id) ? id : undefined} active={tool === id} onPress={() => { stop(); setTool(id); }} />)}</View>;
  const field = (label: string, value: string, onChange: (value: string) => void, multiline = false) => <View style={{ gap: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><View style={{ backgroundColor: colors.inputBg, borderRadius: 12, minHeight: 50, paddingHorizontal: 14 }}><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} style={{ color: ink, minHeight: multiline ? 70 : 50, borderRadius: 0, fontSize: 14 }} /></View></View>;
  const heading = (label: string) => <Text style={{ color: ink, fontWeight: "700", fontSize: 15, marginTop: 10 }}>{label}</Text>;
  const openPayload = async (p: CourtVisualPayload, documentId?: string | null) => { try { stop(); await editor.open(p, documentId); setSelected([]); setPanel(null); } catch { editor.setError("Não foi possível guardar a cópia local. Exporte antes de trocar."); } };
  const runExport = async (kind: "png" | "gif" | "pdf" | "json") => { stop(); setBusy(true); try { await exportCourt(payload, stepIndex, kind); editor.setNotice("Exportação concluída."); } catch (e) { editor.setError(e instanceof Error ? e.message : "Falha ao exportar."); } finally { setBusy(false); } };
  const importFile = async () => { try {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
    if (r.canceled) return;
    if ((r.assets[0].size ?? 0) > 2_000_000) throw new Error("Arquivo acima de 2 MB.");
    const raw = await (await fetch(r.assets[0].uri)).text();
    await openPayload(parseEditorImport(raw));
  } catch (e) { editor.setError(e instanceof Error ? e.message : "Arquivo inválido."); } };
  const roster = courtRoster(payload, stepIndex);
  const teamRoster = roster.filter(item => item.team === team);
  const panelTitle = panel === "library" ? "Biblioteca" : panel === "export" ? "Exportar" : panel === "tools" ? "Ferramentas" : panel === "settings" ? "Configurações da quadra" : panel === "step" ? `Etapa ${stepIndex + 1}` : panel === "players" ? "Jogadores e banco" : selected.length > 1 ? `${selected.length} itens selecionados` : actor ? "Jogador" : object ? "Objeto" : "Propriedades";
  const [courtFocused, setCourtFocused] = useState(false);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreControls = useCallback(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    setCourtFocused(false);
  }, []);
  const focusCourt = useCallback(() => {
    setCourtFocused(true);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setCourtFocused(false), 1400);
  }, []);
  useEffect(() => () => { if (focusTimer.current) clearTimeout(focusTimer.current); }, []);
  const controlFade = { opacity: courtFocused ? 0.28 : 1, ...(Platform.OS === "web" ? { transition: "opacity 180ms ease" } : {}) };
  const root = <View style={[styles.root, Platform.OS === "web" ? { position: "fixed" } as never : null]}>
    {editor.loading ? <View style={styles.center}><ActivityIndicator size="large" color="#fff" /><Text style={{ color: "#fff" }}>Abrindo quadra…</Text></View> : !editor.cls ? <View style={styles.center}><Text style={{ color: "#fff" }}>{editor.error}</Text>{action("Voltar", "chevronBack", onBack, false, false, true)}</View> : <>
      <View style={{ flex: 1 }} onPointerMove={focusCourt} onPointerDown={focusCourt} onPointerLeave={restoreControls} onTouchMove={focusCourt}>
      <VisualCourtCanvas payload={payload} stepIndex={stepIndex} landscape={landscape} selected={selected} multiple={multi} onSelect={select} onMove={move} onDraw={draw} onAddPlayer={addPlayer} tool={tool} motionMode={motionMode} color={color} dashed={dashed} grid={grid} half={half} plain={plain} progress={progress} zoom={zoom} pan={pan} onPan={setPan} onZoom={setZoom} disabled={playing || busy || editor.saving} />
      </View>

      <View onPointerEnter={restoreControls} onPointerDown={() => setTopPinned(true)} onPointerLeave={e => { if (e.nativeEvent.pointerType === "mouse" && !topPinned) setTopOpen(false); }} style={[controlFade, styles.top, { top: insets.top, backgroundColor: surface, maxHeight: height * 0.45, width: topOpen ? Math.min(width, 900) : undefined }]}>
        {topOpen ? <View style={styles.topContent}>
          {action("Voltar à turma", "chevronBack", () => editor.dirty ? setExitOpen(true) : onBack())}
          <View style={{ flex: 1, minWidth: 120 }}><Text numberOfLines={1} style={{ color: ink, fontSize: 16, fontWeight: "700" }}>{effectiveTitle}</Text><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{editor.cls.name} · {editor.saving ? "Salvando…" : editor.dirty ? editor.draftStatus || "Alterações locais" : "Versão salva"}</Text></View>
          {action("Biblioteca", "exercises", () => setPanel("library"))}
          {action("Exportar", "share", () => setPanel("export"))}
          {action("Salvar versão", "save", () => void editor.save(), true, editor.saving || !editor.dirty, !compact)}
          {action("Recolher cabeçalho", "chevronUp", () => { setTopPinned(false); setTopOpen(false); })}
        </View> : <Pressable accessibilityRole="button" accessibilityLabel="Mostrar cabeçalho" onPress={() => { setTopPinned(true); setTopOpen(true); }} style={styles.handle}><GoAtletaIcon name="chevronDown" size={18} color={ink} /></Pressable>}
      </View>

      <View onPointerEnter={restoreControls} style={[controlFade, styles.tools, { top: toolsTop + (toolsSpace - toolsHeight) / 2, left: insets.left + 10, maxHeight: toolsHeight, backgroundColor: mode === "dark" ? "rgba(9,28,48,0.72)" : "rgba(246,251,255,0.78)" }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 2, padding: 3 }}>
          {TOOLS.map(t => action(t.label, t.icon, () => { stop(); setTool(t.id); if (t.id === "ball" || t.id === "cone" || t.id === "animate") setPanel("tools"); else if (t.id === "player") setPanel("players"); }, tool === t.id, false, false, t.id === "ball" ? "ball" : undefined))}
          {action("Mais ferramentas", "dashboard", () => setPanel("tools"))}
          {action("Apagar seleção", "trash", remove, false, !selected.length)}
        </ScrollView>
      </View>
      <View onPointerEnter={restoreControls} style={[controlFade, styles.history, { left: insets.left + 12, top: insets.top + (topOpen ? 72 : 14), backgroundColor: surface }]}>
        {action("Desfazer", "restore", () => { stop(); editor.undo(); }, false, !editor.canUndo)}{action("Refazer", "arrowForward", () => { stop(); editor.redo(); }, false, !editor.canRedo)}
      </View>
      <View onPointerEnter={restoreControls} style={[controlFade, styles.propertyTrigger, { right: insets.right + 12, top: insets.top + 14, backgroundColor: surface }]}>{action("Configurações da quadra", "management", () => setPanel(panel === "settings" ? null : "settings"), panel === "settings")}</View>

      <View onPointerEnter={restoreControls} onPointerDown={() => setBottomPinned(true)} onPointerLeave={e => { if (e.nativeEvent.pointerType === "mouse" && !bottomPinned) setBottomOpen(false); }} style={[controlFade, styles.bottom, { bottom: insets.bottom, backgroundColor: surface, width: timelineVisible ? timelineWidth : undefined }]}>
        {timelineVisible ? <View onLayout={event => setTimelineHeight(event.nativeEvent.layout.height)} style={{ gap: 8, padding: 8 }}>
          <View style={styles.row}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.row}>
              {action("Etapa anterior", "skipBack", () => selectStep(stepIndex - 1), false, stepIndex <= 0)}
              <CourtActionButton label={playing ? "Pausar etapa" : progress >= 1 ? "Reproduzir novamente" : "Reproduzir etapa"} icon={playing ? "pause" : "play"} onPress={playCurrentStep} active={playing} />
              {action("Próxima etapa", "skipForward", () => selectStep(stepIndex + 1), false, stepIndex >= payload.timeline.steps.length - 1)}
              {[0.75, 1, 1.5, 2].map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={`Velocidade ${v}x`} onPress={() => setSpeed(v)} style={[styles.speed, { backgroundColor: speed === v ? colors.secondaryBg : "transparent" }]}><Text style={{ color: ink }}>{v}×</Text></Pressable>)}
              <CourtActionButton label="Voltar ao início da etapa" icon="restore" onPress={restartCurrentStep} />
              {action("Editar etapa", "pencil", openStepEditor)}
              <View style={{ width: 1, height: 24, marginHorizontal: 4, backgroundColor: colors.border }} />
              {action("Animar movimento", "compare", () => { stop(); setTool("animate"); setPanel("tools"); }, tool === "animate")}
              {action("Duplicar etapa", "copy", () => mutateStep(duplicateStep(payload, stepIndex)))}
              {action("Adicionar quadra vazia", "add", () => mutateStep(addBlankStep(payload, stepIndex)))}
            </ScrollView>
            {action("Recolher etapas", "chevronDown", () => { setBottomPinned(false); setBottomOpen(false); })}
          </View>
          <CourtTimelineScrubber progress={progress} durationMs={step.durationMs} onSeek={value => { setPlaying(false); playhead.current = value; setProgress(value); }} />
          <ScrollView ref={stepListRef} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scrollCurrentStep(false)} contentContainerStyle={{ gap: 8 }}>
            {payload.timeline.steps.map((s, i) => <DraggableStepFrame key={s.id} index={i} active={draggedStep === i} over={dragOverStep === i} onDragState={updateStepDrag} onMove={moveStepTo}><Pressable accessibilityRole="button" accessibilityLabel={`Etapa ${i + 1}: ${s.label}. Arraste para reordenar.`} accessibilityState={{ selected: i === stepIndex }} onPress={() => selectStep(i)} style={{ width: short ? 105 : 135, padding: 4, borderWidth: 2, borderRadius: 10, borderColor: i === stepIndex ? "#28d78b" : colors.border }}>
              <View style={{ height: short ? 40 : 60 }}><CourtEditorScene payload={payload} stepIndex={i} landscape progress={0} /></View><View style={styles.stepLabel}><GoAtletaIcon name="move" size={13} color={colors.muted} /><Text numberOfLines={1} style={{ color: ink, fontSize: 11, flex: 1 }}>{i + 1}. {s.label}</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir etapa ${i + 1}: ${s.label}`} disabled={payload.timeline.steps.length <= 1}
              onPress={() => { const result = removeStep(payload, i); result.stepIndex = i === stepIndex ? Math.min(i, result.payload.timeline.steps.length - 1) : stepIndex - (i < stepIndex ? 1 : 0); mutateStep(result); }}
              style={{ position: "absolute", right: 3, top: 3, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: surface, opacity: payload.timeline.steps.length <= 1 ? 0.35 : 1 }}>
              <GoAtletaIcon name="close" size={16} color={ink} />
            </Pressable></DraggableStepFrame>)}
            {action("Continuar do final", "arrowForward", () => mutateStep(continueStepFromEnd(payload, stepIndex)), false, false, true)}
            {action("Duplicar com animação", "copy", () => mutateStep(duplicateStep(payload, stepIndex)), false, false, true)}
            {action("Adicionar quadra vazia", "add", () => mutateStep(addBlankStep(payload, stepIndex)), false, false, true)}
          </ScrollView>
        </View> : <View style={[styles.handle, styles.collapsedHandle]}>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? "Pausar etapa" : progress >= 1 ? "Reproduzir novamente" : "Reproduzir etapa"} accessibilityState={{ selected: playing }} onPress={playCurrentStep}
            style={({ hovered, pressed }) => [styles.collapsedPlay, { backgroundColor: playing || hovered || pressed ? colors.secondaryBg : "transparent" }]}>
            <GoAtletaIcon name={playing ? "pause" : "play"} size={18} color="#28d78b" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Mostrar etapas" accessibilityState={{ expanded: false }} onPress={() => { setPanel(null); setBottomPinned(true); setBottomOpen(true); }}
            style={({ hovered, pressed }) => [styles.collapsedTimeline, { backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" }]}>
            <Text style={{ color: ink, fontWeight: "600", fontSize: 12 }}>Etapas</Text><GoAtletaIcon name="chevronUp" size={18} color={ink} />
          </Pressable>
        </View>}
      </View>
      <View onPointerEnter={restoreControls} style={[controlFade, styles.history, { right: insets.right + 10, bottom: historyBottom, backgroundColor: surface, maxWidth: !timelineVisible && width < 700 ? Math.max(44, width / 2 - 84 - insets.right) : width - 20, flexWrap: "wrap" }]}>


        {zoomHintVisible ? <View pointerEvents="none" style={{ position: "absolute", bottom: "100%", right: 8, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: surface }}><Text accessibilityLiveRegion="polite" accessibilityLabel={`Zoom ${Math.round(zoom * 100)} por cento`} style={{ color: ink, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{Math.round(zoom * 100)}%</Text></View> : null}
        {action("Reduzir", "remove", () => setZoom(z => Math.max(0.75, z - 0.25)), false, zoom <= 0.75)}
        {action("Ampliar", "add", () => setZoom(z => Math.min(3, z + 0.25)), false, zoom >= 3)}
        {action("Mover a vista", "move", () => { stop(); setTool(tool === "pan" ? "select" : "pan"); }, tool === "pan")}
        {action("Ajustar à tela", "expand", () => { setZoom(1); setPan({ x: 0, y: 0 }); })}
      </View>

      {width < 768 && selected.length > 0 && !panel ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir propriedades da seleção" onPress={() => setPanel("properties")} onHoverIn={() => { restoreControls(); setPanel("properties"); }} style={{ position: "absolute", right: insets.right, top: height / 2 - 24, width: 36, height: 48, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: surface, zIndex: 24 }}><GoAtletaIcon name="chevronBack" size={20} color={ink} /></Pressable> : null}
      {panel ? <View style={[styles.panel, { backgroundColor: surface, borderColor: colors.border, top: insets.top + 70, bottom: insets.bottom + (width < 700 ? 124 : 72), right: insets.right + 10, width: Math.min(310, width - 84) }]}>
        <View style={styles.row}><Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: ink }}>{panelTitle}</Text>{action("Fechar painel", "close", () => setPanel(null))}</View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          {tool === "animate" ? <View style={{ gap: 8 }}>
            {heading("Trajeto da animação")}
            <View style={styles.row}>
              {action("Livre", "pencil", () => setMotionMode("free"), motionMode === "free", false, true)}
              {action("Reto", "courtArrow", () => setMotionMode("straight"), motionMode === "straight", false, true)}
            </View>
          </View> : null}
          {panel === "properties" ? <>
            {actor ? <>
              {field("Rótulo do jogador", actor.label, label => changeActor({ label }))}
              {field("Número", String(actor.number ?? ""), value => changeActor({ number: Math.min(99, Math.max(0, Number(value) || 0)) }))}
              <View style={styles.wrap}>{ROLES.map(([role, label]) => action(label, "profile", () => {
                const appearance = {
                  setter: { label: "Lv", color: "#28d78b" },
                  outside: { label: "P", color: "#60a5fa" },
                  middle: { label: "C", color: "#8b5cf6" },
                  opposite: { label: "Op", color: "#19c87b" },
                  libero: { label: "Lb", color: "#c5fff0" },
                  athlete: { label: String(actor.number ?? "At"), color: payload.editor!.actorMeta[actor.id]?.team === "B" ? "#4389ff" : "#19c87b" },
                  coach: { label: "T", color: "#64748b" },
                };
                changeActor({ role, ...appearance[role] });
              }, actor.role === role, false, true))}</View>
              <View style={styles.row}>{["A", "B"].map(t => action(`Equipe ${t}`, "students", () => setActorMeta({ team: t as "A" | "B" }), payload.editor!.actorMeta[actor.id]?.team === t, false, true))}</View>
              <View style={styles.wrap}>{COLORS.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Cor ${c}`} onPress={() => changeActor({ color: c })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: 2, borderColor: actor.color === c ? ink : "transparent" }} />)}</View>
              {action("Bloquear jogador", "lock", () => setActorMeta({ locked: !payload.editor!.actorMeta[actor.id]?.locked }), !!payload.editor!.actorMeta[actor.id]?.locked, false, true)}
              {heading("Elenco da turma")}
              <CourtRosterPicker key={actor.id} roster={editor.roster} selectedId={payload.editor!.actorMeta[actor.id]?.studentId} onChange={studentId => setActorMeta({ studentId })} />
              {action("Enviar ao banco", "students", () => { edit(p => deleteSelection(p, stepIndex, [actor.id])); setSelected([]); }, false, false, true)}
              {action("Substituir jogador", "compare", () => { setSubstitute(true); setPanel("players"); }, substitute, false, true)}
            </> : object ? <>
              {object.kind === "text" ? field("Texto", object.text || "", text => changeObject({ text })) : null}
              <CourtSizeControl key={object.id} value={object.size} onChange={size => changeObject({ size })} />
              {action("Girar 45 graus", "repeat", () => changeObject({ rotation: (object.rotation + 45) % 360 }), false, false, true)}
              <View style={styles.wrap}>{COLORS.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Cor ${c}`} onPress={() => changeObject({ color: c })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c }} />)}</View>
              {action("Linha tracejada", "trend", () => changeObject({ dashed: !object.dashed }), !!object.dashed, false, true)}
              {action("Bloquear objeto", "lock", () => changeObject({ locked: !object.locked }), !!object.locked, false, true)}
            </> : <Text style={{ color: colors.muted }}>Selecione um jogador ou objeto na quadra.</Text>}
            {selected.length ? <View style={styles.wrap}>{action("Duplicar seleção", "copy", duplicate, false, false, true)}{action("Apagar seleção", "trash", remove, false, false, true)}</View> : null}
            {selected.length > 1 ? <View style={styles.wrap}>{action("Alinhar na horizontal", "remove", () => edit(p => alignSelection(p, stepIndex, selected, landscape ? "x" : "y")), false, false, true)}{action("Alinhar na vertical", "move", () => edit(p => alignSelection(p, stepIndex, selected, landscape ? "y" : "x")), false, false, true)}</View> : null}
          </> : null}
          {panel === "tools" ? <>
            {heading("Materiais de treino")}
            {toolGrid([["ball", "Bola", "courtBall"], ["cone", "Cone", "courtCone"], ["target", "Alvo", "courtTarget"], ["ladder", "Escada", "courtLadder"]])}
            {heading("Desenho e anotações")}
            {toolGrid([["arrow", "Seta reta", "courtArrow"], ["curve", "Seta curva", "courtCurve"], ["pen", "Traço livre", "pencil"], ["area", "Área", "courtArea"], ["text", "Texto", "courtText"]])}
            {["ball", "cone", "target", "ladder", "arrow", "curve", "pen", "area", "text"].includes(tool) ? <>
              {heading("Estilo da ferramenta")}
              <View style={styles.wrap}>{COLORS.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Usar cor ${c}`} onPress={() => setColor(c)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: 2, borderColor: color === c ? ink : "transparent" }} />)}</View>
              {["arrow", "curve", "pen", "area"].includes(tool) ? toggle("Traço pontilhado", dashed, setDashed) : null}
            </> : null}
          </> : null}
          {panel === "settings" ? <>
            {heading("Exibição da quadra")}
            {toggle("Meia quadra", half, setHalf)}
            {toggle("Lousa livre", plain, setPlain)}
            {heading("Orientação")}
            <View style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: colors.inputBg }}>{([["auto", "Auto"], ["landscape", "Horizontal"], ["portrait", "Vertical"]] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Orientação ${label}`} accessibilityState={{ selected: orientation === id }} onPress={() => setOrientation(id)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: orientation === id ? colors.primaryBg : "transparent" }}><Text style={{ color: orientation === id ? colors.primaryText : colors.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
            {heading("Auxílios de edição")}
            {toggle("Grade e encaixe", grid, setGrid)}
            {toggle("Seleção múltipla", multi, setMulti)}
            {heading("Camadas visíveis")}
            {[["actors", "Jogadores"], ["drawings", "Desenhos e materiais"], ["movements", "Movimentos"], ["court", "Linhas da quadra"]].map(([id, label]) => toggle(label, !payload.editor!.hiddenLayers.includes(id), visible => metadata({ hiddenLayers: visible ? payload.editor!.hiddenLayers.filter(k => k !== id) : [...payload.editor!.hiddenLayers, id] })))}

          </> : null}
          {panel === "step" ? <>
            {heading("Detalhes da etapa")}
            {field("Nome da etapa", step.label, label => edit(p => changeStep(p, stepIndex, s => ({ ...s, label }))))}
            {field("Duração em segundos", String(step.durationMs / 1000), value => edit(p => changeStep(p, stepIndex, s => ({ ...s, durationMs: Math.max(450, Math.min(30000, (Number(value) || 1) * 1000)) }))))}
            {field("Notas da etapa", step.note || "", note => edit(p => changeStep(p, stepIndex, s => ({ ...s, note }))), true)}
            {heading("Ordem na sequência")}
            <View style={styles.row}><Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Posição {stepIndex + 1} de {payload.timeline.steps.length}</Text>{action("Mover etapa antes", "chevronBack", () => mutateStep(reorderStep(payload, stepIndex, -1)), false, stepIndex === 0)}{action("Mover etapa depois", "chevronForward", () => mutateStep(reorderStep(payload, stepIndex, 1)), false, stepIndex === payload.timeline.steps.length - 1)}</View>
            {action("Continuar a partir do final", "arrowForward", () => mutateStep(continueStepFromEnd(payload, stepIndex)), false, false, true)}
            {action("Duplicar com a mesma animação", "copy", () => mutateStep(duplicateStep(payload, stepIndex)), false, false, true)}
            {action("Adicionar quadra vazia", "add", () => mutateStep(addBlankStep(payload, stepIndex)), false, false, true)}
            {heading("Animação")}

            {action("Limpar animação desta etapa", "restore", () => edit(p => resetStepAnimation(p, stepIndex)), false, false, true)}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }}>{action("Excluir etapa", "trash", () => mutateStep(removeStep(payload, stepIndex)), false, payload.timeline.steps.length === 1, true)}</View>

          </> : null}
          {panel === "players" ? <>
            {heading("Equipes")}
            <Text style={{ color: colors.muted, fontSize: 12 }}>Selecione uma equipe para ver seus jogadores.</Text>
            <View style={styles.wrap}>{["A", "B"].map(t => <CourtActionButton key={t} label={`Equipe ${t}`} icon="students" tile active={team === t} onPress={() => { setTeam(t as "A" | "B"); }} />)}</View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{landscape ? "Lado A: esquerda · Lado B: direita" : "Lado A: abaixo da rede · Lado B: acima da rede"}</Text>
            {action(`Adicionar à equipe ${team}`, "addStudent", () => { stop(); setTool("player"); editor.setNotice(`Clique ou toque na quadra para posicionar um jogador da equipe ${team}.`); }, tool === "player", false, true)}
            {tool === "player" ? <>
              <Text accessibilityLiveRegion="polite" style={{ color: ink, fontSize: 12 }}>Clique ou toque na quadra para posicionar o jogador da equipe {team}.</Text>
              {action("Cancelar adição", "close", () => setTool("select"), false, false, true)}
            </> : null}
            {heading(`Em quadra · ${teamRoster.filter(item => item.inCourt).length}`)}
            {teamRoster.filter(item => item.inCourt).map(item => <Pressable key={item.actor.id} accessibilityRole="button" accessibilityLabel={`Selecionar ${item.actor.label}`} onPress={() => { stop(); setTool("select"); select([item.actor.id]); }} style={{ padding: 12, borderRadius: 10, backgroundColor: selected.includes(item.actor.id) ? colors.secondaryBg : "transparent", gap: 4 }}>
              <Text style={{ color: ink, fontSize: 13, fontWeight: "600" }}>{item.actor.label}{item.studentId ? ` · ${editor.roster.find(student => student.id === item.studentId)?.name ?? "Atleta vinculado"}` : ""}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{ROLES.find(([role]) => role === item.actor.role)?.[1] ?? "Jogador"} · {item.side === "Rede" ? "Na rede" : `Lado ${item.side}`}{item.outside ? " · Zona externa" : ""}</Text>
            </Pressable>)}
            {!teamRoster.some(item => item.inCourt) ? <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum jogador desta equipe em quadra.</Text> : null}
            {heading("Banco nesta etapa")}
            {teamRoster.filter(item => !item.inCourt).map(({ actor: a }) => action(`${substitute && actor ? "Trocar por" : "Colocar"} ${a.label}`, "addStudent", () => {
              edit(p => changeStep(p, stepIndex, s => ({ ...s, visibleActorIds: [...(s.visibleActorIds ?? p.actors.map(a => a.id)).filter(id => !(substitute && actor && id === actor.id)), a.id], actorPositions: { ...s.actorPositions, [a.id]: substitute && actor ? actorPoint(p, stepIndex, actor.id) : a.initialPosition } }))); setSubstitute(false); setSelected([a.id]);
            }, false, false, true))}

            {!teamRoster.some(item => !item.inCourt) ? <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum jogador desta equipe no banco.</Text> : null}
          </> : null}
          {panel === "library" ? <>
            <View style={styles.wrap}>
              {([['plays', 'Jogadas'], ['systems', 'Sistemas'], ['details', 'Dados'], ['trash', 'Lixeira']] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: libraryTab === id }} onPress={() => { setLibraryTab(id); setQuery(""); }} style={{ minHeight: 44, flexGrow: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 8, backgroundColor: libraryTab === id ? colors.primaryBg : colors.inputBg }}><Text style={{ color: libraryTab === id ? colors.primaryText : ink, fontSize: 12, fontWeight: "600" }}>{label}</Text></Pressable>)}
            </View>
            {libraryTab === "details" ? <>
            {field("Título da jogada", effectiveTitle, title => metadata({ title }))}
            {field("Pasta", payload.editor!.folder, folder => metadata({ folder }))}
            {field("Tags", payload.editor!.tags, tags => metadata({ tags }))}
            {action("Favoritar jogada", "star", () => metadata({ favorite: !payload.editor!.favorite }), payload.editor!.favorite, false, true)}

            {lessonDate ? <>{heading(`Aula · ${lessonDate.split("-").reverse().join("/")}`)}
              <Text style={{ color: colors.muted, fontSize: 12 }}>Vincule esta versão a um bloco. O plano aplicado permanece preservado.</Text>
              {["Aquecimento", "Parte principal", "Volta à calma"].map(block => action(block, "link", () => metadata({ lessonLink: { date: lessonDate, block, revision: planId || editorId() } }), payload.editor!.lessonLink?.date === lessonDate && payload.editor!.lessonLink?.block === block, false, true))}

            </> : null}
            {payload.editor!.lessonLink ? <><Text style={{ color: colors.muted, fontSize: 12 }}>{payload.editor!.lessonLink.date} · {payload.editor!.lessonLink.block}</Text>{action("Remover vínculo da aula", "close", () => metadata({ lessonLink: undefined }), false, false, true)}</> : null}
            </> : <>
              {libraryTab !== "trash" ? <View style={styles.wrap}>
                {action(libraryTab === "systems" ? "Novo sistema" : "Nova jogada", "add", () => { const board = newCourtBoard(libraryTab === "systems" ? "Novo sistema" : "Nova jogada"); if (libraryTab === "systems") board.editor!.tags = "sistema"; void openPayload(board); }, false, false, true)}
                {action("Importar arquivo", "documentAttach", () => void importFile(), false, false, true)}
              </View> : <Text style={{ color: colors.muted, fontSize: 12 }}>Lixeira deste dispositivo. Versões da turma e vínculos com aulas são preservados.</Text>}
              {field("Buscar na biblioteca", query, setQuery)}
              {libraryTab !== "trash" ? <>
                {toggle("Somente favoritos", onlyFavorites, setOnlyFavorites)}
                {lessonDate ? toggle("Somente esta aula", onlyLesson, setOnlyLesson) : null}
              </> : null}
              {(() => {
                const items = editor.documents.filter(d => {
                  const deleted = editor.trashedIds.includes(d.id);
                  const system = d.sourceKind === "rotation" || /(^|[\s,;])sistema([\s,;]|$)/i.test(d.payload.editor?.tags || "");
                  return (libraryTab === "trash" ? deleted : !deleted && (libraryTab === "systems" ? system : !system))
                    && (libraryTab === "trash" || ((!onlyLesson || d.payload.editor?.lessonLink?.date === lessonDate) && (!onlyFavorites || d.payload.editor?.favorite)))
                    && `${d.title} ${d.payload.editor?.folder || ''} ${d.payload.editor?.tags || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
                });
                return items.length ? items.map(d => <View key={d.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, gap: 4 }}>
                  <View style={styles.row}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${d.title}`} onPress={() => void openPayload(d.payload, d.id)} style={{ flex: 1, gap: 5, minHeight: 48, justifyContent: "center" }}>
                      <Text style={{ color: ink, fontWeight: "600" }}>{d.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{d.id.startsWith('template_') ? 'Modelo' : d.id.startsWith('local_') ? 'Neste dispositivo' : 'Versão da turma'} · {d.payload.timeline.steps.length} etapas</Text>
                    </Pressable>
                    {action(`${libraryTab === "trash" ? "Restaurar" : "Mover para lixeira"} ${d.title}`, libraryTab === "trash" ? "restore" : "trash", () => void editor.setDocumentTrashed(d.id, libraryTab !== "trash"))}
                  </View>
                  {Platform.OS === "web" && !d.id.startsWith("local_") && !d.id.startsWith("template_") && libraryTab !== "trash" ? action("Copiar link interno", "link", () => { void Clipboard.setStringAsync(`${window.location.origin}/class/${encodeURIComponent(classId)}/visual-tech?visual=${encodeURIComponent(d.id)}`).then(() => editor.setNotice("Link copiado. O acesso continua restrito à organização.")); }, false, false, true) : null}
                </View>) : <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: 16 }}>{query || onlyFavorites || onlyLesson ? "Nenhum resultado com estes filtros." : libraryTab === "trash" ? "A lixeira está vazia." : "Nenhum item nesta aba."}</Text>;
              })()}
            </>}
          </> : null}
          {panel === "export" ? <>
            <Text style={{ color: colors.muted, fontSize: 13 }}>A exportação inclui os rótulos e as notas visíveis da jogada.</Text>
            {Platform.OS === "web" ? <Text style={{ color: colors.muted, fontSize: 12 }}>O GIF reproduz a etapa atual em loop e respeita sua duração.</Text> : null}
            {Platform.OS === "web" ? <Text style={{ color: colors.muted, fontSize: 12 }}>O PDF usa meia quadra vertical e compara a posição de saque com a posição final.</Text> : null}
            {Platform.OS === "web" ? <>{action("GIF animado da etapa", "play", () => void runExport("gif"), false, busy, true)}{action("Imagem PNG da etapa", "gallery", () => void runExport("png"), false, busy, true)}{action("PDF da sequência", "document", () => void runExport("pdf"), false, busy, true)}</> : null}
            {action("Cópia editável JSON", "download", () => void runExport("json"), false, busy, true)}
            {busy ? <ActivityIndicator color={ink} /> : null}
          </> : null}
        </ScrollView>
      </View> : null}
      {exitOpen ? <View style={styles.exitOverlay}><View style={{ backgroundColor: surface, padding: 22, borderRadius: 16, gap: 12, maxWidth: 340 }}><Text style={{ color: ink, fontWeight: "700", fontSize: 17 }}>Sair da quadra?</Text><Text style={{ color: colors.muted }}>Há alterações ainda não salvas na turma. O rascunho fica neste dispositivo.</Text>{action("Continuar editando", "pencil", () => setExitOpen(false), false, false, true)}{action("Salvar e sair", "save", () => { void editor.save().then(saved => { if (saved) onBack(); }); }, true, editor.saving, true)}{action("Sair com rascunho local", "chevronBack", () => { void editor.preserveDraft().then(saved => { if (saved) onBack(); else setExitOpen(false); }); }, false, false, true)}</View></View> : null}
    </>}
  </View>;
  return Platform.OS === "web" && typeof document !== "undefined" ? createWebPortal(root, document.body) : root;
}
const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 6000, backgroundColor: "#1676ac" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  top: { position: "absolute", alignSelf: "center", maxWidth: "100%", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, zIndex: 20 },
  topContent: { flexDirection: "row", alignItems: "center", padding: 8, gap: 4, width: "100%" },
  handle: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 18 },
  collapsedHandle: { gap: 2, paddingHorizontal: 4 },
  collapsedPlay: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  collapsedTimeline: { minHeight: 44, paddingHorizontal: 8, borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: 9, gap: 6, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1 },
  tools: { position: "absolute", borderRadius: 16, width: 52, zIndex: 24 },
  propertyTrigger: { position: "absolute", width: 44, height: 44, borderRadius: 22, overflow: "hidden", zIndex: 21 },
  bottom: { position: "absolute", alignSelf: "center", maxWidth: "100%", borderTopLeftRadius: 18, borderTopRightRadius: 18, zIndex: 22 },
  history: { position: "absolute", flexDirection: "row", gap: 2, borderRadius: 25, zIndex: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  panel: { position: "absolute", zIndex: 30, padding: 12, gap: 10, borderRadius: 16, borderWidth: 1 },
  speed: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  stepCard: { position: "relative", borderWidth: 1, borderColor: "transparent", borderRadius: 12 },
  stepLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  exitOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 80 },
});
