import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanResponder, Platform, Text, TextInput, View } from "react-native";
import { CourtEditorScene, displayActors, fromScenePoint, sceneBounds, scenePoint } from "./CourtEditorScene";
import { changeDrawings, duplicateSelection, editableCourtSelection, editorId, frameDrawings, hasCourtArea as validArea, moveSelection, snapCourtPoint, limitPoint, type CourtDrawing, type DrawingKind } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualPayload } from "../../core/visual-court";
import { CourtSelectionActions } from "./CourtSelectionActions";
import { COURT_TEXT_FONT, hitCourtText, measureCourtText } from "./court-text-layout";
import { displayCourtDrawings } from "../../core/court-simulation-display";
import { updateCourtSimulationHandle } from "../../core/court-simulation";
import { boundCourtFloorHandle, getCourtFloorHandles, type CourtFloorHandle } from "../../core/court-simulation-handles";
import { resolveCourtLayers } from "../../core/court-layers";
import { CourtActionButton, CourtToolIcon } from "./CourtEditorControls";
import { useAppTheme } from "../../ui/app-theme";
import { radius, spacing } from "../../theme/tokens";
import { courtArrowHandles, courtCurveControl, courtLinkedArrowGrip, moveCourtArrowHandle, straightenCourtArrow, type CourtArrowHandleKind, type CourtArrowShape } from "./court-arrow-geometry";

export type CourtTool = "select" | "pan" | "player" | "animate" | DrawingKind;
export type CourtEditorCanvasProps = {
  readOnly?: boolean;
  payload: CourtVisualPayload; stepIndex: number; landscape: boolean; tool: CourtTool; motionMode?: "free" | "straight"; selected: string[]; multiple?: boolean;
  areaMode?: "free" | "points"; onCancelArea?: () => void;
  onSelect: (ids: string[]) => void; onMove: (ids: string[], delta: CourtPoint, path?: CourtPoint[], duplicate?: boolean) => void; onDraw: (d: CourtDrawing) => void;
  onEditText: (id: string, value: string) => void;
  onEditArrow?: (id: string, shape: CourtArrowShape) => void;
  rotationPreview?: import("../../core/visual-court-perspective").CourtRotationPreview;
  onAddPlayer: (p: CourtPoint) => void; color: string; dashed: boolean; grid: boolean; progress?: number;
  zoom: number; pan: CourtPoint; onPan: (p: CourtPoint) => void; onZoom: (zoom: number) => void; half: boolean; plain: boolean; disabled?: boolean;
  selectionActions?: ReactNode;
  selectionTopInset?: number;
  selectionBottomInset?: number;
  playerPreviewColor?: string;
  /** One completed floor-handle gesture is one canonical history edit. */
  allowServeHandle?: boolean;
  onSimulationHandle?: (edit: Parameters<typeof updateCourtSimulationHandle>[2]) => void;
};
type Props = CourtEditorCanvasProps;
function selectedArrow(p: Props) {
  if (p.tool !== "select" || p.disabled || p.readOnly || !p.onEditArrow || p.selected.length !== 1 || !editableCourtSelection(p.payload, p.stepIndex, p.selected).length) return;
  return displayCourtDrawings(p.payload, p.stepIndex, p.progress).find(d => d.id === p.selected[0] && ["arrow", "curve"].includes(d.kind) && d.points.length >= 2);
}
const arrowShape = (drawing: CourtDrawing): CourtArrowShape => ({ kind: drawing.kind, points: drawing.points, ...(drawing.curveMode ? { curveMode: drawing.curveMode } : {}), ...(drawing.startBallId ? { startBallId: drawing.startBallId } : {}) });
function arrowStartBall(p: Props, point: CourtPoint, scale: number) {
  if (p.payload.editor?.hiddenLayers?.includes("drawings")) return;
  const at = scenePoint(point, p.landscape);
  return displayCourtDrawings(p.payload, p.stepIndex, p.progress).filter(d => d.kind === "ball" && d.points[0]).map(ball => {
    const center = scenePoint(ball.points[0], p.landscape);
    return { ball, distance: Math.hypot(center.x - at.x, center.y - at.y) * scale };
  }).filter(candidate => candidate.distance <= 22).sort((a, b) => a.distance - b.distance)[0]?.ball;
}
function moveArrow(p: Props, drawing: CourtDrawing, kind: CourtArrowHandleKind, point: CourtPoint, scale: number, keyboard = false) {
  if (kind !== "start") return moveCourtArrowHandle(drawing, kind, point, p.landscape, scale, keyboard ? 0 : 3);
  const ball = keyboard ? undefined : arrowStartBall(p, point, scale);
  const next = moveCourtArrowHandle(drawing, kind, ball?.points[0] ?? point, p.landscape, scale);
  if (next.startBallId === ball?.id) return next;
  const { startBallId: _startBallId, ...detached } = next;
  return ball ? { ...detached, startBallId: ball.id } : detached;
}
function hitBallBody(drawing: CourtDrawing, p: Props, scene: CourtPoint, scale: number) {
  if (drawing.kind !== "ball" || !drawing.points[0]) return false;
  const center = scenePoint(drawing.points[0], p.landscape);
  return Math.hypot(center.x - scene.x, center.y - scene.y) * scale <= Math.max(22, (drawing.size || 32) * .85 * scale);
}
type CourtLayerHit = CourtDrawing | { id: string; points: CourtPoint[]; kind?: never };

function hitCourtLayer(p: Props, scene: CourtPoint, scale: number): CourtLayerHit | undefined {
  const hidden = p.payload.editor?.hiddenLayers ?? [];
  const actors = new Map((hidden.includes("actors") ? [] : displayActors(p.payload, p.stepIndex, p.progress)).map(actor => [actor.id, { id: actor.id, points: [actor.point] }]));
  const drawings = new Map((hidden.includes("drawings") ? [] : displayCourtDrawings(p.payload, p.stepIndex, p.progress)).map(drawing => [drawing.id, drawing]));
  const ballBodies = new Set([...drawings.values()].filter(drawing => hitBallBody(drawing, p, scene, scale)).map(drawing => drawing.id));
  const targets = resolveCourtLayers(p.payload, p.stepIndex).flatMap<CourtLayerHit>(ref => {
    const target = ref.kind === "actor" ? actors.get(ref.id) : drawings.get(ref.id);
    return target ? [target] : [];
  });
  return [...targets].reverse().find(t => {
    // A ball remains grabbable beneath its own connectors, while unrelated top layers keep priority.
    if ((t.kind === "arrow" || t.kind === "curve") && t.startBallId && ballBodies.has(t.startBallId)) return false;
    let points = t.points.map(pt => scenePoint(pt, p.landscape));
    if (t.kind === "text" && points[0]) {
      return hitCourtText(scene, points[0], t.text || "Anotação", t.size || 28, t.rotation || 0, 10 / scale);
    }
    if (t.kind === "curve" && points.length > 1) {
      const a = points[0], b = points[points.length - 1];
      const c = courtCurveControl(t, points);
      points = Array.from({ length: 17 }, (_, i) => { const u = i / 16; return { x: (1-u)**2*a.x + 2*(1-u)*u*c.x + u*u*b.x, y: (1-u)**2*a.y + 2*(1-u)*u*c.y + u*u*b.y }; });
    }
    const tolerance = Math.max(t.kind ? 44 : 56, 22 / scale);
    return points.some((a, i) => {
      const b = points[Math.min(i + 1, points.length - 1)], dx = b.x-a.x, dy = b.y-a.y;
      const u = Math.max(0, Math.min(1, ((scene.x-a.x)*dx + (scene.y-a.y)*dy) / (dx*dx+dy*dy || 1)));
      return Math.hypot(scene.x-a.x-u*dx, scene.y-a.y-u*dy) <= tolerance;
    });
  });
}
export function CourtEditorCanvas(props: Props) {
  const { colors } = useAppTheme();
  const { payload, stepIndex, tool, areaMode, disabled, readOnly, landscape, half, zoom, pan } = props;
  const selectedKey = props.selected.join("|");
  const host = useRef<View>(null);
  const live = useRef(props);
  useLayoutEffect(() => { live.current = props; });
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const layoutRef = useRef(layout);
  const areaContext = useMemo(() => ({ payload, stepIndex, tool, areaMode, disabled, readOnly }), [payload, stepIndex, tool, areaMode, disabled, readOnly]);
  const arrowContext = useMemo(() => ({ areaContext, selectedKey, landscape, half, zoom, x: pan.x, y: pan.y, width: layout.width, height: layout.height }), [areaContext, selectedKey, landscape, half, zoom, pan.x, pan.y, layout.width, layout.height]);
  const [previousArrowContext, setPreviousArrowContext] = useState(arrowContext);
  const [marquee, setMarquee] = useState<{ start: CourtPoint; end: CourtPoint }>();
  const [draft, setDraft] = useState<CourtDrawing>();
  const [areaPoints, setAreaPoints] = useState<CourtPoint[]>([]);
  const [areaHover, setAreaHover] = useState<CourtPoint>();
  const areaRef = useRef<{ payload: CourtVisualPayload; stepId: string; points: CourtPoint[] } | null>(null);
  const pointsMode = props.tool === "area" && props.areaMode === "points" && !props.disabled && !props.readOnly;
  const [textDraft, setTextDraft] = useState<{ id?: string; point: CourtPoint; value: string; color: string; size: number; rotation: number }>();
  const [hoveredId, setHoveredId] = useState<string>();
  const hoverRef = useRef<string | undefined>(undefined);
  const hoverEnabled = useRef(false);
  const updateHover = (id?: string, cursor = "") => {
    if (hoverRef.current === id) return;
    hoverRef.current = id; setHoveredId(id);
    if (Platform.OS === "web") {
      const node = host.current as unknown as HTMLElement;
      if (node?.dataset) node.dataset.hoveredId = id ?? "";
      if (node?.style) node.style.cursor = cursor;
    }
  };
  useLayoutEffect(() => {
    hoverEnabled.current = !props.disabled && !props.readOnly && !textDraft && (props.tool === "select" || props.tool === "animate");
    updateHover();
  }, [props.payload, props.stepIndex, props.tool, props.disabled, props.readOnly, props.progress, selectedKey, props.landscape, props.half, props.zoom, props.pan.x, props.pan.y, layout.width, layout.height, textDraft]);
  const textFinished = useRef(false);
  if (textDraft?.id && (disabled || !editableCourtSelection(payload, stepIndex, [textDraft.id]).length)) setTextDraft(undefined);
  const [playerPreview, setPlayerPreview] = useState<CourtPoint>();
  const [preview, setPreview] = useState<{ ids: string[]; delta: CourtPoint; path?: CourtPoint[]; duplicate?: boolean }>();
  const [handlePreview, setHandlePreview] = useState<{ payload: CourtVisualPayload; stepIndex: number; kind: CourtFloorHandle["kind"]; point: CourtPoint }>();
  const [arrowPreview, setArrowPreview] = useState<{ payload: CourtVisualPayload; stepIndex: number; drawing: CourtDrawing; kind: CourtArrowHandleKind; gripOffset?: CourtPoint }>();
  const arrowTap = useRef<{ payload: CourtVisualPayload; stepId: string; id: string; time: number; pixel: CourtPoint } | null>(null);
  const arrowClickGuard = useRef<{ time: number; pixel: CourtPoint } | null>(null);
  const gesture = useRef<{ start: CourtPoint; pixel: CourtPoint; points: CourtPoint[]; ids: string[]; pan: CourtPoint; dragged: boolean; box: boolean; base: string[]; duplicate: boolean; startBallId?: string; drawingContext?: { payload: CourtVisualPayload; stepId: string; tool: CourtTool }; area?: { payload: CourtVisualPayload; stepId: string }; handle?: CourtFloorHandle & { payload: CourtVisualPayload; stepIndex: number }; arrow?: { payload: CourtVisualPayload; stepIndex: number; stepId: string; drawing: CourtDrawing; kind: CourtArrowHandleKind; point: CourtPoint; startedAt: number; gripOffset?: CourtPoint } } | null>(null);
  if (arrowContext !== previousArrowContext) {
    setPreviousArrowContext(arrowContext);
    setArrowPreview(undefined);
    if (areaContext !== previousArrowContext.areaContext) {
      setAreaPoints([]);
      setAreaHover(undefined);
      if (tool === "area") setDraft(undefined);
    }
    if (draft?.id === "preview" && (draft.kind === "arrow" || draft.kind === "curve")) setDraft(undefined);
  }
  useLayoutEffect(() => {
    areaRef.current = null;
    if (gesture.current?.area || areaContext.tool === "area") gesture.current = null;
  }, [areaContext]);
  const clearArea = () => {
    areaRef.current = null;
    setAreaPoints([]);
    setAreaHover(undefined);
    if (gesture.current?.area || live.current.tool === "area") { gesture.current = null; setDraft(undefined); }
  };
  const finishArea = () => {
    const p = live.current, current = areaRef.current;
    if (!current || p.disabled || p.readOnly || p.tool !== "area" || p.areaMode !== "points" || current.payload !== p.payload || current.stepId !== p.payload.timeline.steps[p.stepIndex]?.id || !validArea(current.points)) return;
    clearArea();
    p.onDraw({ id: editorId(), kind: "area", points: current.points, color: p.color, dashed: p.dashed, size: 32, rotation: 0 });
  };
  const undoAreaPoint = () => {
    const current = areaRef.current; if (!current) return;
    const points = current.points.slice(0, -1); areaRef.current = points.length ? { ...current, points } : null; setAreaPoints(points); setAreaHover(undefined);
  };
  const cancelArea = () => { clearArea(); live.current.onCancelArea?.(); };
  useEffect(() => {
    if (!gesture.current?.handle) return;
    gesture.current = null;
    setHandlePreview(undefined);
  }, [props.payload, props.stepIndex, props.tool, props.disabled, props.landscape, props.half, props.zoom, props.pan.x, props.pan.y, layout.width, layout.height]);
  useLayoutEffect(() => {
    if (gesture.current?.arrow || gesture.current?.drawingContext) gesture.current = null;
    arrowTap.current = null;
  }, [arrowContext]);
  const geometry = (p: Props) => {
    const b = sceneBounds(p.landscape, p.half);
    return { x: b.x + b.width * (1 - 1 / p.zoom) / 2 - p.pan.x, y: b.y + b.height * (1 - 1 / p.zoom) / 2 - p.pan.y, width: b.width / p.zoom, height: b.height / p.zoom };
  };
  const getPoint = (pixel: CourtPoint) => {
    const p = live.current, b = geometry(p), l = layoutRef.current;
    const scale = Math.min(l.width / b.width, l.height / b.height);
    const x = (pixel.x - (l.width - b.width * scale) / 2) / scale + b.x;
    const y = (pixel.y - (l.height - b.height * scale) / 2) / scale + b.y;
    const point = fromScenePoint({ x, y }, p.landscape);
    return { point: limitPoint(point), raw: point, scale, scene: { x, y } };
  };
  const visibleDrawings = (p: Props) => displayCourtDrawings(p.payload, p.stepIndex, p.progress);
  const screenArrowHandles = (p: Props, drawing: CourtDrawing, viewport: { width: number; height: number }, gripOffset?: CourtPoint) => {
    const bounds = geometry(p), scale = Math.min(viewport.width / bounds.width, viewport.height / bounds.height);
    const project = (point: CourtPoint) => { const at = scenePoint(point, p.landscape); return { x: (viewport.width - bounds.width * scale) / 2 + (at.x - bounds.x) * scale, y: (viewport.height - bounds.height * scale) / 2 + (at.y - bounds.y) * scale }; };
    const ball = drawing.startBallId ? visibleDrawings(p).find(item => item.id === drawing.startBallId && item.kind === "ball") : undefined;
    const handles = courtArrowHandles(drawing, p.landscape);
    return handles.map(handle => {
      const origin = project(handle.point);
      const grip = handle.kind !== "start" ? origin : gripOffset ? { x: origin.x + gripOffset.x, y: origin.y + gripOffset.y } : ball ? courtLinkedArrowGrip(origin, project(handles[1].point), (ball.size || 32) * .85 * scale, viewport) : origin;
      return { ...handle, origin, grip, ...(grip !== origin ? { gripOffset: { x: grip.x - origin.x, y: grip.y - origin.y } } : {}) };
    });
  };
  const begin = (pixel: CourtPoint, now: number, multiple = false, duplicate = false) => {
    const p = live.current; if ((p.disabled && !(p.readOnly && p.tool === "pan")) || (p.readOnly && p.tool !== "pan")) { arrowTap.current = null; return; }
    multiple = multiple || !!p.multiple;
    let { point } = getPoint(pixel);
    const { raw, scale, scene } = getPoint(pixel);
    const arrow = selectedArrow(p);
    const hit = ["select", "animate"].includes(p.tool) ? hitCourtLayer(p, scene, scale) : undefined;
    const preferBall = !!arrow?.startBallId && hit?.kind === "ball" && hit.id === arrow.startBallId && hitBallBody(hit, p, scene, scale);
    const arrowHandle = arrow && !preferBall && screenArrowHandles(p, arrow, layoutRef.current).map(handle => {
      return { handle, distance: Math.hypot(handle.grip.x - pixel.x, handle.grip.y - pixel.y) };
    }).filter(candidate => candidate.distance <= 22).sort((a, b) => a.distance - b.distance)[0]?.handle;
    if (arrow && arrowHandle) {
      if (arrowHandle.kind !== "middle") arrowTap.current = null;
      gesture.current = { start: raw, pixel, points: [], ids: [], pan: p.pan, dragged: false, box: false, base: [], duplicate: false, arrow: { ...arrowHandle, drawing: arrow, payload: p.payload, stepIndex: p.stepIndex, stepId: p.payload.timeline.steps[p.stepIndex].id, startedAt: now } };
      return;
    }
    arrowTap.current = null;
    if (p.tool === "select" && p.onSimulationHandle && !preferBall) {
      const handle = getCourtFloorHandles(p.payload, p.stepIndex).map(handle => {
        const at = scenePoint(handle.point, p.landscape);
        return { handle, distance: Math.hypot(at.x - scene.x, at.y - scene.y) * scale };
      }).filter(candidate => candidate.distance <= 22).sort((a, b) => a.distance - b.distance)[0]?.handle;
      if (handle) {
        gesture.current = { start: raw, pixel, points: [], ids: [], pan: p.pan, dragged: false, box: false, base: [], duplicate: false, handle: { ...handle, payload: p.payload, stepIndex: p.stepIndex } };
        return;
      }
    }
    let ids: string[] = [];
    let box = false;
    if (["select", "animate"].includes(p.tool)) {
      if (hit) ids = multiple ? (p.selected.includes(hit.id) ? p.selected.filter(id => id !== hit.id) : [...p.selected, hit.id]) : p.selected.includes(hit.id) ? p.selected : [hit.id];
      box = p.tool === "select" && !hit;
      if (!box) p.onSelect(ids);
    }
    if (p.grid && !["select", "animate", "pan", "pen", "area"].includes(p.tool)) point = snapCourtPoint(point);
    const drawingContext = ["arrow", "curve"].includes(p.tool) ? { payload: p.payload, stepId: p.payload.timeline.steps[p.stepIndex].id, tool: p.tool } : undefined;
    const startBall = drawingContext ? arrowStartBall(p, raw, scale) : undefined;
    if (startBall) point = startBall.points[0];
    gesture.current = { start: point, pixel, points: [point], ids, pan: p.pan, dragged: false, box, base: multiple ? [...p.selected] : [], duplicate: duplicate && p.tool === "select", ...(drawingContext ? { drawingContext } : {}), ...(startBall ? { startBallId: startBall.id } : {}), ...(p.tool === "area" && p.areaMode === "points" ? { area: { payload: p.payload, stepId: p.payload.timeline.steps[p.stepIndex].id } } : {}) };
  };
  const snappedDrag = (point: CourtPoint, g: NonNullable<typeof gesture.current>, p: Props) => {
    if (!p.grid || !g.ids.length || (p.tool === "animate" && p.motionMode !== "straight")) return point;
    const anchor = displayActors(p.payload, p.stepIndex, p.progress).find(a => a.id === g.ids[0])?.point ?? frameDrawings(p.payload, p.stepIndex).find(d => d.id === g.ids[0])?.points[0];
    if (!anchor) return point;
    const destination = snapCourtPoint({ x: anchor.x + point.x - g.start.x, y: anchor.y + point.y - g.start.y });
    return { x: g.start.x + destination.x - anchor.x, y: g.start.y + destination.y - anchor.y };
  };
  const move = (pixel: CourtPoint) => {
    const g = gesture.current, p = live.current; if (!g) return;
    if (!g.dragged && Math.hypot(pixel.x - g.pixel.x, pixel.y - g.pixel.y) < 5) return;
    g.dragged = true;
    arrowTap.current = null;
    if (g.area) return;
    if (g.arrow) {
      if (!validArrowGesture(g.arrow, p)) { gesture.current = null; setArrowPreview(undefined); return; }
      const { raw, scale } = getPoint(pixel);
      const drawing = moveArrow(p, g.arrow.drawing, g.arrow.kind, { x: g.arrow.point.x + raw.x - g.start.x, y: g.arrow.point.y + raw.y - g.start.y }, scale);
      setArrowPreview({ payload: p.payload, stepIndex: p.stepIndex, drawing, kind: g.arrow.kind, gripOffset: g.arrow.gripOffset });
      return;
    }
    if (g.handle) {
      if (p.disabled || p.tool !== "select" || p.payload !== g.handle.payload || p.stepIndex !== g.handle.stepIndex || !p.onSimulationHandle) { gesture.current = null; setHandlePreview(undefined); return; }
      const raw = getPoint(pixel).raw;
      const point = boundCourtFloorHandle(g.handle.kind, { x: g.handle.point.x + raw.x - g.start.x, y: g.handle.point.y + raw.y - g.start.y });
      setHandlePreview({ payload: p.payload, stepIndex: p.stepIndex, kind: g.handle.kind, point });
      return;
    }
    if (g.box) { setMarquee({ start: g.pixel, end: pixel }); return; }
    let { point, scale } = getPoint(pixel);
    if (["select", "animate"].includes(p.tool)) point = snappedDrag(point, g, p);
    else if (p.grid && !["pen", "area", "pan"].includes(p.tool)) point = snapCourtPoint(point);
    if (p.tool === "pan") { p.onPan({ x: g.pan.x + (pixel.x - g.pixel.x) / scale, y: g.pan.y + (pixel.y - g.pixel.y) / scale }); return; }
    if (p.tool === "select" || p.tool === "animate") { if (p.tool === "animate") { if (p.motionMode === "straight") g.points = [g.start, point]; else if (g.points.length < 300) g.points.push(point); } const ids = editableCourtSelection(p.payload, p.stepIndex, g.ids); setPreview(ids.length ? { ids, duplicate: g.duplicate, delta: { x: point.x - g.start.x, y: point.y - g.start.y }, path: p.tool === "animate" ? g.points.map(pt => ({ x: pt.x - g.start.x, y: pt.y - g.start.y })) : undefined } : undefined); return; }
    if (p.tool === "player") return;
    if (["pen", "area"].includes(p.tool)) { if (g.points.length < 500) g.points.push(point); } else g.points = [g.start, point];
    setDraft({ id: "preview", kind: p.tool as DrawingKind, points: [...g.points], color: p.color, dashed: p.dashed, size: 32, rotation: 0, ...(g.startBallId ? { startBallId: g.startBallId } : {}) });
  };
  const end = (pixel?: CourtPoint, canceled = false, now = 0) => {
    const g = gesture.current, p = live.current; if (!g) return;
    gesture.current = null;
    if (g.arrow) {
      setArrowPreview(undefined);
      const previousTap = arrowTap.current;
      arrowTap.current = null;
      if (pixel) arrowClickGuard.current = { pixel, time: now };
      if (!canceled && !g.dragged && pixel && g.arrow.kind === "middle" && validArrowGesture(g.arrow, p) && now - g.arrow.startedAt <= 350 && Math.hypot(pixel.x - g.pixel.x, pixel.y - g.pixel.y) < 5) {
        if (previousTap && previousTap.payload === p.payload && previousTap.stepId === g.arrow.stepId && previousTap.id === g.arrow.drawing.id && now - previousTap.time <= 350 && Math.hypot(pixel.x - previousTap.pixel.x, pixel.y - previousTap.pixel.y) <= 22) {
          const drawing = straightenCourtArrow(g.arrow.drawing);
          if (drawing !== g.arrow.drawing) p.onEditArrow?.(drawing.id, arrowShape(drawing));
        } else arrowTap.current = { payload: p.payload, stepId: g.arrow.stepId, id: g.arrow.drawing.id, pixel, time: now };
      }
      if (!canceled && g.dragged && pixel && validArrowGesture(g.arrow, p)) {
        const { raw, scale } = getPoint(pixel);
        const drawing = moveArrow(p, g.arrow.drawing, g.arrow.kind, { x: g.arrow.point.x + raw.x - g.start.x, y: g.arrow.point.y + raw.y - g.start.y }, scale);
        if (drawing !== g.arrow.drawing) p.onEditArrow?.(drawing.id, arrowShape(drawing));
      }
      return;
    }
    if (g.area) {
      if (canceled || g.dragged || !pixel || Math.hypot(pixel.x - g.pixel.x, pixel.y - g.pixel.y) >= 5 || p.disabled || p.readOnly || p.tool !== "area" || p.areaMode !== "points" || g.area.payload !== p.payload || g.area.stepId !== p.payload.timeline.steps[p.stepIndex]?.id) return;
      const { point, scale } = getPoint(pixel), at = scenePoint(point, p.landscape);
      const points = areaRef.current?.points ?? [];
      const distance = (target: CourtPoint) => { const other = scenePoint(target, p.landscape); return Math.hypot(at.x - other.x, at.y - other.y) * scale; };
      if (points[0] && distance(points[0]) <= 22) { finishArea(); return; }
      if (points.length >= 500 || points.some(target => distance(target) < 5)) return;
      const next = [...points, point]; areaRef.current = { ...g.area, points: next }; setAreaPoints(next); setAreaHover(undefined);
      return;
    }
    if (g.handle) {
      setHandlePreview(undefined);
      if (!canceled && g.dragged && pixel && !p.disabled && p.tool === "select" && p.payload === g.handle.payload && p.stepIndex === g.handle.stepIndex && p.onSimulationHandle) {
        const raw = getPoint(pixel).raw;
        const point = boundCourtFloorHandle(g.handle.kind, { x: g.handle.point.x + raw.x - g.start.x, y: g.handle.point.y + raw.y - g.start.y });
        if (Math.hypot(point.x - g.handle.point.x, point.y - g.handle.point.y) > 1e-8) p.onSimulationHandle({ kind: g.handle.kind, point });
      }
      return;
    }
    const validDrawing = !g.drawingContext || (!p.disabled && !p.readOnly && g.drawingContext.payload === p.payload && g.drawingContext.stepId === p.payload.timeline.steps[p.stepIndex]?.id && g.drawingContext.tool === p.tool);
    if (!canceled && validDrawing) {
      if (g.box) {
        const finish = pixel ? getPoint(pixel).point : g.start;
        const minX = Math.min(g.start.x, finish.x), maxX = Math.max(g.start.x, finish.x);
        const minY = Math.min(g.start.y, finish.y), maxY = Math.max(g.start.y, finish.y);
        const hidden = p.payload.editor?.hiddenLayers ?? [];
        const candidates = [
          ...(hidden.includes("actors") ? [] : displayActors(p.payload, p.stepIndex, p.progress).map(a => ({ id: a.id, points: [a.point] }))),
          ...(hidden.includes("drawings") ? [] : visibleDrawings(p)),
        ];
        const enclosed = g.dragged ? candidates.filter(t => t.points.length && Math.max(...t.points.map(pt => pt.x)) >= minX && Math.min(...t.points.map(pt => pt.x)) <= maxX && Math.max(...t.points.map(pt => pt.y)) >= minY && Math.min(...t.points.map(pt => pt.y)) <= maxY).map(t => t.id) : [];
        p.onSelect([...new Set([...g.base, ...enclosed])]);
      } else if (["select", "animate"].includes(p.tool) && g.dragged && pixel) {
        let point = getPoint(pixel).point;
        point = snappedDrag(point, g, p);
        const ids = editableCourtSelection(p.payload, p.stepIndex, g.ids);
        if (ids.length) p.onMove(ids, { x: point.x - g.start.x, y: point.y - g.start.y }, p.tool === "animate" ? (p.motionMode === "straight" ? [g.start, point] : [...g.points, point]).map(pt => ({ x: pt.x - g.start.x, y: pt.y - g.start.y })) : undefined, g.duplicate);
      } else if (p.tool === "player") p.onAddPlayer(g.start);
      else if (p.tool === "text") { textFinished.current = false; setTextDraft({ point: g.start, value: "", color: p.color, size: 32, rotation: 0 }); }
      else if (!["select", "animate", "pan"].includes(p.tool)) {
        const needsStroke = ["arrow", "curve", "pen", "area"].includes(p.tool);
        if (!needsStroke || g.dragged) p.onDraw({ id: editorId(), kind: p.tool as DrawingKind, points: needsStroke ? [...g.points] : [g.start], color: p.color, dashed: p.dashed, size: 32, rotation: 0, ...(g.startBallId ? { startBallId: g.startBallId } : {}) });
      }
    }
    setDraft(undefined); setPreview(undefined); setMarquee(undefined);
  };
  function validArrowGesture(arrow: NonNullable<NonNullable<typeof gesture.current>["arrow"]>, p: Props) {
    return arrow.payload === p.payload && arrow.stepIndex === p.stepIndex && arrow.stepId === p.payload.timeline.steps[p.stepIndex]?.id && selectedArrow(p)?.id === arrow.drawing.id;
  }
  const handlers = useRef({ begin, move, end, getPoint, finishArea, undoAreaPoint, cancelArea });
  useLayoutEffect(() => { handlers.current = { begin, move, end, getPoint, finishArea, undoAreaPoint, cancelArea }; });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const key = (event: KeyboardEvent) => {
      const p = live.current;
      if (event.key === "Escape") arrowTap.current = null;
      const handleNode = (event.target as HTMLElement)?.closest?.("[id^=court-arrow-handle-]");
      if (event.key === "Escape" && gesture.current?.arrow) { event.preventDefault(); event.stopImmediatePropagation(); handlers.current.end(undefined, true); return; }
      if (handleNode && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const arrow = selectedArrow(p), kind = handleNode.id.replace("court-arrow-handle-", "") as CourtArrowHandleKind;
        const handle = arrow && courtArrowHandles(arrow, p.landscape).find(item => item.kind === kind);
        if (arrow && handle?.kind === "middle" && event.key === "Enter") {
          event.preventDefault(); event.stopImmediatePropagation(); arrowTap.current = null;
          if (!event.repeat && !gesture.current?.arrow) { const next = straightenCourtArrow(arrow); if (next !== arrow) p.onEditArrow?.(arrow.id, arrowShape(next)); }
          return;
        }
        const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const direction = directions[event.key];
        if (arrow && handle && direction) {
          event.preventDefault(); event.stopImmediatePropagation();
          arrowTap.current = null;
          if (gesture.current?.arrow) return;
          const b = geometry(p), l = layoutRef.current, scale = Math.min(l.width / b.width, l.height / b.height), at = scenePoint(handle.point, p.landscape), step = event.shiftKey ? 10 : 2;
          const point = fromScenePoint({ x: at.x + direction[0] * step / scale, y: at.y + direction[1] * step / scale }, p.landscape);
          const next = moveArrow(p, arrow, kind, point, scale, true);
          if (next !== arrow) p.onEditArrow?.(arrow.id, arrowShape(next));
          return;
        }
        if (event.code === "Space") { event.preventDefault(); event.stopImmediatePropagation(); return; }
      }
      if (p.disabled || p.readOnly || p.tool !== "area" || p.areaMode !== "points" || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.closest?.("input,textarea,[contenteditable=true]")) return;
      if (event.key === "Enter" && (event.target as HTMLElement)?.closest?.('#court-area-controls, button, a[href], select, summary, [role="button"], [role="radio"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"], [role="combobox"], [role="option"], [role="menuitem"]')) return;
      if (!["Enter", "Backspace", "Escape"].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "Enter") handlers.current.finishArea(); else if (event.key === "Backspace") handlers.current.undoAreaPoint(); else handlers.current.cancelArea();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = host.current as unknown as HTMLElement;
    if (!node?.addEventListener) return;
    if (node.dataset) node.dataset.hoveredId = "";
    let active: number | null = null;
    let space = false;
    let hand: { pixel: CourtPoint; pan: CourtPoint; scale: number } | null = null;
    const pixel = (e: { clientX: number; clientY: number }) => { const r = node.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const dragover = (e: DragEvent) => {
      if (live.current.disabled || !e.dataTransfer?.types.includes("application/x-goatleta-material")) return;
      updateHover();
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const kind = ["ball", "cone", "target", "ladder"].find(value => e.dataTransfer?.types.includes(`application/x-goatleta-material-${value}`));
      if (!kind) return;
      const p = live.current;
      const { point } = handlers.current.getPoint(pixel(e));
      setDraft({ id: "material-drop-preview", kind: kind as DrawingKind, points: [p.grid ? snapCourtPoint(point) : point], color: kind === "cone" && p.tool !== "cone" ? "#f97316" : p.color, dashed: p.dashed, size: 32, rotation: 0 });
    };
    const drop = (e: DragEvent) => {
      const kind = e.dataTransfer?.getData("application/x-goatleta-material");
      if (live.current.disabled || !kind || !["ball", "cone", "target", "ladder"].includes(kind)) return;
      e.preventDefault();
      const p = live.current;
      setDraft(undefined);
      const { point } = handlers.current.getPoint(pixel(e));
      p.onDraw({ id: editorId(), kind: kind as DrawingKind, points: [p.grid ? snapCourtPoint(point) : point], color: kind === "cone" && p.tool !== "cone" ? "#f97316" : p.color, dashed: p.dashed, size: 32, rotation: 0 });
    };
    node.addEventListener("dragover", dragover);
    node.addEventListener("drop", drop);
    const clearDropPreview = () => setDraft(undefined);
    const leave = (e: DragEvent) => { if (!node.contains(e.relatedTarget as Node | null)) clearDropPreview(); };
    node.addEventListener("dragleave", leave);
    window.addEventListener("dragend", clearDropPreview);
    const editable = (target: EventTarget | null) => (target as HTMLElement)?.closest?.("input,textarea,[contenteditable=true]");
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current?.handle) {
        e.preventDefault(); e.stopImmediatePropagation();
        handlers.current.end(undefined, true); active = null;
        return;
      }
      const handleNode = (e.target as HTMLElement)?.closest?.("[id^=court-floor-handle-]");
      if (handleNode && !editable(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const p = live.current;
        const kind = handleNode.id.endsWith("-hit") ? "hit" : "target";
        const handle = getCourtFloorHandles(p.payload, p.stepIndex).find(h => h.kind === kind);
        const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const direction = directions[e.key];
        if (direction && handle && p.tool === "select" && !p.disabled && p.onSimulationHandle) {
          e.preventDefault(); e.stopImmediatePropagation();
          const b = geometry(p), l = layoutRef.current, scale = Math.min(l.width / b.width, l.height / b.height);
          const at = scenePoint(handle.point, p.landscape), step = e.shiftKey ? 10 : 2;
          const point = fromScenePoint({ x: at.x + direction[0] * step / scale, y: at.y + direction[1] * step / scale }, p.landscape);
          p.onSimulationHandle({ kind, point: boundCourtFloorHandle(kind, point) });
          return;
        }
        if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); return; }
      }
      if (e.code !== "Space" || editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); updateHover(); space = true; node.style.cursor = hand ? "grabbing" : "grab";
    };
    const keyup = (e: KeyboardEvent) => { if (e.code === "Space") { space = false; if (!hand) node.style.cursor = ""; } };
    const down = (e: PointerEvent) => {
      if (e.button === 0 || e.pointerType === "touch") updateHover();
      if (editable(e.target)) return;
      if ((e.target as Element)?.closest?.("#court-selection-actions, #court-area-controls")) return;
      if (e.button !== 0 || active !== null || (live.current.disabled && !(live.current.readOnly && live.current.tool === "pan"))) return;
      (e.target as HTMLElement)?.closest?.<HTMLElement>("[id^=court-floor-handle-], [id^=court-arrow-handle-]")?.focus();
      active = e.pointerId; node.setPointerCapture(e.pointerId); e.preventDefault();
      if (space) {
        const p = live.current, b = sceneBounds(p.landscape, p.half), l = layoutRef.current;
        hand = { pixel: pixel(e), pan: { ...p.pan }, scale: Math.min(l.width / b.width, l.height / b.height) * p.zoom };
        node.style.cursor = "grabbing";
      } else handlers.current.begin(pixel(e), Date.now(), e.shiftKey, e.altKey);
    };
    const doubleClick = (e: MouseEvent) => {
      const guard = arrowClickGuard.current, at = pixel(e);
      if ((e.target as HTMLElement)?.closest?.("[id^=court-arrow-handle-]") || (guard && Date.now() - guard.time <= 350 && Math.hypot(at.x - guard.pixel.x, at.y - guard.pixel.y) <= 22)) { arrowClickGuard.current = null; e.preventDefault(); return; }
      const p = live.current;
      if (p.disabled || p.tool !== "select") return;
      const { scene, scale } = handlers.current.getPoint(pixel(e));
      const target = hitCourtLayer(p, scene, scale);
      if (!target || !("kind" in target) || target.kind !== "text" || target.locked || !target.points[0]) return;
      e.preventDefault();
      textFinished.current = false;
      setTextDraft({ id: target.id, point: target.points[0], value: target.text ?? "", color: target.color, size: target.size || 28, rotation: target.rotation || 0 });
    };
    const move = (e: PointerEvent) => {
      if (active === null) {
        const blockedTarget = (e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable=true],button,[role="button"],#court-selection-actions,#court-area-controls,[id^=court-floor-handle-],[id^=court-arrow-handle-]');
        if (hoverEnabled.current && !space && !gesture.current && !blockedTarget && (e.pointerType === "mouse" || e.pointerType === "pen") && !e.buttons) {
          const p = live.current, { scene, scale } = handlers.current.getPoint(pixel(e));
          const hit = hitCourtLayer(p, scene, scale);
          updateHover(hit?.id, hit ? (editableCourtSelection(p.payload, p.stepIndex, [hit.id]).length ? "grab" : "pointer") : "");
        } else updateHover();
      }
      if (active === null && !live.current.disabled && !live.current.readOnly && live.current.tool === "area" && live.current.areaMode === "points") {
        setAreaHover(handlers.current.getPoint(pixel(e)).point); return;
      }
      if (active === null && !live.current.disabled && live.current.tool === "player") {
        const { point } = handlers.current.getPoint(pixel(e));
        setPlayerPreview(live.current.grid ? snapCourtPoint(point) : point);
        return;
      }
      if (active === null && !live.current.disabled && ["ball", "cone", "target", "ladder"].includes(live.current.tool)) {
        const p = live.current;
        const { point } = handlers.current.getPoint(pixel(e));
        setDraft({ id: "placement-preview", kind: p.tool as DrawingKind, points: [p.grid ? snapCourtPoint(point) : point], color: p.color, dashed: p.dashed, size: 32, rotation: 0 });
        return;
      }
      if (e.pointerId !== active) return;
      e.preventDefault();
      if (hand) { const pt = pixel(e); live.current.onPan({ x: hand.pan.x + (pt.x - hand.pixel.x) / hand.scale, y: hand.pan.y + (pt.y - hand.pixel.y) / hand.scale }); }
      else handlers.current.move(pixel(e));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      if (!hand) handlers.current.end(pixel(e), e.type === "pointercancel", Date.now());
      hand = null; active = null; node.style.cursor = space ? "grab" : "";
    };
    const blur = () => { updateHover(); arrowTap.current = null; if (active !== null && !hand) handlers.current.end(undefined, true); space = false; hand = null; active = null; node.style.cursor = ""; };
    const lostCapture = (e: PointerEvent) => { if (e.pointerId === active) blur(); };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      updateHover();
      e.preventDefault();
      if ((live.current.disabled && !live.current.readOnly) || active !== null) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientHeight : 1);
      const zoom = Math.max(0.75, Math.min(3, live.current.zoom * Math.exp(-delta * 0.002)));
      live.current.onZoom(zoom);
    };
    node.addEventListener("pointerdown", down); node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
    node.addEventListener("lostpointercapture", lostCapture);
    node.addEventListener("dblclick", doubleClick);
    const pointerLeave = () => { updateHover(); if (active === null) { setDraft(undefined); setPlayerPreview(undefined); setAreaHover(undefined); } };
    node.addEventListener("pointerleave", pointerLeave);
    node.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", blur);
    return () => {
      if (node.dataset) node.dataset.hoveredId = "";
      node.removeEventListener("dragover", dragover); node.removeEventListener("drop", drop);
      node.removeEventListener("dragleave", leave); window.removeEventListener("dragend", clearDropPreview);
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up);
      node.removeEventListener("lostpointercapture", lostCapture);
      node.removeEventListener("dblclick", doubleClick);
      node.removeEventListener("pointerleave", pointerLeave);
      node.removeEventListener("wheel", wheel); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur);
    };
  }, []);
  // PanResponder registers callbacks here; refs are read only when a gesture fires.
  /* eslint-disable react-hooks/refs */
  const [native] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: e => handlers.current.begin({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, Date.now()),
    onPanResponderMove: (e, g) => { const start = gesture.current; if (start) handlers.current.move({ x: start.pixel.x + g.dx, y: start.pixel.y + g.dy }); },
    onPanResponderRelease: (e, g) => { const start = gesture.current; if (start) handlers.current.end({ x: start.pixel.x + g.dx, y: start.pixel.y + g.dy }, false, Date.now()); },
    onPanResponderTerminate: () => handlers.current.end(undefined, true),
  }));
  /* eslint-enable react-hooks/refs */
  const b = geometry(props);
  const previewIds = preview ? editableCourtSelection(props.payload, props.stepIndex, preview.ids) : undefined;
  const rendered = arrowPreview && arrowPreview.payload === props.payload && arrowPreview.stepIndex === props.stepIndex && selectedArrow(props)?.id === arrowPreview.drawing.id
    ? changeDrawings(props.payload, props.stepIndex, frameDrawings(props.payload, props.stepIndex).map(d => d.id === arrowPreview.drawing.id ? arrowPreview.drawing : d))
    : handlePreview && handlePreview.payload === props.payload && handlePreview.stepIndex === props.stepIndex && props.tool === "select" && !props.disabled
    ? updateCourtSimulationHandle(props.payload, props.stepIndex, handlePreview)
    : preview?.duplicate && previewIds?.length ? duplicateSelection(props.payload, props.stepIndex, previewIds, preview.delta, props.progress).payload : preview ? moveSelection(props.payload, props.stepIndex, previewIds ?? [], preview.delta, !!preview.path, preview.path, props.progress) : props.payload;
  const scenePayload = props.tool === "player" && playerPreview ? {
    ...rendered,
    actors: [...rendered.actors, { id: "cursor-player-preview", role: "athlete" as const, representation: "person" as const, label: "", color: props.playerPreviewColor ?? "#19c87b", initialPosition: playerPreview }],
    timeline: { ...rendered.timeline, steps: rendered.timeline.steps.map((step, index) => index === props.stepIndex ? {
      ...step, visibleActorIds: [...(step.visibleActorIds ?? rendered.actors.map(actor => actor.id)), "cursor-player-preview"],
      actorPositions: { ...step.actorPositions, "cursor-player-preview": playerPreview },
    } : step) },
  } : rendered;
  const anchors = [
    ...displayActors(rendered, props.stepIndex, props.progress).filter(a => props.selected.includes(a.id)).map(a => a.point),
    ...visibleDrawings({ ...props, payload: rendered }).filter(d => props.selected.includes(d.id)).flatMap(d => d.points),
  ].map(point => scenePoint(point, props.landscape));
  const scale = Math.min(layout.width / b.width, layout.height / b.height);
  const floorHandles = props.onSimulationHandle && props.tool === "select" && !props.disabled ? getCourtFloorHandles(rendered, props.stepIndex) : [];
  const arrow = selectedArrow({ ...props, payload: rendered });
  const arrowHandles = arrow ? screenArrowHandles({ ...props, payload: rendered }, arrow, layout, arrowPreview?.gripOffset) : [];
  const anchorX = anchors.length ? anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length : 0;
  const anchorY = anchors.length ? Math.min(...anchors.map(point => point.y)) : 0;
  const actionLeft = Math.max(72, Math.min(layout.width - 76, (layout.width - b.width * scale) / 2 + (anchorX - b.x) * scale - 56 * scale - 72));
  const actionTop = Math.max(props.selectionTopInset ?? 8, Math.min(layout.height - (props.selectionBottomInset ?? 8) - 176, (layout.height - b.height * scale) / 2 + (anchorY - b.y) * scale - 88));
  const finishText = (save: boolean) => {
    if (!textDraft || textFinished.current) return;
    textFinished.current = true;
    setTextDraft(undefined);
    const value = textDraft.value.trim();
    if (!save || !value || props.disabled || (textDraft.id && !editableCourtSelection(props.payload, props.stepIndex, [textDraft.id]).length)) return;
    if (textDraft.id) props.onEditText(textDraft.id, value);
    else props.onDraw({ id: editorId(), kind: "text", points: [textDraft.point], color: textDraft.color, dashed: props.dashed, size: textDraft.size, rotation: textDraft.rotation, text: value });
  };
  const textPoint = textDraft ? scenePoint(textDraft.point, props.landscape) : null;
  const textFontSize = (textDraft?.size ?? 32) * scale;
  const textWidth = textDraft ? Math.max(36, Math.min(layout.width - 16, Math.ceil(measureCourtText(textDraft.value || "Texto", textFontSize) + textFontSize))) : 0;
  const textHeight = Math.ceil(textFontSize * 1.45);
  const textLeft = textPoint ? Math.max(8, Math.min(layout.width - textWidth - 8, (layout.width - b.width * scale) / 2 + (textPoint.x - b.x) * scale - textWidth / 2)) : 0;
  const textTop = textPoint ? Math.max(8, Math.min(layout.height - textHeight - 8, (layout.height - b.height * scale) / 2 + (textPoint.y - b.y) * scale - textFontSize * 1.1)) : 0;
  const areaDraft: CourtDrawing | undefined = pointsMode && areaPoints.length ? { id: "area-points-preview", kind: "area", points: areaHover ? [...areaPoints, areaHover] : areaPoints, color: props.color, dashed: props.dashed, size: 32, rotation: 0 } : undefined;
  const linking = arrowPreview?.kind === "start" && arrowPreview.drawing.startBallId ? arrowPreview.drawing : draft?.startBallId ? draft : undefined;
  const linkingPoint = linking?.points[0] ? scenePoint(linking.points[0], props.landscape) : undefined;
  const linkingX = linkingPoint ? (layout.width - b.width * scale) / 2 + (linkingPoint.x - b.x) * scale : 0;
  const linkingY = linkingPoint ? (layout.height - b.height * scale) / 2 + (linkingPoint.y - b.y) * scale : 0;
  return <View ref={host} {...(Platform.OS === "web" ? {} : native.panHandlers)} onLayout={e => { const next = e.nativeEvent.layout; layoutRef.current = next; setLayout(next); }} style={{ flex: 1, backgroundColor: "#1676ac", ...(Platform.OS === "web" ? { touchAction: "none", userSelect: "none", ...(props.tool === "text" && !props.disabled ? { cursor: "text" } : {}) } as object : {}) }}>
    <View pointerEvents="none" style={{ flex: 1 }}><CourtEditorScene payload={scenePayload} stepIndex={props.stepIndex} landscape={props.landscape} selected={props.selected} hoveredId={hoveredId} progress={props.progress} rotationPreview={props.rotationPreview} previewIds={previewIds} previewMotion={!!preview?.path} draft={areaDraft ?? (draft?.id === "placement-preview" && draft.kind !== props.tool ? undefined : draft)} grid={props.grid} half={props.half} plain={props.plain} editingTextId={textDraft?.id} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`} /></View>
    {pointsMode ? <>
      {areaPoints.map((point, index) => {
        const at = scenePoint(point, props.landscape), diameter = index === 0 ? 14 : 10;
        return <View key={index} testID={`court-area-vertex-${index}`} pointerEvents="none" style={{ position: "absolute", left: (layout.width - b.width * scale) / 2 + (at.x - b.x) * scale - diameter / 2, top: (layout.height - b.height * scale) / 2 + (at.y - b.y) * scale - diameter / 2, width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 2, borderColor: "#fff", backgroundColor: index === 0 ? colors.primaryBg : props.color }} />;
      })}
      <View nativeID="court-area-controls" accessibilityLabel="Área por pontos" onStartShouldSetResponder={() => true} style={{ position: "absolute", top: props.selectionTopInset ?? 8, left: 72, right: 12, maxWidth: 330, padding: spacing.xs, gap: spacing.xs / 2, borderRadius: radius.internal, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 12 }}>{!areaPoints.length ? "Toque para marcar os pontos da área" : areaPoints.length < 3 ? `${areaPoints.length} ${areaPoints.length === 1 ? "ponto" : "pontos"} · marque mais ${3 - areaPoints.length} ${areaPoints.length === 2 ? "ponto" : "pontos"}` : validArea(areaPoints) ? `${areaPoints.length} pontos · toque no início para fechar` : "Marque um ponto fora da linha para formar a área"}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs / 2 }}>
          <CourtActionButton label="Fechar área" icon="checkmark" text compact touchTarget disabled={!validArea(areaPoints)} onPress={finishArea} />
          <CourtActionButton label="Voltar um ponto" icon="restore" compact touchTarget disabled={!areaPoints.length} onPress={undoAreaPoint} />
          <CourtActionButton label="Cancelar área" icon="close" compact touchTarget onPress={cancelArea} />
        </View>
      </View>
    </> : null}
    {floorHandles.map(handle => {
      const at = scenePoint(handle.point, props.landscape);
      const x = (layout.width - b.width * scale) / 2 + (at.x - b.x) * scale;
      const y = (layout.height - b.height * scale) / 2 + (at.y - b.y) * scale;
      if (x < 0 || y < 0 || x > layout.width || y > layout.height) return null;
      return <View key={handle.kind} pointerEvents={Platform.OS === "web" ? "auto" : "none"} nativeID={`court-floor-handle-${handle.kind}`} accessible accessibilityRole="button" accessibilityLabel={handle.label} accessibilityHint={Platform.OS === "web" ? "Arraste para ajustar. Use as setas do teclado para mover." : "Arraste para ajustar."} {...(Platform.OS === "web" ? { tabIndex: 0 } : {})} style={{ position: "absolute", left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", ...(Platform.OS === "web" ? { cursor: handlePreview?.kind === handle.kind ? "grabbing" : "grab", touchAction: "none" } as object : {}) }}>
        <View pointerEvents="none" style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#b9e0ff", backgroundColor: "#1676ac", alignItems: "center", justifyContent: "center" }}><View style={{ width: handle.kind === "hit" ? 6 : 9, height: handle.kind === "hit" ? 6 : 9, borderRadius: 5, borderWidth: handle.kind === "hit" ? 0 : 1, borderColor: "#b9e0ff", backgroundColor: handle.kind === "hit" ? "#b9e0ff" : "transparent" }} /></View>
      </View>;
    })}
    {arrowHandles.map(handle => {
      const { x, y } = handle.grip;
      if (x < 0 || y < 0 || x > layout.width || y > layout.height) return null;
      const linked = handle.kind === "start" && !!arrow?.startBallId;
      const hint = handle.kind === "middle" ? (Platform.OS === "web" ? "Arraste para curvar. Dois cliques ou Enter para endireitar." : "Arraste para curvar. Dois toques para endireitar.") : handle.kind === "start" ? `${linked ? "Ligado à bola. Arraste esta corrente para soltar; arraste a bola para mover as ligações." : "Arraste até a bola para ligar o início."}${Platform.OS === "web" ? " Use as setas do teclado para mover livremente." : ""}` : (Platform.OS === "web" ? "Arraste para ajustar. Use as setas do teclado para mover." : "Arraste para ajustar.");
      const length = Math.hypot(x - handle.origin.x, y - handle.origin.y);
      return <Fragment key={handle.kind}>
        {handle.gripOffset ? <View pointerEvents="none" testID="court-arrow-start-leader" style={{ position: "absolute", left: (x + handle.origin.x - length) / 2, top: (y + handle.origin.y) / 2 - .5, width: length, height: 1, backgroundColor: "#fff", opacity: .65, transform: [{ rotate: `${Math.atan2(y - handle.origin.y, x - handle.origin.x) * 180 / Math.PI}deg` }] }} /> : null}
        <View pointerEvents={Platform.OS === "web" ? "auto" : "none"} nativeID={`court-arrow-handle-${handle.kind}`} accessible accessibilityRole="button" accessibilityLabel={handle.label} accessibilityHint={hint} {...(Platform.OS === "web" ? { tabIndex: 0 } : {})} style={{ position: "absolute", left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", ...(Platform.OS === "web" ? { cursor: arrowPreview?.kind === handle.kind ? "grabbing" : "grab", touchAction: "none" } as object : {}) }}>
        <View pointerEvents="none" style={{ width: 14, height: 14, borderRadius: handle.kind === "middle" ? 3 : 7, borderWidth: 1.5, borderColor: "#fff", backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center", shadowColor: "#102138", shadowOpacity: .18, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } }}>{linked ? <CourtToolIcon name="link" color={colors.primaryText} size={10} /> : null}</View>
        </View>
      </Fragment>;
    })}
    {linkingPoint ? <View pointerEvents="none" testID="court-arrow-ball-snap" style={{ position: "absolute", left: Math.max(8, Math.min(layout.width - 176, linkingX - 84)), top: Math.max(props.selectionTopInset ?? 8, linkingY - 52), paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <CourtToolIcon name="link" color={colors.primaryBg} size={14} /><Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 12 }}>Solte para ligar à bola</Text>
    </View> : null}
    {marquee ? <View pointerEvents="none" style={{ position: "absolute", left: Math.min(marquee.start.x, marquee.end.x), top: Math.min(marquee.start.y, marquee.end.y), width: Math.abs(marquee.end.x - marquee.start.x), height: Math.abs(marquee.end.y - marquee.start.y), borderWidth: 1.5, borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.14)" }} /> : null}
    {textDraft ? <TextInput autoFocus accessibilityLabel="Texto da anotação" placeholder="Texto" placeholderTextColor={`${textDraft.color}99`} selectionColor={textDraft.color} value={textDraft.value} onChangeText={value => setTextDraft(current => current ? { ...current, value } : current)} onSubmitEditing={() => finishText(true)} onBlur={() => finishText(true)} onKeyPress={event => { if (event.nativeEvent.key === "Escape") finishText(false); }} returnKeyType="done" style={{ position: "absolute", left: textLeft, top: textTop, width: textWidth, height: textHeight, padding: 0, margin: 0, borderWidth: 0, backgroundColor: "transparent", color: textDraft.color, fontFamily: COURT_TEXT_FONT, fontWeight: "600", fontSize: textFontSize, lineHeight: textFontSize * 1.2, textAlign: "center", transform: [{ rotate: `${textDraft.rotation}deg` }], ...(Platform.OS === "web" ? { cursor: "text", userSelect: "text", outline: "none", boxShadow: "none" } as object : {}) }} /> : null}
    <CourtSelectionActions visible={!!anchors.length && !!props.selectionActions && !preview && !arrowPreview && !textDraft && !pointsMode} left={actionLeft} top={actionTop}>{props.selectionActions}</CourtSelectionActions>
  </View>;
}
