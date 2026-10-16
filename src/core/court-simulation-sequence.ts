import { buildEditable5x1ReceptionPreset, type CourtVisualPayload, type CourtVisualStep } from "./visual-court";
import { upgradeCourtEditor, type CourtDrawing } from "./visual-court-editor";
import { configureCourtSimulation, getCourtSimulation } from "./court-simulation";
import type { CourtSimulation } from "./court-simulation-model";

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
export function replaceReceptionRotationSequence(payload: CourtVisualPayload, stepIndex = 0): { payload: CourtVisualPayload; stepIndex: number } {
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
    next = configureCourtSimulation(next, index, { mode: "receive", rotation: index }, { resetFormation: true });
  }
  return { payload: next, stepIndex: rotation };
}

/** The reception template has one complete shared simulation per rotation. */
export function buildSimulatedReceptionRotationPreset(): CourtVisualPayload {
  const source = buildEditable5x1ReceptionPreset();
  return replaceReceptionRotationSequence(upgradeCourtEditor(source, source.editor?.title ?? "5×1 · Recepção")).payload;
}

/** Select by rotation identity, preserving a destination's authored mode/system.
 * A non-sequence keeps the caller's individual-stage editing fallback.
 */
export function getReceptionRotationStep(payload: CourtVisualPayload, currentIndex: number, rotation: number): number {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= payload.timeline.steps.length
    || !Number.isInteger(rotation) || rotation < 0 || rotation > 5 || payload.timeline.steps.length !== 6) return -1;
  const simulations = payload.timeline.steps.map((_, index) => getCourtSimulation(payload, index));
  if (simulations.some(config => !config) || new Set(simulations.map(config => config!.rotation)).size !== 6) return -1;
  return simulations.findIndex(config => config!.rotation === rotation);
}

/** One host transaction switches a complete rotation sequence, without navigating
 * or overwriting each stage's tuning. Authored documents keep individual editing.
 */
export function configureCourtRotationSequenceMode(payload: CourtVisualPayload, currentIndex: number, mode: CourtSimulation["mode"]): CourtVisualPayload {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= payload.timeline.steps.length
    || !["receive", "attack"].includes(mode)) return payload;
  const source = payload.timeline.steps, current = getCourtSimulation(payload, currentIndex);
  const sequence = current && source.every(step => Boolean(step.id)) && new Set(source.map(step => step.id)).size === 6
    && getReceptionRotationStep(payload, currentIndex, current.rotation) >= 0;
  if (!sequence) return configureCourtSimulation(payload, currentIndex, { mode });
  const simulations = source.map((_, index) => getCourtSimulation(payload, index)!);
  let next = payload;
  simulations.forEach((config, index) => {
    if (config.mode !== mode) next = configureCourtSimulation(next, index, { mode });
  });
  const steps = next.timeline.steps.map((step, index) => {
    if (!/^P[1-6] · (Recepção|Ataque)$/.test(step.label)) return step;
    const label = `${labels[simulations[index].rotation]} · ${mode === "attack" ? "Ataque" : "Recepção"}`;
    return label === step.label ? step : { ...step, label };
  });
  return steps.some((step, index) => step !== next.timeline.steps[index])
    ? { ...next, timeline: { ...next.timeline, steps } } : next;
}
