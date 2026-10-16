import { CourtLibraryBrowser } from "./CourtLibraryBrowser";
import { CourtEditableTitle } from "./CourtEditableTitle";
import { CourtWorkspacePanel, type CourtWorkspaceTab } from "./CourtWorkspacePanel";
import { mobileCourtOverlayLayout } from "./court-overlay-layout";
import { CourtStepGallery } from "./CourtStepGallery";
import { courtRoster } from "../../core/court-roster";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { useSaveToast } from "../../ui/save-toast";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { useDisclosureMotion } from "../../ui/useDisclosureMotion";
import { createWebPortal } from "../../ui/web-portal";
import { addBlankStep, alignSelection, resetStepAnimation, actorPoint, changeDrawings, changeStep, continueStepFromEnd, copyStepSelection, deleteSelection, duplicateSelection, duplicateStep, editorId, frameDrawings, moveSelection, newCourtBoard, parseEditorImport, pasteStepSelection, removeStep, reorderStep, reorderStepToIndex, type CourtDrawing, type CourtSelectionClipboard, type EditorSnapshot } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualActorRole, CourtVisualPayload } from "../../core/visual-court";
import type { CourtEditorCanvasProps, CourtTool } from "./CourtEditorCanvas";
import { VisualCourtCanvas } from "./VisualCourtCanvas";
import { useCourtEditor } from "./useCourtEditor";
import { CourtPerspectiveCanvas } from "./CourtPerspectiveCanvas";
import type { CourtPerspectiveShortcut } from "./CourtPerspectiveCanvas.types";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../../core/visual-court-perspective";
import { configureCourtSimulation, resetCourtSimulation, sampleCourtSimulation, updateCourtSimulationHandle } from "../../core/court-simulation";
import { configureCourtRotationSequenceMode, getReceptionRotationStep, isLegacyReceptionRotationSequence, replaceReceptionRotationSequence } from "../../core/court-simulation-sequence";
import type { CourtSimulationPatch } from "../../core/court-simulation-model";
import { CourtSimulationModes, CourtSimulationSettings, CourtSimulationTransport } from "./CourtSimulationControls";
import { buildCourtLibraryItems, filterCourtLibraryItems, type CourtLibraryFilter, type CourtLibraryLocation } from "./court-library";
import { CourtActionButton, CourtSwitchRow, CourtSizeControl, CourtRosterPicker, CourtToolIcon, type CourtActionIcon } from "./CourtEditorControls";
import { exportCourt } from "./court-export";

const TOOLS: { id: CourtTool; label: string; icon: CourtActionIcon }[] = [
  { id: "select", label: "Selecionar e mover", icon: "navigate" },
  { id: "player", label: "Adicionar jogador", icon: "profile" },
  { id: "ball", label: "Adicionar bola", icon: "courtBall" },
  { id: "cone", label: "Adicionar cone", icon: "courtCone" },
  { id: "arrow", label: "Desenhar seta", icon: "courtArrow" },
  { id: "pen", label: "Desenho livre", icon: "pencil" },
  { id: "text", label: "Adicionar texto", icon: "courtText" },
  { id: "animate", label: "Animar movimento", icon: "courtMotion" },
];
const COLORS = ["#19c87b", "#4389ff", "#c5fff0", "#b19cff", "#ff6c71", "#ffdc53", "#ffffff", "#172437"];
const ROLES: [CourtVisualActorRole, string][] = [["setter", "Levantador"], ["outside", "Ponteiro"], ["middle", "Central"], ["opposite", "Oposto"], ["libero", "Líbero"], ["athlete", "Atleta"]];

function CourtMenuContents({ id, children }: { id: string; children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.querySelector<HTMLElement>('button:not([disabled]), [role="button"]:not([aria-disabled="true"])')?.focus();
    });
    const node = document.getElementById(id);
    const keydown = (event: KeyboardEvent) => {
      if (!["Tab", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(node?.querySelectorAll<HTMLElement>('button:not([disabled]), [role="button"]:not([aria-disabled="true"])') ?? []);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1) + items.length) % items.length;
      items[next].focus();
    };
    node?.addEventListener("keydown", keydown);
    return () => { cancelAnimationFrame(frame); node?.removeEventListener("keydown", keydown); };
  }, [id]);
  return <View nativeID={id} style={{ gap: 4 }}>{children}</View>;
}

function closeCourtMenu(id: string, trigger: View | null, close: () => void) {
  if (Platform.OS === "web" && document.getElementById(id)?.contains(document.activeElement)) {
    (trigger as unknown as HTMLElement | null)?.querySelector<HTMLElement>('button, [role="button"]')?.focus();
  }
  close();
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
  // Match the approved 1329 x 880 composition in compact desktop panes.
  // Only controls scale; the court keeps native resolution and edit coordinates.
  const uiScale = Platform.OS === "web" && width > 700
    ? Math.max(0.8, Math.min(1, width / 1329, height / 880)) : 1;
  const overlayScale = (transformOrigin: ViewStyle["transformOrigin"]): Pick<ViewStyle, "transform" | "transformOrigin"> | undefined =>
    Platform.OS === "web" ? { transform: [{ scale: uiScale }], transformOrigin } : undefined;
  const [courtView, setCourtView] = useState<"2d" | "3d">("2d");
  const [perspectiveMounted, setPerspectiveMounted] = useState(false);
  const [cameraView, setCameraView] = useState<"front" | "side" | "orbit">("front");
  const [cameraReset, setCameraReset] = useState(0);
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<CourtWorkspaceTab>("adjustments");
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("court3d")) {
      url.searchParams.delete("court3d");
      window.history.replaceState(window.history.state, "", url.href);
    }
  }, []);
  const [panel, setPanel] = useState<"properties" | "export" | "tools" | "settings" | "step" | "players" | null>(null);
  const [motionMode, setMotionMode] = useState<"free" | "straight">("free");
  const [animationToolsOpen, setAnimationToolsOpen] = useState(false);
  const [animationToolY, setAnimationToolY] = useState(0);
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
  const [query, setQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<CourtLibraryFilter>("all");
  const [libraryDetails, setLibraryDetails] = useState(false);
  const [libraryNewOpen, setLibraryNewOpen] = useState(false);
  const [libraryMenuId, setLibraryMenuId] = useState<string | null>(null);
  const [libraryMenuLayout, setLibraryMenuLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const libraryMenuTriggerRef = useRef<View | null>(null);
  const libraryMenuTriggers = useRef(new Map<string, View>());
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyLesson, setOnlyLesson] = useState(false);
  const [actionMenu, setActionMenu] = useState<"document" | "step" | "selection" | "color" | null>(null);
  const [actionMenuLayout, setActionMenuLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const actionMenuTrigger = useRef<View | null>(null);
  const documentMenuRef = useRef<View>(null);
  const stepMenuRef = useRef<View>(null);
  const selectionMenuRef = useRef<View>(null);
  const colorMenuRef = useRef<View>(null);
  const toggleActionMenu = (kind: "document" | "step" | "selection" | "color") => {
    if (actionMenu === kind) { setActionMenu(null); return; }
    const trigger = (kind === "document" ? documentMenuRef : kind === "step" ? stepMenuRef : kind === "color" ? colorMenuRef : selectionMenuRef).current;
    trigger?.measureInWindow((x, y, w, h) => {
      actionMenuTrigger.current = trigger;
      const menuWidth = (kind === "color" ? (width < 700 ? 144 : 120) : 220) * uiScale;
      const left = kind === "color" ? (x + w + menuWidth + 32 * uiScale <= width ? x + w + 30 * uiScale : x - menuWidth - 6 * uiScale) : x + w - menuWidth;
      setActionMenuLayout({ x: Math.max(8, Math.min(width - menuWidth - 8, left)), y: kind === "color" && width < 700 ? y - h - 60 : y, width: menuWidth, height: h });
      setActionMenu(kind);
    });
  };
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [multi, setMulti] = useState(false);
  const [team, setTeam] = useState<"A" | "B">("A");
  const [substitute, setSubstitute] = useState(false);
  const landscape = orientation === "auto" ? width > height : orientation === "landscape";
  const compact = width <= 700;
  const compactWeb = Platform.OS === "web" && compact;
  const denseControls = Platform.OS === "web" || !compact;
  const mobileOverlays = mobileCourtOverlayLayout(width, insets.bottom);
  const panelMotion = useDisclosureMotion(Boolean(panel));
  const desktopPanels = Platform.OS === "web" && !compact;
  const sidePanelTop = insets.top + 144 * uiScale;
  const sidePanelBottom = insets.bottom + 88 * uiScale;
  const sidePanelLayout = desktopPanels ? {
    top: sidePanelTop, right: insets.right + 20 * uiScale, width: 360,
    height: Math.max(160, Math.min(600, (height - sidePanelTop - sidePanelBottom) / uiScale)),
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24,
    transformOrigin: "top right" as const,
    transform: [...panelMotion.style.transform, { scale: uiScale }],
  } : {
    top: insets.top + (compactWeb ? 124 : 70), bottom: compactWeb ? mobileOverlays.panelBottom : insets.bottom + (compact ? 124 : 72),
    right: insets.right + 10, width: Math.min(310, width - 84),
  };
  const historyBottom = compactWeb ? mobileOverlays.zoomBottom : insets.bottom + (compact ? 124 : width < 1000 ? 84 : 20) * uiScale;
  const toolsTop = insets.top + (compactWeb ? 122 : 136) * uiScale;
  const toolsSpace = Math.max(44, (height - toolsTop - insets.bottom) / uiScale - 70);
  const toolsHeight = Math.min(compactWeb ? 328 : 520, toolsSpace);
  const surface = mode === "dark" ? "rgba(10,25,43,0.94)" : "rgba(247,251,255,0.96)";
  const ink = colors.text;
  const step = payload.timeline.steps[stepIndex];
  const simulation = step.simulation;
  const rotationSequence = useMemo(() => Boolean(simulation) && getReceptionRotationStep(payload, stepIndex, simulation!.rotation) >= 0, [payload, stepIndex, simulation]);
  const attackArcValue = useMemo(() => sampleCourtSimulation(payload, stepIndex, 0)?.attackArc, [payload, stepIndex]);
  const simulationMode = simulation?.mode ?? (step.phase === "attack_shape" ? "attack" : "receive");
  const payloadRef = useRef(payload);
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  const actor = payload.actors.find(a => a.id === selected[0]);
  const object = frameDrawings(payload, stepIndex).find(d => d.id === selected[0]);
  const selectionCanRotate = Boolean(object && ["ladder", "cone", "target", "text"].includes(object.kind));
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
  const resetPlayback = useCallback(() => { setPlaying(false); playhead.current = 0; setProgress(0); }, []);
  const edit = (update: (p: CourtVisualPayload) => CourtVisualPayload, index?: number) => { stop(); commit(update, index); };
  const selectStep = (i: number) => { resetPlayback(); setSelected([]); editor.selectStep(i); };
  const configureSimulation = (patch: CourtSimulationPatch) => {
    if (patch.rotation !== undefined && Object.keys(patch).length === 1) {
      const target = getReceptionRotationStep(payload, stepIndex, patch.rotation);
      if (target >= 0) { selectStep(target); return; }
    }
    resetPlayback(); setSelected([]);
    if (patch.mode && Object.keys(patch).length === 1) {
      commit(p => configureCourtRotationSequenceMode(p, stepIndex, patch.mode!));
      return;
    }
    if (patch.system && simulationMode === "receive" && getReceptionRotationStep(payload, stepIndex, simulation?.rotation ?? 0) >= 0) {
      commit(p => p.timeline.steps.reduce((next, current, index) => current.simulation?.mode === "receive"
        ? configureCourtSimulation(next, index, { system: patch.system }) : next, p));
      return;
    }
    commit(p => configureCourtSimulation(p, stepIndex, { mode: simulationMode, ...patch }));
  };
  const metadata = (changes: Partial<NonNullable<CourtVisualPayload["editor"]>>) => edit(p => ({ ...p, editor: { ...p.editor!, ...changes } }));
  const simulationDisplayLayer = simulationMode === "attack" ? "movements" : "labels";
  const showSimulationGuides = !payload.editor?.hiddenLayers.includes(simulationDisplayLayer);
  const setSimulationGuides = (value: boolean) => metadata({ hiddenLayers: value ? payload.editor!.hiddenLayers.filter(layer => layer !== simulationDisplayLayer) : [...new Set([...payload.editor!.hiddenLayers, simulationDisplayLayer])] });
  const mutateStep = (result: EditorSnapshot) => { resetPlayback(); setSelected([]); commit(() => result.payload, result.stepIndex); };
  const select = (ids: string[]) => { setAnimationToolsOpen(false); if (panel === "properties") setPanel(null); setSelected(ids); };
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
  const move = (ids: string[], delta: CourtPoint, path?: CourtPoint[], duplicateDrag = false) => { if (duplicateDrag) { const result = duplicateSelection(payload, stepIndex, ids, delta); edit(() => result.payload); setSelected(result.selected); return; } edit(p => moveSelection(p, stepIndex, ids, delta, tool === "animate", path, progress)); if (tool === "animate") setProgress(1); };
  const draw = (d: CourtDrawing) => { edit(p => changeDrawings(p, stepIndex, [...frameDrawings(p, stepIndex), d])); setSelected([d.id]); if (["text", "ball", "cone", "target", "ladder"].includes(d.kind)) setTool("select"); };
  const editText = (id: string, value: string) => edit(p => changeDrawings(p, stepIndex, frameDrawings(p, stepIndex).map(d => d.id === id ? { ...d, text: value } : d)));
  const addPlayer = (point: CourtPoint) => {
    const id = editorId();
    const a = { id, role: "athlete" as const, representation: "person" as const, label: "", color: team === "A" ? "#19c87b" : "#4389ff", initialPosition: point };
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
      if (e.key === "Escape") {
        keyboard.current.stop();
        if (actionMenu) setActionMenu(null);
        else if (libraryMenuId) setLibraryMenuId(null);
        else if (animationToolsOpen) setAnimationToolsOpen(false);
        else if (newBoardOpen) setNewBoardOpen(false);
        else if (exitOpen) setExitOpen(false);
        else if (panel) setPanel(null);
        else if (workspacePanelOpen) setWorkspacePanelOpen(false);
        else if (tool !== "select") setTool("select");
        else setSelected([]);
        return;
      }
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
  }, [actionMenu, libraryMenuId, animationToolsOpen, newBoardOpen, exitOpen, panel, tool, workspacePanelOpen]);
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
    setPanel("step");
  };
  const moveStepTo = useCallback((from: number, to: number) => {
    if (from === to) return;
    const result = reorderStepToIndex(payloadRef.current, from, to);
    resetPlayback();
    setSelected([]);
    commit(() => result.payload, result.stepIndex);
  }, [commit, resetPlayback]);
  const action = (label: string, icon: CourtActionIcon, fn: () => void, active = false, disabled = false, text = false, dragKind?: string) => <CourtActionButton tooltipScale={uiScale} compact={denseControls} key={label} label={label} icon={icon} onPress={fn} active={active} disabled={disabled} text={text} dragKind={dragKind} danger={label === "Excluir etapa"} />;
  const openAnimationTools = () => { stop(); setSelected([]); setPanel(null); setTool("animate"); setAnimationToolsOpen(open => !open); };
  useEffect(() => {
    if (tool === "animate" && !panel && !playing) return;
    let alive = true;
    Promise.resolve().then(() => { if (alive) setAnimationToolsOpen(false); });
    return () => { alive = false; };
  }, [tool, panel, playing]);
  const toggle = (label: string, value: boolean, onChange: (value: boolean) => void) => <CourtSwitchRow key={label} label={label} value={value} onChange={onChange} />;
  const toolGrid = (items: [CourtTool, string, CourtActionIcon][]) => <View style={styles.wrap}>{items.map(([id, label, icon]) => <CourtActionButton tooltipScale={uiScale} key={id} label={label} icon={icon} tile onAdd={() => {
      stop();
      if (["ball", "cone", "target", "ladder"].includes(id)) { setSelected([]); if (id === "cone") setColor("#f97316"); setTool(id); setPanel(null); return; }
      if (id === "text") { setSelected([]); setTool("text"); setPanel(null); return; }
      const kind = id as CourtDrawing["kind"];
      const point = { x: 0.5, y: 0.7 };
      const points = kind === "curve" ? [point, { x: 0.35, y: 0.6 }, { x: 0.55, y: 0.52 }] : ["arrow", "pen", "area"].includes(kind) ? [point, { x: 0.65, y: 0.55 }] : [point];
      draw({ id: editorId(), kind, points, color, dashed, size: 32, rotation: 0, ...(kind === "text" ? { text: "Anotação" } : {}) });
      setTool("select");
      setPanel(null);
    }} dragKind={["ball", "cone", "target", "ladder"].includes(id) ? id : undefined} active={tool === id} onPress={() => { stop(); setSelected([]); if (id === "cone") setColor("#f97316"); setTool(id); if (["ball", "cone", "target", "ladder"].includes(id)) setPanel(null); }} />)}</View>;
  const field = (label: string, value: string, onChange: (value: string) => void, multiline = false) => <View style={{ gap: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><View style={{ backgroundColor: colors.inputBg, borderRadius: 12, minHeight: 50, paddingHorizontal: 14 }}><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} style={{ color: ink, minHeight: multiline ? 70 : 50, borderRadius: 0, fontSize: 14, ...(Platform.OS === "web" ? { cursor: "text" } as object : {}) }} /></View></View>;
  const heading = (label: string) => <Text style={{ color: ink, fontWeight: "700", fontSize: 15, marginTop: 10 }}>{label}</Text>;
  const openBlankBoard = async () => { const board = newCourtBoard(boardName.trim() || "Nova quadra"); board.actors = []; board.editor!.actorMeta = {}; board.timeline.steps[0].actorPositions = {}; await openPayload(board); setNewBoardOpen(false); };
  const openPayload = async (p: CourtVisualPayload, documentId?: string | null, keepLibraryOpen = false) => { try { stop(); if (!await editor.open(p, documentId)) return; setSelected([]); setLibraryMenuId(null); if (!keepLibraryOpen) setPanel(null); } catch { editor.setError("Não foi possível guardar o rascunho. Exporte antes de trocar."); } };
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
  const panelTitle = panel === "export" ? "Exportar" : panel === "tools" ? "Ferramentas" : panel === "settings" ? "Configurações da quadra" : panel === "step" ? `Etapa ${stepIndex + 1}` : panel === "players" ? "Jogadores e banco" : selected.length > 1 ? `${selected.length} itens selecionados` : actor ? "Jogador" : object ? "Objeto" : "Propriedades";
  const libraryItems = useMemo(() => workspacePanelOpen ? buildCourtLibraryItems(editor.documents, editor.trashedIds, { payload, documentId: editor.activeDocumentId, dirty: editor.dirty }) : [], [workspacePanelOpen, editor.documents, editor.trashedIds, payload, editor.activeDocumentId, editor.dirty]);
  const visibleLibraryItems = useMemo(() => filterCourtLibraryItems(libraryItems, { filter: libraryFilter, query, favorites: onlyFavorites, lessonDate, onlyLesson }), [libraryItems, libraryFilter, query, onlyFavorites, lessonDate, onlyLesson]);
  const libraryGroups: CourtLibraryLocation[] = libraryFilter === "all" ? ["local", "team", "template"] : [libraryFilter];
  const libraryMenuItem = visibleLibraryItems.find(item => item.id === libraryMenuId);
  const toggleLibraryMenu = (id: string) => {
    if (libraryMenuId === id) { setLibraryMenuId(null); return; }
    const trigger = libraryMenuTriggers.current.get(id);
    trigger?.measureInWindow((x, y, width, height) => {
      libraryMenuTriggerRef.current = trigger;
      setLibraryMenuLayout({ x: x + width - 188 * uiScale, y, width: 188 * uiScale, height });
      setLibraryMenuId(id);
    });
  };


  const narrowHeader = width < (compactWeb ? 360 : 440);
  const headerWidth = Math.min(compactWeb ? 332 : 354, Math.max(0, width - 24 - insets.left - insets.right));
  const changingCourt = busy || editor.saving || editor.opening;
  const changeCourtView = (next: "2d" | "3d") => {
    if (changingCourt) return;
    if (next === "3d") setPerspectiveMounted(true);
    setCourtView(next);
  };
  const perspectiveShortcut = (key: CourtPerspectiveShortcut, shift = false) => {
    if (changingCourt && key !== "escape") return;
    if (key === "play") { playCurrentStep(); return; }
    if (key === "escape") { stop(); setPanel(null); setWorkspacePanelOpen(false); setSelected([]); setTool("select"); return; }
    if (playing || changingCourt) return;
    const frame = buildCourtPerspectiveFrame(payload, stepIndex, progress, selected);
    const visible = new Set([...frame.actors, ...frame.drawings].map(item => item.id));
    const ids = selected.filter(id => visible.has(id));
    if (key === "undo") { stop(); editor.undo(); }
    else if (key === "redo") { stop(); editor.redo(); }
    else if (key === "save") void editor.save();
    else if (key === "select-tool") { setTool("select"); setPanel(null); }
    else if (key === "select-all") setSelected([...visible]);
    else if (key === "copy") selectionClipboard.current = copyStepSelection(payload, stepIndex, ids);
    else if (key === "paste") pasteSelection();
    else if (key === "delete") edit(p => deleteSelection(p, stepIndex, ids));
    else if (key.startsWith("nudge-") && ids.length) {
      const n = shift ? 0.03 : 0.01;
      move(ids, { x: key === "nudge-left" ? -n : key === "nudge-right" ? n : 0, y: key === "nudge-up" ? -n : key === "nudge-down" ? n : 0 });
    }
  };
  const headerAction = (label: string, icon: CourtActionIcon, onPress: () => void) => <CourtActionButton tooltipScale={uiScale} compact={denseControls || !narrowHeader} label={label} icon={icon} onPress={onPress} />;
  const courtViews = Platform.OS === "web" ? <View accessibilityRole="radiogroup" accessibilityLabel="Visualização da quadra" style={{ flexDirection: "row", padding: 3, borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg }}>
    {(["2d", "3d"] as const).map(view => <Pressable suppressWebHoverFeedback disableWebPressScale key={view} accessibilityRole="radio" accessibilityLabel={`Quadra ${view.toUpperCase()}`} aria-checked={courtView === view} accessibilityState={{ checked: courtView === view, disabled: changingCourt }} disabled={changingCourt} onPress={() => changeCourtView(view)} style={({ hovered, pressed }) => ({ minHeight: compactWeb ? 28 : narrowHeader ? 40 : 32, paddingHorizontal: compactWeb ? 6 : narrowHeader ? 4 : 9, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: courtView === view || hovered || pressed ? colors.secondaryBg : "transparent", opacity: changingCourt ? 0.55 : 1 })}><Text numberOfLines={1} style={{ color: ink, fontSize: compactWeb || narrowHeader ? 12 : 13, fontWeight: courtView === view ? "500" : "400" }}>{`Quadra ${view.toUpperCase()}`}</Text></Pressable>)}
  </View> : null;
  const openWorkspaceTab = (next: CourtWorkspaceTab) => {
    setPanel(null); setWorkspacePanelOpen(true); setWorkspaceTab(next);
    setLibraryMenuId(null); setActionMenu(null);
  };
  const changeWorkspaceTab = (next: CourtWorkspaceTab) => {
    setWorkspaceTab(next); setLibraryMenuId(null); setActionMenu(null);
  };
  const headerActions = <>
    {!narrowHeader ? headerAction("Biblioteca", "exercises", () => { setLibraryDetails(false); setLibraryNewOpen(false); setLibraryMenuId(null); openWorkspaceTab("library"); }) : null}
    <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={editor.saving ? "Salvando jogada" : "Salvar jogada"} hitSlop={2} disabled={!editor.canSave} onPress={() => void editor.save()} style={({ hovered, pressed }) => ({ width: denseControls ? 34 : narrowHeader ? 44 : 34, height: denseControls ? 34 : narrowHeader ? 44 : 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg, opacity: !editor.canSave ? 0.55 : hovered || pressed ? 0.9 : 1 })}>{editor.saving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <GoAtletaIcon name="save" size={18} color={colors.primaryText} />}</Pressable>
    <View ref={documentMenuRef} collapsable={false}><CourtActionButton tooltipScale={uiScale} compact={denseControls || !narrowHeader} label="Opções da jogada" icon="ellipsisHorizontal" onPress={() => toggleActionMenu("document")} active={actionMenu === "document"} /></View>
  </>;
  const runMenuCommand = (command: "library" | "undo" | "redo" | "new" | "export" | "settings" | "refresh-rotations" | "edit-step" | "duplicate-step" | "continue-step" | "delete-step" | "rotate-selection" | "delete-selection") => {
    switch (command) {
      case "library": setLibraryDetails(false); setLibraryNewOpen(false); setLibraryMenuId(null); openWorkspaceTab("library"); break;
      case "undo": stop(); editor.undo(); break;
      case "redo": stop(); editor.redo(); break;
      case "new": setBoardName(""); setNewBoardOpen(true); break;
      case "export": setPanel("export"); break;
      case "settings": setPanel("settings"); break;
      case "refresh-rotations": mutateStep(replaceReceptionRotationSequence(payload, stepIndex)); break;
      case "edit-step": openStepEditor(); break;
      case "duplicate-step": mutateStep(duplicateStep(payload, stepIndex)); break;
      case "continue-step": mutateStep(continueStepFromEnd(payload, stepIndex)); break;
      case "delete-step": mutateStep(removeStep(payload, stepIndex)); break;
      case "rotate-selection": if (object) changeObject({ rotation: (object.rotation + 45) % 360 }); break;
      case "delete-selection": remove(); break;
    }
  };
  const menuOptions: { label: string; icon: CourtActionIcon; command: Parameters<typeof runMenuCommand>[0]; disabled?: boolean; danger?: boolean }[] = actionMenu === "document" ? [
    ...(narrowHeader ? [{ label: "Biblioteca", icon: "exercises" as const, command: "library" as const }] : []),
    { label: "Desfazer", icon: "restore", command: "undo", disabled: !editor.canUndo },
    { label: "Refazer", icon: "arrowForward", command: "redo", disabled: !editor.canRedo },
    { label: "Nova quadra", icon: "add", command: "new", disabled: editor.saving },
    { label: "Exportar", icon: "download", command: "export" },
    { label: "Configurar quadra", icon: "management", command: "settings" },
  ] : actionMenu === "step" ? [
    ...(isLegacyReceptionRotationSequence(payload) ? [{ label: "Atualizar rotações", icon: "restore" as const, command: "refresh-rotations" as const }] : []),
    { label: "Editar etapa", icon: "pencil", command: "edit-step" },
    { label: "Duplicar após esta etapa", icon: "copy", command: "duplicate-step" },
    { label: "Continuar do final", icon: "arrowForward", command: "continue-step" },
    { label: "Excluir etapa", icon: "trash", command: "delete-step", disabled: payload.timeline.steps.length === 1, danger: true },
  ] : actionMenu === "selection" ? [
    ...(selectionCanRotate && object ? [{ label: "Girar 45 graus", icon: "repeat" as const, command: "rotate-selection" as const }] : []),
    { label: "Excluir seleção", icon: "trash", command: "delete-selection", danger: true },
  ] : [];
  const canvasProps: CourtEditorCanvasProps = {
    payload, stepIndex, landscape, selected, multiple: multi, onSelect: select, onMove: move, onDraw: draw,
    onEditText: editText, onAddPlayer: addPlayer, playerPreviewColor: team === "A" ? "#19c87b" : "#4389ff",
    tool, motionMode, color, dashed, grid, half, plain, progress, zoom, pan, onPan: setPan, onZoom: setZoom,
    disabled: playing || busy || editor.saving || editor.opening,
    onSimulationHandle: edit => { stop(); commit(p => updateCourtSimulationHandle(p, stepIndex, edit)); },
    selectionTopInset: insets.top + 144 * uiScale,
    selectionBottomInset: compactWeb ? mobileOverlays.zoomBottom + 48 : (compact ? 132 : 84) * uiScale,
    selectionActions: !playing && !panel ? <View>
        <Pressable accessibilityRole="button" accessibilityLabel="Editar propriedades da seleção" onPress={() => setPanel("properties")} style={({ hovered, pressed }) => [styles.selectionFab, { backgroundColor: hovered || pressed ? colors.secondaryBg : surface }]}><GoAtletaIcon name="pencil" size={18} color={ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Duplicar seleção" onPress={duplicate} style={({ hovered, pressed }) => [styles.selectionFab, { backgroundColor: hovered || pressed ? colors.secondaryBg : surface }]}><GoAtletaIcon name="copy" size={18} color={ink} /></Pressable>
        <View ref={colorMenuRef} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel="Escolher cor" accessibilityState={{ expanded: actionMenu === "color" }} onPress={() => toggleActionMenu("color")} style={({ hovered, pressed }) => [styles.selectionFab, { backgroundColor: hovered || pressed ? colors.secondaryBg : surface }]}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: actor?.color ?? object?.color ?? color, borderWidth: 1, borderColor: "#ffffff99" }} /></Pressable></View>
        <View ref={selectionMenuRef} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel={selectionCanRotate ? "Opções da seleção" : "Excluir seleção"} onPress={() => { if (selectionCanRotate) toggleActionMenu("selection"); else remove(); }} style={({ hovered, pressed }) => [styles.selectionFab, { backgroundColor: hovered || pressed ? colors.secondaryBg : surface }]}><GoAtletaIcon name={selectionCanRotate ? "ellipsisHorizontal" : "trash"} size={18} color={ink} /></Pressable></View>
      </View> : undefined,
  };
  const libraryContent = <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
        <View style={styles.row}>
          {libraryDetails ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar à Biblioteca" onPress={() => setLibraryDetails(false)} style={[styles.libraryHeaderIcon, denseControls ? { width: 34, height: 34, borderRadius: 999 } : null]}><GoAtletaIcon name="chevronBack" size={18} color={ink} /></Pressable> : null}
          <Text style={{ flex: 1, fontSize: denseControls ? 14 : 16, fontWeight: "600", color: ink }} numberOfLines={1}>{libraryDetails ? "Dados da jogada" : "Jogadas"}</Text>
          {!libraryDetails ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="Dados da jogada" onPress={() => { setLibraryDetails(true); setLibraryNewOpen(false); }} style={[styles.libraryHeaderIcon, denseControls ? { width: 34, height: 34, borderRadius: 999 } : null]}><GoAtletaIcon name="pencil" size={17} color={colors.muted} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Nova jogada ou sistema" accessibilityState={{ expanded: libraryNewOpen }} onPress={() => setLibraryNewOpen(open => !open)} style={[styles.libraryNewButton, denseControls ? { minHeight: 34, borderRadius: 999 } : null, { backgroundColor: colors.primaryBg }]}><GoAtletaIcon name="add" size={15} color={colors.primaryText} /><Text style={{ color: colors.primaryText, fontSize: 11, fontWeight: "700" }}>Nova</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Importar arquivo" onPress={() => void importFile()} style={[styles.libraryHeaderIcon, denseControls ? { width: 34, height: 34, borderRadius: 999 } : null]}><GoAtletaIcon name="documentAttach" size={18} color={colors.muted} /></Pressable>
          </> : null}
        </View>
        {libraryDetails ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
            <View style={{ gap: 12, paddingTop: 10 }}>
            {field("Título da jogada", effectiveTitle, title => metadata({ title }))}
            {field("Pasta", payload.editor!.folder, folder => metadata({ folder }))}
            {field("Tags", payload.editor!.tags, tags => metadata({ tags }))}
            {action("Favoritar jogada", "star", () => metadata({ favorite: !payload.editor!.favorite }), payload.editor!.favorite, false, true)}

            {lessonDate ? <>{heading(`Aula · ${lessonDate.split("-").reverse().join("/")}`)}
              <Text style={{ color: colors.muted, fontSize: 12 }}>Vincule esta versão a um bloco. O plano aplicado permanece preservado.</Text>
              {["Aquecimento", "Parte principal", "Volta à calma"].map(block => action(block, "link", () => metadata({ lessonLink: { date: lessonDate, block, revision: planId || editorId() } }), payload.editor!.lessonLink?.date === lessonDate && payload.editor!.lessonLink?.block === block, false, true))}

            </> : null}
            {payload.editor!.lessonLink ? <><Text style={{ color: colors.muted, fontSize: 12 }}>{payload.editor!.lessonLink.date} · {payload.editor!.lessonLink.block}</Text>{action("Remover vínculo da aula", "close", () => metadata({ lessonLink: undefined }), false, false, true)}</> : null}
            </View>
        </ScrollView> : <>
          {libraryNewOpen ? <View style={{ flexDirection: "row", gap: 8 }}>{([['Nova jogada', false], ['Novo sistema', true]] as const).map(([label, system]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={editor.saving} onPress={() => { const board = newCourtBoard(label); if (system) board.editor!.tags = "sistema"; setLibraryNewOpen(false); void openPayload(board); }} style={[styles.libraryChoice, denseControls ? { minHeight: 34, borderRadius: 999 } : null, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><Text style={{ color: ink, fontSize: 14 }}>{label}</Text></Pressable>)}</View> : null}
          <CourtLibraryBrowser compact={denseControls} items={visibleLibraryItems} groups={libraryGroups} filter={libraryFilter} query={query} favorites={onlyFavorites} onlyLesson={onlyLesson} lessonDate={lessonDate} disabled={editor.saving || editor.opening} onQuery={setQuery} onFilter={value => { setLibraryFilter(value); setLibraryMenuId(null); }} onFavorites={() => setOnlyFavorites(value => !value)} onLesson={() => setOnlyLesson(value => !value)} onClear={() => { setQuery(""); setOnlyFavorites(false); setOnlyLesson(false); }} onOpen={item => { if (item.location === "trash") toggleLibraryMenu(item.id); else if (!item.current) void openPayload(item.payload, item.document?.id, true); }} onMenu={toggleLibraryMenu} menuId={libraryMenuId} registerMenu={(id, node) => { if (node) libraryMenuTriggers.current.set(id, node); else libraryMenuTriggers.current.delete(id); }} />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Pressable accessibilityRole="button" accessibilityLabel={libraryFilter === "trash" ? "Voltar aos arquivos" : "Abrir lixeira"} onPress={() => { setLibraryFilter(value => value === "trash" ? "all" : "trash"); setQuery(""); setLibraryMenuId(null); }} style={{ minHeight: denseControls ? 34 : 40, borderRadius: denseControls ? 999 : 12, justifyContent: "center", backgroundColor: "transparent", borderWidth: 0 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{libraryFilter === "trash" ? "‹ Voltar aos arquivos" : `Lixeira (${editor.documents.filter(d => editor.trashedIds.includes(d.id)).length}) ›`}</Text></Pressable></View>
        </>}
  </View>;
  const root = <View style={[styles.root, Platform.OS === "web" ? { position: "fixed" } as never : null]}>
    {editor.loading ? <View style={styles.center}><ActivityIndicator size="large" color="#fff" /><Text style={{ color: "#fff" }}>Abrindo quadra…</Text></View> : !editor.cls ? <View style={styles.center}><Text style={{ color: "#fff" }}>{editor.error}</Text>{action("Voltar", "chevronBack", onBack, false, false, true)}</View> : <>
      <View style={{ flex: 1 }}>
      {courtView === "2d" ? <VisualCourtCanvas {...canvasProps} /> : null}
      {perspectiveMounted ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, display: courtView === "3d" ? "flex" : "none" }}><CourtPerspectiveCanvas {...canvasProps} active={courtView === "3d"} cameraView={cameraView} cameraReset={cameraReset} onShortcut={perspectiveShortcut} onOpenProperties={() => setPanel("properties")} onSimulationHandle={handle => canvasProps.onSimulationHandle?.({ ...handle, point: worldToCourtPoint(handle.point) })} /></View> : null}
      </View>

      <View style={[styles.top, overlayScale("top center"), { top: insets.top + 18 * uiScale, borderColor: colors.border, backgroundColor: surface, maxHeight: height * 0.45 / uiScale, width: headerWidth }]}>
        <View>
          <View style={[styles.topContent, compactWeb ? { minHeight: 43, padding: 4 } : null]}>
          {headerAction("Voltar à turma", "chevronBack", () => editor.dirty ? setExitOpen(true) : onBack())}
          {courtViews}
          {headerActions}
          </View>
        </View>
      </View>

      {editor.draftError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ position: "absolute", top: insets.top + 74 * uiScale, ...overlayScale("top center"), alignSelf: "center", maxWidth: headerWidth, color: colors.dangerText, fontSize: 11 }}>{editor.draftError}</Text> : null}
      <CourtSimulationModes uiScale={uiScale} mode={simulationMode} disabled={changingCourt} top={insets.top + (compactWeb ? 74 : width <= 560 ? 82 : 86) * uiScale} onChange={next => configureSimulation({ mode: next })} />
      <CourtWorkspacePanel uiScale={uiScale} disabled={changingCourt} tab={workspaceTab} onTabChange={changeWorkspaceTab} open={workspacePanelOpen && !panel} onToggle={() => { setPanel(null); setWorkspacePanelOpen(value => panel ? true : !value); }} top={insets.top + (compactWeb ? 124 : 144) * uiScale} bottom={compactWeb ? mobileOverlays.panelBottom : insets.bottom + (compact ? 124 : 88) * uiScale}
        adjustments={<CourtSimulationSettings config={simulation ?? null} mode={simulationMode} showRotation={simulationMode === "receive" || rotationSequence} attackArcValue={attackArcValue} disabled={changingCourt} onChange={configureSimulation} onRestore={() => { resetPlayback(); setSelected([]); commit(p => resetCourtSimulation(p, stepIndex)); }} onShare={() => setPanel("export")} cameraView={cameraView} onCameraView={value => { setCameraView(value); setCameraReset(n => n + 1); }} labelsVisible={showSimulationGuides} onLabelsVisible={setSimulationGuides} />}
        steps={<CourtStepGallery payload={payload} stepIndex={stepIndex} compact={denseControls} disabled={changingCourt} onSelect={selectStep} onMove={moveStepTo} onAdd={() => mutateStep(addBlankStep(payload, payload.timeline.steps.length - 1))} headerActions={<View ref={stepMenuRef} collapsable={false}><CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Opções da etapa" icon="ellipsisHorizontal" onPress={() => toggleActionMenu("step")} active={actionMenu === "step"} /></View>} />}
        library={libraryContent} />
      <CourtSimulationTransport uiScale={uiScale} showRotation={simulationMode === "receive" || rotationSequence} playing={playing} progress={progress} speed={speed} rotation={simulation?.rotation ?? 0} disabled={changingCourt} onPlay={playCurrentStep} onRestart={restartCurrentStep} onPreviousRotation={() => configureSimulation({ rotation: ((simulation?.rotation ?? 0) + 5) % 6 })} onNextRotation={() => configureSimulation({ rotation: ((simulation?.rotation ?? 0) + 1) % 6 })} onSeek={value => { setPlaying(false); playhead.current = value; setProgress(value); }} onSpeed={setSpeed} onOpenSteps={() => openWorkspaceTab("steps")} bottom={compactWeb ? mobileOverlays.transportBottom : insets.bottom + 20 * uiScale} />

      <View accessibilityLabel="Ferramentas da quadra" style={[styles.tools, overlayScale("top left"), { width: denseControls ? 40 : 52, top: compactWeb ? Math.max(toolsTop, (height - toolsHeight) / 2) : toolsTop + (toolsSpace - toolsHeight) * uiScale / 2, left: insets.left + 10 * uiScale, maxHeight: toolsHeight, backgroundColor: mode === "dark" ? "rgba(9,28,48,0.72)" : "rgba(246,251,255,0.78)" }]}>
        <ScrollView showsVerticalScrollIndicator={false} onScroll={() => setAnimationToolsOpen(false)} contentContainerStyle={{ gap: 2, padding: 3 }}>
          {TOOLS.map(t => t.id === "animate" ? <View key={t.id} onLayout={event => setAnimationToolY(event.nativeEvent.layout.y)}>{action(t.label, t.icon, openAnimationTools, tool === t.id)}</View> : action(t.label, t.icon, () => { stop(); setAnimationToolsOpen(false); setSelected([]); if (t.id === "cone") setColor("#f97316"); setTool(t.id); setPanel(null); }, tool === t.id, false, false, t.id === "ball" ? "ball" : undefined))}
          {action("Mais ferramentas", "dashboard", () => setPanel("tools"))}
        </ScrollView>
      </View>
      {animationToolsOpen ? <View accessibilityLabel="Trajeto da animação" style={{ position: "absolute", ...overlayScale("top left"), left: insets.left + 64 * uiScale, top: Math.min(height - insets.bottom - 48 * uiScale, toolsTop + (toolsSpace - toolsHeight) * uiScale / 2 + (animationToolY + 2) * uiScale), flexDirection: "row", gap: 2, padding: 3, borderRadius: 11, backgroundColor: surface, borderWidth: 1, borderColor: colors.border, zIndex: 26 }}>
        {([ ["free", "Livre"], ["straight", "Reto"] ] as const).map(([modeOption, label]) => <Pressable key={modeOption} accessibilityRole="button" accessibilityLabel={`Trajeto ${label.toLowerCase()}`} accessibilityState={{ selected: motionMode === modeOption }} onPress={() => { setMotionMode(modeOption); setAnimationToolsOpen(false); }} style={({ hovered, pressed }) => ({ minWidth: 56, minHeight: 40, paddingHorizontal: 8, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: motionMode === modeOption ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent" })}><Text style={{ color: motionMode === modeOption ? colors.primaryText : ink, fontSize: 12, fontWeight: motionMode === modeOption ? "700" : "500" }}>{label}</Text></Pressable>)}
      </View> : null}
      <View accessibilityLabel="Controles da vista" style={[styles.history, overlayScale("bottom right"), { right: insets.right + 10 * uiScale, bottom: historyBottom, backgroundColor: surface, width: compactWeb ? mobileOverlays.zoomWidth : undefined, padding: compactWeb ? 3 : 0, maxWidth: compactWeb ? undefined : width < 700 ? Math.max(44, width / 2 - 84 - insets.right) : width - 20, flexWrap: compactWeb ? "nowrap" : "wrap" }]}>


        {zoomHintVisible ? <View pointerEvents="none" style={{ position: "absolute", bottom: "100%", right: 8, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: surface }}><Text accessibilityLiveRegion="polite" accessibilityLabel={`Zoom ${Math.round(zoom * 100)} por cento`} style={{ color: ink, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{Math.round(zoom * 100)}%</Text></View> : null}
        {action("Reduzir", "remove", () => setZoom(z => Math.max(0.75, z - 0.25)), false, zoom <= 0.75)}
        {action("Ampliar", "add", () => setZoom(z => Math.min(3, z + 0.25)), false, zoom >= 3)}
        {action("Mover a vista", "move", () => { stop(); setTool(tool === "pan" ? "select" : "pan"); }, tool === "pan")}
        {action("Ajustar à tela", "expand", () => { setZoom(1); setPan({ x: 0, y: 0 }); setCameraReset(value => value + 1); })}
      </View>

      {panel ? <Animated.View accessibilityLabel={`Painel ${panelTitle}`} style={[styles.panel, panelMotion.style, sidePanelLayout, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={{ flex: 1, fontSize: denseControls ? 14 : 16, fontWeight: "600", color: ink }}>{panelTitle}</Text>
          {action("Fechar painel", "close", () => setPanel(null))}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          {panel === "properties" ? <>
            {actor ? <>
              {toggle("Representar como bolinha", (actor.representation ?? payload.editor?.actorRepresentation ?? "circle") === "circle", enabled => changeActor({ representation: enabled ? "circle" : "person" }))}
              {field("Rótulo do jogador", actor.label, label => changeActor({ label }))}
              {field("Número", String(actor.number ?? ""), value => changeActor({ number: value.trim() ? Math.min(99, Math.max(0, Number(value) || 0)) : undefined }))}
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
            {toggle("Mostrar números", payload.editor!.showActorNumbers !== false, showActorNumbers => metadata({ showActorNumbers }))}
            {toggle("Representar com bonequinhos", payload.editor!.actorRepresentation === "person", enabled => metadata({ actorRepresentation: enabled ? "person" : "circle" }))}
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
            <View style={styles.row}><Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Posição {stepIndex + 1} de {payload.timeline.steps.length}</Text><CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Mover etapa antes" icon="chevronBack" onPress={() => mutateStep(reorderStep(payload, stepIndex, -1))} disabled={stepIndex === 0} /><CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Mover etapa depois" icon="chevronForward" onPress={() => mutateStep(reorderStep(payload, stepIndex, 1))} disabled={stepIndex === payload.timeline.steps.length - 1} /></View>
            <CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Continuar a partir do final" icon="arrowForward" onPress={() => mutateStep(continueStepFromEnd(payload, stepIndex))} text />
            <CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Duplicar com a mesma animação" icon="copy" onPress={() => mutateStep(duplicateStep(payload, stepIndex))} text />

            {heading("Animação")}

            {action("Limpar animação desta etapa", "restore", () => edit(p => resetStepAnimation(p, stepIndex)), false, false, true)}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }}><CourtActionButton tooltipScale={uiScale} compact={denseControls} label="Excluir etapa" icon="trash" onPress={() => mutateStep(removeStep(payload, stepIndex))} disabled={payload.timeline.steps.length === 1} text danger /></View>

          </> : null}
          {panel === "players" ? <>
            {heading("Equipes")}
            <Text style={{ color: colors.muted, fontSize: 12 }}>Selecione uma equipe para ver seus jogadores.</Text>
            <View style={styles.wrap}>{["A", "B"].map(t => <CourtActionButton tooltipScale={uiScale} key={t} label={`Equipe ${t}`} icon="students" tile active={team === t} onPress={() => { setTeam(t as "A" | "B"); }} />)}</View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{landscape ? "Lado A: esquerda · Lado B: direita" : "Lado A: abaixo da rede · Lado B: acima da rede"}</Text>
            {action(`Adicionar à equipe ${team}`, "addStudent", () => { stop(); setSelected([]); setPanel(null); setTool("player"); editor.setNotice(`Clique ou toque na quadra para posicionar um jogador da equipe ${team}.`); }, tool === "player", false, true)}
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
          {panel === "export" ? <>
            <Text style={{ color: colors.muted, fontSize: 13 }}>A exportação inclui os rótulos e as notas visíveis da jogada.</Text>
            {Platform.OS === "web" ? <Text style={{ color: colors.muted, fontSize: 12 }}>O GIF reproduz a etapa atual em loop e respeita sua duração.</Text> : null}
            {Platform.OS === "web" ? <Text style={{ color: colors.muted, fontSize: 12 }}>O PDF usa meia quadra vertical e compara a posição de saque com a posição final.</Text> : null}
            {Platform.OS === "web" ? <>{action("GIF animado da etapa", "play", () => void runExport("gif"), false, busy, true)}{action("Imagem PNG da etapa", "gallery", () => void runExport("png"), false, busy, true)}{action("PDF da sequência", "document", () => void runExport("pdf"), false, busy, true)}</> : null}
            {action("Cópia editável JSON", "download", () => void runExport("json"), false, busy, true)}
            {busy ? <ActivityIndicator color={ink} /> : null}
          </> : null}
        </ScrollView>

      </Animated.View> : null}
      <AnchoredDropdown visualScale={uiScale} visible={workspacePanelOpen && !panel && workspaceTab === "library" && !libraryDetails && Boolean(libraryMenuItem?.document)} layout={libraryMenuLayout} container={null} animationStyle={{}} zIndex={6100} maxHeight={libraryMenuItem?.location === "team" ? 98 : 54} nestedScrollEnabled density="menu" preferredWidth={188} showVerticalScrollIndicator={false} onRequestClose={() => closeCourtMenu("court-library-menu", libraryMenuTriggerRef.current, () => setLibraryMenuId(null))} interactiveRefs={[libraryMenuTriggerRef]}>
        <CourtMenuContents id="court-library-menu">
        {libraryMenuItem?.document ? <>
          <AnchoredDropdownOption active={false} accessibilityLabel={libraryMenuItem.location === "trash" ? "Restaurar" : "Mover para lixeira"} density="compact" style={{ minHeight: denseControls ? 34 : 40, borderRadius: denseControls ? 999 : 12, justifyContent: "center", backgroundColor: "transparent", borderWidth: 0 }} onPress={() => { const item = libraryMenuItem; setLibraryMenuId(null); void editor.setDocumentTrashed(item.id, item.location !== "trash"); }}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><GoAtletaIcon name={libraryMenuItem.location === "trash" ? "restore" : "trash"} size={16} color={libraryMenuItem.location === "trash" ? ink : colors.dangerText} /><Text style={{ color: libraryMenuItem.location === "trash" ? ink : colors.dangerText, fontSize: denseControls ? 12 : 13 }}>{libraryMenuItem.location === "trash" ? "Restaurar" : "Mover para lixeira"}</Text></View></AnchoredDropdownOption>
          {Platform.OS === "web" && libraryMenuItem.location === "team" ? <AnchoredDropdownOption active={false} density="compact" accessibilityLabel="Copiar link interno" style={{ minHeight: denseControls ? 34 : 40, borderRadius: denseControls ? 999 : 12, justifyContent: "center", backgroundColor: "transparent", borderWidth: 0 }} onPress={() => { const item = libraryMenuItem; setLibraryMenuId(null); void Clipboard.setStringAsync(`${window.location.origin}/class/${encodeURIComponent(classId)}/visual-tech?visual=${encodeURIComponent(item.id)}`).then(() => editor.setNotice("Link copiado. O acesso continua restrito à organização.")); }}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><GoAtletaIcon name="link" size={16} color={ink} /><Text style={{ color: ink, fontSize: denseControls ? 12 : 13 }}>Copiar link interno</Text></View></AnchoredDropdownOption> : null}
        </> : null}

        </CourtMenuContents>
      </AnchoredDropdown>
      <AnchoredDropdown visualScale={uiScale} visible={Boolean(actionMenu)} layout={actionMenuLayout} container={null} animationStyle={{}} zIndex={6100} maxHeight={actionMenu === "color" ? (compact ? 142 : 118) : menuOptions.length * (denseControls ? 34 : 40) + Math.max(0, menuOptions.length - 1) * 4 + 22 + (actionMenu === "document" ? 66 : 0)} nestedScrollEnabled density="menu" preferredWidth={actionMenu === "color" ? (compact ? 144 : 120) : 220} onRequestClose={() => closeCourtMenu("court-action-menu", actionMenuTrigger.current, () => setActionMenu(null))} interactiveRefs={[actionMenuTrigger]}>
        <CourtMenuContents id="court-action-menu">
        {actionMenu === "document" ? <View style={{ padding: denseControls ? 6 : 8, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 }}><CourtEditableTitle compact={denseControls} key={editor.activeDocumentId ?? "new"} title={effectiveTitle} color={ink} disabled={editor.saving || editor.opening} onCommit={title => metadata({ title })} /><Text numberOfLines={1} style={{ color: editor.draftError ? colors.dangerText : colors.muted, fontSize: 12 }} accessibilityLiveRegion="polite">{editor.draftError || editor.cls.name}</Text></View> : null}
        {actionMenu === "color" ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>{[...COLORS, "#f97316"].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Aplicar cor ${value}`} accessibilityState={{ selected: value === (actor?.color ?? object?.color) }} onPress={() => { if (actor) changeActor({ color: value }); else changeObject({ color: value }); setActionMenu(null); }} style={{ width: compact ? 40 : 32, height: compact ? 40 : 32, borderRadius: compact ? 20 : 16, backgroundColor: value, borderWidth: value === (actor?.color ?? object?.color) ? 2 : 1, borderColor: "#ffffff99" }} />)}</View> : null}
        {menuOptions.map(option => <AnchoredDropdownOption key={option.label} active={false} accessibilityLabel={option.label} disabled={option.disabled || editor.saving} density="compact" style={{ minHeight: denseControls ? 34 : 40, borderRadius: denseControls ? 999 : 12, justifyContent: "center", backgroundColor: "transparent", borderWidth: 0 }} onPress={() => { closeCourtMenu("court-action-menu", actionMenuTrigger.current, () => setActionMenu(null)); runMenuCommand(option.command); }}><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><CourtToolIcon name={option.icon} size={denseControls ? 16 : 18} color={option.danger ? colors.dangerText : ink} /><Text style={{ fontSize: denseControls ? 12 : 13, color: option.danger ? colors.dangerText : ink }}>{option.label}</Text></View></AnchoredDropdownOption>)}

        </CourtMenuContents>
      </AnchoredDropdown>
      {newBoardOpen ? <View style={styles.exitOverlay}><View role="dialog" accessibilityLabel="Nova quadra" style={{ ...overlayScale("center"), backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: denseControls ? 16 : 24, borderRadius: denseControls ? 24 : 20, gap: denseControls ? 12 : 18, width: denseControls ? 360 : 380, maxWidth: "95%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: ink, fontWeight: "700", fontSize: denseControls ? 14 : 20 }}>Nova quadra</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancelar nova quadra" disabled={editor.saving} onPress={() => setNewBoardOpen(false)} style={{ width: denseControls ? 34 : 38, height: denseControls ? 34 : 38, borderRadius: 999, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="close" size={denseControls ? 18 : 20} color={colors.muted} /></Pressable></View>

        <View style={{ backgroundColor: colors.inputBg, borderRadius: 12, minHeight: 50, paddingHorizontal: 14 }}><TextInput accessibilityLabel="Nome da nova quadra" placeholder="Nome" placeholderTextColor={colors.muted} value={boardName} onChangeText={setBoardName} style={{ color: ink, minHeight: 50, borderRadius: 0, fontSize: 14 }} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Salvar atual e criar" disabled={editor.saving || !boardName.trim()} onPress={() => { void editor.save().then(saved => { if (saved) void openBlankBoard(); }); }} style={({ hovered, pressed }) => ({ minHeight: denseControls ? 34 : 48, borderRadius: denseControls ? 999 : 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg, opacity: editor.saving || !boardName.trim() ? 0.55 : hovered || pressed ? 0.9 : 1 })}>
          {editor.saving ? <ActivityIndicator size="small" color={colors.primaryText} /> : null}<Text style={{ color: colors.primaryText, fontSize: denseControls ? 12 : 14, fontWeight: "700" }}>{editor.saving ? "Salvando…" : "Salvar atual e criar"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Criar sem salvar" disabled={editor.saving} onPress={() => void openBlankBoard()} style={({ hovered }) => ({ minHeight: denseControls ? 34 : 40, alignItems: "center", justifyContent: "center", opacity: editor.saving ? 0.55 : 1 })}><Text style={{ color: colors.muted, fontSize: 12 }}>Criar sem salvar</Text></Pressable>
      </View></View> : null}
      {exitOpen ? <View style={styles.exitOverlay}><View role="dialog" accessibilityLabel="Sair da quadra" style={{ ...overlayScale("center"), backgroundColor: surface, padding: denseControls ? 16 : 22, borderRadius: denseControls ? 24 : 16, gap: 12, width: denseControls ? 360 : undefined, maxWidth: denseControls ? 360 : 340 }}><Text style={{ color: ink, fontWeight: "700", fontSize: denseControls ? 14 : 17 }}>Sair da quadra?</Text><Text style={{ color: colors.muted, fontSize: denseControls ? 12 : 14 }}>Há alterações ainda não salvas na turma. O rascunho fica neste dispositivo.</Text>{action("Continuar editando", "pencil", () => setExitOpen(false), false, false, true)}{action("Salvar e sair", "save", () => { void editor.save().then(saved => { if (saved) onBack(); }); }, true, editor.saving, true)}{action("Sair com rascunho local", "chevronBack", () => { void editor.preserveDraft().then(saved => { if (saved) onBack(); else setExitOpen(false); }); }, false, false, true)}</View></View> : null}
    </>}
  </View>;
  return Platform.OS === "web" && typeof document !== "undefined" ? createWebPortal(root, document.body) : root;
}
const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 6000, backgroundColor: "#1676ac" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  top: { position: "absolute", alignSelf: "center", maxWidth: "100%", borderRadius: 40, borderWidth: 1, zIndex: 20 },
  topContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 53, padding: 6, gap: 2, width: "100%" },
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: 9, gap: 6, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1 },
  tools: { position: "absolute", borderRadius: 16, width: 52, zIndex: 24 },
  propertyTrigger: { position: "absolute", width: 44, height: 44, borderRadius: 22, overflow: "hidden", zIndex: 21 },
  history: { position: "absolute", flexDirection: "row", gap: 2, borderRadius: 25, zIndex: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  selectionFab: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  panel: { position: "absolute", zIndex: 30, padding: 12, gap: 10, borderRadius: 16, borderWidth: 1 },
  libraryHeaderIcon: { width: 40, height: 44, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  libraryNewButton: { minHeight: 44, borderRadius: 9, paddingHorizontal: 10, flexDirection: "row", gap: 3, alignItems: "center" },
  libraryChoice: { minHeight: 44, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  librarySearch: { minHeight: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  libraryFilter: { minHeight: 34, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center" },
  libraryItem: { flex: 1, minHeight: 62, paddingHorizontal: 7, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  libraryThumb: { width: 34, height: 34, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  libraryMore: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  exitOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 80 },
});
