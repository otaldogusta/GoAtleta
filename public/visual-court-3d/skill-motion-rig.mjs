import { Quaternion, Vector3 } from './three.module.min.js';
import { BALL_RADIUS } from './court-net.js';
import { shoeSupportHeight } from './court-shoe.mjs';
import { serveMotionFrame } from './serve-motion-clock.js';
import { settingDigits, skillClips, skillJoints } from './skill-motion-data.mjs?v=jump-serve-20261125';
import { createSettingHands } from './setting-hands.mjs';
import { createStrikePalm } from './strike-palm.mjs';
import { ATTACK_CLIP_JOINT, ATTACK_CLIP_SIZE, sampleAttackClip } from './attack-captured-clip.mjs?v=spike-release-20261124';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (from, to, weight) => from + (to - from) * weight;
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const limbNames = ['shoulder', 'elbow', 'palm', 'fingertip', 'hip', 'knee', 'ankle', 'toe'];
const rightToe = skillJoints.indexOf('toeR') * 3;

// Defensive base in metres, in the capture's joint order (+Z faces the ball).
const defensiveReady = [
  [0, .84, -.09], [0, 1.29, .09], [0, 1.52, .15],
  ...[-1, 1].flatMap(side => [
    [side * .19, 1.29, .09], [side * .27, .97, .23],
    [side * .24, .78, .43], [side * .235, .71, .51],
    [side * .10, .84, -.09], [side * .24, .49, .18],
    [side * .30, .095, -.025], [side * .33, .038, .154],
  ]),
];

// Receive ends before the hitter starts the approach. Sample its opening pose
// once, in the joint order and coordinate system of the reception skeleton.
const approachStart = sampleAttackClip(1, new Float32Array(ATTACK_CLIP_SIZE));
function attackReadyPose(leftHanded) {
  function read(name, lower = .08) {
    const point = new Vector3().fromArray(approachStart, ATTACK_CLIP_JOINT[name]);
    if (!leftHanded) point.x = -point.x;
    // Settle the hips over the feet while the shoe anchors stay on the floor.
    point.y -= lower;
    return point;
  }
  const pose = [read('pelvis'), read('chest'), read('head')];
  for (const side of leftHanded ? ['left', 'right'] : ['right', 'left']) {
    const hand = read(side + 'Hand');
    pose.push(read(side + 'Shoulder'), read(side + 'Elbow'), read(side + 'Wrist').lerp(hand, .5),
      hand, read(side + 'Hip'), read(side + 'Knee', .04), read(side + 'Ankle', 0), read(side + 'Toe', 0));
  }
  return pose;
}
const rightHandedReady = attackReadyPose(false), leftHandedReady = attackReadyPose(true);

function frameForProgress(markers, progress, serve) {
  if (serve) return serveMotionFrame(markers, progress);
  if (progress >= 0) return mix(markers.contact, markers.recover, clamp(progress));
  return mix(markers.ready, markers.contact, clamp(progress + 1));
}

function stageTracks(role, stage, side) {
  if (role !== 'server') return Number(stage === 'contact');
  if (side === 1) return Number(stage === 'contact');
  return Number(stage === 'ready' || stage === 'toss');
}

function reachWeight(role, side, progress, followSet, jumpServe) {
  if (followSet) return 1 - ease((progress - .20) / .55);
  if (role === 'server' && side === 0) return 1 - ease((progress + .65) / .08);
  if (jumpServe) return progress < 0 ? ease((progress + .10) / .10) : 1 - ease(progress / .10);
  if (role === 'setter') return progress < 0 ? ease((progress + .27) / .27) : 1 - ease(progress / .10);
  return progress < 0 ? ease((progress + .35) / .35) : 1 - ease(progress / .18);
}

// The clip supplies the bend plane. A planted foot or a ball handle moves the
// endpoint; solve the middle joint instead of pulling a cylinder away from it.
function solveLimb(base, joint, endpoint, upper, lower, axis, pole, supportForward, supportWeight = 0) {
  axis.subVectors(endpoint, base);
  const span = axis.length();
  if (span < 1e-6) return;
  axis.multiplyScalar(1 / span);
  pole.subVectors(joint, base).projectOnPlane(axis);
  if (pole.lengthSq() < 1e-7) pole.set(0, 0, 1).projectOnPlane(axis);
  pole.normalize();
  if (supportWeight > 0) {
    supportForward.projectOnPlane(axis).normalize();
    const correction = Math.max(0, .6 - pole.dot(supportForward));
    pole.addScaledVector(supportForward, correction * supportWeight).normalize();
  }
  const along = clamp((upper * upper - lower * lower + span * span) / (2 * span), -upper, upper);
  joint.copy(base).addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
}

/** The court clock can seek straight to any contact; there is no mixer clock. */
export function createSkillMotionRig(anatomy) {
  const points = Array.from({ length: 19 }, () => new Vector3());
  const [hips, chest, skull] = points;
  const limbs = [0, 1].map(side => Object.fromEntries(limbNames.map((name, n) => [name, points[3 + side * 8 + n]])));
  const axis = new Vector3(), pole = new Vector3(), desired = new Vector3(), foot = new Vector3();
  const direction = new Vector3(), plantedDirection = new Vector3(), target = new Vector3();
  const shoulderCenter = new Vector3(), contactNormal = new Vector3(), original = new Vector3();
  const platform = new Vector3(), oldAxis = new Vector3(), aimAxis = new Vector3(), shift = new Vector3(), platformNormal = new Vector3();
  const turn = new Quaternion();
  const handNormal = new Vector3(), setTangent = new Vector3();
  const orientServingHand = createStrikePalm(anatomy);
  const renderedHands = ['left', 'right'].map(side => ['palm', 'thumb', 'finger-0', 'finger-1', 'finger-2', 'finger-3']
    .map(name => anatomy.group.getObjectByName(side + '-' + name)));
  let settingHands;

  function poseFloatHand(index, sourceSide, frame, markers) {
    const inward = index ? -1 : 1;
    if (sourceSide === 0) {
      // Retain supination through release. While the guide descends, its
      // fingers tip down and its palm turns progressively toward the hip.
      const lower = ease((frame - markers.toss - 3) / (markers.contact - markers.toss));
      setTangent.set(-inward * .10 * (1 - lower), -lower, 1 - .65 * lower);
      handNormal.set(inward * lower, 1 - lower, .14 * lower).normalize();
    } else {
      // Follow a continuous wrist arc from fingers up to fingers down.
      // Hitting the float uses an open palm facing downcourt at contact.
      const finish = ease((frame - markers.contact) / (markers.idle - markers.contact));
      const pitch = 2.6 * finish, relax = ease((finish - .42) / .58);
      setTangent.set(0, Math.cos(pitch), Math.sin(pitch));
      handNormal.set(inward * relax, (1 - relax) * Math.sin(.22 - pitch),
        (1 - relax) * Math.cos(.22 - pitch)).normalize();
    }
    orientServingHand(index, setTangent, handNormal, 1);
  }

  function ballSurface(role, index, scale, timed, servingHand, jumpServe) {
    const serve = role === 'server';
    contactNormal.subVectors(target, serve ? limbs[index].shoulder : shoulderCenter);
    const distance = contactNormal.length();
    contactNormal.normalize();
    // The guide palm supports from underneath. The striking palm meets the
    // back of the ball, even when the line from the shoulder is almost vertical.
    if (servingHand === 0) contactNormal.set(0, 1, 0);
    if (servingHand === 1) contactNormal.set(0, jumpServe ? -.06 : .22, jumpServe ? 1 : .976).normalize();
    const radius = BALL_RADIUS / scale;
    if (role === 'setter') {
      settingHands.palmTarget(index, target, contactNormal, radius, desired);
    } else {
      desired.copy(target).addScaledVector(contactNormal, -(radius + (serve && timed ? .030 : 0)));
      if (!serve) {
        const bearing = Math.atan2(contactNormal.x, Math.max(.12, contactNormal.z)) * .72;
        desired.x += Math.cos(bearing) * (index ? .055 : -.055);
        desired.z -= Math.sin(bearing) * (index ? .055 : -.055);
      }
    }
    return distance;
  }

  function directPlatform(influence, scale, keepShoulderAim) {
    platform.copy(limbs[0].palm).lerp(limbs[1].palm, .5);
    aimAxis.subVectors(target, shoulderCenter).normalize();
    oldAxis.subVectors(platform, shoulderCenter);
    const span = oldAxis.length();
    oldAxis.normalize();
    platformNormal.subVectors(limbs[1].palm, limbs[0].palm).cross(oldAxis).normalize();
    if (platformNormal.y < 0) platformNormal.negate();
    // Aim the upper face of the two forearms below the sphere; the slight
    // longitudinal offset places contact on their distal third by the wrists.
    for (let iteration = 0; iteration < 2; iteration++) {
      turn.setFromUnitVectors(oldAxis, aimAxis);
      contactNormal.copy(platformNormal).applyQuaternion(turn).addScaledVector(aimAxis, .14).normalize();
      desired.copy(target).addScaledVector(contactNormal, -BALL_RADIUS / scale);
      aimAxis.subVectors(desired, shoulderCenter).normalize();
    }
    turn.setFromUnitVectors(oldAxis, aimAxis);
    shift.copy(desired).sub(shoulderCenter).addScaledVector(aimAxis, -span).clampLength(0, .22);
    // Aim both captured arms as one platform; the same transform preserves
    // elbow extension and the gap between the wrists at ball contact.
    for (const side of limbs) {
      if (keepShoulderAim) side.shoulder.addScaledVector(shift, influence);
      for (const point of keepShoulderAim ? [side.elbow, side.palm, side.fingertip]
        : [side.shoulder, side.elbow, side.palm, side.fingertip]) {
        desired.copy(point).sub(shoulderCenter).applyQuaternion(turn).add(shoulderCenter).add(shift);
        point.lerp(desired, influence);
      }
    }
    chest.addScaledVector(shift, influence);
    skull.addScaledVector(shift, influence);
  }

  return function renderSkill(actor, role, name, previous, blend, yaw, scale, jump, feet, weight, localBall, readiness) {
    const serve = role === 'server';
    if (role === 'setter') settingHands ??= createSettingHands(renderedHands, settingDigits);
    const fallback = serve ? 'serve' : role === 'setter' ? 'set' : 'pass';
    const clipName = Object.hasOwn(skillClips, actor.skillMotion) ? actor.skillMotion : fallback;
    const jumpServe = clipName === 'serveSpin';
    const clip = skillClips[clipName], markers = clip.markers;
    const timed = Number.isFinite(actor.skillProgress);
    const progress = timed ? clamp(actor.skillProgress, -1, 1) : 0;
    const mirror = clipName === 'passSide' ? actor.skillSide < 0 : actor.mirror === true;
    let from, to, fraction, fromClip = clip, toClip = clip;
    if (timed) {
      const frame = frameForProgress(markers, progress, serve);
      from = Math.floor(frame);
      to = Math.min(clip.frames.length - 1, from + 1);
      fraction = frame - from;
    } else {
      // Hand-edited static stages can jump between any two keys. Returning to
      // ready cross-fades poses, rather than playing a second contact in reverse.
      fromClip = !actor.skillMotion && previous === 'backfollow' ? skillClips.setBack : clip;
      toClip = !actor.skillMotion && name === 'backfollow' ? skillClips.setBack : clip;
      const previousKey = fromClip.markers[previous] ?? fromClip.markers.ready;
      const nextKey = toClip.markers[name] ?? toClip.markers.ready;
      if (fromClip === toClip && nextKey > previousKey && previous !== 'follow' && previous !== 'backfollow') {
        const frame = mix(previousKey, nextKey, blend);
        from = Math.floor(frame);
        to = Math.min(toClip.frames.length - 1, from + 1);
        fraction = frame - from;
      } else {
        from = previousKey;
        to = nextKey;
        fraction = blend;
      }
    }
    const a = fromClip.frames[from], b = toClip.frames[to];
    const openHands = role === 'setter' ? mix(fromClip.window?.[from] ?? 0, toClip.window?.[to] ?? 0, fraction) : 0;
    const release = mix(fromClip.release?.[from] ?? 0, toClip.release?.[to] ?? 0, fraction);
    const ready = actor.attackReadyLeft ? leftHandedReady : rightHandedReady;
    const cycle = actor.travelMotion?.phase ?? actor.runCycle;
    const travelWeight = Number.isFinite(cycle) && cycle >= 0 && cycle < 2
      ? clamp(actor.feetWeight ?? 1) : 0;
    const readyWeight = timed
      ? progress >= 0 ? ease((progress - .2) / .65) : ease((-progress - .65) / .35)
      : mix(Number(previous === 'ready'), Number(name === 'ready'), blend);
    const stance = role === 'passer' && jump === 0 ? readyWeight * (1 - travelWeight) : 0;
    for (let joint = 0; joint < points.length; joint++) {
      const source = mirror && joint >= 3 ? joint + (joint < 11 ? 8 : -8) : joint;
      const i = source * 3;
      points[joint].set(
        (mirror ? -1 : 1) * mix(a[i], b[i], fraction) * .001,
        mix(a[i + 1], b[i + 1], fraction) * .001,
        mix(a[i + 2], b[i + 2], fraction) * .001,
      );
      if (stance > 0) {
        const [x, y, z] = defensiveReady[joint];
        points[joint].set(mix(points[joint].x, x, stance), mix(points[joint].y, y, stance), mix(points[joint].z, z, stance));
      }
      if (readiness > 0) points[joint].lerp(ready[joint], readiness);
    }
    const feetWeight = feet ? clamp(actor.feetWeight ?? 1) : 0;
    // A planted reception keeps the same ground contact as the entering gait
    // while its torso and arms blend between the ball gesture and locomotion.
    const plantWeight = feet && actor.plantedStance ? 1 : feetWeight;
    if (plantWeight > 0 && actor.plantedStance && role === 'passer' && clipName === 'passSide' && timed) {
      // Rebase the Blender lead step to the court footprint. The trailing
      // shoe remains on its anchor and the authored pelvis supplies the load.
      const supportIndex = mirror ? 0 : 1;
      const anchor = feet[supportIndex];
      const readyToe = clip.frames[markers.ready];
      const toeOffset = axis => (mix(a[rightToe + axis], b[rightToe + axis], fraction) - readyToe[rightToe + axis]) * .001;
      const across = (mirror ? -1 : 1) * toeOffset(0), forward = toeOffset(2);
      const cosine = Math.cos(anchor[3]), sine = Math.sin(anchor[3]);
      const support = [anchor[0] + across * cosine + forward * sine,
        Math.max(anchor[1], toeOffset(1)), anchor[2] - across * sine + forward * cosine, anchor[3]];
      feet = mirror ? [support, feet[1]] : [feet[0], support];
    }
    if (feetWeight > 0) {
      const readyWeight = timed ? ease((-progress - .45) / .55)
        : mix(Number(previous === 'ready'), Number(name === 'ready'), blend);
      // Stand up to travel, then settle into the platform as the last shoe lands.
      let height = mix(hips.y, Math.max(.89, hips.y), readyWeight * feetWeight);
      for (const [index, { hip }] of limbs.entries()) {
        const anchor = feet[index], span = Math.hypot(anchor[0] - hip.x, anchor[2] - .065 - hip.z);
        const ceiling = anchor[1] + .095 + Math.sqrt(Math.max(.04, .92 ** 2 - span ** 2));
        height = Math.min(height, mix(height, ceiling - (hip.y - hips.y), feetWeight));
      }
      const lift = height - hips.y;
      for (const point of [hips, chest, skull]) point.y += lift;
      for (const side of limbs) {
        for (const point of [side.hip, side.shoulder, side.elbow, side.palm, side.fingertip]) point.y += lift;
      }
    }
    anatomy.group.position.set(0, jump, 0);
    anatomy.group.rotation.set(0, yaw, 0);
    anatomy.group.scale.setScalar(scale);
    shoulderCenter.copy(limbs[0].shoulder).lerp(limbs[1].shoulder, .5);
    if (localBall) target.set(...localBall);
    // The fingertips continue through the release before the arms come down.
    // Keep the correction in the court frame as the setter starts to land.
    const followSet = timed && role === 'setter' && actor.setReleaseDirection && progress > 0;
    const extension = followSet ? 1 - (1 - clamp(progress / .22)) ** 2 : 0;
    if (followSet) {
      const [dx, dy, dz] = actor.setReleaseDirection;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      setTangent.set(dx * c - dz * s, dy, dx * s + dz * c);
      target.addScaledVector(setTangent, .11 * extension / scale);
    }
    const capturedPlatform = role === 'passer' && timed;
    if (capturedPlatform && localBall) {
      const reach = 1 - ease((target.distanceTo(shoulderCenter) * scale - 1.0) / .25);
      directPlatform(reachWeight(role, 0, progress) * weight * reach, scale,
        actor.plantedStance && clipName === 'passSide');
    } else if (timed && localBall) {
      // A high release includes elevation/protraction of the shoulder girdle.
      // Keep the recorded humerus and forearm lengths on the smaller setters.
      shift.set(0, 0, 0);
      for (const [index, side] of limbs.entries()) {
        const sourceSide = mirror ? 1 - index : index;
        const track = reachWeight(role, sourceSide, progress, followSet, jumpServe);
        const distance = ballSurface(role, index, scale, timed, serve ? sourceSide : undefined, jumpServe);
        const reach = side.shoulder.distanceTo(side.elbow) + side.elbow.distanceTo(side.palm);
        const required = desired.sub(side.shoulder).length() - reach + .004;
        const influence = track * weight * (followSet ? 1 : 1 - ease((distance * scale - 1.0) / .25));
        desired.normalize().multiplyScalar(clamp(required, 0, role === 'setter' ? .18 : .12) * influence);
        for (const point of [side.shoulder, side.elbow, side.palm, side.fingertip]) point.add(desired);
        shift.add(desired);
      }
      chest.addScaledVector(shift, .27);
      skull.addScaledVector(shift, .20);
      shoulderCenter.copy(limbs[0].shoulder).lerp(limbs[1].shoulder, .5);
    }
    anatomy.setCapturedTrunk(hips, chest, skull, limbs[0], limbs[1], true);
    for (const [index, side] of limbs.entries()) {
      const { hip, knee, ankle, toe, shoulder, elbow, palm, fingertip } = side;
      // The Blender end marker is on the toe. The footprint origin is
      // 65 mm ahead of the ankle in the standing pose.
      direction.subVectors(toe, ankle);
      // In the source rig a level shoe's toe sits 57 mm below its ankle.
      const solePitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) + Math.atan2(.057, .182);
      direction.y = 0;
      direction.normalize().multiplyScalar(Math.cos(solePitch));
      direction.y = Math.sin(solePitch);
      foot.copy(ankle).addScaledVector(direction, .065);
      let clearance = Math.max(0, toe.y - .038);
      if (plantWeight > 0) {
        const [x, lift, z, heading] = feet[index];
        plantedDirection.set(Math.sin(heading), 0, Math.cos(heading));
        direction.lerp(plantedDirection, plantWeight).normalize();
        foot.x = mix(foot.x, x, plantWeight);
        foot.z = mix(foot.z, z, plantWeight);
        clearance = mix(clearance, lift, plantWeight);
        desired.set(x - plantedDirection.x * .065, .095 + lift, z - plantedDirection.z * .065);
        ankle.lerp(desired, plantWeight);
        // The almost straight trailing leg in frame one has no reliable bend
        // plane. On the staggered base, let its knee track the toes instead.
        if (readiness > 0) {
          desired.copy(hip).lerp(ankle, .5).addScaledVector(plantedDirection, .20);
          knee.lerp(desired, readiness);
        }
        solveLimb(hip, knee, ankle, .46, .46, axis, pole, plantedDirection, plantWeight * (1 - ease(lift / .08)));
      }
      foot.y = clearance + shoeSupportHeight(direction.y);
      anatomy.setCapturedLeg(index, hip, knee, ankle, foot, direction);

      const sourceSide = mirror ? 1 - index : index;
      const track = timed ? reachWeight(role, sourceSide, progress, followSet, jumpServe)
        : mix(stageTracks(role, previous, sourceSide), stageTracks(role, name, sourceSide), blend);
      direction.subVectors(fingertip, palm).normalize();
      let handInfluence = 0;
      if (!capturedPlatform && localBall && weight * track > 0) {
        const distance = ballSurface(role, index, scale, timed, serve ? sourceSide : undefined, jumpServe);
        const reach = .859 * scale + BALL_RADIUS;
        const influence = weight * track * (followSet ? 1 : 1 - ease((distance * scale - reach) / .35));
        if (influence > 0 && distance > 1e-7) {
          original.copy(elbow);
          // Preserve the Blender skeleton on a timed set or serve. The
          // original manual pose handles use the legacy .43 m segment rig.
          const upper = timed ? shoulder.distanceTo(elbow) : .43;
          const lower = timed ? elbow.distanceTo(palm) : .43;
          // Blend from a reachable extension as the feet come down. Blending
          // toward a target still high above the head holds the elbows locked
          // until the last part of recovery.
          if (followSet) desired.sub(shoulder).clampLength(0, upper + lower - .001).add(shoulder);
          palm.lerp(desired, influence);
          axis.subVectors(palm, shoulder).clampLength(0, upper + lower - .001);
          palm.copy(shoulder).add(axis);
          solveLimb(shoulder, elbow, palm, upper, lower, axis, pole);
          if (!timed) elbow.lerp(original, 1 - influence);
          if (timed || role === 'setter') handInfluence = influence;
        }
      }
      anatomy.setArm(index, elbow.x, elbow.y, elbow.z, palm.x, palm.y, palm.z,
        Math.atan2(Math.hypot(direction.x, direction.z), direction.y), 0, role === 'passer' ? 0 : .3 + .55 * openHands,
        Math.atan2(direction.x, direction.z), 0, stance * (1 - readiness), openHands > 0);
      if (openHands > 0) {
        if (followSet) contactNormal.lerp(setTangent, .65 * extension).normalize();
        settingHands.pose(index, direction, openHands, contactNormal, handInfluence, BALL_RADIUS / scale, release);
        anatomy.seatSettingWrist(index, openHands);
      } else if (clipName === 'serve') {
        poseFloatHand(index, sourceSide, mix(from, to, fraction), markers);
      } else if (jumpServe) {
        // Supinate the guide through release. The open striking palm then
        // rolls over the back of the ball as the captured arm follows through.
        const frame = mix(from, to, fraction), inward = index ? -1 : 1;
        if (sourceSide === 0) {
          const down = ease((frame - markers.toss) / (markers.draw - markers.toss));
          handNormal.set(inward * down, 1 - down, .1 * down).normalize();
        } else {
          const snap = ease((frame - markers.contact) / (markers.follow - markers.contact));
          handNormal.set(inward * .15 * snap, -Math.sin(.06 + 1.6 * snap), Math.cos(.06 + 1.6 * snap)).normalize();
        }
        orientServingHand(index, direction, handNormal, 1);
      }
    }
  };
}
