import { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, View } from "react-native";
import { CourtEditorScene, displayActors, fromScenePoint, sceneBounds, scenePoint } from "./CourtEditorScene";
import { editorId, frameDrawings, moveSelection, snapCourtPoint, limitPoint, type CourtDrawing, type DrawingKind } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualPayload } from "../../core/visual-court";

export type CourtTool = "select" | "pan" | "player" | "animate" | DrawingKind;
export type CourtEditorCanvasProps = {
  payload: CourtVisualPayload; stepIndex: number; landscape: boolean; tool: CourtTool; motionMode?: "free" | "straight"; selected: string[]; multiple?: boolean;
  onSelect: (ids: string[]) => void; onMove: (ids: string[], delta: CourtPoint, path?: CourtPoint[]) => void; onDraw: (d: CourtDrawing) => void;
  onAddPlayer: (p: CourtPoint) => void; color: string; dashed: boolean; grid: boolean; progress?: number;
  zoom: number; pan: CourtPoint; onPan: (p: CourtPoint) => void; onZoom: (zoom: number) => void; half: boolean; plain: boolean; disabled?: boolean;
};
type Props = CourtEditorCanvasProps;
export function CourtEditorCanvas(props: Props) {
  const host = useRef<View>(null);
  const live = useRef(props);
  useEffect(() => { live.current = props; });
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const layoutRef = useRef(layout);
  const [marquee, setMarquee] = useState<{ start: CourtPoint; end: CourtPoint }>();
  const [draft, setDraft] = useState<CourtDrawing>();
  const [preview, setPreview] = useState<{ ids: string[]; delta: CourtPoint; path?: CourtPoint[] }>();
  const gesture = useRef<{ start: CourtPoint; pixel: CourtPoint; points: CourtPoint[]; ids: string[]; pan: CourtPoint; dragged: boolean; box: boolean; base: string[] } | null>(null);
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
    return { point: limitPoint(point), scale, scene: { x, y } };
  };
  const begin = (pixel: CourtPoint, multiple = false) => {
    const p = live.current; if (p.disabled) return;
    multiple = multiple || !!p.multiple;
    let { point } = getPoint(pixel);
    const { scale, scene } = getPoint(pixel);
    let ids: string[] = [];
    let box = false;
    if (["select", "animate"].includes(p.tool)) {
      const hidden = p.payload.editor?.hiddenLayers ?? [];
      const targets = [
        ...(hidden.includes("actors") ? [] : displayActors(p.payload, p.stepIndex, p.progress).map(a => ({ id: a.id, points: [a.point] }))),
        ...(hidden.includes("drawings") ? [] : frameDrawings(p.payload, p.stepIndex)),
      ];
      const hit = [...targets].reverse().find(t => {
        let points = t.points.map(pt => scenePoint(pt, p.landscape));
        if ("kind" in t && t.kind === "curve" && points.length > 1) {
          const a = points[0], b = points[points.length - 1];
          const c = { x: (a.x + b.x) / 2 + 65, y: (a.y + b.y) / 2 - 65 };
          points = Array.from({ length: 17 }, (_, i) => { const u = i / 16; return { x: (1-u)**2*a.x + 2*(1-u)*u*c.x + u*u*b.x, y: (1-u)**2*a.y + 2*(1-u)*u*c.y + u*u*b.y }; });
        }
        const tolerance = Math.max("kind" in t ? 44 : 56, 22 / scale);
        return points.some((a, i) => {
          const b = points[Math.min(i + 1, points.length - 1)], dx = b.x-a.x, dy = b.y-a.y;
          const u = Math.max(0, Math.min(1, ((scene.x-a.x)*dx + (scene.y-a.y)*dy) / (dx*dx+dy*dy || 1)));
          return Math.hypot(scene.x-a.x-u*dx, scene.y-a.y-u*dy) <= tolerance;
        });
      });
      if (hit) ids = multiple ? (p.selected.includes(hit.id) ? p.selected.filter(id => id !== hit.id) : [...p.selected, hit.id]) : p.selected.includes(hit.id) ? p.selected : [hit.id];
      box = p.tool === "select" && !hit;
      if (!box) p.onSelect(ids);
    }
    if (p.grid && !["select", "animate", "pan", "pen", "area"].includes(p.tool)) point = snapCourtPoint(point);
    gesture.current = { start: point, pixel, points: [point], ids, pan: p.pan, dragged: false, box, base: multiple ? [...p.selected] : [] };
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
    if (g.box) { setMarquee({ start: g.pixel, end: pixel }); return; }
    let { point, scale } = getPoint(pixel);
    if (["select", "animate"].includes(p.tool)) point = snappedDrag(point, g, p);
    else if (p.grid && !["pen", "area", "pan"].includes(p.tool)) point = snapCourtPoint(point);
    if (p.tool === "pan") { p.onPan({ x: g.pan.x + (pixel.x - g.pixel.x) / scale, y: g.pan.y + (pixel.y - g.pixel.y) / scale }); return; }
    if (p.tool === "select" || p.tool === "animate") { if (p.tool === "animate") { if (p.motionMode === "straight") g.points = [g.start, point]; else if (g.points.length < 300) g.points.push(point); } setPreview({ ids: g.ids, delta: { x: point.x - g.start.x, y: point.y - g.start.y }, path: p.tool === "animate" ? g.points.map(pt => ({ x: pt.x - g.start.x, y: pt.y - g.start.y })) : undefined }); return; }
    if (p.tool === "player") return;
    if (["pen", "area"].includes(p.tool)) { if (g.points.length < 500) g.points.push(point); } else g.points = [g.start, point];
    setDraft({ id: "preview", kind: p.tool as DrawingKind, points: [...g.points], color: p.color, dashed: p.dashed, size: 32, rotation: 0 });
  };
  const end = (pixel?: CourtPoint, canceled = false) => {
    const g = gesture.current, p = live.current; if (!g) return;
    gesture.current = null;
    if (!canceled) {
      if (g.box) {
        const finish = pixel ? getPoint(pixel).point : g.start;
        const minX = Math.min(g.start.x, finish.x), maxX = Math.max(g.start.x, finish.x);
        const minY = Math.min(g.start.y, finish.y), maxY = Math.max(g.start.y, finish.y);
        const hidden = p.payload.editor?.hiddenLayers ?? [];
        const candidates = [
          ...(hidden.includes("actors") ? [] : displayActors(p.payload, p.stepIndex, p.progress).map(a => ({ id: a.id, points: [a.point] }))),
          ...(hidden.includes("drawings") ? [] : frameDrawings(p.payload, p.stepIndex)),
        ];
        const enclosed = g.dragged ? candidates.filter(t => t.points.length && Math.max(...t.points.map(pt => pt.x)) >= minX && Math.min(...t.points.map(pt => pt.x)) <= maxX && Math.max(...t.points.map(pt => pt.y)) >= minY && Math.min(...t.points.map(pt => pt.y)) <= maxY).map(t => t.id) : [];
        p.onSelect([...new Set([...g.base, ...enclosed])]);
      } else if (["select", "animate"].includes(p.tool) && g.dragged && pixel) {
        let point = getPoint(pixel).point;
        point = snappedDrag(point, g, p);
        p.onMove(g.ids, { x: point.x - g.start.x, y: point.y - g.start.y }, p.tool === "animate" ? (p.motionMode === "straight" ? [g.start, point] : [...g.points, point]).map(pt => ({ x: pt.x - g.start.x, y: pt.y - g.start.y })) : undefined);
      } else if (p.tool === "player") p.onAddPlayer(g.start);
      else if (!["select", "animate", "pan"].includes(p.tool)) {
        const needsStroke = ["arrow", "curve", "pen", "area"].includes(p.tool);
        if (!needsStroke || g.dragged) p.onDraw({ id: editorId(), kind: p.tool as DrawingKind, points: needsStroke ? [...g.points] : [g.start], color: p.color, dashed: p.dashed, size: 32, rotation: 0, text: p.tool === "text" ? "Anotação" : undefined });
      }
    }
    setDraft(undefined); setPreview(undefined); setMarquee(undefined);
  };
  const handlers = useRef({ begin, move, end });
  useEffect(() => { handlers.current = { begin, move, end }; });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = host.current as unknown as HTMLElement;
    if (!node?.addEventListener) return;
    let active: number | null = null;
    let space = false;
    let hand: { pixel: CourtPoint; pan: CourtPoint; scale: number } | null = null;
    const pixel = (e: PointerEvent) => { const r = node.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const editable = (target: EventTarget | null) => (target as HTMLElement)?.closest?.("input,textarea,[contenteditable=true]");
    const keydown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); space = true; node.style.cursor = hand ? "grabbing" : "grab";
    };
    const keyup = (e: KeyboardEvent) => { if (e.code === "Space") { space = false; if (!hand) node.style.cursor = ""; } };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || active !== null || live.current.disabled) return;
      active = e.pointerId; node.setPointerCapture(e.pointerId); e.preventDefault();
      if (space) {
        const p = live.current, b = sceneBounds(p.landscape, p.half), l = layoutRef.current;
        hand = { pixel: pixel(e), pan: { ...p.pan }, scale: Math.min(l.width / b.width, l.height / b.height) * p.zoom };
        node.style.cursor = "grabbing";
      } else handlers.current.begin(pixel(e), e.shiftKey);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      e.preventDefault();
      if (hand) { const pt = pixel(e); live.current.onPan({ x: hand.pan.x + (pt.x - hand.pixel.x) / hand.scale, y: hand.pan.y + (pt.y - hand.pixel.y) / hand.scale }); }
      else handlers.current.move(pixel(e));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      if (!hand) handlers.current.end(pixel(e), e.type === "pointercancel");
      hand = null; active = null; node.style.cursor = space ? "grab" : "";
    };
    const blur = () => { if (active !== null && !hand) handlers.current.end(undefined, true); space = false; hand = null; active = null; node.style.cursor = ""; };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (live.current.disabled || active !== null) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientHeight : 1);
      const zoom = Math.max(0.75, Math.min(3, live.current.zoom * Math.exp(-delta * 0.002)));
      live.current.onZoom(zoom);
    };
    node.addEventListener("pointerdown", down); node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
    node.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", blur);
    return () => {
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up);
      node.removeEventListener("wheel", wheel); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur);
    };
  }, []);
  // PanResponder registers callbacks here; refs are read only when a gesture fires.
  /* eslint-disable react-hooks/refs */
  const [native] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: e => handlers.current.begin({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }),
    onPanResponderMove: (e, g) => { const start = gesture.current; if (start) handlers.current.move({ x: start.pixel.x + g.dx, y: start.pixel.y + g.dy }); },
    onPanResponderRelease: (e, g) => { const start = gesture.current; if (start) handlers.current.end({ x: start.pixel.x + g.dx, y: start.pixel.y + g.dy }); },
    onPanResponderTerminate: () => handlers.current.end(undefined, true),
  }));
  /* eslint-enable react-hooks/refs */
  const b = geometry(props);
  const rendered = preview?.path ? moveSelection(props.payload, props.stepIndex, preview.ids, preview.delta, true, preview.path) : preview ? (() => {
    const p = props.payload, s = p.timeline.steps[props.stepIndex];
    return { ...p, timeline: { steps: p.timeline.steps.map((step, i) => i === props.stepIndex ? { ...s, actorPositions: { ...s.actorPositions, ...Object.fromEntries(preview.ids.filter(id => !p.editor?.actorMeta[id]?.locked).map(id => { const a = s.actorPositions[id] ?? p.actors.find(a => a.id === id)?.initialPosition ?? { x: 0.5, y: 0.5 }; return [id, limitPoint({ x: a.x + preview.delta.x, y: a.y + preview.delta.y })]; })) } } : step) }, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [s.id]: frameDrawings(p, props.stepIndex).map(d => preview.ids.includes(d.id) && !d.locked ? { ...d, points: d.points.map(a => limitPoint({ x: a.x + preview.delta.x, y: a.y + preview.delta.y })) } : d) } } };
  })() : props.payload;
  return <View ref={host} {...(Platform.OS === "web" ? {} : native.panHandlers)} onLayout={e => { const next = e.nativeEvent.layout; layoutRef.current = next; setLayout(next); }} style={{ flex: 1, backgroundColor: "#1676ac", ...(Platform.OS === "web" ? { touchAction: "none", userSelect: "none" } as object : {}) }}>
    <View pointerEvents="none" style={{ flex: 1 }}><CourtEditorScene payload={rendered} stepIndex={props.stepIndex} landscape={props.landscape} selected={props.selected} progress={props.progress} previewIds={preview?.ids} previewMotion={!!preview?.path} draft={draft} grid={props.grid} half={props.half} plain={props.plain} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`} /></View>
    {marquee ? <View pointerEvents="none" style={{ position: "absolute", left: Math.min(marquee.start.x, marquee.end.x), top: Math.min(marquee.start.y, marquee.end.y), width: Math.abs(marquee.end.x - marquee.start.x), height: Math.abs(marquee.end.y - marquee.start.y), borderWidth: 1.5, borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.14)" }} /> : null}
  </View>;
}
