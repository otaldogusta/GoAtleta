import source from "./presets/defense-zone4.goatleta.json";
import type { CourtVisualActor, CourtVisualPayload, CourtVisualStep } from "./visual-court";
import type { CourtDrawing } from "./court-drawing-types";
import { normalizeCourtSimulation } from "./court-simulation-model";
import { defenseDefaultAction } from "./court-defense-motion";

const actorIds = ["height-player", "board_mwe81mmb_i7sa8kdc", "board_mwe820yh_46d2dj66", "board_mwe82nib_o7hqgvly", "board_mwe82zw1_2hmbi70q", "board_mwe838z8_9ng7sqxw", "circle-player"];
const initial = [[.17, .80], [.83, .55], [.50, .55], [.17, .55], [.83, .80], [.50, .86], [.88, .30]];

/** Append the coach's contact tableau once; existing stages and actors stay intact. */
export function ensureCourtDefenseStep(payload: CourtVisualPayload): { payload: CourtVisualPayload; stepIndex: number } {
  const existing = payload.timeline.steps.findIndex(step => step.simulation?.mode === "defense");
  if (existing >= 0 || !payload.editor) return { payload, stepIndex: Math.max(0, existing) };
  const used = new Set(payload.timeline.steps.map(step => step.id));
  let id = "defense-zone4";
  for (let n = 2; used.has(id); n++) id = `defense-zone4-${n}`;
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
  const positions = Object.fromEntries(Object.entries(source.actorPositions).map(([actorId, p]) => [mappedId.get(actorId)!, { ...p }]));
  const actorElevations = Object.fromEntries(Object.entries(source.actorElevations).map(([actorId, height]) => [mappedId.get(actorId)!, height]));
  const drawings = JSON.parse(JSON.stringify(source.drawings)) as CourtDrawing[];
  const simulation = normalizeCourtSimulation({ version: 1, mode: "defense", actorIds: participants, teamActorIds: participants.slice(0, 6), ballId: "anchor-ball",
    layers: { attack: false, pass: false, block: false }, blockers: 2,
    defenseSettings: { startPositions: Object.fromEntries(participants.map((actorId, slot) => [actorId, { x: initial[slot][0], y: initial[slot][1] }])) },
  }, actors.map(actor => actor.id), drawings.filter(drawing => drawing.kind === "ball").map(drawing => drawing.id))!;
  const step: CourtVisualStep = { id, label: "Defesa · Ataque da 4", phase: "defense_shape", durationMs: 2600,
    note: "Organização até o contato. As trajetórias mostram alternativas de ataque.",
    actorPositions: positions, baselineActorPositions: Object.fromEntries(Object.entries(positions).map(([actorId, p]) => [actorId, { ...p }])), actorElevations,
    actorActions: Object.fromEntries(participants.map((actorId, slot) => [actorId, defenseDefaultAction(slot)])),
    visibleActorIds: [...participants], trajectories: [], simulation,
  };
  const steps = payload.timeline.steps.map(item => additions.length && !item.visibleActorIds ? { ...item, visibleActorIds: payload.actors.map(actor => actor.id) } : item);
  return { payload: { ...payload, actors, timeline: { ...payload.timeline, steps: [...steps, step] },
    editor: { ...payload.editor, actorMeta, drawings: { ...payload.editor.drawings, [id]: drawings } } }, stepIndex: steps.length };
}
