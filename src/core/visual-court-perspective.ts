import { middleAttackColor } from "./court-simulation/attack-settings.js";
import type { CourtPoint, CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import { actorPoint, courtSelectionElevation, courtTrajectoryHeightTargets, drawingAtProgress, frameDrawings, pointAlong, resolveCourtDrawingAnchors, type CourtDrawing } from "./visual-court-editor";
import { courtTrajectoryHeightAt, courtTrajectoryHeights, parseCourtTrajectoryHeights, type CourtTrajectoryHandleKind, type CourtTrajectoryHeights } from "./court-arrow-trajectory";
import { courtOpponentIdentity, receptionPlayerIdentity, sampleCourtSimulation } from "./court-simulation";
import type { CourtSimulationActor, CourtSimulationPoint } from "./court-simulation-model";
import { courtDrawingTraceProgress } from "./court-simulation-display";
import { buildCourtPerspectiveSimulation, type CourtPerspectiveSimulation } from "./court-perspective-guides";
import { projectCourtBlockShadow, revealCourtBlockShadow } from "./court-block-shadow";
import { courtActorActionPose } from "./court-actor-actions";
import { courtSkillMotion, type CourtSkillMotion } from "./court-skill-motion";
import { manualCourtTravel } from "./court-manual-travel";

export type CourtWorldPoint = { x: number; y: number; z: number };
export type CourtPerspectivePoseRole = "setter" | "passer" | "attacker" | "server" | "blocker";
export type CourtPerspectiveActor = CourtSkillMotion & {
  opacity?: number;
  id: string;
  label: string;
  rotationPosition?: number;
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
  contactWeight?: number;
  attackFrame?: number;
  spikeVelocity?: CourtSimulationPoint;
  runCycle?: number;
  runDrive?: number;
  attackReadiness?: number;
  attackReadyLeft?: boolean;
  plantedStance?: boolean;
  travelMotion?: CourtSimulationActor["travelMotion"];
  attackStrideScale?: number;
  attackLeadIn?: number;
  attackSlide?: boolean;
  attackTakeoffDepth?: number;
  blockFrame?: number;
  blockMirror?: boolean;
  feet?: CourtSimulationActor["feet"];
  feetWeight?: number;
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
export type CourtRotationPreview = {
  paths: Record<string, [CourtSimulationPoint, CourtSimulationPoint]>;
  entering?: readonly string[];
  exiting?: Record<string, { label: string; color: string }>;
  progress: number;
  durationMs: number;
  serve?: { serverId: string; positions: Record<string, CourtSimulationPoint>; netPlayers: string[]; defensePositions?: Record<string, CourtSimulationPoint> };
};

export function courtRotationServeProgress(preview?: CourtRotationPreview) {
  const t = preview?.progress ?? 0;
  return preview?.serve && t >= .33 && t < .68 ? (t - .33) / .35 * .62 : null;
}

export function courtRotationTravel(preview: CourtRotationPreview, id: string) {
  const path = preview.paths[id];
  const servePosition = preview.serve?.positions[id];
  if (!servePosition) return { path, progress: preview.progress, durationMs: preview.durationMs };
  const t = preview.progress;
  const defense = preview.serve?.defensePositions?.[id];
  const [start, end, from, to] = t < .33
    ? [0, .33, path[0], servePosition] as const
    : defense && t >= .88
      ? [.90, 1, defense, path[1]] as const
      : [.68, defense ? .88 : 1, servePosition, defense ?? path[1]] as const;
  const progress = Math.max(0, Math.min(1, (t - start) / (end - start)));
  return {
    path: [from, to] as const,
    progress: progress * progress * (3 - 2 * progress),
    durationMs: preview.durationMs * (end - start),
  };
}

export function buildCourtPerspectiveFrame(
  payload: CourtVisualPayload,
  stepIndex: number,
  progress: number,
  selected: string[] = [],
  rotationPreview?: CourtRotationPreview,
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
  const servePreview = rotationPreview?.serve;
  const serveProgress = rotationPreview?.progress ?? 0;
  const ownServeProgress = courtRotationServeProgress(rotationPreview);
  const ownServe = ownServeProgress === null ? null : sampleCourtSimulation(payload, index, ownServeProgress);
  const serveActor = ownServe?.actors.find(actor => actor.role === "server");
  const sampled = new Map(simulation?.actors.map(actor => [actor.id, actor]));
  if (simulation) {
    frame.simulation = buildCourtPerspectiveSimulation(payload, index, simulation, showMovement && !servePreview);
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
    .filter(actor => !step.visibleActorIds || step.visibleActorIds.includes(actor.id) || Boolean(rotationPreview?.exiting?.[actor.id]))
    .filter(actor => !sampled.has(actor.id) || simulation!.visibleIds.includes(actor.id))
    .map(actor => {
      const path = (step.trajectories ?? step.transitions)?.find(item => item.actorId === actor.id)?.points ?? [];
      const position = path.length ? pointAlong(path, fraction) : actorPoint(payload, index, actor.id);
      const meta = payload.editor?.actorMeta[actor.id];
      const elevation = sampled.has(actor.id) && !authoredFinal ? undefined : courtSelectionElevation(payload, index, actor.id);
      const exiting = rotationPreview?.exiting?.[actor.id];
      const identity = receptionPlayerIdentity(simulation?.config, actor.id);
      const opponent = courtOpponentIdentity(simulation?.config, actor);
      const label = exiting?.label ?? identity?.label ?? opponent?.label ?? (actor.label || String(actor.number ?? ""));
      const showLabel = !hide.includes("labels") && (payload.editor?.showActorNumbers !== false || !(identity && simulation?.config.system === "6-0") && !/^\d+$/.test(label));
      const state = sampled.get(actor.id);
      const action = step.actorActions?.[actor.id];
      const manualTravel = !state && !elevation && (!action || action === "ready") && path.length > 1;
      const worldPath = showMovement || manualTravel ? path.map(point => courtPointToWorld(point, elevation ?? 0)) : [];
      const result: CourtPerspectiveActor = {
        id: actor.id, label: showLabel ? label : "",
        ...(showLabel && identity ? { rotationPosition: identity.position } : {}),
        role: actor.role, color: exiting?.color ?? identity?.color ?? opponent?.color ?? middleAttackColor(simulation?.config, actor.id) ?? actor.color ?? actor.baseColor ?? (meta?.team === "B" ? "#4389ff" : "#19c87b"),
        locked: Boolean(meta?.locked), position: courtPointToWorld(position, elevation ?? 0),
        ...(elevation !== undefined ? { elevation } : {}),
        facing: heading(path, fraction, position), poseRole: poseRole(actor, step, meta?.team),
        pose: "ready", jump: 0,
        path: showMovement ? worldPath : [],
      };
      if (!state && action) {
        const { role, ...pose } = courtActorActionPose(action);
        Object.assign(result, pose, { poseRole: role, ...(action === "attack" ? { mirror: actor.attackHand === "left" } : {}) });
      }
      if (manualTravel) {
        const gait = manualCourtTravel(worldPath, fraction, step.durationMs);
        if (gait) {
          Object.assign(result, gait);
          if (result.poseRole === "blocker" && gait.feet) {
            result.feet = [gait.feet[1], gait.feet[0]];
            result.handAngle = Math.atan2(gait.facing[0], gait.facing[1]) * 180 / Math.PI;
          }
        }
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
          ...courtSkillMotion(simulation!, state, state.slot),
          ...(state.contactWeight !== undefined ? { contactWeight: state.contactWeight } : {}),
          ...(state.attackFrame !== undefined ? { attackFrame: state.attackFrame } : {}),
          ...(state.attackFrame !== undefined && simulation?.mode === "attack" && simulation.flight ? {
            spikeVelocity: simulation.flight.segments[0].velocity,
            contactTarget: { x: simulation.flight.hit[0], y: simulation.flight.hit[1], z: simulation.flight.hit[2] },
          } : {}),
          ...(state.runCycle !== undefined ? { runCycle: state.runCycle } : {}),
          ...(state.runDrive !== undefined ? { runDrive: state.runDrive } : {}),
          ...(state.attackReadiness !== undefined ? { attackReadiness: state.attackReadiness, attackReadyLeft: state.attackReadyLeft } : {}),
          ...(state.plantedStance ? { plantedStance: true } : {}),
          ...(state.travelMotion ? { travelMotion: state.travelMotion } : {}),
          ...(state.attackStrideScale !== undefined ? { attackStrideScale: state.attackStrideScale } : {}),
          ...(state.attackLeadIn ? { attackLeadIn: state.attackLeadIn } : {}),
          ...(state.attackSlide ? { attackSlide: true } : {}),
          ...(state.attackTakeoffDepth !== undefined ? { attackTakeoffDepth: state.attackTakeoffDepth } : {}),
          ...(state.feet ? { feet: state.feet, feetWeight: state.feetWeight } : {}),
          ...(state.blockFrame !== undefined ? { blockFrame: state.blockFrame, blockMirror: state.blockMirror } : {}),
          crouch: state.crouch, extension: state.extension, handAngle: state.handAngle,
          poseScale: state.role === "server" ? 1 : simulation!.mode === "receive" ? .9 : state.role === "setter" ? .86 : state.role === "passer" ? .96 : .9,
          path: [],
        });
      }
      if (servePreview && state?.role === "server") {
        result.opacity = Math.max(0, 1 - Math.min(serveProgress / .12, (1 - serveProgress) / .12));
      }
      const rotationPath = rotationPreview?.paths[actor.id];
      if (rotationPath && rotationPreview) {
        const travel = courtRotationTravel(rotationPreview, actor.id);
        const [start, end] = travel.path;
        const t = travel.progress;
        const entering = rotationPreview.entering?.includes(actor.id);
        if (entering || exiting) {
          result.opacity = entering ? Math.min(1, t / .25) : Math.min(1, (1 - t) / .35);
        }
        const points = travel.path.map(([x, , z]) => ({ x, z }));
        const gait = ownServe ? undefined : manualCourtTravel(points, t, travel.durationMs);
        Object.assign(result, gait, {
          position: { x: start[0] + (end[0] - start[0]) * t, y: 0, z: start[2] + (end[2] - start[2]) * t },
          poseRole: "passer", pose: gait ? "approach" : "ready", previousPose: "ready",
          poseBlend: gait ? 1 : 0, jump: 0,
        });
        if (ownServe) {
          // The ready poses use their own stance, independent of the preceding steps.
          Object.assign(result, {
            facing: [0, -1], feet: undefined, feetWeight: undefined, plantedStance: false,
          });
        }
        if (ownServe && serveActor && actor.id === servePreview?.serverId) {
          const [x, , z] = serveActor.position;
          const dx = serveActor.facing[0] - x, dz = serveActor.facing[1] - z;
          const length = Math.hypot(dx, dz);
          const motion = courtSkillMotion(ownServe, serveActor);
          const contact = motion?.contactTarget;
          Object.assign(result, {
            position: { x: -x, y: 0, z: -z },
            facing: length > .000001 ? [-dx / length, -dz / length] : [0, -1],
            poseRole: "server", pose: serveActor.pose, jump: serveActor.jump,
            previousPose: serveActor.previousPose, poseBlend: serveActor.poseBlend,
            mirror: serveActor.mirror ?? true, poseScale: 1,
            ...motion,
            contactTarget: contact ? { x: -contact.x, y: contact.y, z: -contact.z } : undefined,
          });
        } else if (ownServe && servePreview?.netPlayers.includes(actor.id)) {
          Object.assign(result, { poseRole: "blocker", pose: "ready", handAngle: 180, crouch: .13, extension: .28 * Math.min(1, (serveProgress - .33) / .05, (.68 - serveProgress) / .05) });
        }
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
        previousPose: state.previousPose, poseBlend: state.poseBlend, ...courtSkillMotion(simulation!, state), poseScale: setter ? .86 : .96, path: [],
      });
    });
  }
  if (!hide.includes("drawings")) {
    const legacy: CourtDrawing[] = [
      ...(step.arrows ?? []).map(arrow => ({ id: arrow.id, kind: "arrow" as const, points: [arrow.from, arrow.to], color: arrow.color ?? "#fff", size: 28, rotation: 0 })),
      ...payload.markers.filter(marker => !step.markerIds || step.markerIds.includes(marker.id)).map(marker => ({ id: marker.id, kind: marker.type, points: [marker.position], color: marker.color ?? "#ffdc53", size: 28, rotation: 0 })),
    ];
    const drawings = [...legacy, ...frameDrawings(payload, index)].filter(drawing => courtDrawingTraceProgress(drawing, simulation) >= 0 && (!servePreview || ownServe || drawing.id !== simulation?.ballId)).map(drawing => simulation && drawing.id === simulation.ballId
      ? { ...drawing, points: [{ x: (simulation.defenseContact ?? simulation.ball)[0] / 9 + .5, y: (simulation.defenseContact ?? simulation.ball)[2] / 18 + .5 }] }
      : drawingAtProgress(drawing, fraction));
    const projected = revealCourtBlockShadow(resolveCourtDrawingAnchors(drawings), simulation, payload.editor).map(drawing => {
      const elevation = ["ball", "cone", "target", "ladder"].includes(drawing.kind) && (drawing.id !== simulation?.ballId || authoredFinal) ? courtSelectionElevation(payload, index, drawing.id) : undefined;
      const result = perspectiveDrawing(drawing, showMovement, elevation);
      const traceProgress = courtDrawingTraceProgress(drawing, simulation);
      if (traceProgress < 1) result.traceProgress = traceProgress;
      if (simulation && drawing.id === simulation.ballId) {
        const [x, y, z] = ownServe?.ball ?? simulation.ball;
        result.points = ownServe ? [{ x: -x, y, z: -z }] : servePreview ? [] : [{ x, y, z }];
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
