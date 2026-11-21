import type { CourtPoint, CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import { actorPoint, courtSelectionElevation, courtTrajectoryHeightTargets, drawingAtProgress, frameDrawings, pointAlong, resolveCourtDrawingAnchors, type CourtDrawing } from "./visual-court-editor";
import { courtTrajectoryHeightAt, courtTrajectoryHeights, parseCourtTrajectoryHeights, type CourtTrajectoryHandleKind, type CourtTrajectoryHeights } from "./court-arrow-trajectory";
import { sampleCourtSimulation } from "./court-simulation";
import { courtDrawingTraceProgress } from "./court-simulation-display";
import { buildCourtPerspectiveSimulation, type CourtPerspectiveSimulation } from "./court-perspective-guides";
import { projectCourtBlockShadow } from "./court-block-shadow";
import { courtActorActionPose } from "./court-actor-actions";

export type CourtWorldPoint = { x: number; y: number; z: number };
export type CourtPerspectivePoseRole = "setter" | "passer" | "attacker" | "server" | "blocker";
export type CourtPerspectiveActor = {
  id: string;
  label: string;
  role: CourtVisualActor["role"];
  color: string;
  locked: boolean;
  illustration?: boolean;
  /** Authored offset; absent on objects whose height is controlled by the engine. */
  elevation?: number;
  simulated?: boolean;
  position: CourtWorldPoint;
  /** Unit heading in court X/Z coordinates, independent of camera orientation. */
  facing: [number, number];
  poseRole: CourtPerspectivePoseRole;
  pose: string;
  jump: number;
  side?: boolean;
  mirror?: boolean;
  previousPose?: string;
  previousSide?: boolean;
  poseBlend?: number;
  poseScale?: number;
  crouch?: number;
  extension?: number;
  handAngle?: number;
  /** Full authored movement; the renderer may reveal it with frame.progress. */
  path: CourtWorldPoint[];
};
export type CourtPerspectiveDrawing = {
  id: string;
  kind: CourtDrawing["kind"];
  points: CourtWorldPoint[];
  curveMode?: CourtDrawing["curveMode"];
  startBallId?: string;
  traceProgress?: number;
  trajectoryHeights?: CourtTrajectoryHeights;
  /** The renderer locates these on its actual stroke, including legacy landscape curves. */
  trajectoryHandles?: { kind: CourtTrajectoryHandleKind; value: number; editable: boolean; min: number; max: number }[];
  elevation?: number;
  color: string;
  text?: string;
  size: number;
  rotation: number;
  locked: boolean;
  dashed?: boolean;
  motion?: CourtWorldPoint[];
  simulated?: boolean;
};
export type CourtPerspectiveFrame = {
  stepId: string;
  progress: number;
  phase: CourtVisualStep["phase"];
  actors: CourtPerspectiveActor[];
  drawings: CourtPerspectiveDrawing[];
  selected: string[];
  hide: string[];
  court: boolean;
  net: boolean;
  simulation?: CourtPerspectiveSimulation;
};

/** Canonical regulation coordinates cover the complete 9 × 18 m court. */
export function courtPointToWorld(point: CourtPoint, height = 0): CourtWorldPoint {
  return { x: (point.x - 0.5) * 9, y: height, z: (point.y - 0.5) * 18 };
}

/** Keep the inverse exact; editing commands own clamping and snapping. */
export function worldToCourtPoint(point: Pick<CourtWorldPoint, "x" | "z">): CourtPoint {
  return { x: point.x / 9 + 0.5, y: point.z / 18 + 0.5 };
}

function heading(points: CourtPoint[], progress: number, position: CourtPoint): [number, number] {
  if (points.length > 1) {
    const before = courtPointToWorld(pointAlong(points, Math.max(0, progress - 0.001)));
    const after = courtPointToWorld(pointAlong(points, Math.min(1, progress + 0.001)));
    const x = after.x - before.x, z = after.z - before.z;
    const length = Math.hypot(x, z);
    if (length > 0.000001) return [x / length, z / length];
  }
  return [0, position.y >= 0.5 ? -1 : 1];
}

function poseRole(actor: CourtVisualActor, step: CourtVisualStep, team?: "A" | "B"): CourtPerspectivePoseRole {
  if (actor.role === "setter") return "setter";
  if (actor.role === "libero" || step.passers?.includes(actor.id)) return "passer";
  if (step.phase === "attack_shape" && team === "B" && actor.isFrontRow) return "blocker";
  if (step.phase === "attack_shape" && step.attackOptions?.includes(actor.id)) return "attacker";
  return "setter";
}

function perspectiveDrawing(drawing: CourtDrawing, showMovement: boolean, elevation?: number): CourtPerspectiveDrawing {
  const height = (drawing.kind === "ball" ? 0.12 : 0.025) + (elevation ?? 0);
  const trajectoryHeights = ["arrow", "curve"].includes(drawing.kind) && drawing.points.length >= 2 ? parseCourtTrajectoryHeights(drawing.trajectoryHeights) : undefined;
  return {
    id: drawing.id, kind: drawing.kind,
    points: drawing.points.map(point => courtPointToWorld(point, height)),
    ...(drawing.kind === "curve" && drawing.curveMode === "through-point" && drawing.points.length === 3 ? { curveMode: "through-point" as const } : {}),
    ...(["arrow", "curve"].includes(drawing.kind) && drawing.startBallId ? { startBallId: drawing.startBallId } : {}),
    ...(trajectoryHeights ? { trajectoryHeights } : {}),
    ...(elevation !== undefined ? { elevation } : {}),
    color: drawing.color, size: drawing.size, rotation: drawing.rotation,
    locked: Boolean(drawing.locked),
    ...(drawing.text !== undefined ? { text: drawing.text } : {}),
    ...(drawing.dashed !== undefined ? { dashed: drawing.dashed } : {}),
    ...(showMovement && drawing.motion?.length ? { motion: drawing.motion.map(point => courtPointToWorld(point, height)) } : {}),
  };
}

/**
 * A projection of the existing editor document, never a second simulation state.
 * Sampling deliberately matches CourtEditorScene: equal time per authored segment.
 * An enabled simulation is sampled by the canonical engine for both projections.
 */
export function buildCourtPerspectiveFrame(
  payload: CourtVisualPayload,
  stepIndex: number,
  progress: number,
  selected: string[] = [],
): CourtPerspectiveFrame {
  const index = Math.max(0, Math.min(payload.timeline.steps.length - 1, Math.floor(stepIndex) || 0));
  const step = payload.timeline.steps[index];
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const hide = [...(payload.editor?.hiddenLayers ?? [])];
  const frame: CourtPerspectiveFrame = {
    stepId: step?.id ?? "", progress: fraction, phase: step?.phase,
    actors: [], drawings: [], selected: [], hide,
    court: !hide.includes("court"), net: !hide.includes("court"),
  };
  if (!step) return frame;
  const showMovement = !hide.includes("movements");
  const simulation = sampleCourtSimulation(payload, index, fraction);
  const authoredFinal = simulation?.mode === "defense" && fraction === 1;
  const sampled = new Map(simulation?.actors.map(actor => [actor.id, actor]));
  if (simulation) {
    frame.simulation = buildCourtPerspectiveSimulation(payload, index, simulation, showMovement);
    if (authoredFinal && showMovement && !hide.includes("drawings") && !hide.includes("actors")) {
      const blockers = simulation.actors.filter(actor => !payload.editor?.actorMeta[actor.id]?.hidden);
      const projection = projectCourtBlockShadow(simulation.ball, blockers);
      const matchingShadow = frameDrawings(payload, index).find(drawing =>
        !drawing.hidden && drawing.kind === "area" && drawing.points.length === projection.points.length &&
        drawing.points.every((point, i) => Math.hypot(point.x - projection.points[i].x, point.y - projection.points[i].y) < 1e-7));
      if (matchingShadow) {
        const color = matchingShadow.color;
        frame.simulation.paths = [...frame.simulation.paths, ...projection.rays.map((points, i) => ({
          id: `defense-shadow-ray-${i}`, points, dashed: true, opacity: .68, color,
        }))];
        frame.simulation.guideKey = JSON.stringify([frame.simulation.guideKey, projection.rays, color]);
      }
    }
  }
  if (!hide.includes("actors")) frame.actors = payload.actors
    .filter(actor => !payload.editor?.actorMeta[actor.id]?.hidden)
    .filter(actor => !step.visibleActorIds || step.visibleActorIds.includes(actor.id))
    .filter(actor => !sampled.has(actor.id) || simulation!.visibleIds.includes(actor.id))
    .map(actor => {
      const path = (step.trajectories ?? step.transitions)?.find(item => item.actorId === actor.id)?.points ?? [];
      const position = path.length ? pointAlong(path, fraction) : actorPoint(payload, index, actor.id);
      const meta = payload.editor?.actorMeta[actor.id];
      const elevation = sampled.has(actor.id) && !authoredFinal ? undefined : courtSelectionElevation(payload, index, actor.id);
      const showLabel = !hide.includes("labels") && (payload.editor?.showActorNumbers !== false || !/^\d+$/.test(String(actor.label || actor.number || "")));
      const result: CourtPerspectiveActor = {
        id: actor.id, label: showLabel ? actor.label || String(actor.number ?? "") : "",
        role: actor.role, color: actor.color ?? actor.baseColor ?? (meta?.team === "B" ? "#4389ff" : "#19c87b"),
        locked: Boolean(meta?.locked), position: courtPointToWorld(position, elevation ?? 0),
        ...(elevation !== undefined ? { elevation } : {}),
        facing: heading(path, fraction, position), poseRole: poseRole(actor, step, meta?.team),
        pose: "ready", jump: 0,
        path: showMovement ? path.map(point => courtPointToWorld(point, elevation ?? 0)) : [],
      };
      const state = sampled.get(actor.id);
      const action = step.actorActions?.[actor.id];
      if (!state && action) {
        const { role, ...pose } = courtActorActionPose(action);
        Object.assign(result, pose, { poseRole: role });
      }
      if (state) {
        const [x, y, z] = state.position;
        const dx = state.facing[0] - x, dz = state.facing[1] - z, length = Math.hypot(dx, dz);
        Object.assign(result, {
          simulated: !authoredFinal,
          position: { x, y, z }, facing: length > .000001 ? [dx / length, dz / length] : [0, z >= 0 ? -1 : 1],
          poseRole: state.role, pose: state.pose, jump: state.jump, side: state.side,
          mirror: state.mirror ?? (state.role === "server"), previousPose: state.previousPose,
          previousSide: state.previousSide, poseBlend: state.poseBlend,
          crouch: state.crouch, extension: state.extension, handAngle: state.handAngle,
          poseScale: state.role === "server" ? 1 : simulation!.mode === "receive" ? .9 : state.role === "setter" ? .86 : state.role === "passer" ? .96 : .9,
          path: [],
        });
      }
      return result;
    });
  if (!hide.includes("actors") && simulation?.defenseSupport) {
    simulation.defenseSupport.forEach(state => {
      const [x, y, z] = state.position;
      const dx = state.facing[0] - x, dz = state.facing[1] - z, length = Math.hypot(dx, dz);
      const setter = state.role === "setter";
      let id = `defense-illustration-${state.role}`;
      while (payload.actors.some(actor => actor.id === id)) id += "-";
      frame.actors.push({
        id, label: hide.includes("labels") ? "" : setter ? "L3" : "P6",
        role: setter ? "setter" : "libero", color: "#4389ff", locked: true, illustration: true, simulated: true,
        position: { x, y, z }, facing: length > .000001 ? [dx / length, dz / length] : [0, z >= 0 ? -1 : 1],
        poseRole: state.role, pose: state.pose, jump: state.jump, side: state.side,
        previousPose: state.previousPose, poseBlend: state.poseBlend, poseScale: setter ? .86 : .96, path: [],
      });
    });
  }
  if (!hide.includes("drawings")) {
    const legacy: CourtDrawing[] = [
      ...(step.arrows ?? []).map(arrow => ({ id: arrow.id, kind: "arrow" as const, points: [arrow.from, arrow.to], color: arrow.color ?? "#fff", size: 28, rotation: 0 })),
      ...payload.markers.filter(marker => !step.markerIds || step.markerIds.includes(marker.id)).map(marker => ({ id: marker.id, kind: marker.type, points: [marker.position], color: marker.color ?? "#ffdc53", size: 28, rotation: 0 })),
    ];
    const drawings = [...legacy, ...frameDrawings(payload, index)].filter(drawing => courtDrawingTraceProgress(drawing, simulation) >= 0).map(drawing => simulation && drawing.id === simulation.ballId
      ? { ...drawing, points: [{ x: (simulation.defenseContact ?? simulation.ball)[0] / 9 + .5, y: (simulation.defenseContact ?? simulation.ball)[2] / 18 + .5 }] }
      : drawingAtProgress(drawing, fraction));
    const projected = resolveCourtDrawingAnchors(drawings).map(drawing => {
      const elevation = ["ball", "cone", "target", "ladder"].includes(drawing.kind) && (drawing.id !== simulation?.ballId || authoredFinal) ? courtSelectionElevation(payload, index, drawing.id) : undefined;
      const result = perspectiveDrawing(drawing, showMovement, elevation);
      const traceProgress = courtDrawingTraceProgress(drawing, simulation);
      if (traceProgress < 1) result.traceProgress = traceProgress;
      if (simulation && drawing.id === simulation.ballId) {
        result.points = [{ x: simulation.ball[0], y: simulation.ball[1], z: simulation.ball[2] }];
        result.simulated = !authoredFinal;
        delete result.motion;
      }
      return result;
    });
    const balls = new Map(projected.filter(drawing => drawing.kind === "ball" && drawing.points[0]).map(drawing => [drawing.id, drawing.points[0]]));
    if (simulation?.defenseContact) {
      const [x, y, z] = simulation.defenseContact;
      balls.set(simulation.ballId, { x, y, z });
    }
    const hidden = new Set(drawings.filter(drawing => drawing.hidden).map(drawing => drawing.id));
    frame.drawings = projected.filter(drawing => !hidden.has(drawing.id)).map(drawing => {
      const ball = drawing.startBallId ? balls.get(drawing.startBallId) : undefined;
      if (!["arrow", "curve"].includes(drawing.kind) || drawing.points.length < 2) return drawing;
      const floor = drawing.points[drawing.points.length - 1].y;
      const heights = courtTrajectoryHeights(drawing.trajectoryHeights, ball?.y);
      const trajectoryHandles = courtTrajectoryHeightTargets(payload, index, drawing.id, fraction).map(handle => ({ ...handle, value: heights[handle.kind] }));
      if (!ball && !drawing.trajectoryHeights) return { ...drawing, trajectoryHandles };
      const distances = drawing.points.map((point, i) => i ? Math.hypot(point.x - drawing.points[i - 1].x, point.z - drawing.points[i - 1].z) : 0);
      const total = distances.reduce((sum, length) => sum + length, 0); let travelled = 0;
      return { ...drawing, trajectoryHandles, ...(drawing.trajectoryHeights ? { trajectoryHeights: heights } : {}), points: drawing.points.map((point, i) => {
        travelled += distances[i];
        const fraction = drawing.kind === "curve" && drawing.curveMode === "through-point" && drawing.points.length === 3 ? i / 2 : total ? travelled / total : i / (drawing.points.length - 1);
        const y = drawing.trajectoryHeights ? courtTrajectoryHeightAt(heights, fraction) : i === 0 ? ball!.y : i === drawing.points.length - 1 ? floor : fraction === .5 ? (ball!.y + floor) / 2 : ball!.y + (floor - ball!.y) * fraction;
        return { ...point, y };
      }) };
    });
  }
  const visible = new Set([...frame.actors.filter(actor => !actor.illustration), ...frame.drawings].map(item => item.id));
  frame.selected = selected.filter(id => visible.has(id));
  return frame;
}
