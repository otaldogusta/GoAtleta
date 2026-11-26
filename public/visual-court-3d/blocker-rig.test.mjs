import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {createBlocker} from './blocker-rig.mjs';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const world=part=>part.getWorldPosition(new THREE.Vector3());
function fixture(){const parent=new THREE.Group(),rig=createBlocker(parent);return {parent,...rig};}
function snapshot(group){group.updateMatrixWorld(true);return group.children.map(part=>({name:part.name,matrix:[...part.matrixWorld.elements]}));}

test('captured blocking wrists turn continuously into the ready pose',()=>{
 const {group,update}=fixture();
 for(const clipMirror of [false,true]){
  let previous=[];
  for(let clipFrame=1;clipFrame<=46;clipFrame+=.25){
   update({clipFrame,clipMirror,extension:Math.min(1,Math.max(0,(clipFrame-32)/12))});
   const palms=['left','right'].map(side=>group.getObjectByName(side+'-palm'));
   palms.forEach((palm,index)=>{
    assert.ok(Math.abs(palm.rotation.y)<=.32);
    if(previous[index])assert.ok(palm.quaternion.angleTo(previous[index])<.35);
   });
   previous=palms.map(palm=>palm.quaternion.clone());
  }
 }
});

test('the ready block keeps elbows close and below the shoulders with hands raised',()=>{
 const {group,update}=fixture();
 for(const extension of [0,.28]){
  update({crouch:.13,extension});
  for(const side of ['left','right']){
   const elbow=group.getObjectByName(side+'-elbow').position;
   const shoulder=group.getObjectByName(side+'-shoulder').position;
   const palm=group.getObjectByName(side+'-palm').position;
   assert.ok(Math.abs(elbow.x-shoulder.x)<.08);
   assert.ok(elbow.y<shoulder.y-.025);
   assert.ok(elbow.z>shoulder.z);
   assert.ok(palm.y>shoulder.y);
  }
 }
});

test('the elbows stay outside the head as the blocker rises',()=>{
 const {group,update}=fixture();
 for(const extension of [.5,.6,.7,.8,.9,1]){
  update({extension,jump:.6});
  for(const side of ['left','right']){
   const elbow=group.getObjectByName(side+'-elbow').position;
   assert.ok(Math.abs(elbow.x)>=.18);
   if(extension>=.9){
    const shoulder=group.getObjectByName(side+'-shoulder').position;
    const palm=group.getObjectByName(side+'-palm').position;
    assert.ok(elbow.clone().sub(shoulder).normalize().dot(palm.clone().sub(elbow).normalize())>.95);
   }
  }
 }
});

test('the entire anatomy is solid geometry with shared per-rig resources and no pose texture',()=>{
 const {group}=fixture(),geometries=new Set(),materials=new Set();
 for(const part of group.children){
  assert.equal(part.isMesh,true);assert.notEqual(part.geometry.type,'PlaneGeometry');
  assert.equal(part.material.map,null);assert.equal(part.material.depthWrite,true);
  geometries.add(part.geometry);materials.add(part.material);
 }
 assert.ok(geometries.size<=10);assert.equal(materials.size,1);assert.ok(group.children.length<50);
 for(const name of ['forearm','upper-arm','thigh','shin','shorts','foot']){
  assert.equal(group.getObjectByName('left-'+name).geometry,group.getObjectByName('right-'+name).geometry);
 }
 for(const side of ['left','right']){
  assert.equal(group.children.filter(part=>part.name.startsWith(`${side}-finger-`)).length,4);
  assert.equal(group.children.filter(part=>part.name===`${side}-thumb`).length,1);
 }
 const box=new THREE.Box3().setFromObject(group);
 near(box.min.y,0);near(box.max.y,1.8*.95);
 assert.ok(box.max.z-box.min.z>.2,'the body has actual depth at every camera angle');
 const another=fixture();assert.notEqual(another.group.getObjectByName('head').geometry,group.getObjectByName('head').geometry);
});

test('a blocker closes over the outside foot with the knee aligned to its toes',()=>{
 const {group,update}=fixture();
 for(const sign of [-1,1]){
  const feet=[[-.32,0,.06,.75*sign],[.32,0,-.06,.75*sign]];
  update({crouch:.19,feet,feetWeight:1,plantedStance:true});
  for(const side of ['left','right']){
   const position=name=>group.getObjectByName(side+'-'+name).position;
   const hip=position('hip'),knee=position('knee'),ankle=position('ankle');
   const axis=ankle.clone().sub(hip).normalize();
   const bend=knee.clone().sub(hip).projectOnPlane(axis);
   const forward=new THREE.Vector3(0,0,1).applyQuaternion(group.getObjectByName(side+'-foot').quaternion);
   assert.ok(bend.length()>.1);
   assert.ok(bend.normalize().dot(forward.projectOnPlane(axis).normalize())>.99);
  }
 }
});

test('the neck overlaps the shirt and head rather than floating between them',()=>{
 const {group,update}=fixture();
 for(const crouch of [0,.13,.26]){
  update({crouch});group.updateMatrixWorld(true);
  const torso=new THREE.Box3().setFromObject(group.getObjectByName('torso'));
  const neck=new THREE.Box3().setFromObject(group.getObjectByName('neck'));
  const head=new THREE.Box3().setFromObject(group.getObjectByName('head'));
  assert.ok(neck.min.y<torso.max.y);assert.ok(neck.max.y>head.min.y);
 }
});

test('oblique and elevated cameras cannot rotate or flatten any limb',()=>{
 const {group,update}=fixture(),pose={jump:.85,crouch:0,extension:1,handAngle:180};
 const camera=new THREE.PerspectiveCamera();camera.position.set(4,3,9);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 update(pose,camera);const first=snapshot(group);
 for(const position of [[-8,12,2],[0,15,.01],[5,1,-10]]){
  camera.position.set(...position);camera.lookAt(0,1,0);camera.updateMatrixWorld();update(pose,camera);
  assert.deepEqual(snapshot(group),first);
 }
});

test('arm and leg segments remain attached to their joints through preparation and extension',()=>{
 const {group,update}=fixture();
 for(const pose of [{crouch:0,extension:0},{crouch:.26,extension:0},{crouch:.1,extension:.5},{jump:.85,extension:1,handAngle:35}]){
  update(pose);group.updateMatrixWorld(true);
  for(const side of ['left','right'])for(const [bone,start,end] of [['upper-arm','shoulder','elbow'],['forearm','elbow','palm'],['thigh','hip','knee'],['shin','knee','ankle']]){
   const part=group.getObjectByName(`${side}-${bone}`),a=part.localToWorld(new THREE.Vector3(0,-.5,0)),b=part.localToWorld(new THREE.Vector3(0,.5,0));
   near(a.distanceTo(world(group.getObjectByName(`${side}-${start}`))),0);
   near(b.distanceTo(world(group.getObjectByName(`${side}-${end}`))),0);
  }
 }
});

test('the central keeps both arm lengths from backswing through contact above the net',()=>{
 const {group,update}=fixture();
 for(const clipMirror of [false,true])for(let clipFrame=1;clipFrame<=46;clipFrame+=.5){
  update({clipFrame,clipMirror,extension:Math.min(1,Math.max(0,(clipFrame-32)/12))});
  for(const side of ['left','right']){
   near(group.getObjectByName(side+'-upper-arm').scale.y,.32);
   near(group.getObjectByName(side+'-forearm').scale.y,.33);
  }
 }
});

test('both palms preserve the canonical height, reach, single rotation and unscaled jump',()=>{
 const {parent,group,update}=fixture();parent.position.y=1.25;
 for(const [crouch,extension,jump,angle] of [[0,0,0,0],[.26,0,0,35],[.1,.5,.3,-30],[0,1,.85,180]]){
  update({crouch,extension,jump,handAngle:angle});parent.updateMatrixWorld(true);
  near(group.position.y,jump);near(group.rotation.y,angle*Math.PI/180);
  for(const side of ['left','right']){
   const palm=group.getObjectByName(`${side}-palm`),at=world(palm);
   near(palm.position.y,1.55+.51*extension-crouch);near(palm.position.z,.20+.24*extension);
   near(at.y,1.25+jump+.95*(1.55+.51*extension-crouch));
   const sign=side==='left'?-1:1,x=sign*.26,z=.20+.24*extension,radians=angle*Math.PI/180;
   near(at.x,.95*(x*Math.cos(radians)+z*Math.sin(radians)));
   near(at.z,.95*(-x*Math.sin(radians)+z*Math.cos(radians)));
  }
 }
 parent.position.y=0;update({jump:.85,extension:1});parent.updateMatrixWorld(true);
 for(const side of ['left','right'])assert.ok(world(group.getObjectByName(`${side}-palm`)).y>2.43+.065/2);
});

test('the central reads across the net while crossing and squares the shoulders on the plant',()=>{
 const {group,update}=fixture();
 const part=name=>world(group.getObjectByName(name));
 for(const clipMirror of [false,true]){
  const sign=clipMirror?1:-1;
  function angles(frame){
   update({clipFrame:frame,clipMirror});
   group.updateMatrixWorld(true);
   const shoulders=part('right-shoulder').sub(part('left-shoulder'));
   const nose=part('nose').sub(part('head'));
   return [group.rotation.y,Math.atan2(-shoulders.z,shoulders.x),Math.atan2(nose.x,nose.z)];
  }
  const [hips,chest,eyes]=angles(20);
  const crossing=snapshot(group);
  assert.ok(sign*hips>1.25&&sign*chest>1&&sign*eyes>.25);
  assert.ok(sign*eyes<sign*chest-.5);
  const [brakingHips,brakingChest]=angles(26);
  assert.ok(sign*(brakingHips-brakingChest)>.35);
  const [,plantChest,plantEyes]=angles(32);
  near(plantChest,0);near(plantEyes,0);
  for(const frame of [34,36,38,46])angles(frame);
  assert.deepEqual(angles(20),[hips,chest,eyes],'scrubbing restores the same pose');
  assert.deepEqual(snapshot(group),crossing);
 }
});

test('crouching bends knees and hips while feet stay grounded and updates reuse every mesh',()=>{
 const {group,update}=fixture(),parts=[...group.children],geometries=parts.map(part=>part.geometry),materials=parts.map(part=>part.material);
 update({crouch:.26});group.updateMatrixWorld(true);
 assert.ok(group.getObjectByName('pelvis').position.z<0);
 for(const side of ['left','right']){
  assert.ok(group.getObjectByName(`${side}-knee`).position.z>0);
  near(new THREE.Box3().setFromObject(group.getObjectByName(`${side}-foot`)).min.y,0);
 }
 for(let i=0;i<120;i++)update({crouch:.26*(1-i/120),extension:i/120,jump:.85*i/120,handAngle:30});
 assert.deepEqual(group.children,parts);assert.deepEqual(parts.map(part=>part.geometry),geometries);assert.deepEqual(parts.map(part=>part.material),materials);
 update({jump:NaN,crouch:Infinity,extension:NaN,handAngle:Infinity});
 assert.ok(snapshot(group).every(part=>part.matrix.every(Number.isFinite)));
});
