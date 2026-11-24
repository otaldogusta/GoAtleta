import { Matrix4, Quaternion, Vector3 } from './three.module.min.js';
import { BALL_RADIUS } from './court-net.js';
import { skillClips } from './skill-motion-data.mjs';
import { ATTACK_CLIP_JOINT, ATTACK_CLIP_SIZE, sampleAttackClip } from './attack-captured-clip.mjs?v=landing-20261122';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (from, to, weight) => from + (to - from) * weight;
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const limbNames = ['shoulder', 'elbow', 'palm', 'fingertip', 'hip', 'knee', 'ankle', 'toe'];

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
  if (progress >= 0) return mix(markers.contact, markers.recover, clamp(progress));
  if (serve) {
    if (progress <= -.65) return mix(markers.ready, markers.toss, clamp((progress + 1) / .35));
    return mix(markers.toss, markers.contact, clamp((progress + .65) / .65));
  }
  return mix(markers.ready, markers.contact, clamp(progress + 1));
}

function stageTracks(role, stage, side) {
  if (role !== 'server') return Number(stage === 'contact');
  if (side === 1) return Number(stage === 'contact');
  return Number(stage === 'ready' || stage === 'toss');
}

function reachWeight(role, side, progress) {
  if (role === 'server' && side === 0) return 1 - ease((progress + .65) / .08);
  return progress < 0 ? ease((progress + .35) / .35) : 1 - ease(progress / .18);
}

// The clip supplies the bend plane. A planted foot or a ball handle moves the
// endpoint; solve the middle joint instead of pulling a cylinder away from it.
function solveLimb(base, joint, endpoint, upper, lower, axis, pole) {
  axis.subVectors(endpoint, base);
  const span = axis.length();
  if (span < 1e-6) return;
  axis.multiplyScalar(1 / span);
  pole.subVectors(joint, base).projectOnPlane(axis);
  if (pole.lengthSq() < 1e-7) pole.set(0, 0, 1).projectOnPlane(axis);
  pole.normalize();
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
  const handAxes = new Matrix4(), wristTurn = new Quaternion(), wristBlend = new Quaternion();
  const handNormal = new Vector3(), handTangent = new Vector3(), handAcross = new Vector3();
  const renderedHands = ['left', 'right'].map(side => ['palm', 'thumb', 'finger-0', 'finger-1', 'finger-2', 'finger-3']
    .map(name => anatomy.group.getObjectByName(side + '-' + name)));

  function ballSurface(role, index, scale, timed) {
    const serve = role === 'server';
    contactNormal.subVectors(target, serve ? limbs[index].shoulder : shoulderCenter);
    const distance = contactNormal.length();
    contactNormal.normalize();
    const radius = BALL_RADIUS / scale;
    const handDepth = .030;
    desired.copy(target).addScaledVector(contactNormal, -(radius + (serve && timed ? handDepth : 0)));
    if (!serve) {
      if (role === 'setter' && timed) {
        // Hold the lower sides; each palm lies one palm-depth off the sphere.
        handAcross.set(1, 0, 0).projectOnPlane(contactNormal).normalize();
        const spread = Math.sqrt((radius + handDepth) ** 2 - radius ** 2);
        desired.addScaledVector(handAcross, (index ? 1 : -1) * spread);
      } else {
        const bearing = Math.atan2(contactNormal.x, Math.max(.12, contactNormal.z)) * (role === 'setter' ? .32 : .72);
        desired.x += Math.cos(bearing) * (index ? .055 : -.055);
        desired.z -= Math.sin(bearing) * (index ? .055 : -.055);
      }
    }
    return distance;
  }

  function orientContactHand(index, fingerDirection, influence, serve) {
    const hand = renderedHands[index], palm = hand[0];
    handNormal.subVectors(target, palm.position).normalize();
    handTangent.copy(fingerDirection).projectOnPlane(handNormal);
    if (handTangent.lengthSq() < .01) {
      if (Math.abs(handNormal.y) < .8) handTangent.set(0, 1, 0);
      else handTangent.set(0, 0, 1);
      handTangent.projectOnPlane(handNormal);
    }
    handTangent.normalize();
    // Aim the pads a little into the tangent plane. The fingertips then
    // meet the curved surface while the heel of the hand stays outside.
    handAcross.crossVectors(handTangent, handNormal).normalize();
    const fingerContactPitch = (serve ? 22 : 20) * Math.PI / 180;
    handTangent.multiplyScalar(Math.cos(fingerContactPitch)).addScaledVector(handNormal, Math.sin(fingerContactPitch));
    handNormal.crossVectors(handAcross, handTangent).normalize();
    wristTurn.setFromRotationMatrix(handAxes.makeBasis(handAcross, handTangent, handNormal));
    wristTurn.multiply(wristBlend.copy(palm.quaternion).invert());
    wristBlend.identity().slerp(wristTurn, influence);
    palm.quaternion.premultiply(wristBlend);
    for (let i = 1; i < hand.length; i++) {
      const digit = hand[i];
      digit.position.sub(palm.position).applyQuaternion(wristBlend).add(palm.position);
      digit.quaternion.premultiply(wristBlend);
    }
  }

  function directPlatform(influence, scale) {
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
      for (const point of [side.shoulder, side.elbow, side.palm, side.fingertip]) {
        desired.copy(point).sub(shoulderCenter).applyQuaternion(turn).add(shoulderCenter).add(shift);
        point.lerp(desired, influence);
      }
    }
    chest.addScaledVector(shift, influence);
    skull.addScaledVector(shift, influence);
  }

  return function renderSkill(actor, role, name, previous, blend, yaw, scale, jump, feet, weight, localBall, readiness) {
    const serve = role === 'server';
    const fallback = serve ? 'serve' : role === 'setter' ? 'set' : 'pass';
    const clipName = Object.hasOwn(skillClips, actor.skillMotion) ? actor.skillMotion : fallback;
    const clip = skillClips[clipName], markers = clip.markers;
    const timed = Number.isFinite(actor.skillProgress);
    const progress = timed ? clamp(actor.skillProgress, -1, 1) : 0;
    const mirror = clipName === 'passSide' ? actor.skillSide < 0 : actor.mirror === true;
    let from, to, fraction, sourceFrames = clip.frames, targetFrames = clip.frames;
    if (timed) {
      const frame = frameForProgress(markers, progress, serve);
      from = Math.floor(frame);
      to = Math.min(clip.frames.length - 1, from + 1);
      fraction = frame - from;
    } else {
      // Hand-edited static stages can jump between any two keys. Returning to
      // ready cross-fades poses, rather than playing a second contact in reverse.
      const fromClip = !actor.skillMotion && previous === 'backfollow' ? skillClips.setBack : clip;
      const toClip = !actor.skillMotion && name === 'backfollow' ? skillClips.setBack : clip;
      sourceFrames = fromClip.frames;
      targetFrames = toClip.frames;
      const previousKey = fromClip.markers[previous] ?? fromClip.markers.ready;
      const nextKey = toClip.markers[name] ?? toClip.markers.ready;
      if (fromClip === toClip && nextKey > previousKey && previous !== 'follow' && previous !== 'backfollow') {
        const frame = mix(previousKey, nextKey, blend);
        from = Math.floor(frame);
        to = Math.min(targetFrames.length - 1, from + 1);
        fraction = frame - from;
      } else {
        from = previousKey;
        to = nextKey;
        fraction = blend;
      }
    }
    const a = sourceFrames[from], b = targetFrames[to];
    const ready = actor.attackReadyLeft ? leftHandedReady : rightHandedReady;
    for (let joint = 0; joint < points.length; joint++) {
      const source = mirror && joint >= 3 ? joint + (joint < 11 ? 8 : -8) : joint;
      const i = source * 3;
      points[joint].set(
        (mirror ? -1 : 1) * mix(a[i], b[i], fraction) * .001,
        mix(a[i + 1], b[i + 1], fraction) * .001,
        mix(a[i + 2], b[i + 2], fraction) * .001,
      );
      if (readiness > 0) points[joint].lerp(ready[joint], readiness);
    }
    const feetWeight = feet ? clamp(actor.feetWeight ?? 1) : 0;
    // A planted reception keeps the same ground contact as the entering gait
    // while its torso and arms blend between the ball gesture and locomotion.
    const plantWeight = feet && actor.plantedStance ? 1 : feetWeight;
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
    const capturedPlatform = role === 'passer' && timed;
    if (capturedPlatform && localBall) {
      const reach = 1 - ease((target.distanceTo(shoulderCenter) * scale - 1.0) / .25);
      directPlatform(reachWeight(role, 0, progress) * weight * reach, scale);
    } else if (timed && localBall) {
      // A high release includes elevation/protraction of the shoulder girdle.
      // Keep the recorded humerus and forearm lengths on the smaller setters.
      shift.set(0, 0, 0);
      for (const [index, side] of limbs.entries()) {
        const track = reachWeight(role, mirror ? 1 - index : index, progress);
        const distance = ballSurface(role, index, scale, timed);
        const reach = side.shoulder.distanceTo(side.elbow) + side.elbow.distanceTo(side.palm);
        const required = desired.sub(side.shoulder).length() - reach + .004;
        const influence = track * weight * (1 - ease((distance * scale - 1.0) / .25));
        desired.normalize().multiplyScalar(clamp(required, 0, .12) * influence);
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
      // The Blender end marker is the toe on the sole. The court's oval shoe
      // is measured at its centre, .065 m ahead of the ankle when standing.
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
        solveLimb(hip, knee, ankle, .46, .46, axis, pole);
      }
      // Support height of the rotated shoe ellipsoid, after blending the plant.
      const soleDepth = Math.hypot(.055 * Math.hypot(direction.x, direction.z), .145 * direction.y);
      foot.y = clearance + soleDepth;
      anatomy.setCapturedLeg(index, hip, knee, ankle, foot, direction);

      const sourceSide = mirror ? 1 - index : index;
      const track = timed ? reachWeight(role, sourceSide, progress)
        : mix(stageTracks(role, previous, sourceSide), stageTracks(role, name, sourceSide), blend);
      direction.subVectors(fingertip, palm).normalize();
      let handInfluence = 0;
      if (!capturedPlatform && localBall && weight * track > 0) {
        const distance = ballSurface(role, index, scale, timed);
        const reach = .859 * scale + BALL_RADIUS;
        const influence = weight * track * (1 - ease((distance * scale - reach) / .35));
        if (influence > 0 && distance > 1e-7) {
          original.copy(elbow);
          // Preserve the Blender skeleton on a timed set or serve. The
          // original manual pose handles use the legacy .43 m segment rig.
          const upper = timed ? shoulder.distanceTo(elbow) : .43;
          const lower = timed ? elbow.distanceTo(palm) : .43;
          palm.lerp(desired, influence);
          axis.subVectors(palm, shoulder).clampLength(0, upper + lower - .001);
          palm.copy(shoulder).add(axis);
          solveLimb(shoulder, elbow, palm, upper, lower, axis, pole);
          if (!timed) elbow.lerp(original, 1 - influence);
          else handInfluence = influence;
        }
      }
      anatomy.setArm(index, elbow.x, elbow.y, elbow.z, palm.x, palm.y, palm.z,
        Math.atan2(Math.hypot(direction.x, direction.z), direction.y), 0, role === 'passer' ? 0 : .3,
        Math.atan2(direction.x, direction.z));
      if (handInfluence > 0) orientContactHand(index, direction, handInfluence, serve);
    }
  };
}
