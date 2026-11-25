import { Matrix4, Quaternion, Vector3 } from './three.module.min.js';

// Turn the surface of the open hand toward the ball. The thumb and the four
// fingers follow the wrist together throughout the strike and follow-through.
export function createStrikePalm(anatomy) {
  const hands = ['left', 'right'].map(side => ['palm', 'thumb', 'finger-0', 'finger-1', 'finger-2', 'finger-3']
    .map(name => anatomy.group.getObjectByName(side + '-' + name)));
  const tangent = new Vector3(), across = new Vector3(), normal = new Vector3();
  const basis = new Matrix4(), turn = new Quaternion(), blend = new Quaternion();
  const padPitch = 22 * Math.PI / 180;
  return (index, fingerDirection, contactNormal, influence) => {
    const [palm] = hands[index];
    tangent.copy(fingerDirection).projectOnPlane(contactNormal);
    if (tangent.lengthSq() < .01) {
      if (Math.abs(contactNormal.y) < .8) tangent.set(0, 1, 0);
      else tangent.set(0, 0, 1);
      tangent.projectOnPlane(contactNormal);
    }
    tangent.normalize();
    across.crossVectors(tangent, contactNormal).normalize();
    tangent.multiplyScalar(Math.cos(padPitch)).addScaledVector(contactNormal, Math.sin(padPitch));
    normal.crossVectors(across, tangent).normalize();
    turn.setFromRotationMatrix(basis.makeBasis(across, tangent, normal));
    turn.multiply(blend.copy(palm.quaternion).invert());
    blend.identity().slerp(turn, influence);
    palm.quaternion.premultiply(blend);
    for (let i = 1; i < hands[index].length; i++) {
      const digit = hands[index][i];
      digit.position.sub(palm.position).applyQuaternion(blend).add(palm.position);
      digit.quaternion.premultiply(blend);
    }
  };
}
