import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Group, Triangle, Vector3 } from './three.module.min.js';
import { createActorRig } from './actor-rig.mjs';
import { skillClips } from './skill-motion-data.mjs';
import { receptionFormation } from '../../src/core/court-simulation/formations.js';
import { sampleReception } from '../../src/core/court-simulation/reception-motion.js';
import { sampleAttack } from '../../src/core/court-simulation/attack-motion.js';
import { courtSkillMotion } from '../../src/core/court-skill-motion.ts';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const digitNames = ['thumb', 'finger-0', 'finger-1', 'finger-2', 'finger-3'];
function surfaceDistance(rig, side, ball, names = digitNames) {
  const face = new Triangle(), point = new Vector3();
  let closest = Infinity;
  for (const digit of names) {
    const part = rig.group.getObjectByName(side + '-' + digit), mesh = part.geometry;
    for (let index = 0; index < mesh.index.count; index += 3) {
      for (const [offset, vertex] of [face.a, face.b, face.c].entries()) {
        part.getVertexPosition(mesh.index.getX(index + offset), vertex).applyMatrix4(part.matrixWorld);
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

test('the pelvis loads over the planted side before a lateral pass', () => {
  const { rig, position } = fixture();
  for (const skillSide of [-1, 1]) {
    const feet = [[-.34, 0, 0, 0], [.34, 0, 0, 0]];
    const side = skillSide < 0 ? 'left' : 'right';
    const trailing = skillSide < 0 ? 'right' : 'left';
    const render = skillProgress => rig.update({ poseRole: 'passer', pose: 'load', poseScale: 1,
      skillMotion: 'passSide', skillProgress, skillSide, feet, plantedStance: true, position: { x: 0, y: 0, z: 0 } });
    render(7 / 22 - 1);
    assert.ok(position(side + '-foot').y > .16);
    near(position(side + '-foot').x, skillSide * .44, .004);
    near(position(trailing + '-foot').x, -skillSide * .34);
    near(position(trailing + '-foot').y, .055);
    render(18 / 22 - 1);
    assert.ok(position('pelvis').x * skillSide > .23);
    near(position(side + '-foot').x, skillSide * .61, .004);
    near(position(side + '-foot').y, .055, .004);
    render(0);
    near(position(side + '-foot').x, skillSide * .61, .004);
  }
});

test('6–0 P1 keeps its lead shoe on one court mark while the shoulders aim at the setter', () => {
  const { rig } = fixture(), parent = rig.group.parent;
  const options = { system: '6-0', bases: [...receptionFormation('6-0', 0), [1.7, 0, -10.44]] };
  const timing = sampleReception(0, options);
  let firstShoe;
  for (let ms = -205; ms <= 120; ms += 5) {
    const frame = sampleReception(timing.receiveContact + ms / 1000 / timing.duration, options);
    const actor = frame.actors[frame.receiver], [x, y, z] = actor.position;
    const facing = [actor.facing[0] - x, actor.facing[1] - z];
    const target = new Vector3(...frame.ballContact);
    parent.position.set(x, y, z);
    rig.update({ ...actor, position: { x, y, z }, facing, poseRole: 'passer', poseScale: .9,
      skillMotion: 'passSide', skillProgress: ms / (ms < 0 ? 520 : 580), skillSide: -1, contactTarget: target });
    parent.updateMatrixWorld(true);
    const world = name => rig.group.getObjectByName(name).getWorldPosition(new Vector3());
    const shoe = world('left-foot');
    firstShoe ??= shoe;
    assert.ok(shoe.distanceTo(firstShoe) <= .002, `shoe drift at ${ms} ms: ${shoe.distanceTo(firstShoe)}`);
    if (ms === 0) {
      const shoulderLine = world('right-shoulder').sub(world('left-shoulder'));
      const aim = new Vector3(...frame.setHand).sub(world('pelvis')).setY(0).normalize();
      const shoulderAim = new Vector3(-shoulderLine.z, 0, shoulderLine.x).normalize();
      assert.ok(shoulderAim.dot(aim) > .995);
    }
  }
});

test('stationary passers hold their hands low and apart over a flexed defensive base', () => {
  const { rig, position } = fixture();
  for (const skillMotion of ['pass', 'dig']) {
    for (const skillProgress of [-1, 1]) {
      rig.update({ poseRole: 'passer', pose: 'ready', poseScale: 1, skillMotion, skillProgress });
      const pelvis = position('pelvis');
      assert.ok(pelvis.y < .9);
      for (const side of ['left', 'right']) {
        const palm = position(side + '-palm');
        assert.ok(palm.y < pelvis.y && palm.z > pelvis.z + .4);
        const thumb = position(side + '-thumb');
        assert.ok(Math.abs(thumb.x) > Math.abs(palm.x));
        assert.ok(position(side + '-knee').z > position(side + '-foot').z);
      }
      assert.ok(position('left-palm').distanceTo(position('right-palm')) > .4);
    }
  }
});

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
    near(position('pelvis').y, poseRole === 'passer' ? .84 : clip.frames[clip.markers.recover][1] / 1000);
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

test('each pad meets the lower sides of the ball in reception and front and back sets', () => {
  const { rig } = fixture(), parent = rig.group.parent, scale = .86;
  const samples = [];
  for (let rotation = 0; rotation < 6; rotation++) {
    const bases = [...receptionFormation('6-0', rotation), [1.7, 0, -10.44]];
    samples.push([sampleReception(1, { system: '6-0', rotation, bases }), 'setJump']);
  }
  for (const preset of ['4', 'tempo-costas', 'china', 'fundo-1']) {
    const options = { preset, layers: { pass: true, attack: true, block: true } };
    const clock = sampleAttack(0, options);
    samples.push([sampleAttack(clock.setContact, options), preset === '4' ? 'setJump' : 'setBack']);
  }
  for (const [frame, skillMotion] of samples) {
    const actor = frame.actors[0], [x, y, z] = actor.position, ball = new Vector3(...frame.ball);
    parent.position.set(x, y, z);
    rig.update({ ...actor, poseRole: actor.role, position: { x, y, z }, poseScale: scale,
      facing: [actor.facing[0] - x, actor.facing[1] - z], skillMotion,
      skillProgress: 0, contactTarget: ball });
    parent.updateMatrixWorld(true);
    const world = name => rig.group.getObjectByName(name).getWorldPosition(new Vector3());
    assert.ok(world('left-palm').distanceTo(world('right-palm')) > .21);
    for (const side of ['left', 'right']) {
      near(world(side + '-elbow').distanceTo(world(side + '-shoulder')), scale * .352, .002);
      near(world(side + '-elbow').distanceTo(world(side + '-palm')), scale * .382, .002);
      for (const name of digitNames) near(surfaceDistance(rig, side, ball, [name]), .12, .002);
      assert.ok(surfaceDistance(rig, side, ball, ['palm']) > .125, 'the ball clears the heel of the hand');
      const tip = name => {
        const finger = rig.group.getObjectByName(side + '-' + name);
        return finger.localToWorld(new Vector3(0, .5, 0));
      };
      assert.ok(tip('finger-0').y > tip('thumb').y + .05);
      assert.ok(tip('finger-0').distanceTo(tip('finger-3')) > .11);
    }
  }
});

test('the setter finishes toward the flight of a front or back set before lowering the hands', () => {
  const { rig } = fixture(), parent = rig.group.parent;
  for (const [preset, attack] of [['4', true], ['5', true], ['china', true], ['5', false]]) {
    const options = { preset, layers: { pass: true, attack } };
    const timing = sampleAttack(0, options);
    const release = new Vector3(...timing.setHand);
    const tangent = new Vector3(...sampleAttack(timing.setContact + .00001, options).ball).sub(release).normalize();
    const render = ms => {
      const progress = timing.setContact + ms / (1000 * timing.duration);
      const frame = sampleAttack(progress, options), setter = frame.actors[0], [x, y, z] = setter.position;
      const motion = courtSkillMotion({ ...frame, progress, mode: 'attack', config: { preset } }, setter, 0);
      assert.ok(new Vector3(...motion.setReleaseDirection).dot(tangent) > .99999);
      parent.position.set(x, y, z);
      rig.update({ ...setter, ...motion, poseRole: 'setter', position: { x, y, z }, poseScale: .86,
        facing: [setter.facing[0] - x, setter.facing[1] - z] });
      parent.updateMatrixWorld(true);
      const palm = side => rig.group.getObjectByName(side + '-palm').getWorldPosition(new Vector3());
      return palm('left').lerp(palm('right'), .5);
    };
    const contact = render(0), start = render(30).sub(contact);
    assert.ok(start.y > .015 && start.dot(tangent) > .025 && start.length() < .075);
    const follow = render(70).sub(contact);
    assert.ok(follow.y >= 0 && (follow.x * tangent.x + follow.z * tangent.z) > .01);
    assert.ok(render(100).y > contact.y - .06);
    let previous = contact;
    for (let ms = 5; ms <= 520; ms += 5) {
      const current = render(ms);
      assert.ok(current.distanceTo(previous) < .04, `arm snaps at ${ms} ms on ${preset}`);
      previous = current;
    }
    near(render(30).sub(contact).distanceTo(start), 0);
  }
});

test('opening and releasing the setting window follow the Blender clock on replay', () => {
  const { rig } = fixture(), finger = rig.group.getObjectByName('right-finger-0');
  const ordinary = finger.geometry;
  const pose = progress => rig.update({ poseRole: 'setter', skillMotion: 'set', skillProgress: progress });
  const clip = skillClips.set;
  pose(7 / clip.markers.contact - 1);
  const open = finger.geometry, early = [...finger.morphTargetInfluences];
  near(early[1], clip.window[7]);
  assert.notEqual(open, ordinary);
  pose(0);
  const atContact = finger.morphTargetInfluences[0];
  pose((clip.markers.follow - clip.markers.contact) / (clip.markers.recover - clip.markers.contact));
  assert.ok(finger.morphTargetInfluences[0] < atContact);
  pose(-1);
  assert.equal(finger.geometry, ordinary);
  pose(7 / clip.markers.contact - 1);
  assert.equal(finger.geometry, open);
  assert.deepEqual(finger.morphTargetInfluences, early);
});

test('standing float shows the left palm under the toss, the right elbow cocked, and a high forward strike', () => {
  const { rig, position } = fixture(), parent = rig.group.parent;
  const options = { system: '6-0', serve: 'Float', bases: [...receptionFormation('6-0', 0), [1.7, 0, -10.44]] };
  const timing = sampleReception(0, options);
  const palmNormal = side => new Vector3(0, 0, 1).applyQuaternion(rig.group.getObjectByName(side + '-palm').quaternion);
  function render(time) {
    const frame = sampleReception(time, options), a = frame.actors[6], [x, y, z] = a.position;
    const skill = courtSkillMotion({ ...frame, mode: 'receive', config: options, progress: time }, a, 6);
    parent.position.set(x, y, z);
    // In reception the server faces court +Z; physical left is the +X mesh.
    rig.update({ ...a, ...skill, poseRole: 'server', poseScale: 1, mirror: true, position: { x, y, z },
      facing: [a.facing[0] - x, a.facing[1] - z] });
    parent.updateMatrixWorld(true);
    return rig.group.worldToLocal(new Vector3(...frame.ball));
  }
  for (const time of [0, timing.tossStart / 2, timing.tossStart]) {
    const ball = render(time), hand = position('right-palm'), elbow = position('left-elbow');
    assert.ok(Math.hypot(ball.x - hand.x, ball.z - hand.z) < .025);
    near(ball.y - hand.y, .15, .015);
    assert.ok(palmNormal('right').y > .90);
    assert.ok(elbow.y > position('left-shoulder').y - .10, 'elbow already cocked');
    assert.ok(position('left-palm').y > position('head').y, 'striking hand up by the ear');
    assert.ok(position('right-foot').z > position('left-foot').z + .20, 'opposite foot forward');
    if (time === 0) {
      const guideElbow = position('right-elbow'), shoulder = position('right-shoulder');
      const reach = hand.distanceTo(guideElbow) + guideElbow.distanceTo(shoulder);
      assert.ok(hand.distanceTo(shoulder) > .88 * reach, 'the guide arm extends in front');
    }
  }
  const contact = render(timing.serveContact), hand = position('left-palm');
  assert.ok(hand.y > position('head').y + .42);
  assert.ok(hand.z < contact.z - .11 && palmNormal('left').z > .92, 'open palm behind the ball');
  assert.ok(position('right-palm').y < position('right-shoulder').y, 'guide has dropped');
});

test('jump serve toss comes from shoulder flexion and the palm strikes in suspension after the approach', () => {
  const { rig, position } = fixture(), parent = rig.group.parent;
  const config = { system: '6-0', serve: 'Topspin', bases: [...receptionFormation('6-0', 0), [1.7, 0, -10.44]] };
  const { tossStart, serveContact, duration } = sampleReception(0, config);
  function render(time) {
    const sample = sampleReception(time, config), server = sample.actors[6], [x, y, z] = server.position;
    const skill = courtSkillMotion({ ...sample, mode: 'receive', config, progress: time }, server, 6);
    parent.position.set(x, y, z);
    rig.update({ ...server, ...skill, poseRole: 'server', poseScale: 1, mirror: true,
      position: { x, y, z }, facing: [server.facing[0] - x, server.facing[1] - z] });
    parent.updateMatrixWorld(true);
    return sample;
  }
  const elevations = [], elbows = [], down = new Vector3(0, -1, 0);
  for (let n = 0; n <= 24; n++) {
    const sample = render(tossStart * n / 24);
    const shoulder = position('right-shoulder'), elbow = position('right-elbow'), palm = position('right-palm');
    elevations.push(elbow.clone().sub(shoulder).angleTo(down));
    elbows.push(shoulder.sub(elbow).angleTo(palm.clone().sub(elbow)));
    const ball = rig.group.worldToLocal(new Vector3(...sample.ball));
    assert.ok(ball.y > palm.y && Math.hypot(ball.x - palm.x, ball.z - palm.z) < .035, 'guide palm under the ball');
  }
  const degrees = Math.PI / 180;
  assert.ok(elevations.at(-1) - elevations[0] > 45 * degrees, 'upper arm swings up from the shoulder');
  assert.ok(Math.min(...elbows) > 145 * degrees, 'guide elbow stays long throughout the toss');
  assert.ok(Math.max(...elbows) - Math.min(...elbows) < 25 * degrees, 'elbow does not power the toss');
  const marks = skillClips.serveSpin.markers;
  function shoesAt(frame) {
    render(tossStart + (serveContact - tossStart) * (frame - marks.toss) / (marks.contact - marks.toss));
    return ['right-foot', 'left-foot'].map(name => rig.group.getObjectByName(name).getWorldPosition(new Vector3()));
  }
  for (const [frame, support] of [[marks.firstStep, 0], [marks.penultimate, 1]]) {
    const plant = shoesAt(frame), swing = shoesAt(frame + 2);
    assert.ok(plant[support].distanceTo(swing[support]) < .035, 'the loaded shoe stays on the floor mark');
    assert.ok(plant[1 - support].distanceTo(swing[1 - support]) > .20, 'the other foot steps past');
  }
  const start = render(0).actors[6];
  const contact = render(serveContact), server = contact.actors[6];
  assert.ok(Math.hypot(server.position[0] - start.position[0], server.position[2] - start.position[2]) > 1.3);
  assert.ok(server.jump > .5 && contact.ball[1] > 2.8);
  for (const side of ['left', 'right']) {
    assert.ok(rig.group.getObjectByName(side + '-foot').getWorldPosition(new Vector3()).y > .45);
  }
  near(surfaceDistance(rig, 'left', new Vector3(...contact.ball)), .12, .003);
  const landed = render(serveContact + .64 / duration).actors[6];
  assert.equal(landed.jump, 0);
  assert.deepEqual(render(serveContact).ball, contact.ball);
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
      near(surfaceDistance(rig, side, ball), .12, .002);
    }
  }
});
