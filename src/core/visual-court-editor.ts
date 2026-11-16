import { courtArrowHandles, limitPoint, moveCourtArrowHandle } from "./court-arrow-geometry";
import { COURT_ACTOR_ACTIONS, normalizeCourtActorActions, type CourtActorAction } from "./court-actor-actions";
import type { CourtDrawing, DrawingKind } from "./court-drawing-types";
import { repairReceptionMiddleIdentity } from './court-reception-middle-identity';
import { buildRotation5x1Preset, normalizeReceive5x1Timeline, type CourtPoint, type CourtVisualPayload, type CourtVisualStep } from "./visual-court";
import { normalizeCourtSimulation } from "./court-simulation-model";
import { configureCourtSimulation, getCourtSimulation, sampleCourtSimulation } from "./court-simulation";
import { bringCourtLayersToFront, normalizeCourtLayerOrder, resolveCourtLayers, type CourtLayerRef } from "./court-layers";
import { COURT_TRAJECTORY_HANDLES, COURT_TRAJECTORY_MAX_HEIGHT, courtTrajectoryHeights, isCourtTrajectoryHeight, parseCourtTrajectoryHeights, type CourtTrajectoryHandleKind, type CourtTrajectoryHeights } from "./court-arrow-trajectory";

export type { CourtDrawing, DrawingKind } from "./court-drawing-types";

export type CourtEditorMetadata = {
  version: 1;
  coordinates: "regulation";
  title: string;
  folder: string;
  tags: string;
  favorite: boolean;
  showActorNumbers?: boolean;
  actorRepresentation?: "circle" | "person";
  actorMeta: Record<string, { team?: "A" | "B"; locked?: boolean; hidden?: boolean; studentId?: string; simulationSupport?: boolean }>;
  drawings: Record<string, CourtDrawing[]>;
  layerOrder?: Record<string, CourtLayerRef[]>;
  hiddenLayers: string[];
  lessonLink?: { date: string; block: string; revision: string };
};
export type EditorSnapshot = { payload: CourtVisualPayload; stepIndex: number };
export type CourtSelectionClipboard = {
  actorIds: string[];
  actorPositions: Record<string, CourtPoint>;
  actorElevations?: Record<string, number>;
  actorActions?: Record<string, CourtActorAction>;
  trajectories: NonNullable<CourtVisualStep["trajectories"]>;
  drawings: CourtDrawing[];
  layerOrder?: CourtLayerRef[];
};
export const editorId = () => `board_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
export { limitPoint } from "./court-arrow-geometry";
/** Half-metre intersections on the 9 × 18 m court, independent of orientation. */
export const snapCourtPoint = (p: CourtPoint): CourtPoint => ({ x: Math.round(p.x * 18) / 18, y: Math.round(p.y * 36) / 36 });
export const COURT_ELEVATION_MAX = 8;
const elevationKinds: readonly DrawingKind[] = ["ball", "cone", "target", "ladder"];
const validElevation = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= COURT_ELEVATION_MAX;
const elevationValue = (value: unknown): number => validElevation(value) ? value : 0;
function withActorElevations(step: CourtVisualStep, actorElevations: Record<string, number>): CourtVisualStep {
  const { actorElevations: _actorElevations, ...rest } = step;
  return Object.keys(actorElevations).length ? { ...rest, actorElevations } : rest;
}

/** Convert legacy didactic/official positions once. View rotation never changes the document. */
export function upgradeCourtEditor(payload: CourtVisualPayload, title: string): CourtVisualPayload {
  payload = repairReceptionMiddleIdentity(normalizeReceive5x1Timeline(payload));
  const repairedSteps = payload.timeline.steps.map(s => {
    if (s.formationKind !== "5x1_receive_3" || !s.legalPositions || s.legalPositions.lib || !s.visibleActorIds?.includes("lib")) return s;
    const replaced = ["c1", "c2"].find(id => !s.visibleActorIds!.includes(id) && s.legalPositions![id]);
    if (!replaced) return s;
    const position = s.legalPositions[replaced];
    const restored = !s.trajectories?.length && !s.transitions?.length && ["lev", "op", "p1", "p2"].every(id => JSON.stringify(s.actorPositions[id]) === JSON.stringify(s.legalPositions![id]));
    return { ...s, legalPositions: { ...s.legalPositions, lib: position }, ...(restored ? { actorPositions: { ...s.actorPositions, lib: position }, baselineActorPositions: { ...s.baselineActorPositions, lib: position } } : {}) };
  });
  if (repairedSteps.some((s, i) => s !== payload.timeline.steps[i])) payload = { ...payload, timeline: { steps: repairedSteps } };
  // Old presets carried a setter destination as a visible target material.
  // Keep user-created targets; remove only the two known preset marker IDs.
  const automatic = new Set(["target", "receive-target"]);
  const markers = payload.markers.filter(m => !automatic.has(m.id));
  const editor = payload.editor ? { ...payload.editor, drawings: Object.fromEntries(Object.entries(payload.editor.drawings).map(([step, drawings]) => [step, drawings.filter(d => ![...automatic].some(id => d.id === `legacy_${step}_${id}`))])) } : undefined;
  if (markers.length !== payload.markers.length || (editor && JSON.stringify(editor.drawings) !== JSON.stringify(payload.editor?.drawings))) payload = { ...payload, markers, ...(editor ? { editor } : {}) };
  if (payload.editor?.version === 1) {
    if (!payload.markers.length && !payload.timeline.steps.some(s => s.arrows?.length)) return payload;
    const drawings = { ...payload.editor.drawings };
    for (const step of payload.timeline.steps) {
      const existing = drawings[step.id] ?? [];
      const migrated: CourtDrawing[] = [
        ...payload.markers.filter(m => !step.markerIds || step.markerIds.includes(m.id)).map(m => ({ id: `legacy_${step.id}_${m.id}`, kind: m.type, points: [m.position], color: m.color ?? "#ffdc53", size: 28, rotation: 0 })),
        ...(step.arrows ?? []).map(a => ({ id: `legacy_${step.id}_${a.id}`, kind: "arrow" as const, points: [a.from, a.to], color: a.color ?? "#fff", size: 28, rotation: 0 })),
      ];
      drawings[step.id] = [...existing, ...migrated.filter(m => !existing.some(d => d.id === m.id))];
    }
    return { ...payload, markers: [], editor: { ...payload.editor, drawings }, timeline: { steps: payload.timeline.steps.map(s => ({ ...s, markerIds: [], arrows: undefined })) } };
  }
  const official = payload.court.layoutMode !== "didactic_slots" && payload.court.labelMode !== "slots";
  const map = (p: CourtPoint): CourtPoint => ({ x: p.x, y: official ? (p.y <= 0.5 ? 0.5 + p.y / 3 : 2 / 3 + (p.y - 0.5) * 2 / 3) : 0.5 + p.y / 2 });
  const positions = (v?: Record<string, CourtPoint>) => v ? Object.fromEntries(Object.entries(v).map(([k, p]) => [k, map(p)])) : undefined;
  return {
    ...payload,
    editor: { version: 1, coordinates: "regulation", title, folder: "", tags: "", favorite: false, actorMeta: {}, drawings: Object.fromEntries(payload.timeline.steps.map(s => [s.id, [
      ...payload.markers.filter(m => !s.markerIds || s.markerIds.includes(m.id)).map(m => ({ id: `legacy_${s.id}_${m.id}`, kind: m.type, points: [map(m.position)], color: m.color ?? "#ffdc53", size: 32, rotation: 0 })),
      ...(s.arrows ?? []).map(a => ({ id: `legacy_${s.id}_${a.id}`, kind: "arrow" as const, points: [map(a.from), map(a.to)], color: a.color ?? "#ffffff", size: 32, rotation: 0 })),
    ]])), hiddenLayers: [] },
    court: { ...payload.court, courtView: "full_court", renderStyle: "coach_board", showZones: false },
    actors: payload.actors.map(a => ({ ...a, initialPosition: map(a.initialPosition) })),
    markers: [],
    timeline: { steps: payload.timeline.steps.map(s => ({ ...s,
      actorPositions: positions(s.actorPositions)!, baselineActorPositions: positions(s.baselineActorPositions),
      legalPositions: positions(s.legalPositions), tacticalPositions: positions(s.tacticalPositions),
      setterTarget: s.setterTarget ? map(s.setterTarget) : undefined,
      arrows: undefined,
      trajectories: s.trajectories?.map(t => ({ ...t, points: t.points.map(map) })),
      transitions: s.transitions?.map(t => ({ ...t, points: t.points.map(map) })),
    })) },
  };
}

export function newCourtBoard(title = "Nova jogada"): CourtVisualPayload {
  const p = upgradeCourtEditor(buildRotation5x1Preset(), title);
  const actors = ["A", "B"].flatMap((team, ti) => Array.from({ length: 6 }, (_, i) => ({
    id: editorId(), label: i === 5 ? "Lb" : String(i + 1), number: i + 1,
    role: i === 5 ? "libero" as const : "athlete" as const,
    color: i === 5 ? (ti ? "#c7d9ff" : "#c5fff0") : ti ? "#4389ff" : "#19c87b",
    initialPosition: { x: 0.22 + (i % 3) * 0.28, y: (ti ? 0.12 : 0.65) + Math.floor(i / 3) * 0.18 },
  })));
  return { ...p, actors, markers: [], editor: { ...p.editor!, drawings: {}, actorMeta: Object.fromEntries(actors.map((a, i) => [a.id, { team: i < 6 ? "A" : "B" }])) },
    timeline: { steps: [{ id: editorId(), label: "Posição inicial", durationMs: 1600, actorPositions: Object.fromEntries(actors.map(a => [a.id, a.initialPosition])) }] } };
}

export const frameDrawings = (p: CourtVisualPayload, index: number) => p.editor?.drawings[p.timeline.steps[index]?.id] ?? [];
function withoutStartBall(drawing: CourtDrawing): CourtDrawing {
  if (drawing.startBallId === undefined) return drawing;
  const { startBallId: _startBallId, ...detached } = drawing;
  return detached;
}
/** Freeze the effective Y before a link is copied alone, removed or translated away. */
function materializeDrawingTrajectoryHeights(drawings: CourtDrawing[], include: (drawing: CourtDrawing) => boolean = () => true): CourtDrawing[] {
  const balls = new Map(drawings.filter(d => d.kind === "ball" && d.points[0]).map(d => [d.id, .12 + elevationValue(d.elevation)]));
  return drawings.map(drawing => include(drawing) && drawing.startBallId && balls.has(drawing.startBallId) && ["arrow", "curve"].includes(drawing.kind)
    ? { ...drawing, trajectoryHeights: courtTrajectoryHeights(drawing.trajectoryHeights, balls.get(drawing.startBallId)) } : drawing);
}
/** Resolve within one step, after motion sampling. Hidden/locked balls remain valid anchors. */
export function resolveCourtDrawingAnchors(drawings: CourtDrawing[]): CourtDrawing[] {
  const balls = new Map(drawings.filter(d => d.kind === "ball" && d.points[0]).map(d => [d.id, d]));
  return drawings.map(drawing => {
    if (drawing.startBallId === undefined) return drawing;
    const ball = ["arrow", "curve"].includes(drawing.kind) && drawing.points.length >= 2 ? balls.get(drawing.startBallId) : undefined;
    if (!ball) return withoutStartBall(drawing);
    const target = ball.points[0], storedHeights = parseCourtTrajectoryHeights(drawing.trajectoryHeights);
    const trajectoryHeights = storedHeights ? courtTrajectoryHeights(storedHeights, .12 + elevationValue(ball.elevation)) : undefined;
    const start = drawing.points[0], dx = target.x - start.x, dy = target.y - start.y;
    if (!dx && !dy && (!trajectoryHeights || trajectoryHeights.start === storedHeights?.start)) return drawing;
    const points = [...drawing.points]; points[0] = { ...target };
    // M=(A+2C+B)/4: preserve C within the same document bounds as the edit handles.
    if (drawing.kind === "curve" && drawing.curveMode === "through-point" && points.length === 3) points[1] = limitPoint({ x: points[1].x + dx / 4, y: points[1].y + dy / 4 });
    return { ...drawing, points, ...(trajectoryHeights ? { trajectoryHeights } : {}) };
  });
}
function sampledAnchoredDrawings(p: CourtVisualPayload, index: number, progress?: number): CourtDrawing[] {
  const simulation = typeof progress === "number" ? sampleCourtSimulation(p, index, progress) : null;
  return resolveCourtDrawingAnchors(frameDrawings(p, index).map(d => simulation && d.id === simulation.ballId
    ? { ...d, points: [{ x: simulation.ball[0] / 9 + .5, y: simulation.ball[2] / 18 + .5 }], elevation: Math.max(0, Math.min(8, simulation.ball[1] - .12)), motion: undefined }
    : drawingAtProgress(d, progress)));
}
function remapDrawingAnchors(drawings: CourtDrawing[], source: CourtDrawing[], retainExternal = false): CourtDrawing[] {
  const ids = new Map(source.map((drawing, index) => [drawing.id, drawings[index].id]));
  return drawings.map(d => !d.startBallId ? d : ids.has(d.startBallId) ? { ...d, startBallId: ids.get(d.startBallId)! } : retainExternal ? d : withoutStartBall(d));
}
export const actorPoint = (p: CourtVisualPayload, index: number, id: string) => p.timeline.steps[index]?.actorPositions[id] ?? p.actors.find(a => a.id === id)?.initialPosition ?? { x: 0.5, y: 0.75 };
export function changeStep(p: CourtVisualPayload, index: number, change: (s: CourtVisualStep) => CourtVisualStep): CourtVisualPayload {
  return { ...p, timeline: { steps: p.timeline.steps.map((s, i) => i === index ? change(s) : s) } };
}
export function changeDrawings(p: CourtVisualPayload, index: number, drawings: CourtDrawing[]): CourtVisualPayload {
  const old = new Map(materializeDrawingTrajectoryHeights(resolveCourtDrawingAnchors(frameDrawings(p, index))).map(d => [d.id, d]));
  const balls = new Set(drawings.filter(d => d.kind === "ball").map(d => d.id));
  drawings = resolveCourtDrawingAnchors(drawings.map(d => {
    const previous = old.get(d.id);
    if (previous?.startBallId && !d.startBallId && ["arrow", "curve"].includes(d.kind)) return { ...d, trajectoryHeights: d.trajectoryHeights ?? previous.trajectoryHeights };
    return d.startBallId && !balls.has(d.startBallId) && previous?.startBallId === d.startBallId
      ? withoutStartBall({ ...d, points: previous.points, trajectoryHeights: previous.trajectoryHeights }) : d;
  }));
  const previous = new Set(frameDrawings(p, index).map(drawing => drawing.id));
  const added = drawings.filter(drawing => !previous.has(drawing.id)).map(drawing => ({ kind: "drawing" as const, id: drawing.id }));
  const next = { ...p, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [p.timeline.steps[index].id]: drawings } } };
  // Seed the legacy stack before appending a first object, so it is placed above actors too.
  if (added.length && !p.editor?.layerOrder?.[p.timeline.steps[index].id]) next.editor.layerOrder = { ...p.editor?.layerOrder, [p.timeline.steps[index].id]: resolveCourtLayers(p, index) };
  else if (p.editor?.layerOrder?.[p.timeline.steps[index].id]) next.editor.layerOrder = { ...p.editor.layerOrder, [p.timeline.steps[index].id]: resolveCourtLayers(next, index) };
  return added.length ? bringCourtLayersToFront(next, index, added) : next;
}
/** Authoring commands must ignore stale selections of protected or invisible objects. */
export function editableCourtSelection(p: CourtVisualPayload, index: number, ids: string[]): string[] {
  return ids.filter(id => {
    const actor = p.actors.find(item => item.id === id);
    const meta = actor ? p.editor?.actorMeta[id] : frameDrawings(p, index).find(item => item.id === id);
    return (actor || meta) && !meta?.locked && !meta?.hidden && !p.editor?.hiddenLayers.includes(actor ? "actors" : "drawings");
  });
}
/** Height belongs to the active step; engine-controlled objects retain their simulation height. */
export function editableCourtElevationSelection(p: CourtVisualPayload, index: number, ids: string[]): string[] {
  const step = p.timeline.steps[index]; if (!step) return [];
  const simulation = getCourtSimulation(p, index), actors = new Set(p.actors.map(a => a.id));
  return [...new Set(editableCourtSelection(p, index, ids))].filter(id => {
    if (actors.has(id)) return (!step.visibleActorIds || step.visibleActorIds.includes(id)) && (simulation?.mode === "defense" || !simulation?.actorIds.includes(id));
    return (simulation?.mode === "defense" || id !== simulation?.ballId) && frameDrawings(p, index).some(d => d.id === id && elevationKinds.includes(d.kind));
  });
}
export function courtSelectionElevation(p: CourtVisualPayload, index: number, id: string): number {
  return p.actors.some(a => a.id === id) ? elevationValue(p.timeline.steps[index]?.actorElevations?.[id])
    : elevationValue(frameDrawings(p, index).find(d => d.id === id && elevationKinds.includes(d.kind))?.elevation);
}
export function setCourtSelectionElevation(p: CourtVisualPayload, index: number, ids: string[], elevation: number): CourtVisualPayload {
  if (!validElevation(elevation)) return p;
  const editable = new Set(editableCourtElevationSelection(p, index, ids).filter(id => courtSelectionElevation(p, index, id) !== elevation));
  if (!editable.size) return p;
  const actors = p.actors.filter(a => editable.has(a.id));
  let next = actors.length ? changeStep(p, index, step => {
    const actorElevations = { ...step.actorElevations };
    for (const actor of actors) { if (elevation) actorElevations[actor.id] = elevation; else delete actorElevations[actor.id]; }
    return withActorElevations(step, actorElevations);
  }) : p;
  if (frameDrawings(p, index).some(d => editable.has(d.id))) next = changeDrawings(next, index, frameDrawings(p, index).map(d => {
    if (!editable.has(d.id)) return d;
    const { elevation: _elevation, ...rest } = d;
    return elevation ? { ...rest, elevation } : rest;
  }));
  return next;
}
export function courtTrajectoryHeightTargets(p: CourtVisualPayload, index: number, id: string, progress = 0) {
  const drawings = frameDrawings(p, index), drawing = drawings.find(d => d.id === id && ["arrow", "curve"].includes(d.kind) && d.points.length >= 2);
  if (!drawing) return [];
  const ball = drawing.startBallId ? drawings.find(d => d.id === drawing.startBallId && d.kind === "ball" && d.points[0]) : undefined;
  const simulation = ball && getCourtSimulation(p, index)?.ballId === ball.id ? sampleCourtSimulation(p, index, progress) : null;
  const heights = courtTrajectoryHeights(drawing.trajectoryHeights, ball ? simulation?.ball[1] ?? .12 + elevationValue(ball.elevation) : undefined);
  const editable = editableCourtSelection(p, index, [id]).length > 0;
  const linkedEditable = !ball || !(simulation?.mode === "defense" && progress < 1) && editableCourtElevationSelection(p, index, [ball.id]).length > 0;
  return COURT_TRAJECTORY_HANDLES.map(kind => ({ kind, value: heights[kind], min: kind === "start" && ball ? .12 : 0, max: COURT_TRAJECTORY_MAX_HEIGHT, editable: editable && (kind !== "start" || linkedEditable) }));
}
/** One completed vertical grip gesture is one document edit; linked starts edit their ball. */
export function setCourtTrajectoryHeight(p: CourtVisualPayload, index: number, id: string, handle: CourtTrajectoryHandleKind, value: number, progress = 0): CourtVisualPayload {
  if (!isCourtTrajectoryHeight(value)) return p;
  const targets = courtTrajectoryHeightTargets(p, index, id, progress), target = targets.find(item => item.kind === handle);
  if (!target?.editable || value < target.min || value > target.max || Math.abs(target.value - value) < 1e-8) return p;
  const drawings = frameDrawings(p, index), drawing = drawings.find(d => d.id === id)!;
  const ball = drawing.startBallId ? drawings.find(d => d.id === drawing.startBallId && d.kind === "ball") : undefined;
  if (handle === "start" && ball) return setCourtSelectionElevation(p, index, [ball.id], Math.max(0, Math.min(8, value - .12)));
  const heights = Object.fromEntries(targets.map(item => [item.kind, item.value])) as CourtTrajectoryHeights;
  return changeDrawings(p, index, drawings.map(item => item.id === id ? { ...item, trajectoryHeights: { ...heights, [handle]: value } } : item));
}
/** One 3D grip edit owns X/Z and Y together; a linked start moves its ball. */
export function setCourtTrajectoryPoint(p: CourtVisualPayload, index: number, id: string, handle: CourtTrajectoryHandleKind, point: { x: number; y: number; z: number }, landscape = false, progress = 0): CourtVisualPayload {
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite) || Math.abs(point.x) > 6.3 || Math.abs(point.z) > 11.7 || !isCourtTrajectoryHeight(point.y)) return p;
  const targets = courtTrajectoryHeightTargets(p, index, id, progress), target = targets.find(item => item.kind === handle);
  if (!target?.editable || point.y < target.min || point.y > target.max) return p;
  const displayed = sampledAnchoredDrawings(p, index, progress), drawing = displayed.find(item => item.id === id)!;
  const grip = courtArrowHandles(drawing, landscape).find(item => item.kind === handle);
  if (!grip) return p;
  const destination = limitPoint({ x: point.x / 9 + .5, y: point.z / 18 + .5 });
  if (Math.hypot(destination.x - grip.point.x, destination.y - grip.point.y) < 1e-8) return setCourtTrajectoryHeight(p, index, id, handle, point.y, progress);
  const heightChanged = Math.abs(target.value - point.y) >= 1e-8;
  const ball = handle === "start" && drawing.startBallId ? displayed.find(item => item.id === drawing.startBallId && item.kind === "ball") : undefined;
  if (ball) {
    const moved = moveSelection(p, index, [ball.id], { x: destination.x - ball.points[0].x, y: destination.y - ball.points[0].y }, false, undefined, progress);
    return heightChanged ? setCourtSelectionElevation(moved, index, [ball.id], Math.max(0, Math.min(8, point.y - .12))) : moved;
  }
  const shape = moveCourtArrowHandle(drawing, handle, destination, landscape, 1, 0);
  if (shape === drawing && !heightChanged) return p;
  const heights = Object.fromEntries(targets.map(item => [item.kind, item.value])) as CourtTrajectoryHeights;
  return changeDrawings(p, index, frameDrawings(p, index).map(item => item.id === id ? heightChanged ? { ...shape, trajectoryHeights: { ...heights, [handle]: point.y } } : shape : item));
}
export function moveSelection(p: CourtVisualPayload, index: number, ids: string[], delta: CourtPoint, animate: boolean, path?: CourtPoint[], progress?: number): CourtVisualPayload {
  ids = editableCourtSelection(p, index, ids);
  if (!ids.length) return p;
  const simulation = sampleCourtSimulation(p, index, typeof progress === "number" ? progress : 0);
  if (simulation && simulation.mode !== "defense" && ids.some(id => id === simulation.ballId && !frameDrawings(p, index).find(drawing => drawing.id === id)?.locked
    || animate && simulation.config.actorIds.includes(id) && !p.editor?.actorMeta[id]?.locked)) {
    const sampled = Object.fromEntries(simulation.actors.map(actor => [actor.id, { x: actor.position[0] / 9 + .5, y: actor.position[2] / 18 + .5 }]));
    p = changeStep(p, index, step => ({ ...step, simulation: undefined, actorPositions: { ...step.actorPositions, ...sampled }, baselineActorPositions: { ...step.actorPositions, ...sampled }, visibleActorIds: (step.visibleActorIds ?? p.actors.map(actor => actor.id)).filter(id => !simulation.config.actorIds.includes(id) || simulation.visibleIds.includes(id)) }));
    p = changeDrawings(p, index, frameDrawings(p, index).map(drawing => drawing.id === simulation.ballId ? { ...drawing, points: [{ x: simulation.ball[0] / 9 + .5, y: simulation.ball[2] / 18 + .5 }], motion: undefined } : drawing));
  }
  const movable = ids.filter(id => !p.editor?.actorMeta[id]?.locked);
  let next = changeStep(p, index, s => {
    const actorPositions = { ...s.actorPositions };
    let trajectories = [...(s.trajectories ?? s.transitions ?? [])];
    const baseline = { ...(s.baselineActorPositions ?? s.actorPositions) };
    for (const a of p.actors.filter(a => movable.includes(a.id))) {
      const existing = trajectories.find(t => t.actorId === a.id);
      const sampled = !animate ? simulation?.actors.find(actor => actor.id === a.id) : undefined;
      const from = sampled ? { x: sampled.position[0] / 9 + .5, y: sampled.position[2] / 18 + .5 } : typeof progress === "number" && existing?.points.length ? pointAlong(existing.points, progress) : actorPoint(p, index, a.id);
      const to = limitPoint({ x: from.x + delta.x, y: from.y + delta.y });
      actorPositions[a.id] = to;
      if (animate) {
        trajectories = [...trajectories.filter(t => t.actorId !== a.id), { id: existing?.id ?? editorId(), actorId: a.id, points: path?.length ? path.map(pt => limitPoint({ x: from.x + pt.x, y: from.y + pt.y })) : [from, to], color: a.color }];
      } else {
        baseline[a.id] = to;
        trajectories = trajectories.filter(t => t.actorId !== a.id);
      }
    }
    return { ...s, actorPositions, baselineActorPositions: baseline, trajectories, transitions: undefined };
  });
  const displayed = new Map(materializeDrawingTrajectoryHeights(sampledAnchoredDrawings(p, index, progress)).map(d => [d.id, d]));
  next = changeDrawings(next, index, frameDrawings(p, index).map(d => {
    if (!ids.includes(d.id) || d.locked) return d;
    const sampled = displayed.get(d.id)!;
    const points = sampled.points.map(pt => limitPoint({ x: pt.x + delta.x, y: pt.y + delta.y }));
    const from = typeof progress === "number" ? sampled.points[0] : d.motion?.[0] ?? d.points[0];
    const moved = d.startBallId && !ids.includes(d.startBallId) ? withoutStartBall(sampled) : d;
    return { ...moved, points, motion: animate && d.kind === "ball" ? path?.length ? path.map(pt => limitPoint({ x: from.x + pt.x, y: from.y + pt.y })) : [from, points[0]] : undefined };
  }));
  if (simulation?.mode === "attack" && !animate && next.timeline.steps[index].simulation) {
    const manualBlockers = [...simulation.config.attackSettings.manualBlockers];
    for (const slot of [1, 2, 5]) if (movable.includes(simulation.config.actorIds[slot]) && !manualBlockers.includes(slot)) manualBlockers.push(slot);
    return configureCourtSimulation(next, index, { attackSettings: { manualBlockers } });
  }
  return next;
}

/** A single undoable stage edit; engine-driven Receive/Attack actions stay canonical. */
export function setCourtActorAction(p: CourtVisualPayload, index: number, ids: string[], action: CourtActorAction | undefined): CourtVisualPayload {
  const step = p.timeline.steps[index];
  if (!step || action !== undefined && !COURT_ACTOR_ACTIONS.includes(action)) return p;
  const simulation = getCourtSimulation(p, index);
  const selected = editableCourtSelection(p, index, ids).filter(id => p.actors.some(actor => actor.id === id)
    && (!step.visibleActorIds || step.visibleActorIds.includes(id))
    && (!simulation || simulation.mode === "defense" || !simulation.actorIds.includes(id)));
  if (!selected.some(id => step.actorActions?.[id] !== action)) return p;
  const actorActions = { ...step.actorActions };
  selected.forEach(id => { if (action === undefined) delete actorActions[id]; else actorActions[id] = action; });
  return changeStep(p, index, current => {
    const { actorActions: _actions, ...rest } = current;
    return Object.keys(actorActions).length ? { ...rest, actorActions } : rest;
  });
}
export function alignSelection(p: CourtVisualPayload, index: number, ids: string[], axis: "x" | "y") {
  const points = ids.map(id => p.actors.some(a => a.id === id) ? actorPoint(p, index, id) : frameDrawings(p, index).find(d => d.id === id)?.points[0]).filter((pt): pt is CourtPoint => !!pt);
  if (points.length < 2) return p;
  const value = points.reduce((sum, pt) => sum + pt[axis], 0) / points.length;
  return ids.reduce((next, id) => {
    const pt = p.actors.some(a => a.id === id) ? actorPoint(p, index, id) : frameDrawings(p, index).find(d => d.id === id)?.points[0];
    return pt ? moveSelection(next, index, [id], { x: axis === "x" ? value - pt.x : 0, y: axis === "y" ? value - pt.y : 0 }, false) : next;
  }, p);
}
export function resetStepAnimation(p: CourtVisualPayload, index: number): CourtVisualPayload {
  p = upgradeCourtEditor(p, p.editor?.title ?? "Jogada");
  const next = changeStep(p, index, s => {
    const starts = Object.fromEntries((s.trajectories ?? s.transitions ?? []).filter(t => t.points.length).map(t => [t.actorId, t.points[0]]));
    const positions = { ...s.actorPositions, ...starts, ...s.baselineActorPositions, ...s.legalPositions };
    return { ...s, actorPositions: positions, baselineActorPositions: { ...positions }, trajectories: [], transitions: undefined };
  });
  return changeDrawings(next, index, frameDrawings(next, index).map(d => ({ ...d, points: d.motion?.length ? [d.motion[0]] : d.points, motion: undefined })));
}
export function deleteSelection(p: CourtVisualPayload, index: number, ids: string[], progress?: number) {
  ids = editableCourtSelection(p, index, ids);
  if (!ids.length) return p;
  const displayed = new Map(materializeDrawingTrajectoryHeights(sampledAnchoredDrawings(p, index, progress)).map(d => [d.id, d]));
  // Detach at the visible origin before removing its ball or disabling its simulation.
  p = changeDrawings(p, index, frameDrawings(p, index).map(d => d.startBallId && ids.includes(d.startBallId) ? withoutStartBall(displayed.get(d.id)!) : d));
  const next = changeStep(p, index, s => withActorElevations({ ...s, visibleActorIds: (s.visibleActorIds ?? p.actors.map(a => a.id)).filter(id => !ids.includes(id) || p.editor?.actorMeta[id]?.locked),
    trajectories: (s.trajectories ?? s.transitions)?.filter(t => !ids.includes(t.actorId) || p.editor?.actorMeta[t.actorId]?.locked), transitions: undefined,
    ...(s.simulation && ids.some(id => (s.simulation!.actorIds.includes(id) && !p.editor?.actorMeta[id]?.locked) || id === s.simulation!.ballId && !frameDrawings(p, index).find(drawing => drawing.id === id)?.locked) ? { simulation: undefined } : {}),
  }, Object.fromEntries(Object.entries(s.actorElevations ?? {}).filter(([id]) => !ids.includes(id)))));
  return changeDrawings(next, index, frameDrawings(next, index).filter(d => !ids.includes(d.id) || d.locked));
}
export function duplicateSelection(p: CourtVisualPayload, index: number, ids: string[], offset: CourtPoint = { x: 0.06, y: 0.03 }, progress?: number) {
  let next = p;
  const selected: string[] = [];
  const copies = new Map<string, CourtLayerRef>();
  for (const a of p.actors.filter(a => ids.includes(a.id))) {
    const id = editorId(); selected.push(id);
    copies.set(`actor:${a.id}`, { kind: "actor", id });
    const point = actorPoint(p, index, a.id);
    const clone = { ...a, id, initialPosition: limitPoint({ x: point.x + offset.x, y: point.y + offset.y }) };
    next = { ...next, actors: [...next.actors, clone], editor: { ...next.editor!, actorMeta: { ...next.editor!.actorMeta, [id]: { ...next.editor!.actorMeta[a.id], locked: false } } } };
    next = { ...next, timeline: { steps: next.timeline.steps.map((s, i) => ({ ...s, visibleActorIds: [...(s.visibleActorIds ?? p.actors.map(a => a.id)), ...(i === index ? [id] : [])], actorPositions: i === index ? { ...s.actorPositions, [id]: clone.initialPosition } : s.actorPositions })) } };
    const elevation = courtSelectionElevation(p, index, a.id);
    if (elevation) next = changeStep(next, index, s => ({ ...s, actorElevations: { ...s.actorElevations, [id]: elevation } }));
    const action = p.timeline.steps[index].actorActions?.[a.id];
    if (action) next = changeStep(next, index, s => ({ ...s, actorActions: { ...s.actorActions, [id]: action } }));
  }
  const source = sampledAnchoredDrawings(p, index, progress).filter(d => ids.includes(d.id));
  const clones = remapDrawingAnchors(source.map(d => { const id = editorId(); selected.push(id); copies.set(`drawing:${d.id}`, { kind: "drawing", id }); return { ...d, id, locked: false, points: d.points.map(pt => limitPoint({ x: pt.x + offset.x, y: pt.y + offset.y })), ...(d.motion ? { motion: d.motion.map(pt => limitPoint({ x: pt.x + offset.x, y: pt.y + offset.y })) } : {}) }; }), source, true);
  next = changeDrawings(next, index, [...frameDrawings(next, index), ...clones]);
  return { payload: bringCourtLayersToFront(next, index, resolveCourtLayers(p, index).flatMap(ref => copies.get(`${ref.kind}:${ref.id}`) ?? [])), selected };
}
function copiedStepLayerOrder(p: CourtVisualPayload, index: number, id: string, drawings: CourtDrawing[]) {
  if (!p.editor?.layerOrder?.[p.timeline.steps[index].id]) return p.editor?.layerOrder;
  const remap = new Map(frameDrawings(p, index).map((drawing, i) => [drawing.id, drawings[i].id]));
  return { ...p.editor.layerOrder, [id]: resolveCourtLayers(p, index).map(ref => ref.kind === "drawing" ? { ...ref, id: remap.get(ref.id)! } : ref) };
}
export function duplicateStep(p: CourtVisualPayload, index: number): EditorSnapshot {
  const source = p.timeline.steps[index];
  const id = editorId();
  const step = { ...JSON.parse(JSON.stringify(source)), id, label: `${source.label} · cópia` } as CourtVisualStep;
  const steps = [...p.timeline.steps]; steps.splice(index + 1, 0, step);
  const sourceDrawings = resolveCourtDrawingAnchors(frameDrawings(p, index));
  const drawings = remapDrawingAnchors(sourceDrawings.map(d => ({ ...d, id: editorId() })), sourceDrawings);
  if (step.simulation) step.simulation.ballId = drawings[frameDrawings(p, index).findIndex(d => d.id === source.simulation!.ballId)]?.id ?? step.simulation.ballId;
  return { payload: { ...p, timeline: { steps }, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [id]: drawings }, layerOrder: copiedStepLayerOrder(p, index, id, drawings) } }, stepIndex: index + 1 };
}
export function continueStepFromEnd(p: CourtVisualPayload, index: number): EditorSnapshot {
  const source = p.timeline.steps[index];
  const id = editorId();
  const actorPositions = { ...source.actorPositions };
  const step = {
    ...JSON.parse(JSON.stringify(source)),
    id,
    label: `${source.label} · continuação`,
    actorPositions,
    baselineActorPositions: { ...actorPositions },
    trajectories: [],
    transitions: undefined,
  } as CourtVisualStep;
  const sourceDrawings = sampledAnchoredDrawings(p, index, 1);
  const drawings = remapDrawingAnchors(sourceDrawings.map(d => ({ ...d, id: editorId(), points: d.points.map(point => ({ ...point })), motion: undefined })), sourceDrawings);
  if (step.simulation) step.simulation.ballId = drawings[frameDrawings(p, index).findIndex(d => d.id === source.simulation!.ballId)]?.id ?? step.simulation.ballId;
  const steps = [...p.timeline.steps];
  steps.splice(index + 1, 0, step);
  return {
    payload: { ...p, timeline: { steps }, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [id]: drawings }, layerOrder: copiedStepLayerOrder(p, index, id, drawings) } },
    stepIndex: index + 1,
  };
}
export function addBlankStep(p: CourtVisualPayload, index: number): EditorSnapshot {
  const id = editorId();
  const step: CourtVisualStep = {
    id,
    label: `Etapa vazia ${p.timeline.steps.length + 1}`,
    durationMs: 1600,
    actorPositions: {},
    baselineActorPositions: {},
    visibleActorIds: [],
    trajectories: [],
  };
  const steps = [...p.timeline.steps];
  steps.splice(index + 1, 0, step);
  return {
    payload: { ...p, timeline: { steps }, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [id]: [] } } },
    stepIndex: index + 1,
  };
}
export function removeStep(p: CourtVisualPayload, index: number): EditorSnapshot {
  if (p.timeline.steps.length <= 1) return { payload: p, stepIndex: index };
  const drawings = { ...p.editor!.drawings }; delete drawings[p.timeline.steps[index].id];
  const layerOrder = p.editor?.layerOrder ? { ...p.editor.layerOrder } : undefined;
  if (layerOrder) delete layerOrder[p.timeline.steps[index].id];
  return { payload: { ...p, timeline: { steps: p.timeline.steps.filter((_, i) => i !== index) }, editor: { ...p.editor!, drawings, layerOrder } }, stepIndex: Math.max(0, index - 1) };
}
export function reorderStep(p: CourtVisualPayload, index: number, direction: number): EditorSnapshot {
  const target = Math.max(0, Math.min(p.timeline.steps.length - 1, index + direction));
  const steps = [...p.timeline.steps]; [steps[index], steps[target]] = [steps[target], steps[index]];
  return { payload: { ...p, timeline: { steps } }, stepIndex: target };
}
export function reorderStepToIndex(p: CourtVisualPayload, from: number, to: number): EditorSnapshot {
  const source = Math.max(0, Math.min(p.timeline.steps.length - 1, from));
  const target = Math.max(0, Math.min(p.timeline.steps.length - 1, to));
  if (source === target) return { payload: p, stepIndex: source };
  const steps = [...p.timeline.steps];
  const [step] = steps.splice(source, 1);
  steps.splice(target, 0, step);
  return { payload: { ...p, timeline: { steps } }, stepIndex: target };
}

export function copyStepSelection(p: CourtVisualPayload, index: number, ids: string[], progress?: number): CourtSelectionClipboard {
  const actorIds = p.actors.filter(actor => ids.includes(actor.id)).map(actor => actor.id);
  const selectedActors = new Set(actorIds);
  const actorElevations = Object.fromEntries(actorIds.flatMap(id => { const value = courtSelectionElevation(p, index, id); return value ? [[id, value]] : []; }));
  return {
    actorIds,
    ...(p.timeline.steps[index].actorActions ? { actorActions: normalizeCourtActorActions(p.timeline.steps[index].actorActions, actorIds) } : {}),
    ...(Object.keys(actorElevations).length ? { actorElevations } : {}),
    layerOrder: resolveCourtLayers(p, index).filter(ref => ids.includes(ref.id)),
    actorPositions: Object.fromEntries(actorIds.map(id => [id, { ...actorPoint(p, index, id) }])),
    trajectories: (p.timeline.steps[index].trajectories ?? p.timeline.steps[index].transitions ?? [])
      .filter(trajectory => selectedActors.has(trajectory.actorId))
      .map(trajectory => ({ ...trajectory, points: trajectory.points.map(point => ({ ...point })) })),
    drawings: materializeDrawingTrajectoryHeights(sampledAnchoredDrawings(p, index, progress), drawing => !ids.includes(drawing.startBallId ?? ""))
      .filter(drawing => ids.includes(drawing.id))
      .map(drawing => ({ ...(drawing.startBallId && !ids.includes(drawing.startBallId) ? withoutStartBall(drawing) : drawing), points: drawing.points.map(point => ({ ...point })), motion: drawing.motion?.map(point => ({ ...point })) })),
  };
}

export function pasteStepSelection(p: CourtVisualPayload, index: number, clipboard: CourtSelectionClipboard): { payload: CourtVisualPayload; selected: string[] } {
  const actorIds = editableCourtSelection(p, index, clipboard.actorIds.filter(id => p.actors.some(actor => actor.id === id)));
  if (!actorIds.length && !clipboard.drawings.length) return { payload: p, selected: [] };
  const actorSet = new Set(actorIds);
  const step = p.timeline.steps[index];
  const visibleActorIds = [...new Set([...(step.visibleActorIds ?? p.actors.map(actor => actor.id)), ...actorIds])];
  const trajectories = [
    ...(step.trajectories ?? step.transitions ?? []).filter(trajectory => !actorSet.has(trajectory.actorId)),
    ...clipboard.trajectories.filter(trajectory => actorSet.has(trajectory.actorId)).map(trajectory => ({ ...trajectory, id: editorId(), points: trajectory.points.map(point => ({ ...point })) })),
  ];
  let next = actorIds.length ? changeStep(p, index, current => ({
    ...current,
    visibleActorIds,
    actorPositions: { ...current.actorPositions, ...Object.fromEntries(actorIds.map(id => [id, { ...clipboard.actorPositions[id] }])) },
    baselineActorPositions: { ...current.baselineActorPositions, ...Object.fromEntries(actorIds.map(id => [id, { ...clipboard.actorPositions[id] }])) },
    trajectories,
    transitions: undefined,
  })) : p;
  if (actorIds.length) next = changeStep(next, index, current => {
    const actorElevations = { ...current.actorElevations };
    const actorActions = { ...current.actorActions };
    for (const id of actorIds) { const value = elevationValue(clipboard.actorElevations?.[id]); if (value) actorElevations[id] = value; else delete actorElevations[id]; }
    for (const id of actorIds) { const action = clipboard.actorActions?.[id]; if (action && COURT_ACTOR_ACTIONS.includes(action)) actorActions[id] = action; else delete actorActions[id]; }
    const { actorActions: _actions, ...rest } = current;
    return withActorElevations(Object.keys(actorActions).length ? { ...rest, actorActions } : rest, actorElevations);
  });
  const drawings = remapDrawingAnchors(clipboard.drawings.map(drawing => ({
    ...drawing,
    id: editorId(),
    points: drawing.points.map(point => ({ ...point })),
    motion: drawing.motion?.map(point => ({ ...point })),
  })), clipboard.drawings);
  next = changeDrawings(next, index, [...frameDrawings(next, index), ...drawings]);
  const drawingIds = new Map(clipboard.drawings.map((drawing, i) => [drawing.id, drawings[i].id]));
  const copiedOrder = clipboard.layerOrder ?? [...clipboard.drawings.map(drawing => ({ kind: "drawing" as const, id: drawing.id })), ...actorIds.map(id => ({ kind: "actor" as const, id }))];
  next = bringCourtLayersToFront(next, index, copiedOrder.flatMap(ref => ref.kind === "drawing" ? drawingIds.has(ref.id) ? [{ ...ref, id: drawingIds.get(ref.id)! }] : [] : actorSet.has(ref.id) ? [ref] : []));
  return { payload: next, selected: [...actorIds, ...drawings.map(drawing => drawing.id)] };
}
export function pointAlong(points: CourtPoint[], progress: number): CourtPoint {
  if (!points.length) return { x: 0.5, y: 0.5 };
  const segment = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const i = Math.floor(segment), a = points[i], b = points[Math.min(i + 1, points.length - 1)];
  return { x: a.x + (b.x - a.x) * (segment - i), y: a.y + (b.y - a.y) * (segment - i) };
}

/** The canvas hit target must follow the same animated point shown by the scene. */
export function drawingAtProgress(drawing: CourtDrawing, progress?: number): CourtDrawing {
  return typeof progress === "number" && drawing.motion?.length
    ? { ...drawing, points: [pointAlong(drawing.motion, progress)] }
    : drawing;
}

/** The traveled path ends at the rear edge of the moving token. */
export function motionTrail(points: CourtPoint[], progress: number, clearance: number): CourtPoint[] {
  if (points.length < 2 || progress <= 0) return [];
  const segment = Math.min(1, progress) * (points.length - 1);
  const trail = [...points.slice(0, Math.floor(segment) + 1), pointAlong(points, progress)];
  let remaining = clearance;
  while (trail.length > 1) {
    const b = trail[trail.length - 1], a = trail[trail.length - 2];
    const length = Math.hypot((b.x - a.x) * 900, (b.y - a.y) * 1800);
    if (length <= remaining) { remaining -= length; trail.pop(); continue; }
    const ratio = (length - remaining) / length;
    trail[trail.length - 1] = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    break;
  }
  return trail.length > 1 ? trail : [];
}

/** Bounded, typed import. Never accept organization IDs, executable markup or arbitrary links. */
export function parseEditorImport(raw: string): CourtVisualPayload {
  if (raw.length > 2_000_000) throw new Error("Arquivo acima de 2 MB.");
  const value = JSON.parse(raw);
  const p = value?.format === "goatleta-court" && value?.version === 1 ? value.payload : null;
  if (!p || p.version !== 1 || p.sport !== "volleyball_indoor" || p.editor?.version !== 1 || p.editor?.coordinates !== "regulation" || !Array.isArray(p.actors) || !Array.isArray(p.timeline?.steps) || p.actors.length > 100 || !p.timeline.steps.length || p.timeline.steps.length > 200) throw new Error("Formato de quadra incompatível.");
  const text = (v: unknown, max = 120) => typeof v === "string" ? v.slice(0, max) : "";
  const point = (v: unknown) => { const pt = v as CourtPoint; if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) throw new Error("Coordenada inválida."); return limitPoint(pt); };
  const color = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#19c87b";
  const optionalColor = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined;
  const roles = ["setter", "outside", "middle", "opposite", "libero", "athlete", "coach"];
  const actors = p.actors.map((a: { id: string; label: string; number?: number; color?: string; baseColor?: string; role: string; initialPosition: CourtPoint; currentZone?: number; rotationOrder?: number; isBackRow?: boolean; isFrontRow?: boolean }) => ({
    id: text(a.id),
    label: text(a.label, 24),
    ...(Number.isFinite(a.number) ? { number: Math.min(99, Math.max(0, Number(a.number))) } : {}),
    ...(optionalColor(a.color) ? { color: optionalColor(a.color) } : {}),
    ...(optionalColor(a.baseColor) ? { baseColor: optionalColor(a.baseColor) } : {}),
    role: roles.includes(a.role) ? a.role : "athlete",
    initialPosition: point(a.initialPosition),
    ...([1, 2, 3, 4, 5, 6].includes(Number(a.currentZone)) ? { currentZone: Number(a.currentZone) } : {}),
    ...(Number.isInteger(a.rotationOrder) ? { rotationOrder: Number(a.rotationOrder) } : {}),
    ...(typeof a.isBackRow === "boolean" ? { isBackRow: a.isBackRow } : {}),
    ...(typeof a.isFrontRow === "boolean" ? { isFrontRow: a.isFrontRow } : {}),
  }));
  if (new Set(actors.map((a: {id: string}) => a.id)).size !== actors.length) throw new Error("Jogadores duplicados no arquivo.");
  const actorIds = new Set(actors.map((a: { id: string }) => a.id));
  const positions = (v: unknown, fallback?: Record<string, CourtPoint>) => {
    if (!v || typeof v !== "object") return fallback;
    return Object.fromEntries(actors.flatMap((a: { id: string; initialPosition: CourtPoint }) => {
      const rawPoint = (v as Record<string, CourtPoint>)[a.id];
      return rawPoint ? [[a.id, point(rawPoint)]] : fallback?.[a.id] ? [[a.id, fallback[a.id]]] : [];
    }));
  };
  const trajectories = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 100).flatMap(t => {
    const actorId = text(t?.actorId);
    if (!actorIds.has(actorId) || !Array.isArray(t?.points) || t.points.length < 2) return [];
    return [{ id: text(t.id), actorId, ...(optionalColor(t.color) ? { color: optionalColor(t.color) } : {}), points: t.points.slice(0, 300).map(point) }];
  });
  const phases = ["receive_legal", "receive_release", "attack_shape", "defense_shape", "serve_base", "serve_after_hit"];
  const formations = ["didactic_grid", "5x1_receive_3", "5x1_serving", "defense_base_6_back"];
  const steps = p.timeline.steps.map((s: CourtVisualStep) => {
    const actorPositions = positions(s.actorPositions) ?? Object.fromEntries(actors.map((a: { id: string; initialPosition: CourtPoint }) => [a.id, a.initialPosition]));
    const visibleActorIds = actors.filter((a: { id: string }) => !s.visibleActorIds || s.visibleActorIds.includes(a.id)).map((a: { id: string }) => a.id);
    const rotationIndex = Number(s.rotationIndex);
    const heights = s.actorElevations && typeof s.actorElevations === "object" && !Array.isArray(s.actorElevations) ? s.actorElevations : undefined;
    const actorElevations = Object.fromEntries(actors.flatMap((a: { id: string }) => { const elevation = elevationValue(heights?.[a.id]); return elevation ? [[a.id, elevation]] : []; }));
    const actorActions = normalizeCourtActorActions(s.actorActions, actors.map((a: { id: string }) => a.id));
    return {
      id: text(s.id), label: text(s.label), note: text(s.note, 1000), durationMs: Math.max(450, Math.min(30000, Number(s.durationMs) || 1600)), actorPositions, visibleActorIds,
      ...(Object.keys(actorElevations).length ? { actorElevations } : {}),
      ...(actorActions ? { actorActions } : {}),
      ...(positions(s.baselineActorPositions) ? { baselineActorPositions: positions(s.baselineActorPositions) } : {}),
      ...(positions(s.legalPositions) ? { legalPositions: positions(s.legalPositions) } : {}),
      ...(positions(s.tacticalPositions) ? { tacticalPositions: positions(s.tacticalPositions) } : {}),
      ...([1, 2, 3, 4, 5, 6].includes(rotationIndex) ? { rotationIndex } : {}),
      ...(phases.includes(String(s.phase)) ? { phase: s.phase } : {}),
      ...(formations.includes(String(s.formationKind)) ? { formationKind: s.formationKind } : {}),
      ...(Array.isArray(s.passers) ? { passers: s.passers.filter(id => actorIds.has(id)).slice(0, 6) } : {}),
      ...(s.setterTarget ? { setterTarget: point(s.setterTarget) } : {}),
      ...(Array.isArray(s.attackOptions) ? { attackOptions: s.attackOptions.map(id => text(id)).filter(id => actorIds.has(id)).slice(0, 6) } : {}),
      ...(Array.isArray(s.markerIds) ? { markerIds: s.markerIds.map(id => text(id)).slice(0, 100) } : {}),
      ...(Array.isArray(s.visibleLayerIds) ? { visibleLayerIds: s.visibleLayerIds.map(id => text(id)).slice(0, 20) } : {}),
      trajectories: trajectories(s.trajectories),
      ...(Array.isArray(s.transitions) ? { transitions: trajectories(s.transitions) } : {}),
      ...(Array.isArray(s.highlights) ? { highlights: s.highlights.slice(0, 50).map(h => ({ id: text(h.id), ...([1, 2, 3, 4, 5, 6].includes(Number(h.zone)) ? { zone: Number(h.zone) } : {}), ...([1, 2, 3, 4, 5, 6].includes(Number(h.slot)) ? { slot: Number(h.slot) } : {}), label: text(h.label), ...(optionalColor(h.color) ? { color: optionalColor(h.color) } : {}) })) } : {}),
    };
  });
  if (new Set(steps.map((s: CourtVisualStep) => s.id)).size !== steps.length) throw new Error("Etapas duplicadas no arquivo.");
  const drawings = Object.fromEntries(steps.map((s: CourtVisualStep) => [s.id, (Array.isArray(p.editor.drawings?.[s.id]) ? p.editor.drawings[s.id] : []).slice(0, 200).map((d: CourtDrawing) => {
    if (!["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"].includes(d.kind) || !Array.isArray(d.points) || !d.points.length) throw new Error("Objeto inválido.");
    const trajectoryHeights = ["arrow", "curve"].includes(d.kind) && d.points.length >= 2 ? parseCourtTrajectoryHeights(d.trajectoryHeights) : undefined;
    return { id: text(d.id), kind: d.kind, points: d.points.slice(0, 500).map(point), ...(d.kind === "curve" && d.curveMode === "through-point" && d.points.length === 3 ? { curveMode: "through-point" as const } : {}), ...(["arrow", "curve"].includes(d.kind) && d.points.length >= 2 && typeof d.startBallId === "string" && d.startBallId.length > 0 && d.startBallId.length <= 120 ? { startBallId: d.startBallId } : {}), ...(trajectoryHeights ? { trajectoryHeights } : {}), ...(elevationKinds.includes(d.kind) && elevationValue(d.elevation) ? { elevation: d.elevation } : {}), text: text(d.text, 200), color: color(d.color), dashed: Boolean(d.dashed), size: Math.max(12, Math.min(80, Number(d.size) || 28)), rotation: Number(d.rotation) % 360 || 0, locked: Boolean(d.locked), ...(typeof d.hidden === "boolean" ? { hidden: d.hidden } : {}), motion: d.kind === "ball" && Array.isArray(d.motion) ? d.motion.slice(0, 300).map(point) : undefined };
  })]));
  for (const objects of Object.values(drawings) as CourtDrawing[][]) {
    if (new Set(objects.map(drawing => drawing.id)).size !== objects.length || objects.some(drawing => actorIds.has(drawing.id))) throw new Error("Objetos com identificadores duplicados no arquivo.");
  }
  for (const step of steps) drawings[step.id] = resolveCourtDrawingAnchors(drawings[step.id]);
  steps.forEach((step: CourtVisualStep, index: number) => {
    if (p.timeline.steps[index].simulation === undefined) return;
    const simulation = normalizeCourtSimulation(p.timeline.steps[index].simulation, actors.map((actor: { id: string }) => actor.id),
      (drawings[step.id] as CourtDrawing[]).filter(drawing => drawing.kind === "ball").map(drawing => drawing.id));
    if (!simulation) throw new Error("Simulação de quadra inválida.");
    step.simulation = simulation;
  });
  const layouts = ["didactic_slots", "official_volleyball_zones", "official_zones"];
  const labels = ["slots", "official_zones"];
  const views = ["full_court", "team_half"];
  const renderStyles = ["standard", "coach_board"];
  const layerKinds = ["zones", "actors", "markers", "arrows", "trajectories", "highlights"];
  const layers = (Array.isArray(p.layers) ? p.layers : []).slice(0, 20).flatMap((layer: { id?: unknown; label?: unknown; kind?: unknown; visibleByDefault?: unknown }) => layerKinds.includes(String(layer.kind)) ? [{ id: text(layer.id), label: text(layer.label, 40), kind: layer.kind, visibleByDefault: Boolean(layer.visibleByDefault) }] : []);
  const markers = (Array.isArray(p.markers) ? p.markers : []).slice(0, 100).flatMap((marker: { id?: unknown; type?: unknown; label?: unknown; position?: unknown; color?: unknown }) => ["cone", "ball", "target"].includes(String(marker.type)) ? [{ id: text(marker.id), type: marker.type, label: text(marker.label, 40), position: point(marker.position), ...(optionalColor(marker.color) ? { color: optionalColor(marker.color) } : {}) }] : []);
  const parsed = {
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: Boolean(p.court?.showZones),
      layoutMode: layouts.includes(p.court?.layoutMode) ? p.court.layoutMode : "official_volleyball_zones",
      labelMode: labels.includes(p.court?.labelMode) ? p.court.labelMode : "official_zones",
      courtView: views.includes(p.court?.courtView) ? p.court.courtView : "full_court",
      renderStyle: renderStyles.includes(p.court?.renderStyle) ? p.court.renderStyle : "coach_board",
    },
    actors,
    markers,
    layers: layers.length ? layers : newCourtBoard().layers,
    timeline: { steps },
    editor: { version: 1, coordinates: "regulation", title: text(p.editor.title) || "Jogada importada", folder: text(p.editor.folder), tags: text(p.editor.tags), favorite: false, actorMeta: Object.fromEntries(actors.map((a: { id: string }) => [a.id, { team: p.editor.actorMeta?.[a.id]?.team === "B" ? "B" : "A", locked: Boolean(p.editor.actorMeta?.[a.id]?.locked), ...(typeof p.editor.actorMeta?.[a.id]?.hidden === "boolean" ? { hidden: p.editor.actorMeta[a.id].hidden } : {}), ...(p.editor.actorMeta?.[a.id]?.simulationSupport === true ? { simulationSupport: true } : {}) }])), hiddenLayers: Array.isArray(p.editor.hiddenLayers) ? p.editor.hiddenLayers.map((id: unknown) => text(id)).slice(0, 20) : [], drawings },
  } as CourtVisualPayload;
  const layerOrder = normalizeCourtLayerOrder(parsed, p.editor.layerOrder);
  return layerOrder ? { ...parsed, editor: { ...parsed.editor!, layerOrder } } : parsed;
}
