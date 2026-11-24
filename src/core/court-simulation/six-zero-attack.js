import { courtFootwork } from './court-footwork.js';
import { receptionDestinations } from './formations.js';

// Map attack animation slots back to the six reception jobs. Opposing blockers
// keep their existing slots so wall controls, editable handles and replays agree.
export function sixZeroAttackOrder(preset) {
  const hitter = preset === '1' ? 2 : preset === 'fundo-1' ? 1 : 3;
  return [0, -1, -1, hitter, 4, -1, ...[1, 2, 3, 5].filter(slot => slot !== hitter)];
}

export function sixZeroAttackFormation(preset, rotation, blockerBases) {
  const release = receptionDestinations('6-0', rotation);
  return sixZeroAttackOrder(preset).map((job, slot) =>
    job < 0 ? blockerBases[slot] : [release[job][0], 0, release[job][1]]);
}

// Short cover and deep cover shift toward the lane of the selected hitter.
// The null entries are the setter and finisher, whose clips own their movement.
const coverByPreset = {
  '4': [null, [2.5, 4.8], [-2.1, 2], null, [.25, 5.65], [-3.4, 4.25]],
  '1': [null, [3.1, 3.45], null, [-3.2, 2.4], [1.25, 5.4], [-1.65, 4.5]],
  'fundo-1': [null, null, [1.45, 2.55], [-2.65, 2.85], [1.75, 5.5], [-.9, 5.15]],
};

export function applySixZeroAttackCover(actors, bases, preset, hit, time, duration, hasPass) {
  const order = sixZeroAttackOrder(preset);
  for (const slot of [4, 6, 7, 8]) {
    // Finish the forearm pass and follow-through before releasing that player.
    const release = hasPass ? (slot === 4 ? .192 : .118) * duration : 0;
    if (slot === 4 && hasPass && time < release) continue;
    const [toX, toZ] = coverByPreset[preset][order[slot]];
    const [x, , z] = bases[slot];
    const travelSeconds = Math.max(.45, Math.hypot(toX - x, toZ - z) / 2.5);
    const t = Math.min(1, Math.max(0, (time - release) / travelSeconds));
    const progress = t * t * (3 - 2 * t);
    const path = u => [x + (toX - x) * u, z + (toZ - z) * u];
    const [cx, cz] = path(progress);
    const facing = [hit[0], hit[2]];
    const gait = courtFootwork(path, progress, { shuffle: true, facing, travelSeconds,
      stridePhase: t, endYaw: Math.atan2(hit[0] - toX, hit[2] - toZ) });
    Object.assign(actors[slot], { role: 'passer', pose: 'ready', previousPose: 'ready',
      poseBlend: 1, side: false, facing, position: [cx, 0, cz] }, gait);
  }
}
