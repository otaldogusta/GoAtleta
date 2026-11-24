import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from './three.module.min.js';
import {createActorRig} from './actor-rig.mjs';
import {sampleReception} from '../../src/core/court-simulation/reception-motion.js';
import {receptionFormation} from '../../src/core/court-simulation/formations.js';

const reception=rotation=>({rotation,bases:[...receptionFormation('5-1',rotation),[1.7,0,-10.44]]});

test('blocker keeps its ground marks while the running pose yields to the block',()=>{
 const parent=new Group(),rig=createActorRig(parent);
 const feet=[[1.5,0,-.35,0],[1.18,0,-.31,0]];
 // Block actors number their marks from the opposite half of the court.
 const shoes=['right-foot','left-foot'].map(name=>rig.group.getObjectByName(name));
 for(const [i,weight] of [1,.55,.04,0,0].entries()){
  const x=1.36+i*.01,z=-.4;
  parent.position.set(x,0,z);
  rig.update({poseRole:'blocker',position:{x,y:0,z},facing:[0,1],feet,feetWeight:weight,
   plantedStance:true,runCycle:1.3,runDrive:.3,crouch:.05});
  for(const [side,shoe] of shoes.entries()){
   const p=shoe.getWorldPosition(new Vector3());
   assert.ok(Math.hypot(p.x-feet[side][0],p.z-feet[side][2])<1e-6);
  }
 }
});

test('receivers and setters retain their planted soles at both ends of the run or lateral adjustment',()=>{
 const parent=new Group(),rig=createActorRig(parent),sole=new Vector3();
 const shoes=['left-foot','right-foot'].map(name=>rig.group.getObjectByName(name));
 for(const [rotation,slot] of [[0,0],[1,'receiver'],[3,0],[3,4]]){
  const config=reception(rotation),held=[null,null];
  let grounded=0;
  for(let i=0;i<=1000;i++){
   const frame=sampleReception(i/1000,config),actor=frame.actors[slot==='receiver'?frame.receiver:slot];
   const [x,y,z]=actor.position;
   parent.position.set(x,y,z);
   rig.update({...actor,poseRole:actor.role,poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
   if(!actor.feet){held.fill(null);continue;}
   for(const [side,shoe] of shoes.entries()){
    const [fx,lift,fz]=actor.feet[side];
    if(lift>1e-8||actor.jump>1e-8){held[side]=null;continue;}
    grounded++;
    shoe.getWorldPosition(sole);
    assert.ok(Math.hypot(sole.x-fx,sole.z-fz)<1e-6,'shoe detached from its mark during stance');
    held[side]??=sole.clone();
    assert.ok(Math.hypot(sole.x-held[side].x,sole.z-held[side].z)<1e-6,'mark moved during uninterrupted contact');
   }
  }
  assert.ok(grounded>100);
 }
});

test('P1 faces its running path, lifts the recovery shoe and turns continuously into the set',()=>{
 const parent=new Group(),rig=createActorRig(parent),config=reception(0);
 const joint=name=>rig.group.getObjectByName(name).getWorldPosition(new Vector3());
 let peakShoe=0,previousYaw;
 for(let i=0;i<=600;i++){
  const actor=sampleReception(i/600,config).actors[0];
  const [x,y,z]=actor.position,facing=[actor.facing[0]-x,actor.facing[1]-z];
  const yaw=Math.atan2(...facing);
  if(i>400){
   const turn=yaw-previousYaw;
   assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.08,'no snap after the last running footfall');
  }
  previousYaw=yaw;
  if(actor.feetWeight!==1)continue;
  parent.position.set(x,y,z);
  rig.update({...actor,position:{x,y,z},poseRole:actor.role,poseScale:.9,facing});
  const forward=joint('nose').sub(joint('head')).normalize();
  assert.ok(forward.dot(new Vector3(facing[0],0,facing[1]).normalize())>.9);
  for(const [n,side] of ['left','right'].entries()){
   const foot=joint(side+'-foot'),[fx,lift,fz]=actor.feet[n];
   if(!lift)assert.ok(Math.hypot(foot.x-fx,foot.z-fz)<1e-6);
   peakShoe=Math.max(peakShoe,foot.y);
  }
 }
 assert.ok(peakShoe>.31,'the heel recovers visibly during swing');
});

test('P1 swings the arms by the ribs and folds the recovering knee with constant limb lengths',()=>{
 const rig=createActorRig(new Group()),config=reception(0);
 let back=0,front=0,minElbow=Math.PI,maxElbow=0,maxKnee=0,lean=0;
 const point=name=>rig.group.getObjectByName(name).position;
 const angle=(a,b,c)=>a.clone().sub(b).angleTo(c.clone().sub(b));
 for(let i=0;i<=1000;i++){
  const actor=sampleReception(i/1000,config).actors[0];
  if(actor.feetWeight!==1||!(actor.runDrive>.8))continue;
  const [x,y,z]=actor.position;
  rig.update({...actor,poseRole:actor.role,poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
  const spine=point('left-shoulder').clone().lerp(point('right-shoulder'),.5).sub(point('pelvis'));
  lean=Math.max(lean,Math.atan2(spine.z,spine.y));
  for(const [n,side] of ['left','right'].entries()){
   const [shoulder,elbow,wrist,hip,knee,ankle]=['shoulder','elbow','palm','hip','knee','ankle'].map(joint=>point(side+'-'+joint));
   assert.ok(Math.abs(shoulder.distanceTo(elbow)-.352)<.002);
   assert.ok(Math.abs(elbow.distanceTo(wrist)-.382)<.002);
   assert.ok(Math.abs(hip.distanceTo(knee)-.454)<.002);
   assert.ok(Math.abs(knee.distanceTo(ankle)-.451)<.002);
   const reach=wrist.z-shoulder.z,bend=angle(shoulder,elbow,wrist);
   back=Math.min(back,reach);front=Math.max(front,reach);
   minElbow=Math.min(minElbow,bend);maxElbow=Math.max(maxElbow,bend);
   if(actor.feet[n][1]>.02)maxKnee=Math.max(maxKnee,angle(hip,knee,ankle));
  }
 }
 assert.ok(lean>10*Math.PI/180,'trunk inclines into the run');
 assert.ok(back<-.05&&front>.12&&front<.35,'hand travels from behind the ribs to chest height within reach');
 assert.ok(maxElbow-minElbow>.5,'elbow folds on the forward swing');
 assert.ok(maxKnee>1&&maxKnee<170*Math.PI/180,'recovering leg retains knee flexion');
});

test('P1 hands the last running stride to the setting stance without a jump in elbow or knee position',()=>{
 const rig=createActorRig(new Group()),config=reception(0);
 const joints=['left-elbow','right-elbow','left-knee','right-knee'].map(name=>rig.group.getObjectByName(name));
 let previous;
 for(let i=2000;i<=2700;i++){
  const actor=sampleReception(i/4000,config).actors[0], [x,y,z]=actor.position;
  rig.update({...actor,poseRole:actor.role,poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
  const points=joints.map(joint=>joint.position.clone());
  if(previous)for(const [j,point] of points.entries()){
   assert.ok(point.distanceTo(previous[j])<.012,`jump in ${joints[j].name} at ${i/4000}`);
  }
  previous=points;
 }
});

test('sprinting setters and covering players share alternating contacts and flight; lateral receivers keep a support',()=>{
 const config=reception(3);
 const setter=[],cover=[];
 for(let i=0;i<500;i++){
  const frame=sampleReception(i/500,config),receiver=frame.actors[frame.receiver];
  if(i/500<=frame.receiveContact){
   assert.equal(receiver.runCycle,undefined);
   if(receiver.feet)assert.ok(receiver.feet.some(foot=>foot[1]===0));
  }
  for(const [slot,samples] of [[0,setter],[4,cover]]){
   const actor=frame.actors[slot];
   if(Number.isFinite(actor.runCycle)&&actor.feetWeight===1)samples.push(actor);
  }
 }
 for(const samples of [setter,cover]){
  assert.ok(samples.some(actor=>actor.jump>.015&&actor.feet.every(foot=>foot[1]>0)));
  for(let n=0;n<2;n++){
   const pair=samples.findIndex((actor,i)=>i>0&&actor.feet[n][1]===0&&samples[i-1].feet[n][1]===0);
   assert.ok(pair>0);
   assert.deepEqual(samples[pair].feet[n],samples[pair-1].feet[n]);
  }
 }
 const nearNet=reception(4);
 assert.ok(Array.from({length:90},(_,i)=>sampleReception(i/90,nearNet).actors[0]).every(actor=>actor.runCycle===undefined));
});
