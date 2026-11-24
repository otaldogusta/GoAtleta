import { buildEditable5x1ReceptionPreset, type CourtVisualPayload, type CourtVisualStep } from "./visual-court";
import { newCourtBoard, upgradeCourtEditor, type CourtDrawing } from "./visual-court-editor";
import { configureCourtSimulation, getCourtSimulation } from "./court-simulation";
import type { CourtSimulation } from "./court-simulation-model";
import { receptionFormation, receptionTeamOrder } from "./court-simulation/formations.js";

const labels = ["P1", "P6", "P5", "P4", "P3", "P2"];

/** Only the complete, ordered legacy reception pairs are eligible for replacement. */
export function isLegacyReceptionRotationSequence(payload: CourtVisualPayload): boolean {
  const steps = payload.timeline.steps;
  return payload.version === 1 && payload.sport === "volleyball_indoor"
    && payload.editor?.version === 1 && payload.editor.coordinates === "regulation"
    && steps.length === 12 && new Set(steps.map(step => step.id)).size === 12
    && steps.every((step, index) => Boolean(step.id) && step.formationKind === "5x1_receive_3"
      && step.rotationIndex === Math.floor(index / 2) + 1
      && step.phase === (index % 2 ? "receive_release" : "receive_legal"));
}

/** Explicit, undoable conversion; existing actors and document metadata stay canonical. */
export function replaceReceptionRotationSequence(payload: CourtVisualPayload, stepIndex = 0, system?: CourtSimulation["system"]): { payload: CourtVisualPayload; stepIndex: number } {
  if (!isLegacyReceptionRotationSequence(payload)) return { payload, stepIndex };
  const source = payload.timeline.steps;
  const activeIndex = Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < source.length ? stepIndex : 0;
  const active = getCourtSimulation(payload, activeIndex);
  const rotation = active?.mode === "receive" ? active.rotation : source[activeIndex].rotationIndex! - 1;
  const drawings: Record<string, CourtDrawing[]> = {};
  const steps: CourtVisualStep[] = labels.map((label, index) => {
    const pair = source.slice(index * 2, index * 2 + 2), first = pair[0];
    const configurations = [getCourtSimulation(payload, index * 2), getCourtSimulation(payload, index * 2 + 1)];
    const receiveIndex = configurations.findIndex(config => config?.mode === "receive");
    const tuningIndex = receiveIndex >= 0 ? receiveIndex : configurations.findIndex(Boolean);
    const tuning = configurations[tuningIndex], participantSource = pair[Math.max(0, tuningIndex)];
    const material = [...new Map(pair.flatMap(step => payload.editor!.drawings[step.id] ?? []).map(item => [item.id, item] as const)).values()];
    const ball = material.find(item => item.kind === "ball" && item.id === tuning?.ballId) ?? material.find(item => item.kind === "ball");
    drawings[first.id] = [...material.filter(item => item.kind !== "ball"), ...(ball ? [ball] : [])];
    // Deliberately start a new stage rather than carrying legal/tactical fields,
    // old trajectories or source phase semantics into the canonical simulation.
    return {
      id: first.id, label: `${label} · Recepção`, durationMs: 4100,
      actorPositions: { ...first.actorPositions },
      visibleActorIds: [...(participantSource.visibleActorIds ?? payload.actors.map(actor => actor.id))],
      ...(tuning ? { simulation: tuning } : {}),
    };
  });
  let next: CourtVisualPayload = { ...payload, timeline: { ...payload.timeline, steps }, editor: { ...payload.editor!, drawings } };
  for (let index = 0; index < steps.length; index++) {
    next = configureCourtSimulation(next, index, { mode: "receive", rotation: index, ...(system ? { system } : {}) }, { resetFormation: true });
  }
  return { payload: next, stepIndex: rotation };
}

/** The reception template has one complete shared simulation per rotation. */
export function buildSimulatedReceptionRotationPreset(system: CourtSimulation["system"] = "5-1"): CourtVisualPayload {
  const title = `${system.replace("-", "×")} · Recepção`;
  if (system === "6-0") {
    const blank = newCourtBoard(title), teamOrder = receptionTeamOrder(system, 0), opening = receptionFormation(system, 0);
    const team = blank.actors.filter(actor => blank.editor!.actorMeta[actor.id].team === "A").map((actor, index) => {
      const [x, , z] = opening[teamOrder.indexOf(index)];
      return { ...actor, number: index + 1, label: String(index + 1), role: "athlete" as const,
        representation: "person" as const, color: "#19c87b", initialPosition: { x: x / 9 + .5, y: z / 18 + .5 } };
    });
    const steps = labels.map(label => ({ id: `six-zero-${label}`, label: `${label} · Recepção`,
      durationMs: 4100, actorPositions: Object.fromEntries(team.map(actor => [actor.id, actor.initialPosition])),
      visibleActorIds: team.map(actor => actor.id) }));
    let board: CourtVisualPayload = { ...blank, actors: team, timeline: { steps },
      editor: { ...blank.editor!, actorMeta: Object.fromEntries(team.map(actor => [actor.id, { team: "A" }])) } };
    for (let rotation = 0; rotation < steps.length; rotation++) {
      board = configureCourtSimulation(board, rotation, { mode: "receive", system, rotation }, { resetFormation: true });
    }
    return board;
  }
  const source = buildEditable5x1ReceptionPreset();
  const board = replaceReceptionRotationSequence(upgradeCourtEditor(source, title), 0, system).payload;
  if (system === "5-1") return board;
  const setters = board.timeline.steps[0].simulation!.teamActorIds!.slice(0, 2);
  return {
    ...board, editor: { ...board.editor!, title },
    actors: board.actors.map(actor => {
      const setter = setters.indexOf(actor.id);
      return setter < 0 ? actor : { ...actor, role: "setter", label: setter === 0 ? "Levantador¹" : "Levantador²", color: "#38bdf8", baseColor: "#38bdf8" };
    }),
  };
}

/** Select by rotation identity, preserving a destination's authored mode/system.
 * A non-sequence keeps the caller's individual-stage editing fallback.
 */
function rotationSequenceEntries(payload: CourtVisualPayload) {
  return payload.timeline.steps.flatMap((step, index) => step.simulation?.mode === "defense"
    ? [] : [{ index, id: step.id, config: getCourtSimulation(payload, index) }]);
}

export function getReceptionRotationStep(payload: CourtVisualPayload, currentIndex: number, rotation: number): number {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= payload.timeline.steps.length
    || !Number.isInteger(rotation) || rotation < 0 || rotation > 5) return -1;
  const entries = rotationSequenceEntries(payload);
  if (entries.length !== 6 || !entries.some(entry => entry.index === currentIndex) || entries.some(({ config }) => !config)
    || new Set(entries.map(({ config }) => config!.rotation)).size !== 6) return -1;
  return entries.find(({ config }) => config!.rotation === rotation)?.index ?? -1;
}

/** One host transaction switches a complete rotation sequence, without navigating
 * or overwriting each stage's tuning. Authored documents keep individual editing.
 */
export function configureCourtRotationSequenceMode(payload: CourtVisualPayload, currentIndex: number, mode: CourtSimulation["mode"]): CourtVisualPayload {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= payload.timeline.steps.length
    || !["receive", "attack"].includes(mode)) return payload;
  const entries = rotationSequenceEntries(payload), current = getCourtSimulation(payload, currentIndex);
  const sequence = current && entries.every(entry => Boolean(entry.id)) && new Set(entries.map(entry => entry.id)).size === 6
    && getReceptionRotationStep(payload, currentIndex, current.rotation) >= 0;
  if (!sequence) return configureCourtSimulation(payload, currentIndex, { mode });
  let next = payload;
  for (const { config, index } of entries) {
    if (config!.mode !== mode) next = configureCourtSimulation(next, index, { mode });
  }
  const rotationsByIndex = new Map(entries.map(({ index, config }) => [index, config!.rotation]));
  const steps = next.timeline.steps.map((step, index) => {
    const rotation = rotationsByIndex.get(index);
    if (rotation === undefined) return step;
    if (!/^P[1-6] · (Recepção|Ataque)$/.test(step.label)) return step;
    const label = `${labels[rotation]} · ${mode === "attack" ? "Ataque" : "Recepção"}`;
    return label === step.label ? step : { ...step, label };
  });
  return steps.some((step, index) => step !== next.timeline.steps[index])
    ? { ...next, timeline: { ...next.timeline, steps } } : next;
}
