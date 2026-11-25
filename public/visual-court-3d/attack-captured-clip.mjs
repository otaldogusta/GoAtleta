import {frames, jointNames, positions} from './attack-captured-positions.mjs?v=spike-release-20261124';

// Offsets in the flat XYZ pose buffer. X points right, Y up and Z forward.
// Horizontal joint positions are relative to the pelvis. The Y coordinate
// includes the original jump: subtract rootMotion.y if the host supplies lift.
// rootMotion.x/z retain the authored horizontal displacement from frame one.
export const ATTACK_CLIP_JOINT = Object.freeze(
  Object.fromEntries(jointNames.map((name, index) => [name, index * 3])),
);
export const ATTACK_CLIP_SIZE = jointNames.length * 3;

/** Sample an authored Blender frame in metres into the caller's reusable buffer. */
export function sampleAttackClip(frame, out) {
  const t = Number.isFinite(frame) ? Math.min(frames[frames.length - 1], Math.max(frames[0], frame)) : frames[0];
  let left = 0;
  let right = frames.length - 1;
  while (right - left > 1) {
    const middle = (left + right) >>> 1;
    if (frames[middle] <= t) left = middle;
    else right = middle;
  }
  const fraction = (t - frames[left]) / (frames[right] - frames[left]);
  const start = left * ATTACK_CLIP_SIZE;
  const end = right * ATTACK_CLIP_SIZE;
  for (let i = 0; i < ATTACK_CLIP_SIZE; i++) {
    const a = positions[start + i];
    out[i] = (a + (positions[end + i] - a) * fraction) * .001;
  }
  return out;
}
