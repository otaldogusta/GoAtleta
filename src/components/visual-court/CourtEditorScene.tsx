import type { ReactNode } from "react";
import { Platform } from "react-native";
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { actorPoint, pointAlong, motionTrail, type CourtDrawing } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualPayload } from "../../core/visual-court";
import { courtOpponentIdentity, receptionPlayerIdentity, sampleCourtSimulation } from "../../core/court-simulation";
import { middleAttackColor } from "../../core/court-simulation/attack-settings.js";
import { displayCourtDrawings, simulationFloorPoint, type DisplayedCourtDrawing } from "../../core/court-simulation-display";
import { buildCourtPerspectiveSimulation } from "../../core/court-perspective-guides";
import { resolveCourtLayers } from "../../core/court-layers";

import { CourtVolleyballGlyph } from "./CourtVolleyballGlyph";
import { COURT_TEXT_FONT } from "./court-text-layout";
import { courtCurveControl } from "./court-arrow-geometry";
import { courtHoverColor } from "./court-hover-color";

export const COURT_FLOOR = "#1676ac";
const PERSON_BODY_PATH = "M -12 -13 Q -20 -13 -24 -4 L -34 15 Q -37 22 -30 25 Q -24 27 -21 20 L -15 7 L -15 24 L -19 45 Q -20 53 -12 53 Q -6 53 -5 46 L 0 25 L 5 46 Q 6 53 12 53 Q 20 53 19 45 L 15 24 L 15 7 L 21 20 Q 24 27 30 25 Q 37 22 34 15 L 24 -4 Q 20 -13 12 -13 Z";
const CONE_BODY_PATH = "M -14 10 L -3 -21 Q 0 -27 3 -21 L 14 10 Z";
const LADDER_SIDES = [-1, 1], LADDER_RUNGS = [-1.65, -0.825, 0, 0.825, 1.65];
export const scenePoint = (p: CourtPoint, landscape: boolean) => landscape ? { x: (1 - p.y) * 1800, y: p.x * 900 } : { x: p.x * 900, y: p.y * 1800 };
export const fromScenePoint = (p: CourtPoint, landscape: boolean): CourtPoint => landscape ? { x: p.y / 900, y: 1 - p.x / 1800 } : { x: p.x / 900, y: p.y / 1800 };
export function sceneBounds(landscape: boolean, half = false) {
  return landscape ? { x: half ? -160 : -160, y: -200, width: half ? 1220 : 2120, height: 1300 } : { x: -200, y: half ? 740 : -160, width: 1300, height: half ? 1220 : 2120 };
}
export function displayActors(p: CourtVisualPayload, index: number, progress?: number) {
  const s = p.timeline.steps[index];
  const sample = sampleCourtSimulation(p, index, progress ?? 0);
  return p.actors.filter(a => !p.editor?.actorMeta[a.id]?.hidden && (!s.visibleActorIds || s.visibleActorIds.includes(a.id)) && (!sample || !s.simulation?.actorIds.includes(a.id) || sample.visibleIds.includes(a.id))).map(a => {
    const simulated = sample?.actors.find(item => item.id === a.id);
    const trajectory = (s.trajectories ?? s.transitions)?.find(t => t.actorId === a.id);
    const identity = receptionPlayerIdentity(sample?.config, a.id);
    const opponent = courtOpponentIdentity(sample?.config, a);
    const roleLabel = Boolean(opponent || (identity && sample?.config.system !== "6-0"));
    return { ...a, label: identity?.label ?? opponent?.label ?? a.label, receptionRole: roleLabel, color: identity?.color ?? opponent?.color ?? middleAttackColor(sample?.config, a.id) ?? a.color, point: simulated ? simulationFloorPoint(simulated.position) : typeof progress === "number" && trajectory?.points.length ? pointAlong(trajectory.points, progress) : actorPoint(p, index, a.id) };
  });
}
const interpolate = (a: CourtPoint, b: CourtPoint, t: number): CourtPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function tracePrefix(points: CourtPoint[], progress: number): CourtPoint[] {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  let remaining = lengths.reduce((total, length) => total + length, 0) * progress;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (length > remaining) return [...points.slice(0, index + 1), interpolate(points[index], points[index + 1], remaining / length)];
    if (length === remaining && length > 0) return points.slice(0, index + 2);
    remaining -= length;
  }
  return points;
}

function DrawObject({ drawing: d, landscape, selected = false, hovered = false }: { drawing: DisplayedCourtDrawing; landscape: boolean; selected?: boolean; hovered?: boolean }) {
  const color = hovered ? courtHoverColor(d.color) : d.color;
  let points = d.points.map(p => scenePoint(p, landscape));
  const first = points[0]; if (!first || d.traceProgress === 0) return null;
  let last = points[points.length - 1];
  let control = d.kind === "curve" && points.length > 1 ? courtCurveControl(d, points) : undefined;
  if (d.traceProgress !== undefined && d.traceProgress < 1 && points.length > 1) {
    if (control) {
      const back = interpolate(control, last, d.traceProgress);
      control = interpolate(first, control, d.traceProgress);
      last = interpolate(control, back, d.traceProgress);
    } else {
      points = tracePrefix(points, d.traceProgress);
      last = points[points.length - 1];
    }
  }
  const path = control
    ? `M ${first.x} ${first.y} Q ${control.x} ${control.y} ${last.x} ${last.y}`
    : points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const size = d.size || 28;
  const previous = control && (d.traceProgress !== undefined || d.curveMode === "through-point" && points.length === 3) ? control : points[Math.max(0, points.length - 2)];
  const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
  const headSize = d.traceProgress === undefined ? 25 : Math.min(25, Math.hypot(last.x - first.x, last.y - first.y));
  const head = `${last.x},${last.y} ${last.x - headSize * Math.cos(angle - 0.5)},${last.y - headSize * Math.sin(angle - 0.5)} ${last.x - headSize * Math.cos(angle + 0.5)},${last.y - headSize * Math.sin(angle + 0.5)}`;
  const outlinePath = path + (d.kind === "area" ? " Z" : "");
  // Keep the underlay in the object's own transform and leave the authored paint intact.
  // The dark outer edge also makes white text and white strokes visibly selectable.
  const halo = (geometry: ReactNode, width = 8, scale = 1, subtle = false) => selected ? <G pointerEvents="none" {...(Platform.OS === "web" ? {} : { accessible: false })} aria-hidden>
    <G fill="none" stroke="#102138" strokeOpacity={subtle ? 0.4 : 1} strokeWidth={(width + (subtle ? 2 : 4)) / scale} strokeLinecap="round" strokeLinejoin="round">{geometry}</G>
    <G fill="none" stroke="#fff" strokeWidth={width / scale} strokeLinecap="round" strokeLinejoin="round">{geometry}</G>
  </G> : null;
  return <G>

    {["arrow", "curve", "pen", "area"].includes(d.kind) ? <>
      {halo(<><Path d={outlinePath} strokeDasharray={d.dashed ? "15 12" : undefined} />{d.kind === "arrow" || d.kind === "curve" ? <Polygon points={head} /> : null}</>, 7, 1, true)}
      <Path d={outlinePath} fill={d.kind === "area" ? color : "none"} fillOpacity={hovered ? 0.28 : 0.2} stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={d.dashed ? "15 12" : undefined} />
      {d.kind === "arrow" || d.kind === "curve" ? <Polygon points={head} fill={color} /> : null}
    </> : <G transform={`rotate(${d.rotation || 0} ${first.x} ${first.y})`}>
      {d.kind === "text" ? <>
        {halo(<SvgText {...(Platform.OS === "web" ? {} : { accessible: false })} aria-hidden x={first.x} y={first.y} fontFamily={COURT_TEXT_FONT} fontSize={size} fontWeight="600" textAnchor="middle">{d.text || "Anotação"}</SvgText>, Math.max(1.5, Math.min(4, size * .1)))}
        <SvgText x={first.x} y={first.y} fill={color} fontFamily={COURT_TEXT_FONT} fontSize={size} fontWeight="600" textAnchor="middle">{d.text || "Anotação"}</SvgText>
      </> : null}
      {d.kind === "ball" ? <G transform={`translate(${first.x} ${first.y}) scale(${size * 0.085})`}>
        {halo(<Circle r={10} />, 8, size * .085)}
        <CourtVolleyballGlyph />
        {hovered ? <Circle r={10} fill="#b9e0ff" fillOpacity={0.22} pointerEvents="none" /> : null}
      </G> : null}
      {d.kind === "cone" ? <G transform={`translate(${first.x} ${first.y}) scale(${size / 24})`}>
        {halo(<><Path d={CONE_BODY_PATH} /><Rect x={-17} y={8} width={34} height={5} rx={2.5} /></>, 8, size / 24)}
        <Path d={CONE_BODY_PATH} fill={color} stroke="#10213880" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M -6 -10 H 6 M -10 1 H 10" fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={4} />
        <Rect x={-17} y={8} width={34} height={5} rx={2.5} fill={color} stroke="#10213880" strokeWidth={1.5} />
      </G> : null}
      {d.kind === "target" ? <>{halo(<Circle cx={first.x} cy={first.y} r={size} />, 9)}<Circle cx={first.x} cy={first.y} r={size} fill={color} fillOpacity={hovered ? 0.2 : 0.12} stroke={color} strokeWidth={4} /><Circle cx={first.x} cy={first.y} r={size / 2} fill="none" stroke={color} strokeWidth={3} /><Circle cx={first.x} cy={first.y} r={size / 9} fill={color} /></> : null}
      {d.kind === "ladder" ? <G>
        {halo(<>
          {LADDER_SIDES.map(side => <Rect key={`side-${side}`} x={first.x + side * size * 0.62 - size * 0.07} y={first.y - size * 2} width={size * 0.14} height={size * 4} rx={size * 0.06} />)}
          {LADDER_RUNGS.map(offset => <Rect key={`rung-${offset}`} x={first.x - size * 0.65} y={first.y + offset * size - size * 0.08} width={size * 1.3} height={size * 0.16} rx={size * 0.05} />)}
        </>)}
        {LADDER_SIDES.map(side => <Rect key={side} x={first.x + side * size * 0.62 - size * 0.07} y={first.y - size * 2} width={size * 0.14} height={size * 4} rx={size * 0.06} fill={hovered ? courtHoverColor("#263445") : "#263445"} />)}
        {LADDER_RUNGS.map(offset => <Rect key={offset} x={first.x - size * 0.65} y={first.y + offset * size - size * 0.08} width={size * 1.3} height={size * 0.16} rx={size * 0.05} fill={color} stroke="#10213880" strokeWidth={1.5} />)}
      </G> : null}
    </G>}
  </G>;
}
export type CourtSceneProps = {
  payload: CourtVisualPayload; stepIndex: number; landscape: boolean;
  /** Transient canvas feedback; omitted by thumbnails and export callers. */
  hoveredId?: string;
  selected?: string[]; previewIds?: string[]; previewMotion?: boolean; progress?: number; draft?: CourtDrawing; grid?: boolean; half?: boolean; plain?: boolean; editingTextId?: string;
  viewBox?: string; width?: number | string; height?: number | string;
};

/** One geometric scene for the interactive canvas, thumbnails and image/PDF exports. */
export function CourtEditorScene({ payload: p, stepIndex, landscape, selected = [], hoveredId, previewIds, previewMotion, progress, draft, grid, half, plain, editingTextId, viewBox, width = "100%", height = "100%" }: CourtSceneProps) {
  const b = sceneBounds(landscape, half);
  const step = p.timeline.steps[stepIndex];
  const hide = p.editor?.hiddenLayers ?? [];
  const simulation = sampleCourtSimulation(p, stepIndex, progress ?? 0);
  const guides = simulation ? buildCourtPerspectiveSimulation(p, stepIndex, simulation, !hide.includes("movements")) : null;
  const drawings = new Map(displayCourtDrawings(p, stepIndex, progress).map(drawing => [drawing.id, drawing]));
  const actors = new Map(displayActors(p, stepIndex, progress).map(actor => [actor.id, actor]));
  const project = (x: number, y: number) => scenePoint({ x, y }, landscape);
  const line = (x1: number, y1: number, x2: number, y2: number, key: string, thickness = 5) => {
    const a = project(x1, y1), z = project(x2, y2);
    return <Line key={key} x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="#fff" strokeWidth={thickness} />;
  };
  const courtWidth = landscape ? 1800 : 900, courtHeight = landscape ? 900 : 1800;
  return <Svg width={width} height={height} viewBox={viewBox ?? `${b.x} ${b.y} ${b.width} ${b.height}`} preserveAspectRatio="xMidYMid meet" accessibilityLabel="Quadra de voleibol">
    <Rect x={-10000} y={-10000} width={20000} height={20000} fill={COURT_FLOOR} />
    {!plain && !hide.includes("court") ? <>
      <Rect x={0} y={0} width={courtWidth} height={courtHeight} fill="#d8a05c" stroke="#fff" strokeWidth={5} />
      {line(0, 1 / 3, 1, 1 / 3, "attack-a")}{line(0, 2 / 3, 1, 2 / 3, "attack-b")}
      {[1 / 3, 2 / 3].flatMap(y => [-1, 1].flatMap(side => [0, 1, 2, 3, 4].map(i => {
        const start = (side === -1 ? 0 : 1) + side * (20 + i * 35) / 900;
        return line(start, y, start + side * 15 / 900, y, `attack-extension-${y}-${side}-${i}`);
      })))}
      {[0, 1].flatMap(x => [0, 1].map(y => line(x, y + (y ? 1 : -1) * 20 / 1800, x, y + (y ? 1 : -1) * 35 / 1800, `serve-${x}-${y}`)))}
      {line(-0.04, 0.5, 1.04, 0.5, "net-shadow", 15)}
      {(() => { const a = project(-0.04, 0.5), z = project(1.04, 0.5); return <Line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="#34455b" strokeWidth={7} />; })()}
    </> : null}
    {grid ? <G>
      {Array.from({ length: 17 }, (_, n) => n + 1).map(i => <G key={`grid-x-${i}`} opacity={i % 6 === 0 ? 0.22 : 0.09}>{line(i / 18, 0, i / 18, 1, `gx${i}`, i % 6 === 0 ? 1.6 : 0.9)}</G>)}
      {Array.from({ length: 35 }, (_, n) => n + 1).filter(i => ![12, 18, 24].includes(i)).map(i => <G key={`grid-y-${i}`} opacity={i % 6 === 0 ? 0.22 : 0.09}>{line(0, i / 36, 1, i / 36, `gy${i}`, i % 6 === 0 ? 1.6 : 0.9)}</G>)}
    </G> : null}
    {guides?.guidesVisible ? <G pointerEvents="none">
      {guides.paths.map(path => <DrawObject key={`simulation-${path.id}`} landscape={landscape} drawing={{ id: path.id, kind: "pen", points: path.points.map(pt => simulationFloorPoint([pt.x, pt.y, pt.z])), color: path.color, size: 28, rotation: 0, dashed: path.dashed }} />)}
      {guides.markers.filter(marker => marker.kind !== "dot").map(marker => {
        const at = scenePoint(simulationFloorPoint([marker.point.x, marker.point.y, marker.point.z]), landscape);
        return marker.kind === "ring" ? <Circle key={marker.id} cx={at.x} cy={at.y} r={16} stroke={marker.color} fill="none" strokeWidth={3} /> : <G key={marker.id}><Line x1={at.x - 15} y1={at.y - 15} x2={at.x + 15} y2={at.y + 15} stroke={marker.color} strokeWidth={3} /><Line x1={at.x - 15} y1={at.y + 15} x2={at.x + 15} y2={at.y - 15} stroke={marker.color} strokeWidth={3} /></G>;
      })}
    </G> : null}
    {!hide.includes("drawings") ? <>
      {step.arrows?.map(a => <DrawObject key={a.id} landscape={landscape} drawing={{ id: a.id, kind: "arrow", points: [a.from, a.to], color: a.color ?? "#fff", size: 28, rotation: 0 }} />)}
      {p.markers.filter(m => !step.markerIds || step.markerIds.includes(m.id)).map(m => <DrawObject key={m.id} landscape={landscape} drawing={{ id: m.id, kind: m.type, points: [m.position], color: m.color ?? "#ffdc53", size: 28, rotation: 0 }} />)}
    </> : null}
    {!hide.includes("movements") ? (step.trajectories ?? step.transitions)?.filter(t => !p.editor?.actorMeta[t.actorId]?.hidden && (previewIds?.includes(t.actorId) ? previewMotion : progress !== 0)).map(t => <DrawObject key={t.id} landscape={landscape} drawing={{ id: t.id, kind: "arrow", points: motionTrail(t.points, previewIds?.includes(t.actorId) ? 1 : progress ?? 1, 55), color: t.color ?? "#fff", dashed: true, size: 28, rotation: 0 }} />) : null}
    {!hide.includes("actors") && simulation?.defenseSupport ? <G pointerEvents="none">
      {simulation.defenseSupport.map(actor => {
        const at = scenePoint(simulationFloorPoint(actor.position), landscape);
        return <G key={actor.role}>
          <Circle cx={at.x} cy={at.y} r={52} fill="#4389ff" stroke="#ffffff55" strokeWidth={2} />
          {!hide.includes("labels") ? <SvgText x={at.x} y={at.y + 14} fontFamily="Arial" fontWeight="700" fontSize={37} fill="#fff" textAnchor="middle">{actor.role === "setter" ? "L3" : "P6"}</SvgText> : null}
        </G>;
      })}
    </G> : null}
    {resolveCourtLayers(p, stepIndex).map(ref => {
      if (ref.kind === "drawing") {
        const d = drawings.get(ref.id);
        if (!d || d.id === editingTextId || hide.includes("drawings")) return null;
        return <G key={`drawing:${d.id}`}>
        {d.motion && (previewIds ? previewMotion && previewIds.includes(d.id) : progress !== 0) && !hide.includes("movements") ? <DrawObject landscape={landscape} drawing={{ ...d, kind: "arrow", points: motionTrail(d.motion, previewIds?.includes(d.id) ? 1 : progress ?? 1, (d.size || 28) * 0.85 + 3), dashed: true }} /> : null}
        <DrawObject drawing={d} landscape={landscape} selected={selected.includes(d.id)} hovered={hoveredId === d.id} />
        </G>;
      }
      const a = actors.get(ref.id);
      if (!a || hide.includes("actors")) return null;
      const pt = scenePoint(previewIds?.includes(a.id) ? actorPoint(p, stepIndex, a.id) : a.point, landscape);
      const person = (a.representation ?? p.editor?.actorRepresentation) === "person";
      const isSelected = selected.includes(a.id);
      const color = hoveredId === a.id ? courtHoverColor(a.color ?? "#19c87b") : a.color ?? "#19c87b";
      return <G key={`actor:${a.id}`}>
        {isSelected && !person ? <Circle cx={pt.x} cy={pt.y} r={61} fill="none" stroke="#fff" strokeWidth={4} /> : null}
        {person ? <G>
          {isSelected ? <G pointerEvents="none">
            <Circle cx={pt.x} cy={pt.y - 35} r={16} fill="none" stroke="#fff" strokeWidth={8} />
            <Path transform={`translate(${pt.x} ${pt.y})`} d={PERSON_BODY_PATH} fill="none" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
          </G> : null}
          <Circle cx={pt.x} cy={pt.y - 35} r={16} fill={color} stroke="#10213880" strokeWidth={2} />
          <Path transform={`translate(${pt.x} ${pt.y})`} d={PERSON_BODY_PATH} fill={color} stroke="#10213880" strokeWidth={2} strokeLinejoin="round" />
        </G> : <Circle cx={pt.x} cy={pt.y} r={52} fill={color} stroke="#ffffff55" strokeWidth={2} />}
        {!hide.includes("labels") && (p.editor?.showActorNumbers !== false || !/^\d+$/.test(String(a.label || a.number || ""))) ? <SvgText x={pt.x} y={pt.y + (a.receptionRole ? -72 : person ? 16 : 14)} fontFamily="Arial" fontWeight="700" fontSize={a.receptionRole ? 24 : person ? 25 : 37} fill={a.receptionRole ? "#fff" : a.role === "libero" ? "#102138" : "#fff"} textAnchor="middle">{a.label || a.number}</SvgText> : null}
        {p.editor?.actorMeta[a.id]?.locked ? <Circle cx={pt.x + 39} cy={pt.y - 39} r={7} fill="#fff" /> : null}
      </G>;
    })}
    {draft && !hide.includes("drawings") ? <G pointerEvents="none" opacity={draft.id === "material-drop-preview" ? 0.72 : 1}>
      {draft.id === "material-drop-preview" ? <G transform="translate(8 12)" opacity={0.22}>
        <DrawObject drawing={{ ...draft, color: "#0f172a" }} landscape={landscape} />
      </G> : null}
      <DrawObject drawing={draft} landscape={landscape} />
    </G> : null}
  </Svg>;
}
