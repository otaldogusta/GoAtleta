import { Euler, Matrix4, Quaternion, Vector3 } from './three.module.min.js';

const up = new Vector3(0, 1, 0);
const radians = Math.PI / 180;
// Calibration of the Blender contact pose. +Y runs along the fingers, +Z
// faces out of the palm. Mirror the wrist and landmarks together.
const wrists = [-1, 1].map(side => new Quaternion().setFromEuler(
  new Euler(-20 * radians, -side * 48 * radians, side * 26 * radians, 'YXZ'),
));
const fingers = ['thumb', 'index', 'middle', 'ring', 'little'];
const radii = [.013, .010, .0105, .010, .0085];

export function createSettingHands(renderedHands, landmarks) {
  const hands = renderedHands.map(([palm, ...meshes], index) => {
    const side = index ? 1 : -1;
    return { palm, side, axis: up.clone().applyQuaternion(wrists[index]),
      digits: fingers.map((name, i) => {
        const [base, joint, tip] = landmarks[name].map(([x, y, z]) => new Vector3(side * x, y, z));
        return { mesh: meshes[i], base, joint, tip, radius: radii[i] };
      }),
    };
  });
  const turn = new Quaternion(), wrist = new Quaternion(), contact = new Quaternion(), orientation = new Quaternion();
  const axis = new Vector3(), bend = new Vector3(), across = new Vector3(), endpoint = new Vector3();
  const center = new Vector3(), dimensions = new Vector3(), basis = new Matrix4();

  function contactWrist(index, ballAxis) {
    return contact.setFromUnitVectors(up, ballAxis).multiply(wrists[index]);
  }

  function palmTarget(index, ball, ballAxis, radius, result) {
    // Offset from the centre of the open palm to the ball, in hand space.
    center.set(-hands[index].side * .027, .042, radius + .032);
    return result.copy(ball).sub(center.applyQuaternion(contactWrist(index, ballAxis)));
  }

  function pose(index, fingerDirection, openness, ballAxis, influence, radius, release) {
    const { palm, digits, side, axis: restAxis } = hands[index];
    wrist.copy(wrists[index]).premultiply(turn.setFromUnitVectors(restAxis, fingerDirection));
    if (influence > 0) wrist.slerp(contactWrist(index, ballAxis), influence);
    palm.quaternion.slerp(wrist, openness);
    for (const digit of digits) {
      const { base, joint, tip, mesh } = digit;
      endpoint.copy(tip);
      endpoint.z *= 1 - .35 * release;
      if (influence > 0) {
        // Fit each pad to its own point on the near hemisphere when player
        // scale changes. The knuckles keep the curvature authored in Blender.
        const lateral = tip.x + side * .027, distal = tip.y - .042;
        const padSurface = radius + digit.radius * .51;
        const depth = radius + .032 - Math.sqrt(Math.max(0, padSurface ** 2 - lateral ** 2 - distal ** 2));
        endpoint.z += influence * Math.max(-.02, Math.min(.02, depth - tip.z));
      }
      axis.subVectors(endpoint, base);
      const length = axis.length();
      axis.multiplyScalar(1 / length);
      bend.subVectors(joint, base);
      bend.z -= .175 * release * joint.z;
      bend.projectOnPlane(axis);
      const deflection = bend.length();
      bend.normalize();
      across.crossVectors(axis, bend);
      orientation.setFromRotationMatrix(basis.makeBasis(across, axis, bend)).premultiply(wrist);
      center.copy(base).lerp(endpoint, .5).applyQuaternion(wrist).add(palm.position);
      mesh.position.lerp(center, openness);
      mesh.quaternion.slerp(orientation, openness);
      mesh.scale.lerp(dimensions.set(digit.radius, length, digit.radius), openness);
      mesh.morphTargetInfluences[0] = openness * deflection / (3 * digit.radius);
      mesh.morphTargetInfluences[1] = openness;
      mesh.boundingBox.max.z = 1 + 3 * mesh.morphTargetInfluences[0];
    }
  }
  return { palmTarget, pose };
}
