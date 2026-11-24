import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Group, Triangle, Vector3 } from './three.module.min.js';
import { createActorRig } from './actor-rig.mjs';
import { skillClips } from './skill-motion-data.mjs';
import { receptionFormation } from '../../src/core/court-simulation/formations.js';
import { sampleReception } from '../../src/core/court-simulation/reception-motion.js';
import { sampleAttack } from '../../src/core/court-simulation/attack-motion.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function nearestFingerSurface(rig, side, ball) {
  const face = new Triangle(), point = new Vector3();
  let closest = Infinity;
  for (const digit of ['finger-0', 'finger-1', 'finger-2', 'finger-3', 'thumb']) {
    const part = rig.group.getObjectByName(side + '-' + digit), mesh = part.geometry;
    for (let index = 0; index < mesh.index.count; index += 3) {
      for (const [offset, vertex] of [face.a, face.b, face.c].entries()) {
        vertex.fromBufferAttribute(mesh.attributes.position, mesh.index.getX(index + offset)).applyMatrix4(part.matrixWorld);
      }
      closest = Math.min(closest, face.closestPointToPoint(ball, point).distanceTo(ball));
    }
  }
  return closest;
}
function fixture() {
  const rig = createActorRig(new Group());
  const position = name => rig.group.getObjectByName(name).position.clone();
  return { rig, position };
}

test('a tilted shoe stays on the floor while the heel rises and the plant blends in', () => {
  const { rig } = fixture();
  for (const [skillMotion, poseRole] of [['serve', 'server'], ['setJump', 'setter']]) {
    for (const feetWeight of [0, .45, 1]) {
      rig.update({ poseRole, pose: 'contact', poseScale: 1, skillMotion, skillProgress: 0,
        position: { x: 0, y: 0, z: 0 }, feet: [[-.17, 0, .05, .12], [.17, 0, -.05, -.12]], feetWeight });
      const shoe = rig.group.getObjectByName('right-foot');
      if (!feetWeight) assert.ok(shoe.rotation.x > .4);
      rig.group.updateWorldMatrix(true, true);
      const ground = new Box3().setFromObject(shoe, true).min.y;
      assert.ok(ground > -1e-6 && ground < .002, `${skillMotion} sole is ${ground} m above the floor`);
    }
  }
});

test('the court clock samples intermediate Blender frames and rewinds to identical geometry', () => {
  const { rig, position } = fixture();
  for (const [skillMotion, clip] of Object.entries(skillClips)) {
    const serve = skillMotion.startsWith('serve');
    const poseRole = serve ? 'server' : skillMotion.startsWith('set') ? 'setter' : 'passer';
    const render = skillProgress => rig.update({ poseRole, pose: 'ready', poseScale: 1, skillMotion, skillProgress });
    const frame = serve ? clip.markers.toss / 2 : clip.markers.contact / 2;
    const timing = serve ? -.825 : -.5;
    const lower = clip.frames[Math.floor(frame)], upper = clip.frames[Math.ceil(frame)];
    render(timing);
    const pelvis = position('pelvis'), saved = position('left-elbow');
    near(pelvis.y, (lower[1] + upper[1]) / 2000);
    render(0);
    assert.ok(position('left-elbow').distanceTo(saved) > .03, skillMotion);
    assert.ok(position('nose').sub(position('head')).z > .065, `${skillMotion} looks forward`);
    render(.43);
    render(timing);
    near(position('left-elbow').distanceTo(saved), 0);
    render(1);
    near(position('pelvis').y, clip.frames[clip.markers.recover][1] / 1000);
  }
});

test('a side platform mirrors its hip transfer and leaves the windup of a back set distinct', () => {
  const { rig, position } = fixture();
  const pass = skillSide => rig.update({ poseRole: 'passer', skillMotion: 'passSide', skillProgress: 0, skillSide });
  pass(1);
  const rightHip = position('pelvis'), rightHand = position('right-palm');
  pass(-1);
  near(position('pelvis').x, -rightHip.x);
  near(position('left-palm').x, -rightHand.x);
  assert.ok(rightHip.x > .1);
  for (const key of ['set', 'setBack']) {
    const clip = skillClips[key];
    rig.update({ poseRole: 'setter', skillMotion: key, skillProgress: (clip.markers.follow - clip.markers.contact) / (clip.markers.recover - clip.markers.contact) });
    const reach = position('right-palm').z - position('right-shoulder').z;
    assert.ok(key === 'set' ? reach > .2 : reach < -.10, `${key} release ${reach}`);
  }
});

test('a contact retargets the rendered platform and planting survives rotation and scrubbing', () => {
  const { rig } = fixture();
  const parent = rig.group.parent, origin = { x: 1, y: 0, z: 2 }, feet = [[.82, 0, 2.06, .1], [1.22, 0, 2.05, .1]];
  parent.position.set(origin.x, origin.y, origin.z);
  const localContact = new Vector3(.49, 1.04, .73);
  for (const angle of [.1, -.15, .1]) {
    const ball = localContact.clone().applyAxisAngle(new Vector3(0, 1, 0), angle).add(parent.position);
    rig.update({ position: origin, feet, feetWeight: 1, poseRole: 'passer', pose: 'load', poseScale: 1,
      facing: [Math.sin(angle), Math.cos(angle)], skillMotion: 'passSide', skillProgress: 0, skillSide: 1, contactTarget: ball });
    parent.updateMatrixWorld(true);
    const world = name => rig.group.getObjectByName(name).getWorldPosition(new Vector3());
    near(world('left-palm').lerp(world('right-palm'), .5).distanceTo(ball), .12);
    for (const [index, side] of ['left', 'right'].entries()) {
      near(world(side + '-foot').distanceTo(new Vector3(feet[index][0], .055, feet[index][2])), 0);
      const elbow = world(side + '-elbow');
      const upper = elbow.clone().sub(world(side + '-shoulder')).normalize();
      const forearm = world(side + '-palm').sub(elbow).normalize();
      assert.ok(upper.dot(forearm) > .94, 'the receiver presents a long forearm platform');
    }
  }
});

test('incoming serves meet the two extended forearms across the six starting rotations', () => {
  const { rig } = fixture();
  const parent = rig.group.parent;
  for (const serve of ['Float', 'Topspin']) for (let rotation = 0; rotation < 6; rotation++) {
    const options = { serve, rotation, bases: [...receptionFormation('5-1', rotation), [1.7, 0, -10.44]] };
    const timing = sampleReception(0, options), frame = sampleReception(timing.receiveContact, options);
    const actor = frame.actors[timing.receiver], [x, y, z] = actor.position, ball = new Vector3(...frame.ball);
    const facing = [actor.facing[0] - x, actor.facing[1] - z], yaw = Math.atan2(...facing);
    const side = Math.sign((ball.x - x) * Math.cos(yaw) - (ball.z - z) * Math.sin(yaw));
    parent.position.set(x, y, z);
    rig.update({ ...actor, position: { x, y, z }, facing, poseRole: actor.role, poseScale: .9,
      skillMotion: 'passSide', skillProgress: 0, skillSide: side, contactTarget: ball });
    parent.updateMatrixWorld(true);
    const world = name => rig.group.getObjectByName(name).getWorldPosition(new Vector3());
    for (const limb of ['left', 'right']) {
      const shoulder = world(limb + '-shoulder'), elbow = world(limb + '-elbow'), wrist = world(limb + '-palm');
      const axisDistance = wrist.clone().lerp(elbow, .22).distanceTo(ball);
      // The ball has a .12 m radius; a distal forearm has a .035–.042 m radius.
      assert.ok(axisDistance > .135 && axisDistance < .175, `${limb} forearm ${axisDistance} m from the ball centre`);
      assert.ok(elbow.clone().sub(shoulder).normalize().dot(wrist.clone().sub(elbow).normalize()) > .97);
    }
  }
});

test('front and back sets reach the release height without lengthening the arms', () => {
  const { rig } = fixture(), parent = rig.group.parent, scale = .86;
  for (const preset of ['4', 'tempo-costas', 'china', 'fundo-1']) {
    const options = { preset, layers: { pass: true, attack: true, block: true } };
    const clock = sampleAttack(0, options), frame = sampleAttack(clock.setContact, options);
    const actor = frame.actors[0], [x, y, z] = actor.position, ball = new Vector3(...frame.ball);
    parent.position.set(x, y, z);
    rig.update({ ...actor, poseRole: actor.role, position: { x, y, z }, poseScale: scale,
      facing: [actor.facing[0] - x, actor.facing[1] - z], skillMotion: preset === '4' ? 'setJump' : 'setBack',
      skillProgress: 0, contactTarget: ball });
    parent.updateMatrixWorld(true);
    const world = name => rig.group.getObjectByName(name).getWorldPosition(new Vector3());
    near(world('left-palm').lerp(world('right-palm'), .5).distanceTo(ball), .12, .002);
    for (const side of ['left', 'right']) {
      near(world(side + '-elbow').distanceTo(world(side + '-shoulder')), scale * .352, .002);
      near(world(side + '-elbow').distanceTo(world(side + '-palm')), scale * .382, .002);
      near(nearestFingerSurface(rig, side, ball), .12, .002);
    }
  }
});

test('serve release and strike present fingertips on the ball surface for either dominant hand', () => {
  const { rig } = fixture(), parent = rig.group.parent;
  for (const serve of ['Float', 'Topspin']) {
    const options = { serve, bases: [...receptionFormation('5-1', 0), [1.7, 0, -10.44]] };
    const clock = sampleReception(0, options);
    for (const [time, progress] of [[clock.tossStart, -.65], [clock.serveContact, 0]]) for (const mirror of [true, false]) {
      const frame = sampleReception(time, options), actor = frame.actors[6], [x, y, z] = actor.position;
      const ball = new Vector3(...frame.ball);
      parent.position.set(x, y, z);
      rig.update({ ...actor, poseRole: 'server', poseScale: 1, mirror, position: { x, y, z },
        facing: [actor.facing[0] - x, actor.facing[1] - z], skillMotion: serve === 'Float' ? 'serve' : 'serveSpin',
        skillProgress: progress, contactTarget: ball });
      parent.updateMatrixWorld(true);
      const side = (progress === 0) !== mirror ? 'right' : 'left';
      near(nearestFingerSurface(rig, side, ball), .12, .002);
    }
  }
});
