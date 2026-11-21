import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {createActorRig} from './actor-rig.mjs';
import {createBlocker} from './blocker-rig.mjs';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const names={setter:['ready','load','rise','contact','follow','backfollow'],passer:['ready','load','contact','follow'],attacker:['ready','approach','plant','draw','contact','follow','land'],server:['ready','toss','draw','contact','follow','idle']};
const part=(rig,name)=>rig.group.getObjectByName(name);
const world=object=>object.getWorldPosition(new THREE.Vector3());
function fixture(){const parent=new THREE.Group(),rig=createActorRig(parent);return {parent,group:rig.group,update:rig.update,get height(){return rig.height;}};}
function matrices(rig){rig.group.updateMatrixWorld(true);return rig.group.children.map(object=>({name:object.name,matrix:[...object.matrixWorld.elements]}));}

test('all sporting poses use one connected solid anatomy and a valid pose-specific height',()=>{
 const rig=fixture(),objects=[...rig.group.children],geometries=objects.map(object=>object.geometry),materials=objects.map(object=>object.material);
 for(const [poseRole,poses] of Object.entries(names))for(const pose of poses){
  rig.update({poseRole,pose,facing:[0,1],poseScale:.95,jump:0});rig.parent.updateMatrixWorld(true);
  assert.equal(rig.group.children.length,39);assert.ok(Number.isFinite(rig.height)&&rig.height>1.2&&rig.height<2.5,`${poseRole}/${pose}: ${rig.height}`);
  const box=new THREE.Box3().setFromObject(rig.group);assert.ok(rig.height>=box.max.y-1e-7);
  near(box.min.y,0);assert.ok(matrices(rig).every(object=>object.matrix.every(Number.isFinite)));
  for(const side of ['left','right'])for(const [bone,start,end] of [['upper-arm','shoulder','elbow'],['forearm','elbow','palm'],['thigh','hip','knee'],['shin','knee','ankle']]){
   const mesh=part(rig,`${side}-${bone}`),a=mesh.localToWorld(new THREE.Vector3(0,-.5,0)),b=mesh.localToWorld(new THREE.Vector3(0,.5,0));
   near(a.distanceTo(world(part(rig,`${side}-${start}`))),0);near(b.distanceTo(world(part(rig,`${side}-${end}`))),0);
  }
 }
 assert.deepEqual(rig.group.children,objects);assert.deepEqual(objects.map(object=>object.geometry),geometries);assert.deepEqual(objects.map(object=>object.material),materials);
 assert.equal(new Set(geometries).size,3);assert.equal(new Set(materials).size,1);
 assert.ok(objects.every(object=>object.isMesh&&object.material.map===null));
});

test('facing rotates the body as a whole and a cached pose still follows a changed heading',()=>{
 const rig=fixture(),actor={poseRole:'attacker',pose:'contact',facing:[0,1],poseScale:1};
 rig.update(actor);const local=part(rig,'right-palm').position.clone();
 for(const [x,z,angle] of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
  rig.update({...actor,facing:[x,z]});rig.parent.updateMatrixWorld(true);
  near(rig.group.rotation.y,angle);const palm=world(part(rig,'right-palm'));
  near(palm.x,local.x*Math.cos(angle)+local.z*Math.sin(angle));near(palm.z,-local.x*Math.sin(angle)+local.z*Math.cos(angle));
 }
});

test('attack, set, pass and serve actions have distinct contact shapes and preserve dominant-hand mirroring',()=>{
 const rig=fixture();rig.update({poseRole:'attacker',pose:'plant'});const preparation=part(rig,'right-palm').position.clone();
 rig.update({poseRole:'attacker',pose:'draw'});assert.ok(part(rig,'right-palm').position.z<0,'cocked hand prepares behind the body');
 rig.update({poseRole:'attacker',pose:'contact'});const contact=part(rig,'right-palm').position.clone();
 assert.ok(contact.y>2.2&&contact.y>preparation.y+1);assert.ok(contact.z>0);assert.ok(part(rig,'left-palm').position.y<1.4);
 rig.update({poseRole:'attacker',pose:'contact',mirror:true});near(part(rig,'left-palm').position.x,-contact.x);near(part(rig,'left-palm').position.y,contact.y);near(part(rig,'left-palm').position.z,contact.z);
 rig.update({poseRole:'setter',pose:'contact'});assert.ok(part(rig,'left-palm').position.y>2.1&&part(rig,'right-palm').position.y>2.1);
 rig.update({poseRole:'passer',pose:'contact'});assert.ok(part(rig,'left-palm').position.y<.8&&part(rig,'right-palm').position.y<.8);assert.ok(part(rig,'left-palm').position.distanceTo(part(rig,'right-palm').position)<.12);
 rig.update({poseRole:'server',pose:'toss'});assert.ok(part(rig,'left-palm').position.y>2&&part(rig,'right-palm').position.z<0);
 rig.update({poseRole:'server',pose:'contact'});assert.ok(part(rig,'right-palm').position.y>2.1&&part(rig,'left-palm').position.y<1.4);
});

test('host poseBlend interpolates joints continuously without an independent animation clock',()=>{
 const rig=fixture(),actor={poseRole:'attacker',pose:'contact',previousPose:'draw',facing:[0,1]};
 rig.update({...actor,poseBlend:0});const start=part(rig,'right-palm').position.clone();
 rig.update({...actor,poseBlend:1});const end=part(rig,'right-palm').position.clone();
 for(const fraction of [.25,.5,.75]){
  rig.update({...actor,poseBlend:fraction});const actual=part(rig,'right-palm').position;
  near(actual.x,start.x+(end.x-start.x)*fraction);near(actual.y,start.y+(end.y-start.y)*fraction);near(actual.z,start.z+(end.z-start.z)*fraction);
  const first=matrices(rig);rig.update({...actor,poseBlend:fraction});assert.deepEqual(matrices(rig),first);
 }
});

test('approach progress alternates the lifted foot and returns to the authored plant transition',()=>{
 const rig=fixture(),actor={poseRole:'attacker',pose:'approach',previousPose:'approach'};
 const foot=side=>part(rig,`${side}-foot`).position;
 rig.update({...actor,poseBlend:0});
 const start=matrices(rig);
 rig.update({...actor,poseBlend:.125});
 const leftEarly=foot('left').z,rightEarly=foot('right').z;
 rig.update({...actor,poseBlend:.375});
 assert.ok(foot('left').z>leftEarly&&foot('right').z<rightEarly);
 rig.update({...actor,poseBlend:.25});
 near(foot('right').y,.055);assert.ok(foot('left').y>.19);
 const firstStep=matrices(rig);
 rig.update({...actor,poseBlend:.75});
 near(foot('left').y,.055);assert.ok(foot('right').y>.19);
 rig.update({...actor,poseBlend:.25});
 assert.deepEqual(matrices(rig),firstStep);
 rig.update({...actor,poseBlend:.25,mirror:true});
 near(foot('left').y,.055);assert.ok(foot('right').y>.19);
 rig.update({...actor,poseBlend:1});
 assert.deepEqual(matrices(rig),start);
 rig.update({...actor,pose:'plant',poseBlend:0});
 assert.deepEqual(matrices(rig),start);
});

test('the parent owns authored elevation, poseScale applies once and jump remains unscaled',()=>{
 const rig=fixture();rig.parent.position.y=1.006326834602263;
 const actor={poseRole:'attacker',pose:'contact',poseScale:.9,jump:.85,position:{x:99,y:9,z:99},facing:[0,1]};
 rig.update(actor);rig.parent.updateMatrixWorld(true);
 near(rig.group.position.y,.85);near(rig.group.scale.y,.9);near(rig.group.position.x,0);near(rig.group.position.z,0);
 const palm=part(rig,'right-palm');near(world(palm).y,rig.parent.position.y+.85+palm.position.y*.9);
 const jumped=rig.height;rig.update({...actor,jump:0});near(jumped-rig.height,.85);
 assert.equal(actor.position.y,9);
});

test('the generalized blocker is geometrically identical to the approved rig across poses and angles',()=>{
 const actor=fixture(),parent=new THREE.Group(),blocker=createBlocker(parent);
 for(const pose of [{jump:0,crouch:0,extension:0,handAngle:0},{jump:0,crouch:.26,extension:0,handAngle:35},{jump:.85,crouch:0,extension:1,handAngle:180}]){
  actor.update({poseRole:'blocker',pose:'block',poseScale:.6,facing:[1,0],...pose});blocker.update(pose);
  assert.deepEqual(matrices(actor),matrices(blocker));near(actor.height,blocker.height);near(actor.group.scale.y,.95);
 }
 actor.update({poseRole:'blocker',pose:'contact'});near(part(actor,'right-palm').position.y,2.06);
});

test('invalid pose data keeps a finite neutral actor and role changes cannot reuse the wrong cached skeleton',()=>{
 const rig=fixture();
 rig.update({poseRole:'attacker',pose:'contact',jump:.85,mirror:true});
 rig.update({poseRole:'blocker',pose:'block',extension:1,jump:.85});
 rig.update({poseRole:'setter',pose:'ready'});assert.ok(part(rig,'right-palm').position.y<1);
 rig.update({poseRole:'__proto__',pose:'__proto__',previousPose:'__proto__',jump:NaN,poseBlend:Infinity,poseScale:NaN,facing:[NaN,Infinity]});
 assert.ok(Number.isFinite(rig.height));assert.ok(matrices(rig).every(object=>object.matrix.every(Number.isFinite)));
});

test('a lateral reception at either side forms one platform at the canonical ball contact',()=>{
 const rig=fixture();
 for(const side of [-1,1]){
  const target={x:side*.58,y:1.05,z:.19};
  rig.update({poseRole:'passer',pose:'contact',poseScale:.9,position:{x:0,y:0,z:0},facing:[0,1],contactTarget:target});rig.parent.updateMatrixWorld(true);
  const left=world(part(rig,'left-palm')),right=world(part(rig,'right-palm')),center=left.clone().add(right).multiplyScalar(.5);
  near(center.distanceTo(new THREE.Vector3(target.x,target.y,target.z)),.12);
  near(left.distanceTo(right),.11*.9);assert.ok(Math.abs(center.x)> .45);
  for(const hand of ['left','right']){
   const shoulder=world(part(rig,`${hand}-shoulder`)),elbow=world(part(rig,`${hand}-elbow`)),palm=world(part(rig,`${hand}-palm`));
   near(shoulder.distanceTo(elbow),.43*.9);near(elbow.distanceTo(palm),.43*.9);
  }
 }
});

test('the striking palm contacts the sphere through yaw, mirroring, authored height and jump',()=>{
 const rig=fixture();
 for(const angle of [0,.7,Math.PI])for(const mirror of [false,true]){
  const position={x:2,y:1.2,z:-1},scale=.9,jump=.6,x=mirror?-.13:.13,y=2.28,z=.2;
  const target={x:position.x+scale*(x*Math.cos(angle)+z*Math.sin(angle)),y:position.y+jump+y*scale,z:position.z+scale*(-x*Math.sin(angle)+z*Math.cos(angle))};
  rig.parent.position.set(position.x,position.y,position.z);
  rig.update({poseRole:'attacker',pose:'contact',poseScale:scale,jump,position,facing:[Math.sin(angle),Math.cos(angle)],mirror,contactTarget:target});rig.parent.updateMatrixWorld(true);
  near(world(part(rig,mirror?'left-palm':'right-palm')).distanceTo(new THREE.Vector3(target.x,target.y,target.z)),.12);
  near(rig.group.position.y,jump);near(rig.parent.position.y,position.y);
 }
});

test('contact cache follows changes to parent position, jump, heading and scale without moving the ball',()=>{
 const rig=fixture(),target={x:.13,y:2.20,z:.25},before=JSON.stringify(target);
 const actor={poseRole:'attacker',pose:'contact',poseScale:1,jump:0,position:{x:0,y:0,z:0},facing:[0,1],contactTarget:target};
 for(const patch of [{},{position:{x:.10,y:.10,z:.05}},{jump:.1},{facing:[.2,1]},{poseScale:.95}]){
  const current={...actor,...patch};rig.parent.position.set(current.position.x,current.position.y,current.position.z);rig.update(current);rig.parent.updateMatrixWorld(true);
  near(world(part(rig,'right-palm')).distanceTo(new THREE.Vector3(target.x,target.y,target.z)),.12);
 }
 assert.equal(JSON.stringify(target),before);
});

test('removing an unreachable or disabled contact restores the authored pose and respects its blend',()=>{
 const rig=fixture(),actor={poseRole:'attacker',pose:'contact',position:{x:0,y:0,z:0},facing:[0,1]};
 rig.update(actor);const baseline=matrices(rig);
 rig.update({...actor,contactTarget:{x:.1,y:2.2,z:.3}});assert.notDeepEqual(matrices(rig),baseline);
 for(const contactTarget of [undefined,{x:20,y:5,z:20},{x:NaN,y:1,z:0}]){rig.update({...actor,contactTarget});assert.deepEqual(matrices(rig),baseline);}
 rig.update({...actor,contactTarget:{x:.1,y:2.2,z:.3},contactWeight:0});assert.deepEqual(matrices(rig),baseline);
 rig.update({...actor,pose:'draw'});const prepared=matrices(rig);
 rig.update({...actor,previousPose:'draw',poseBlend:0,contactTarget:{x:.1,y:2.2,z:.3}});assert.deepEqual(matrices(rig),prepared);
});

test('the setter uses both hands while the server holds and tosses with the supporting hand',()=>{
 const rig=fixture();
 rig.update({poseRole:'setter',pose:'contact',poseScale:.86,jump:.23,position:{x:0,y:0,z:0},facing:[0,1],contactTarget:{x:0,y:2.28,z:.17}});rig.parent.updateMatrixWorld(true);
 const center=world(part(rig,'left-palm')).add(world(part(rig,'right-palm'))).multiplyScalar(.5);
 near(center.distanceTo(new THREE.Vector3(0,2.28,.17)),.12);
 for(const pose of ['ready','toss'])for(const mirror of [false,true]){
  const target={x:.03,y:pose==='ready'?1.72:2.15,z:pose==='ready'?.6:.36};
  rig.update({poseRole:'server',pose,poseScale:1,mirror,position:{x:0,y:0,z:0},facing:[0,1],contactTarget:target});rig.parent.updateMatrixWorld(true);
  near(world(part(rig,mirror?'right-palm':'left-palm')).distanceTo(new THREE.Vector3(target.x,target.y,target.z)),.12);
 }
});
