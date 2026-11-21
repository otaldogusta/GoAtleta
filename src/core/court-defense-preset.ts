import source from "./presets/defense-zone4.goatleta.json";
import type { CourtPoint, CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import type { CourtDrawing } from "./court-drawing-types";
import { normalizeCourtSimulation, type CourtDefenseCoverage } from "./court-simulation-model";
import { defenseDefaultAction } from "./court-defense-motion";

export const COURT_DEFENSE_ATTACKS = [
  { value: "4", label: "Entrada" },
  { value: "1", label: "Meio" },
  { value: "5", label: "Saída" },
] as const;
export type CourtDefensePreset = (typeof COURT_DEFENSE_ATTACKS)[number]["value"];

export const courtDefensePreset = (preset?: string): CourtDefensePreset =>
  preset === "1" || preset === "5" ? preset : "4";

const isDefenseSide = (step: CourtVisualStep, preset: CourtDefensePreset): boolean =>
  step.simulation?.mode === "defense" && courtDefensePreset(step.simulation.preset) === preset;

export function getCourtDefenseStepIndex(payload: CourtVisualPayload, preset: CourtDefensePreset, coverage?: CourtDefenseCoverage): number {
  return payload.timeline.steps.findIndex(step => isDefenseSide(step, preset) && step.simulation?.defenseSettings?.coverage === coverage);
}

export function getCourtDefenseSideStepIndex(payload: CourtVisualPayload, preset: CourtDefensePreset, coverage?: CourtDefenseCoverage): number {
  const preferred = getCourtDefenseStepIndex(payload, preset, coverage);
  return preferred >= 0 ? preferred : payload.timeline.steps.findIndex(step => isDefenseSide(step, preset));
}

const actorIds = ["height-player", "board_mwe81mmb_i7sa8kdc", "board_mwe820yh_46d2dj66", "board_mwe82nib_o7hqgvly", "board_mwe82zw1_2hmbi70q", "board_mwe838z8_9ng7sqxw", "circle-player"];
const initial = [[.17, .80], [.83, .55], [.50, .55], [.17, .55], [.83, .80], [.50, .86], [.88, .30]];
const middleInitial = [[.17, .80], [.70, .55], [.50, .55], [.17, .55], [.83, .80], [.50, .86], [.62, .32]];
const middleFinal = [[.50, .66], [.62, .55], [.48, .55], [.18, .72], [.82, .85], [.49, .88], [.60, .435]];
const middleContact = { x: .58, y: .465 };
const middleRoutes: Record<string, CourtPoint[]> = {
  "anchor-ball": [middleContact],
  "anchor-arrow-a": [middleContact, { x: .39, y: .62 }, { x: .14, y: .84 }],
  "anchor-arrow-b": [middleContact, { x: .73, y: .67 }, { x: .87, y: .89 }],
  "anchor-curve": [middleContact, { x: .67, y: .72 }, { x: .76, y: .96 }],
  "defense-block-shadow": [{ x: .46, y: .53 }, { x: .64, y: .53 }, { x: .72, y: .97 }, { x: .32, y: .97 }],
};

/** Append the coach's contact tableau once; existing stages and actors stay intact. */
export function ensureCourtDefenseStep(payload: CourtVisualPayload, preset: CourtDefensePreset = "4", coverage?: CourtDefenseCoverage): { payload: CourtVisualPayload; stepIndex: number } {
  const existing = getCourtDefenseStepIndex(payload, preset, coverage);
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
  const participants = actorIds.map((actorId, slot) => {
    const actor = payload.actors.find(item => item.id === actorId), meta = actorMeta[actorId];
    const team = slot === 6 ? "B" : "A";
    // Imported missing teams default to A. A preset cannot overwrite that global
    // choice, nor make a protected/hidden actor editable in previous stages.
    const conflict = actor && (meta?.team && meta.team !== team || meta?.hidden || meta?.locked);
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
  // Slot 0 currently occupies the short coverage destination. The defender
  // selected for coverage takes it while slot 0 fills the vacated lane.
  // Zone 1 is the right back base on the defending half for both attacks.
  const coverSlot = coverage === "front" ? 3 : coverage === "zone1" && !exit ? 4 : 0;
  if (coverSlot !== 0) {
    const [short, replacement] = [participants[0], participants[coverSlot]];
    [positions[short], positions[replacement]] = [positions[replacement], positions[short]];
  }
  const actorElevations = Object.fromEntries(Object.entries(source.actorElevations).map(([actorId, height]) => [mappedId.get(actorId)!, height]));
  const drawings = (JSON.parse(JSON.stringify(source.drawings)) as CourtDrawing[]).map(drawing => ({
    ...drawing, points: (middle ? middleRoutes[drawing.id] ?? drawing.points : drawing.points).map(place),
  }));
  const simulation = normalizeCourtSimulation({ version: 1, mode: "defense", preset, actorIds: participants, teamActorIds: participants.slice(0, 6), ballId: "anchor-ball",
    layers: { attack: false, pass: false, block: false }, blockers: 2,
    defenseSettings: { coverage, startPositions: Object.fromEntries(participants.map((actorId, slot) => {
      const [x, y] = (middle ? middleInitial : initial)[slot];
      return [actorId, place({ x, y })];
    })) },
  }, actors.map(actor => actor.id), drawings.filter(drawing => drawing.kind === "ball").map(drawing => drawing.id))!;
  const sideLabel = exit ? "Saída de rede" : middle ? "Ataque pelo meio" : "Ataque da 4";
  const coverageLabel = coverage === "front" ? " · Cobertura frontal" : coverage === "zone1" ? " · Cobertura da posição 1" : "";
  const step: CourtVisualStep = { id, label: `Defesa · ${sideLabel}${coverageLabel}`, phase: "defense_shape", durationMs: 2600,
    note: "Organização até o contato. As trajetórias mostram alternativas de ataque.",
    actorPositions: positions, baselineActorPositions: Object.fromEntries(Object.entries(positions).map(([actorId, p]) => [actorId, { ...p }])), actorElevations,
    actorActions: Object.fromEntries(participants.map((actorId, slot) => [actorId, defenseDefaultAction(slot)])),
    visibleActorIds: [...participants], trajectories: [], simulation,
  };
  const steps = payload.timeline.steps.map(item => additions.length && !item.visibleActorIds ? { ...item, visibleActorIds: payload.actors.map(actor => actor.id) } : item);
  return { payload: { ...payload, actors, timeline: { ...payload.timeline, steps: [...steps, step] },
    editor: { ...payload.editor, actorMeta, drawings: { ...payload.editor.drawings, [id]: drawings } } }, stepIndex: steps.length };
}
