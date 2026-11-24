import source from "./presets/defense-zone4.goatleta.json";
import type { CourtPoint, CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import type { CourtDrawing } from "./court-drawing-types";
import { normalizeCourtSimulation, type CourtDefenseCoverage, type CourtSimulation } from "./court-simulation-model";
import { receptionPlayerIdentity } from "./court-simulation";
import { receptionTeamOrder } from "./court-simulation/formations.js";
import { defenseDefaultAction } from "./court-defense-motion";

export const COURT_DEFENSE_ATTACKS = [
  { value: "4", label: "Entrada" },
  { value: "1", label: "Meio" },
  { value: "5", label: "Saída" },
] as const;
export type CourtDefensePreset = (typeof COURT_DEFENSE_ATTACKS)[number]["value"];

export const courtDefensePreset = (preset?: string): CourtDefensePreset =>
  preset === "1" || preset === "5" ? preset : "4";

type DefenseContext = CourtSimulation | null | undefined;

function teamFromContext(context: CourtSimulation) {
  if (context.teamActorIds) return context.teamActorIds;
  if (context.mode !== "receive") return undefined;
  const ids: string[] = [];
  receptionTeamOrder(context.system, context.rotation).forEach((teamIndex, slot) => { ids[teamIndex] = context.actorIds[slot]; });
  return ids;
}

export function matchesCourtDefenseContext(candidate: DefenseContext, context?: DefenseContext): boolean {
  if (!context) return true;
  if (!candidate || candidate.system !== context.system || candidate.rotation !== context.rotation) return false;
  const team = teamFromContext(context), other = teamFromContext(candidate);
  return !team || !other || team.every((id, slot) => id === other[slot]);
}

const isDefenseSide = (step: CourtVisualStep, preset: CourtDefensePreset, context?: DefenseContext): boolean =>
  step.simulation?.mode === "defense" && courtDefensePreset(step.simulation.preset) === preset && matchesCourtDefenseContext(step.simulation, context);

export function getCourtDefenseStepIndex(payload: CourtVisualPayload, preset: CourtDefensePreset, coverage?: CourtDefenseCoverage, context?: DefenseContext): number {
  return payload.timeline.steps.findIndex(step => isDefenseSide(step, preset, context) && step.simulation?.defenseSettings?.coverage === coverage);
}

export function getCourtDefenseSideStepIndex(payload: CourtVisualPayload, preset: CourtDefensePreset, coverage?: CourtDefenseCoverage, context?: DefenseContext): number {
  const preferred = getCourtDefenseStepIndex(payload, preset, coverage, context);
  return preferred >= 0 ? preferred : payload.timeline.steps.findIndex(step => isDefenseSide(step, preset, context));
}

const actorIds = ["height-player", "board_mwe81mmb_i7sa8kdc", "board_mwe820yh_46d2dj66", "board_mwe82nib_o7hqgvly", "board_mwe82zw1_2hmbi70q", "board_mwe838z8_9ng7sqxw", "circle-player"];
const initial = [[.17, .80], [.83, .55], [.50, .55], [.17, .55], [.83, .80], [.50, .86], [.88, .30]];
const middleInitial = [[.17, .80], [.70, .55], [.50, .55], [.17, .55], [.83, .80], [.50, .86], [.62, .32]];
const middleContact = { x: .58, y: .465 };
// Store the coach's contact marks before assigning the short defender for each coverage.
const middleFinal = [
  [.2900721777713027, .6298676099257186],
  [.8614388600742843, .6257356163041492],
  [middleContact.x, .55],
  [.13752719546412312, .7192882445250112],
  [.8159902971919492, .8349304928492594],
  [.3193374543930615, .8481186969781658],
  [.60, .435],
];
const middleRoutes: Record<string, Pick<CourtDrawing, "points" | "trajectoryHeights">> = {
  "anchor-ball": { points: [middleContact] },
  "anchor-arrow-a": {
    points: [middleContact, { x: .36515762896897014, y: .6141598042642757 }, { x: .040630515875880624, y: .8166392170571026 }],
    trajectoryHeights: { start: 3.1517103037717202, middle: 2.397408025257005, end: .42025616088413287 },
  },
  "anchor-arrow-b": {
    points: [middleContact, { x: .7514006510801325, y: .6496304719247664 }, { x: .9556026043205306, y: .8085218876990654 }],
    trajectoryHeights: { start: 3.1517103037717202, middle: 2.177477463795312, end: .44298936933307465 },
  },
  "anchor-curve": {
    points: [middleContact, { x: .44501205883514416, y: .7042300925490492 }, { x: .22366001654544337, y: .9189528852268591 }],
    trajectoryHeights: { start: 3.1517103037717202, middle: 2.632719780316571, end: .40365008051173135 },
  },
  "defense-block-shadow": { points: [{ x: .55, y: .55 }, { x: .61, y: .55 }, { x: .69, y: .97 }, { x: .47, y: .97 }] },
};

function defensiveLineup(context: CourtSimulation, team: string[], exit: boolean) {
  const receive: CourtSimulation = { ...context, mode: "receive", teamActorIds: team };
  const byZone = new Map<number, string>();
  team.forEach((id, index) => {
    let zone = receptionPlayerIdentity(receive, id)!.position;
    // In systems with specialists, the front middle defends from 3, the
    // outside from 4 and the front setter/opposite from 2 after the exchange.
    if (context.system !== "6-0" && zone >= 2 && zone <= 4) zone = index === 2 ? 3 : index < 2 ? 2 : 4;
    byZone.set(zone, id);
  });
  if (context.system === "5-1" && byZone.get(6) === team[4] && byZone.get(5) === team[3]) {
    // The defense starts after the libero and first outside have exchanged lanes.
    byZone.set(5, team[4]);
    byZone.set(6, team[3]);
  }
  // In the 6×0 the same defensive exchange follows the zones at each rotation.
  const [leftBack, middleBack] = context.system === "6-0" ? [6, 5] : [5, 6];
  const zones = exit ? [1, 4, 3, 2, leftBack, middleBack] : [leftBack, 2, 3, 4, 1, middleBack];
  return zones.map(zone => byZone.get(zone)!);
}

/** Append the coach's contact tableau once; existing stages and actors stay intact. */
export function ensureCourtDefenseStep(payload: CourtVisualPayload, preset: CourtDefensePreset = "4", coverage?: CourtDefenseCoverage, context?: DefenseContext): { payload: CourtVisualPayload; stepIndex: number } {
  const existing = getCourtDefenseStepIndex(payload, preset, coverage, context);
  if (existing >= 0 || !payload.editor) return { payload, stepIndex: Math.max(0, existing) };
  const exit = preset === "5";
  const middle = preset === "1";
  const used = new Set(payload.timeline.steps.map(step => step.id));
  const sideId = exit ? "defense-exit" : middle ? "defense-middle" : "defense-zone4";
  const baseId = coverage ? `${sideId}-${coverage}` : sideId;
  let id = baseId;
  for (let n = 2; used.has(id); n++) id = `${baseId}-${n}`;
  const actorMeta = { ...payload.editor.actorMeta }, additions: CourtVisualActor[] = [];
  const occupied = new Set([...payload.actors.map(actor => actor.id), ...actorIds]);
  const teamIds = context && teamFromContext(context);
  const lineup = context && teamIds ? defensiveLineup(context, teamIds, exit) : undefined;
  const opponent = context?.actorIds.find(id => !teamIds?.includes(id) && actorMeta[id]?.team === "B");
  const participants = actorIds.map((actorId, slot) => {
    if (lineup && slot < 6) return lineup[slot];
    if (slot === 6 && opponent) return opponent;
    const actor = payload.actors.find(item => item.id === actorId), meta = actorMeta[actorId];
    const team = slot === 6 ? "B" : "A";
    // Imported missing teams default to A. A preset cannot overwrite that global
    // choice, nor make a protected/hidden actor editable in previous stages.
    const conflict = actor && (meta?.team && meta.team !== team || meta?.hidden || meta?.locked || slot === 6 && teamIds?.includes(actorId));
    let nextId = actorId;
    if (conflict) {
      nextId = `defense-${actorId}`;
      for (let n = 2; occupied.has(nextId); n++) nextId = `defense-${actorId}-${n}`;
    }
    occupied.add(nextId);
    if (!actor || conflict) {
      const original = actor ?? (source.actors as CourtVisualActor[]).find(item => item.id === actorId)!;
      additions.push({ ...original, id: nextId, initialPosition: { ...original.initialPosition } });
      actorMeta[nextId] = { ...meta, team, hidden: false, locked: false };
    } else if (!meta?.team) actorMeta[nextId] = { ...meta, team };
    return nextId;
  });
  const mappedId = new Map(actorIds.map((actorId, slot) => [actorId, participants[slot]]));
  const actors = [...payload.actors, ...additions];
  const place = ({ x, y }: CourtPoint): CourtPoint => ({ x: exit ? 1 - x : x, y });
  const positions = middle
    ? Object.fromEntries(participants.map((actorId, slot) => [actorId, { x: middleFinal[slot][0], y: middleFinal[slot][1] }]))
    : Object.fromEntries(Object.entries(source.actorPositions).map(([actorId, p]) => [mappedId.get(actorId)!, place(p)]));
  if (coverage) {
    const liberoSlot = teamIds && context?.system !== "6-0" ? participants.indexOf(teamIds[4]) : -1;
    const coverSlot = coverage === "front" ? 3 : liberoSlot >= 0 ? liberoSlot : exit && context?.system !== "6-0" ? 4 : 0;
    const [short, replacement] = [participants[0], participants[coverSlot]];
    [positions[short], positions[replacement]] = [positions[replacement], positions[short]];
    const paragonal = participants[coverSlot === 5 ? 0 : 5];
    const backOutside = participants.slice(0, 6).find((id, slot) =>
      [0, 4, 5].includes(slot) && id !== replacement && (id === teamIds?.[3] || id === teamIds?.[5]));
    if (context?.system === "5-1" && backOutside) {
      [positions[paragonal], positions[backOutside]] = [positions[backOutside], positions[paragonal]];
    }
    if (exit && context?.system === "6-0" && coverage === "zone1") {
      // Short-ball mark just inside the attack line, over a meter ahead of the paragonal.
      positions[short] = { x: .55, y: .66 };
    }
  }
  const actorElevations = Object.fromEntries(Object.entries(source.actorElevations).map(([actorId, height]) => [mappedId.get(actorId)!, height]));
  const template = middle ? source.drawings.map(drawing => ({ ...drawing, ...middleRoutes[drawing.id] })) : source.drawings;
  const drawings = (JSON.parse(JSON.stringify(template)) as CourtDrawing[]).map(drawing => ({
    ...drawing, points: drawing.points.map(place),
  }));
  const simulation = normalizeCourtSimulation({ version: 1, mode: "defense", preset, system: context?.system, rotation: context?.rotation,
    actorIds: participants, teamActorIds: teamIds ?? participants.slice(0, 6), ballId: "anchor-ball",
    layers: { attack: false, pass: false, block: false }, blockers: middle ? 1 : 2,
    defenseSettings: { coverage, startPositions: Object.fromEntries(participants.map((actorId, slot) => {
      const [x, y] = (middle ? middleInitial : initial)[slot];
      return [actorId, place({ x, y })];
    })) },
  }, actors.map(actor => actor.id), drawings.filter(drawing => drawing.kind === "ball").map(drawing => drawing.id))!;
  const sideLabel = exit ? "Saída de rede" : middle ? "Ataque pelo meio" : "Ataque da 4";
  const coverageLabel = coverage === "front" ? " · Largada pela rede" : coverage === "zone1" ? " · Largada pelo fundo" : "";
  const step: CourtVisualStep = { id, label: `Defesa · ${sideLabel}${coverageLabel}`, phase: "defense_shape", durationMs: 2600,
    note: "Organização até o contato. As trajetórias mostram alternativas de ataque.",
    actorPositions: positions, baselineActorPositions: Object.fromEntries(Object.entries(positions).map(([actorId, p]) => [actorId, { ...p }])), actorElevations,
    actorActions: Object.fromEntries(participants.map((actorId, slot) => [actorId, defenseDefaultAction(slot, preset)])),
    visibleActorIds: [...participants], trajectories: [], simulation,
  };
  const steps = payload.timeline.steps.map(item => additions.length && !item.visibleActorIds ? { ...item, visibleActorIds: payload.actors.map(actor => actor.id) } : item);
  return { payload: { ...payload, actors, timeline: { ...payload.timeline, steps: [...steps, step] },
    editor: { ...payload.editor, actorMeta, drawings: { ...payload.editor.drawings, [id]: drawings } } }, stepIndex: steps.length };
}
