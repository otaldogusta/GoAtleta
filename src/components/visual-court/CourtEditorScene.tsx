import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { actorPoint, frameDrawings, pointAlong, motionTrail, type CourtDrawing } from "../../core/visual-court-editor";
import type { CourtPoint, CourtVisualPayload } from "../../core/visual-court";

export const COURT_FLOOR = "#1676ac";
export const scenePoint = (p: CourtPoint, landscape: boolean) => landscape ? { x: (1 - p.y) * 1800, y: p.x * 900 } : { x: p.x * 900, y: p.y * 1800 };
export const fromScenePoint = (p: CourtPoint, landscape: boolean): CourtPoint => landscape ? { x: p.y / 900, y: 1 - p.x / 1800 } : { x: p.x / 900, y: p.y / 1800 };
export function sceneBounds(landscape: boolean, half = false) {
  return landscape ? { x: half ? -160 : -160, y: -200, width: half ? 1220 : 2120, height: 1300 } : { x: -200, y: half ? 740 : -160, width: 1300, height: half ? 1220 : 2120 };
}
export function displayActors(p: CourtVisualPayload, index: number, progress?: number) {
  const s = p.timeline.steps[index];
  return p.actors.filter(a => !s.visibleActorIds || s.visibleActorIds.includes(a.id)).map(a => {
    const trajectory = (s.trajectories ?? s.transitions)?.find(t => t.actorId === a.id);
    return { ...a, point: typeof progress === "number" && trajectory?.points.length ? pointAlong(trajectory.points, progress) : actorPoint(p, index, a.id) };
  });
}
function DrawObject({ drawing: d, landscape }: { drawing: CourtDrawing; landscape: boolean }) {
  const points = d.points.map(p => scenePoint(p, landscape));
  const first = points[0]; if (!first) return null;
  const last = points[points.length - 1];
  const path = d.kind === "curve" && points.length > 1
    ? `M ${first.x} ${first.y} Q ${(first.x + last.x) / 2 + 65} ${(first.y + last.y) / 2 - 65} ${last.x} ${last.y}`
    : points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const size = d.size || 28;
  const previous = points[Math.max(0, points.length - 2)];
  const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
  const head = `${last.x},${last.y} ${last.x - 25 * Math.cos(angle - 0.5)},${last.y - 25 * Math.sin(angle - 0.5)} ${last.x - 25 * Math.cos(angle + 0.5)},${last.y - 25 * Math.sin(angle + 0.5)}`;
  return <G>

    {["arrow", "curve", "pen", "area"].includes(d.kind) ? <>
      <Path d={path + (d.kind === "area" ? " Z" : "")} fill={d.kind === "area" ? d.color : "none"} fillOpacity={0.2} stroke={d.color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={d.dashed ? "15 12" : undefined} />
      {d.kind === "arrow" || d.kind === "curve" ? <Polygon points={head} fill={d.color} /> : null}
    </> : <G transform={`rotate(${d.rotation || 0} ${first.x} ${first.y})`}>
      {d.kind === "text" ? <SvgText x={first.x} y={first.y} fill={d.color} fontSize={size} fontWeight="600" textAnchor="middle">{d.text || "Anotação"}</SvgText> : null}
      {d.kind === "ball" ? <G transform={`translate(${first.x} ${first.y}) scale(${size * 0.085})`}>
        <Circle r={10} fill="#ffe16a" stroke="#ffffff" strokeWidth={0.65} />
        {[0, 120, 240].map(rotation => <G key={rotation} transform={`rotate(${rotation})`}>
          <Path d="M0 0 C-1 -4 -5 -7 -8.66 -5 A10 10 0 0 1 0 -10 C4 -7 4 -3 0 0Z" fill="#226ac4" />
          <Path d="M0 0 C-1 -4 -5 -7 -8.66 -5 M0 0 C4 -3 4 -7 0 -10 M-1.5 -1.8 C0 -4 0 -7 -2.8 -9.6" fill="none" stroke="#173b70" strokeWidth={0.35} strokeLinecap="round" />
        </G>)}
        <Circle cx={-3.3} cy={-4.2} r={2.5} fill="#fff" opacity={0.18} />
      </G> : null}
      {d.kind === "cone" ? <Polygon points={`${first.x},${first.y - size} ${first.x - size * 0.7},${first.y + size * 0.5} ${first.x + size * 0.7},${first.y + size * 0.5}`} fill={d.color} stroke="#fff" strokeWidth={2} /> : null}
      {d.kind === "target" ? <><Circle cx={first.x} cy={first.y} r={size} fill="none" stroke={d.color} strokeWidth={5} /><Circle cx={first.x} cy={first.y} r={size / 2} fill="none" stroke={d.color} strokeWidth={3} /></> : null}
      {d.kind === "ladder" ? <><Rect x={first.x - size / 2} y={first.y - size * 2} width={size} height={size * 4} fill="none" stroke={d.color} strokeWidth={4} />{[0, 1, 2, 3, 4].map(i => <Line key={i} x1={first.x - size / 2} x2={first.x + size / 2} y1={first.y + (i - 2) * size} y2={first.y + (i - 2) * size} stroke={d.color} strokeWidth={4} />)}</> : null}
    </G>}
  </G>;
}
export type CourtSceneProps = {
  payload: CourtVisualPayload; stepIndex: number; landscape: boolean;
  selected?: string[]; previewIds?: string[]; previewMotion?: boolean; progress?: number; draft?: CourtDrawing; grid?: boolean; half?: boolean; plain?: boolean;
  viewBox?: string; width?: number | string; height?: number | string;
};

/** One geometric scene for the interactive canvas, thumbnails and image/PDF exports. */
export function CourtEditorScene({ payload: p, stepIndex, landscape, selected = [], previewIds, previewMotion, progress, draft, grid, half, plain, viewBox, width = "100%", height = "100%" }: CourtSceneProps) {
  const b = sceneBounds(landscape, half);
  const step = p.timeline.steps[stepIndex];
  const hide = p.editor?.hiddenLayers ?? [];
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
    {!hide.includes("drawings") ? <>
      {step.arrows?.map(a => <DrawObject key={a.id} landscape={landscape} drawing={{ id: a.id, kind: "arrow", points: [a.from, a.to], color: a.color ?? "#fff", size: 28, rotation: 0 }} />)}
      {p.markers.filter(m => !step.markerIds || step.markerIds.includes(m.id)).map(m => <DrawObject key={m.id} landscape={landscape} drawing={{ id: m.id, kind: m.type, points: [m.position], color: m.color ?? "#ffdc53", size: 28, rotation: 0 }} />)}
      {frameDrawings(p, stepIndex).map(d => <G key={d.id}>
        {selected.includes(d.id) && d.points.length ? (() => {
          const points = d.points.map(pt => scenePoint(pt, landscape));
          const padding = d.size || 28;
          const x = Math.min(...points.map(pt => pt.x)) - padding;
          const y = Math.min(...points.map(pt => pt.y)) - padding;
          return <Rect x={x} y={y} width={Math.max(...points.map(pt => pt.x)) - x + padding} height={Math.max(...points.map(pt => pt.y)) - y + padding} rx={6} fill="none" stroke="#fff" strokeWidth={2} opacity={0.8} />;
        })() : null}
        {d.motion && (previewIds ? previewMotion && previewIds.includes(d.id) : progress !== 0) && !hide.includes("movements") ? <DrawObject landscape={landscape} drawing={{ ...d, kind: "arrow", points: motionTrail(d.motion, previewIds?.includes(d.id) ? 1 : progress ?? 1, (d.size || 28) * 0.85 + 3), dashed: true }} /> : null}
        <DrawObject drawing={typeof progress === "number" && !previewIds?.includes(d.id) && d.motion ? { ...d, points: [pointAlong(d.motion, progress)] } : d} landscape={landscape} />
      </G>)}
      {draft ? <DrawObject drawing={draft} landscape={landscape} /> : null}
    </> : null}
    {(previewIds ? previewMotion : progress !== 0) && !hide.includes("movements") ? (step.trajectories ?? step.transitions)?.filter(t => !previewIds || previewIds.includes(t.actorId)).map(t => <DrawObject key={t.id} landscape={landscape} drawing={{ id: t.id, kind: "arrow", points: motionTrail(t.points, previewIds?.includes(t.actorId) ? 1 : progress ?? 1, 55), color: t.color ?? "#fff", dashed: true, size: 28, rotation: 0 }} />) : null}
    {!hide.includes("actors") ? displayActors(p, stepIndex, progress).map(a => {
      const pt = scenePoint(previewIds?.includes(a.id) ? actorPoint(p, stepIndex, a.id) : a.point, landscape);
      return <G key={a.id}>
        {selected.includes(a.id) ? <Circle cx={pt.x} cy={pt.y} r={61} fill="none" stroke="#fff" strokeWidth={4} /> : null}
        <Circle cx={pt.x} cy={pt.y} r={52} fill={a.color ?? "#19c87b"} stroke="#ffffff55" strokeWidth={2} />
        <SvgText x={pt.x} y={pt.y + 14} fontFamily="Arial" fontWeight="700" fontSize={37} fill={a.role === "libero" ? "#102138" : "#fff"} textAnchor="middle">{a.label || a.number}</SvgText>
        {p.editor?.actorMeta[a.id]?.locked ? <Circle cx={pt.x + 39} cy={pt.y - 39} r={7} fill="#fff" /> : null}
      </G>;
    }) : null}
  </Svg>;
}
