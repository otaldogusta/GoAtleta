import type { CourtVisualPayload } from './visual-court';

/** Repair the canonical six-rotation reception's participant identity, without moving its authored formation. */
export function repairReceptionMiddleIdentity(payload: CourtVisualPayload): CourtVisualPayload {
  const steps = payload.timeline.steps;
  if (steps.length !== 6 || !['c1', 'c2'].every(id => payload.actors.some(actor => actor.id === id && actor.role === 'middle'))
    || steps.some(step => !/^P[1-6] · (Recepção|Ataque)$/.test(step.label) || step.simulation?.mode !== 'receive' || step.simulation.system !== '5-1')
    || new Set(steps.map(step => step.simulation!.rotation)).size !== 6) return payload;
  const repaired = steps.map(step => {
    const config = step.simulation!;
    const expected = [0, 1, 5].includes(config.rotation) ? 'c2' : 'c1';
    const current = config.actorIds[2];
    if (!['c1', 'c2'].includes(current) || current === expected) return step;
    const swap = (id: string) => id === 'c1' ? 'c2' : id === 'c2' ? 'c1' : id;
    const points = <T,>(values: Record<string, T> | undefined) => values && Object.fromEntries(Object.entries(values).map(([id, value]) => [swap(id), value]));
    return { ...step,
      actorPositions: points(step.actorPositions)!, baselineActorPositions: points(step.baselineActorPositions),
      legalPositions: points(step.legalPositions), tacticalPositions: points(step.tacticalPositions),
      visibleActorIds: step.visibleActorIds?.map(swap),
      trajectories: step.trajectories?.map(path => ({ ...path, actorId: swap(path.actorId) })),
      transitions: step.transitions?.map(path => ({ ...path, actorId: swap(path.actorId) })),
      simulation: { ...config, actorIds: config.actorIds.map(swap), teamActorIds: config.teamActorIds?.map(swap) },
    };
  });
  return repaired.some((step, index) => step !== steps[index]) ? { ...payload, timeline: { ...payload.timeline, steps: repaired } } : payload;
}
