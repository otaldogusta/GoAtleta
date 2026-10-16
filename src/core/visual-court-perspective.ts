import type { CourtPoint, CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import { actorPoint, drawingAtProgress, frameDrawings, pointAlong, type CourtDrawing } from "./visual-court-editor";
import { sampleCourtSimulation } from "./court-simulation";
import { buildCourtPerspectiveSimulation, type CourtPerspectiveSimulation } from "./court-perspective-guides";

export type CourtWorldPoint = { x: number; y: number; z: number };
export type CourtPerspectivePoseRole = "setter" | "passer" | "attacker" | "server" | "blocker";
export type CourtPerspectiveActor = {
  id: string;
  label: string;
  role: CourtVisualActor["role"];
  color: string;
  locked: boolean;
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

function perspectiveDrawing(drawing: CourtDrawing, progress: number, showMovement: boolean): CourtPerspectiveDrawing {
  const sampled = drawingAtProgress(drawing, progress);
  // Height is a rendering detail. The document currently authors ground paths only.
  const height = drawing.kind === "ball" ? 0.12 : 0.025;
  return {
    id: drawing.id, kind: drawing.kind,
    points: sampled.points.map(point => courtPointToWorld(point, height)),
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
  const sampled = new Map(simulation?.actors.map(actor => [actor.id, actor]));
  if (simulation) frame.simulation = buildCourtPerspectiveSimulation(payload, index, simulation, showMovement);
  if (!hide.includes("actors")) frame.actors = payload.actors
    .filter(actor => !step.visibleActorIds || step.visibleActorIds.includes(actor.id))
    .filter(actor => !sampled.has(actor.id) || simulation!.visibleIds.includes(actor.id))
    .map(actor => {
      const path = (step.trajectories ?? step.transitions)?.find(item => item.actorId === actor.id)?.points ?? [];
      const position = path.length ? pointAlong(path, fraction) : actorPoint(payload, index, actor.id);
      const meta = payload.editor?.actorMeta[actor.id];
      const showLabel = !hide.includes("labels") && (payload.editor?.showActorNumbers !== false || !/^\d+$/.test(String(actor.label || actor.number || "")));
      const result: CourtPerspectiveActor = {
        id: actor.id, label: showLabel ? actor.label || String(actor.number ?? "") : "",
        role: actor.role, color: actor.color ?? actor.baseColor ?? (meta?.team === "B" ? "#4389ff" : "#19c87b"),
        locked: Boolean(meta?.locked), position: courtPointToWorld(position),
        facing: heading(path, fraction, position), poseRole: poseRole(actor, step, meta?.team),
        pose: "ready", jump: 0,
        path: showMovement ? path.map(point => courtPointToWorld(point)) : [],
      };
      const state = sampled.get(actor.id);
      if (state) {
        const [x, y, z] = state.position;
        const dx = state.facing[0] - x, dz = state.facing[1] - z, length = Math.hypot(dx, dz);
        Object.assign(result, {
          position: { x, y, z }, facing: length > .000001 ? [dx / length, dz / length] : [0, z >= 0 ? -1 : 1],
          poseRole: state.role, pose: state.pose, jump: state.jump, side: state.side,
          mirror: state.mirror ?? (state.role === "server"), previousPose: state.previousPose,
          previousSide: state.previousSide, poseBlend: state.poseBlend,
          crouch: state.crouch, extension: state.extension, handAngle: state.handAngle,
          poseScale: simulation!.mode === "receive" ? .9 : state.role === "setter" ? .86 : state.role === "passer" ? .96 : .9,
          path: [],
        });
      }
      return result;
    });
  if (!hide.includes("drawings")) {
    const legacy: CourtDrawing[] = [
      ...(step.arrows ?? []).map(arrow => ({ id: arrow.id, kind: "arrow" as const, points: [arrow.from, arrow.to], color: arrow.color ?? "#fff", size: 28, rotation: 0 })),
      ...payload.markers.filter(marker => !step.markerIds || step.markerIds.includes(marker.id)).map(marker => ({ id: marker.id, kind: marker.type, points: [marker.position], color: marker.color ?? "#ffdc53", size: 28, rotation: 0 })),
    ];
    frame.drawings = [...legacy, ...frameDrawings(payload, index)].map(drawing => {
      const result = perspectiveDrawing(drawing, fraction, showMovement);
      if (simulation && drawing.id === simulation.ballId) {
        result.points = [{ x: simulation.ball[0], y: simulation.ball[1], z: simulation.ball[2] }];
        result.simulated = true;
        delete result.motion;
      }
      return result;
    });
  }
  const visible = new Set([...frame.actors, ...frame.drawings].map(item => item.id));
  frame.selected = selected.filter(id => visible.has(id));
  return frame;
}
