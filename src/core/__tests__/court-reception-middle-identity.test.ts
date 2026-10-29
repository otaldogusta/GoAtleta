import { repairReceptionMiddleIdentity } from '../court-reception-middle-identity';
import { buildSimulatedReceptionRotationPreset } from '../court-simulation-sequence';
import { buildCourtPerspectiveFrame } from '../visual-court-perspective';

it('keeps the same central through P2, P1 and P6 without renaming players or moving their formation', () => {
  const source = buildSimulatedReceptionRotationPreset();
  source.actors = source.actors.map(actor => actor.id === 'c2' ? { ...actor, label: 'C¹' } : actor.id === 'c1' ? { ...actor, label: 'C²' } : actor);
  const step = source.timeline.steps[0];
  const swap = (id: string) => id === 'c2' ? 'c1' : id === 'c1' ? 'c2' : id;
  const initial = step.actorPositions.c2;
  source.timeline.steps[0] = { ...step, actorPositions: Object.fromEntries(Object.entries(step.actorPositions).map(([id, point]) => [swap(id), point])), visibleActorIds: step.visibleActorIds?.map(swap), simulation: { ...step.simulation!, actorIds: step.simulation!.actorIds.map(swap), teamActorIds: step.simulation!.teamActorIds?.map(swap) } };
  const before = JSON.stringify(source);
  const fixed = repairReceptionMiddleIdentity(source);
  expect(fixed.actors).toBe(source.actors);
  expect(fixed.timeline.steps[0].actorPositions.c2).toEqual(initial);
  for (const index of [5, 0, 1]) {
    const middles = buildCourtPerspectiveFrame(fixed, index, 0).actors.filter(actor => actor.role === 'middle');
    expect(middles.map(actor => [actor.id, actor.label])).toEqual([['c2', 'C¹']]);
  }
  for (const index of [2, 3, 4]) expect(buildCourtPerspectiveFrame(fixed, index, 0).actors.filter(actor => actor.role === 'middle').map(actor => actor.id)).toEqual(['c1']);
  expect(JSON.stringify(source)).toBe(before);
  expect(repairReceptionMiddleIdentity(fixed)).toBe(fixed);
  const custom = { ...source, timeline: { steps: source.timeline.steps.map((s, i) => i === 0 ? { ...s, label: 'Jogada autoral' } : s) } };
  expect(repairReceptionMiddleIdentity(custom)).toBe(custom);
});
