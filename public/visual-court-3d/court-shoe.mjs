import {BufferGeometry, BufferAttribute} from './three.module.min.js';
import {shoeVertices, shoeIndices, shoeProfile} from './court-shoe-data.mjs';

const unit = .0001; // Blender bake in tenths of a millimetre.

export function createCourtShoeGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(shoeVertices, x => x * unit), 3));
  geometry.setIndex(new BufferAttribute(shoeIndices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

// Positive distance from the origin to the lowest point of the rotated sole.
// Yaw and mirroring X do not change height. The silhouette has far fewer
// vertices than the shoe, so this can also follow the pitch during a stride.
export function shoeSupportHeight(directionY) {
  const sine = Math.max(-1, Math.min(1, directionY));
  const cosine = Math.sqrt(1 - sine * sine);
  let depth = -Infinity;
  for (let i = 0; i < shoeProfile.length; i += 2) {
    depth = Math.max(depth, -shoeProfile[i] * cosine - shoeProfile[i + 1] * sine);
  }
  return depth * unit;
}
