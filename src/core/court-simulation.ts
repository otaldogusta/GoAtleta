import type { CourtPoint, CourtVisualActor, CourtVisualPayload } from "./visual-court";
import { attackFormation, attackPreset, sampleAttack } from "./court-simulation/attack-motion.js";
import { receptionFormation } from "./court-simulation/formations.js";
import { sampleReception } from "./court-simulation/reception-motion.js";
import { normalizeCourtSimulation, type CourtSimulation, type CourtSimulationActor, type CourtSimulationPatch, type CourtSimulationPoint, type CourtSimulationSample } from "./court-simulation-model";

const makeId = () => `simulation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const world = (point: CourtPoint): CourtSimulationPoint => [(point.x - .5) * 9, 0, (point.y - .5) * 18];
const court = (point: CourtSimulationPoint): CourtPoint => ({ x: point[0] / 9 + .5, y: point[2] / 18 + .5 });
const roles: CourtVisualActor["role"][] = ["setter", "opposite", "middle", "outside", "libero", "outside"];
const labels = ["Lv", "Op", "C", "P", "Lb", "P"];
function visibleSlots(config: CourtSimulation) {
  return config.actorIds.map((_, slot) => slot).filter(slot => config.mode === "receive" || slot === 0 || slot === 3 && config.layers.attack || slot === 4 && config.layers.pass || [1, 2, 5].slice(0, config.blockers).includes(slot) && config.layers.block);
}

export function getCourtSimulation(payload: CourtVisualPayload, index: number): CourtSimulation | null {
  const step = payload.timeline.steps[index];
  if (!step) return null;
  const config = normalizeCourtSimulation(step.simulation, payload.actors.map(actor => actor.id), (payload.editor?.drawings[step.id] ?? []).filter(drawing => drawing.kind === "ball").map(drawing => drawing.id));
  if (config && step.visibleActorIds && visibleSlots(config).some(slot => !step.visibleActorIds!.includes(config.actorIds[slot]))) return null;
  return config;
}

/** Both renderers sample the exact same pure motion and continuous collision engines. */
export function sampleCourtSimulation(payload: CourtVisualPayload, index: number, progress: number): CourtSimulationSample | null {
  const config = getCourtSimulation(payload, index);
  if (!config) return null;
  const step = payload.timeline.steps[index], fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const bases = config.actorIds.map(id => world(step.actorPositions[id] ?? payload.actors.find(actor => actor.id === id)!.initialPosition));
  const raw = (config.mode === "receive"
    ? sampleReception(fraction, { system: config.system, rotation: config.rotation, bases, landing: [config.landingOverride?.x ?? (config.seam === "Left" ? -1.45 : 1.4), config.landingOverride?.z ?? 6.65], serve: config.serve })
    : sampleAttack(fraction, { bases, preset: config.preset, blockers: config.blockers, layers: config.layers, ...config.attackSettings })) as unknown as Omit<CourtSimulationSample, "config" | "bases" | "actors" | "ballId" | "visibleIds" | "mode" | "elapsedSeconds" | "progress"> & { actors: Omit<CourtSimulationActor, "id" | "slot" | "visible">[] };
  const visibleIds = visibleSlots(config).map(slot => config.actorIds[slot]);
  return {
    ...raw, config, bases, progress: fraction, mode: config.mode, ballId: config.ballId, visibleIds, visible: true,
    elapsedSeconds: fraction * raw.duration,
    actors: raw.actors.map((actor, slot) => ({ ...actor, id: config.actorIds[slot], slot, visible: visibleIds.includes(config.actorIds[slot]) })),
  };
}

/** One undoable edit: configuration, canonical actors/material and bases stay together. */
export function configureCourtSimulation(payload: CourtVisualPayload, index: number, patch: CourtSimulationPatch = {}, options: { resetFormation?: boolean } = {}): CourtVisualPayload {
  const source = payload.timeline.steps[index];
  if (!source || !payload.editor) return payload;
  const previous = getCourtSimulation(payload, index);
  const mode = patch.mode ?? previous?.mode ?? "receive";
  const actors = [...payload.actors], actorMeta = { ...payload.editor.actorMeta }, positions = { ...source.actorPositions };
  const initiallyVisible = source.visibleActorIds ?? actors.map(actor => actor.id);
  const own = actors.filter(actor => actorMeta[actor.id]?.team !== "B").sort((a, b) => Number(initiallyVisible.includes(b.id)) - Number(initiallyVisible.includes(a.id)));
  const previousTeam = previous?.teamActorIds ?? (previous?.mode === "receive" ? previous.actorIds.slice(0, 6) : undefined);
  const used = new Set<string>();
  const ownIds = roles.map((role, slot) => {
    let actor = own.find(item => !used.has(item.id) && item.id === previousTeam?.[slot])
      ?? own.find(item => !used.has(item.id) && item.role === role) ?? own.find(item => !used.has(item.id));
    if (!actor) {
      const id = makeId(), initialPosition = court((receptionFormation("5-1", 0) as CourtSimulationPoint[])[slot]);
      actor = { id, label: labels[slot], role, color: role === "libero" ? "#a78bfa" : "#609ce8", initialPosition };
      actors.push(actor); own.push(actor); actorMeta[id] = { team: "A", simulationSupport: true }; positions[id] = initialPosition;
    }
    used.add(actor.id); return actor.id;
  });
  const opponentIds: string[] = [];
  const opponent = (slot: number) => {
    let actor = actors.find(item => actorMeta[item.id]?.team === "B" && !opponentIds.includes(item.id));
    if (!actor) {
      const id = makeId(), initialPosition = court(slot === 6 ? [1.7, 0, -10.44] : [-3.65 + opponentIds.length * .93, 0, -.25]);
      actor = { id, label: slot === 6 ? "Saq" : "Bloq", role: "athlete", color: "#e8757c", initialPosition };
      actors.push(actor); actorMeta[id] = { team: "B", simulationSupport: true }; positions[id] = initialPosition;
    }
    opponentIds.push(actor.id); return actor.id;
  };
  const actorIds = previous?.mode === mode ? [...previous.actorIds] : mode === "receive"
    ? [...ownIds, opponent(6)]
    : [ownIds[0], opponent(1), opponent(2), ownIds[3], ownIds[4], opponent(5), ownIds[1]];
  let drawings = [...(payload.editor.drawings[source.id] ?? [])];
  let ball = drawings.find(item => item.id === previous?.ballId) ?? drawings.find(item => item.kind === "ball");
  if (!ball) {
    ball = { id: makeId(), kind: "ball", points: [{ x: .5, y: .75 }], color: "#ffdc53", size: 28, rotation: 0 };
    drawings.push(ball);
  }
  const defaults = {
    version: 1, mode, system: "5-1", rotation: 0, serve: "Float", seam: "Left", preset: "4", format: "Indoor",
    layers: { attack: true, pass: true, block: true }, blockers: 1, landingOverride: null, attackSettings: {}, actorIds, ballId: ball.id,
  };
  const explicitFormation = options.resetFormation === true || (!previous && patch.mode !== undefined) || (patch.mode !== undefined && patch.mode !== previous?.mode)
    || (patch.rotation !== undefined && patch.rotation !== previous?.rotation) || (patch.system !== undefined && patch.system !== previous?.system)
    || (patch.preset !== undefined && patch.preset !== previous?.preset);
  const config = normalizeCourtSimulation({ ...defaults, ...previous, ...patch, actorIds, teamActorIds: ownIds, ballId: ball.id,
    layers: { ...defaults.layers, ...previous?.layers, ...patch.layers },
    attackSettings: { ...previous?.attackSettings, ...patch.attackSettings,
      ...(patch.preset !== undefined ? { hitOverride: null, setHeight: null, attackArc: null } : {}) },
  })!;
  if (explicitFormation) {
    const formation = (mode === "receive" ? [...receptionFormation(config.system, config.rotation), [1.7, 0, -10.44]] : attackFormation()) as CourtSimulationPoint[];
    actorIds.forEach((id, slot) => { if (mode === "receive" || slot !== 6) positions[id] = court(formation[slot]); });
    if (mode === "attack") {
      const preset = attackPreset(config.preset), count = config.blockers;
      // Keep the reference approach's run-up, on the selected attack's side/depth.
      // These are shared authoring bases, so the paused 2D and 3D views agree too.
      const reference = attackPreset("4"), approach = formation[3];
      const inset = Math.abs(reference.x) - Math.abs(approach[0]);
      positions[actorIds[3]] = court([Math.sign(preset.x) * Math.max(0, Math.abs(preset.x) - inset), 0, preset.z + approach[2] - reference.z]);
      const preferred = preset.x < -2 ? preset.x + .25 + (count - 1) * .465 : preset.x > 2 ? preset.x - .25 - (count - 1) * .465 : preset.x;
      const center = Math.max(-4.05 + (count - 1) * .465, Math.min(4.05 - (count - 1) * .465, preferred));
      [1, 2, 5].forEach((slot, n) => { positions[actorIds[slot]] = court([center + (n - (count - 1) / 2) * .93, 0, -.25]); });
    }
  }
  const required = new Set(actorIds);
  const inactiveOwn = mode === "attack" ? [ownIds[1], ownIds[2], ownIds[5]] : [];
  const visibleActorIds = [...new Set([...initiallyVisible.filter(id => (!actorMeta[id]?.simulationSupport || required.has(id)) && !inactiveOwn.includes(id)),
    ...(mode === "receive" ? ownIds : []), ...visibleSlots(config).map(slot => actorIds[slot])])];
  const step = { ...source, simulation: config, actorPositions: positions,
    ...(explicitFormation ? { baselineActorPositions: { ...positions }, trajectories: source.trajectories?.filter(path => !required.has(path.actorId)), transitions: source.transitions?.filter(path => !required.has(path.actorId)) } : {}), visibleActorIds };
  let next: CourtVisualPayload = { ...payload, actors, editor: { ...payload.editor, actorMeta, drawings: { ...payload.editor.drawings, [source.id]: drawings } }, timeline: { steps: payload.timeline.steps.map((item, i) => i === index ? step : item) } };
  const frame = sampleCourtSimulation(next, index, 0);
  if (frame) {
    drawings = drawings.map(item => item.id === config.ballId ? { ...item, points: [court(frame.ball)], motion: undefined } : item);
    next = { ...next, editor: { ...next.editor!, drawings: { ...next.editor!.drawings, [source.id]: drawings } }, timeline: { steps: next.timeline.steps.map((item, i) => i === index ? { ...item, durationMs: Math.round(frame.duration * 1000) } : item) } };
  }
  return next;
}

export function resetCourtSimulation(payload: CourtVisualPayload, index: number): CourtVisualPayload {
  const config = getCourtSimulation(payload, index);
  if (!config) return payload;
  return configureCourtSimulation(payload, index, { landingOverride: null,
    attackSettings: { hitOverride: null, targetOverride: null, setHeight: null, attackArc: null, passHeight: 2.1, blockAngle: 0, blockAngles: {}, manualBlockers: [] },
  }, { resetFormation: true });
}

export type CourtSimulationHandleEdit = { kind: "hit" | "target" | "serve" | "pass" | "set" | "attack"; point?: CourtPoint; value?: number };
export function updateCourtSimulationHandle(payload: CourtVisualPayload, index: number, edit: CourtSimulationHandleEdit): CourtVisualPayload {
  const config = getCourtSimulation(payload, index);
  if (!config) return payload;
  const point = edit.point && Number.isFinite(edit.point.x) && Number.isFinite(edit.point.y) ? world(edit.point) : null;
  if (edit.kind === "serve") return point ? configureCourtSimulation(payload, index, { landingOverride: { x: point[0], z: point[2] } }) : payload;
  if (edit.kind === "target") return point ? configureCourtSimulation(payload, index, { attackSettings: { targetOverride: [point[0], point[2]] } }) : payload;
  if (edit.kind === "hit") {
    if (!point) return payload;
    const handSide = sampleCourtSimulation(payload, index, 0)?.handSide ?? (attackPreset(config.preset).x > 0 ? -1 : 1);
    return configureCourtSimulation(payload, index, { attackSettings: { hitOverride: [point[0] - handSide * .13, point[2] + .1] } });
  }
  if (!Number.isFinite(edit.value)) return payload;
  if (edit.kind === "attack") return config.mode === "attack"
    ? configureCourtSimulation(payload, index, { attackSettings: { attackArc: edit.value! } }) : payload;
  return configureCourtSimulation(payload, index, { attackSettings: edit.kind === "pass" ? { passHeight: edit.value! } : { setHeight: edit.value! } });
}
