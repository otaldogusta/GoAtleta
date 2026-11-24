import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from './three.module.min.js';
import {createActorRig} from './actor-rig.mjs';
import {courtFootwork} from '../../src/core/court-simulation/court-footwork.js';
import {sampleReception} from '../../src/core/court-simulation/reception-motion.js';
import {receptionFormation} from '../../src/core/court-simulation/formations.js';

const point=(rig,name)=>rig.group.getObjectByName(name).getWorldPosition(new Vector3());
function render(rig,actor){
 const [x,y,z]=actor.position;
 rig.group.parent.position.set(x,y,z);
 rig.update({...actor,poseRole:actor.role,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
}

test('every setter turns out of the initial serve-reading stance with a fixed support heading',()=>{
 for(let rotation=0;rotation<6;rotation++){
  const options={rotation,bases:[...receptionFormation('5-1',rotation),[1.7,0,-10.44]]};
  const {tossStart}=sampleReception(0,options);
  const setter=dt=>sampleReception(tossStart+dt,options).actors[0];
  const yaw=actor=>Math.atan2(actor.facing[0]-actor.position[0],actor.facing[1]-actor.position[2]);
  const initial=yaw(setter(-1e-7)),first=setter(1e-7),later=setter(.006);
  const change=yaw(first)-initial;
  assert.ok(Math.abs(Math.atan2(Math.sin(change),Math.cos(change)))<1e-5);
  if(!first.feet){
   // In P3 the setter is already within one shoe length of the setting spot.
   assert.equal(later.feet,undefined);
   const end=sampleReception(1,options).actors[0].position;
   assert.ok(Math.hypot(end[0]-first.position[0],end[2]-first.position[2])<.25);
   continue;
  }
  const support=first.feet.findIndex((foot,i)=>foot[1]===0&&later.feet[i][1]===0);
  assert.ok(support>=0);
  assert.deepEqual(first.feet[support],later.feet[support]);
 }
});

test('P6 samples a full-body walk for the setter and a separate grounded shuffle to receive',()=>{
 const options={rotation:1,bases:[...receptionFormation('5-1',1),[1.7,0,-10.44]]};
 const rig=createActorRig(new Group()),baseline=createActorRig(new Group());
 const motion={walk:{n:0,hand:0,head:0},shuffle:{n:0,hand:0,head:0}};
 const air=[0,0],shoewasUp=[false,false];
 for(let i=0;i<400;i++){
  const sample=sampleReception(i/400,options);
  if(i/400>=sample.receiveContact)break;
  for(const [slot,kind] of [[0,'walk'],[sample.receiver,'shuffle']]){
   const actor=sample.actors[slot];
   if(actor.travelMotion?.kind!==kind||actor.feetWeight!==1)continue;
   assert.equal(actor.runCycle,undefined);
   render(rig,actor);
   render(baseline,{...actor,travelMotion:undefined});
   motion[kind].n++;
   for(const [n,side] of ['left','right'].entries()){
    const [x,lift,z]=actor.feet[n];
    if(!lift){
     const shoe=point(rig,side+'-foot');
     assert.ok(Math.hypot(shoe.x-x,shoe.z-z)<1e-6);
    }
    if(kind==='shuffle'){
     if(lift>0&&!shoewasUp[n])air[n]++;
     shoewasUp[n]=lift>0;
     if(!actor.skillMotion){
      const hips=rig.group.getObjectByName('pelvis').position;
      const hand=rig.group.getObjectByName(side+'-palm').position;
      const shoulder=rig.group.getObjectByName(side+'-shoulder').position;
      assert.ok(hand.y<hips.y+.07,'the free hand stays by the hip before preparing the pass');
      assert.ok(shoulder.z-hips.z>.15,'the receiver hinges forward over the supporting foot');
     }
    }
    motion[kind].hand=Math.max(motion[kind].hand,point(rig,side+'-palm').distanceTo(point(baseline,side+'-palm')));
   }
   motion[kind].head=Math.max(motion[kind].head,point(rig,'head').distanceTo(point(baseline,'head')));
   assert.ok(actor.feet.some(foot=>foot[1]===0));
  }
 }
 for(const {n,hand,head} of Object.values(motion)){
  assert.ok(n>35);
  assert.ok(hand>.06&&head>.024,`the authored arms and spine move: ${hand}, ${head}`);
 }
 assert.deepEqual(air,[2,2],'two lateral open-gather cycles reach a 1.22 m ball');
});

test('the lateral cycle mirrors the lead leg; retreat keeps the face on the net and contact regains both arms',()=>{
 const rig=createActorRig(new Group());
 function travel(x,z,p,skill){
  const path=u=>[x*u,z*u],gait=courtFootwork(path,p,{shuffle:true,facing:[x*.5,20],travelSeconds:1});
  const actor={role:'passer',pose:'ready',position:[x*p,0,z*p],...gait,...skill};
  render(rig,actor);
  return {foot:actor.feet,travel:actor.travelMotion,palm:point(rig,x>0?'right-palm':'left-palm').sub(rig.group.parent.position),
   front:point(rig,'nose').sub(point(rig,'head')).normalize()};
 }
 const left=travel(-1,0,.12),right=travel(1,0,.12);
 assert.equal(left.travel.kind,'shuffle');
 assert.equal(left.foot[1][1],0);
 assert.equal(right.foot[0][1],0);
 assert.ok(Math.abs(left.palm.x+right.palm.x)<1e-6&&Math.abs(left.palm.z-right.palm.z)<1e-6);
 const retreat=travel(0,-1,.12);
 assert.equal(retreat.travel.kind,'walk');
 assert.equal(retreat.travel.direction,-1);
 assert.ok(retreat.front.z>.9);
 const skill={skillMotion:'pass',skillProgress:0,contactTarget:{x:.12,y:.85,z:.58}};
 const contact=travel(1,0,.12,skill);
 const quiet=travel(1,0,.12,{...skill,travelMotion:undefined});
 assert.ok(contact.palm.distanceTo(quiet.palm)<1e-8);
});

test('an urgent three-metre defensive close uses normal running strides and turns back to the net',()=>{
 const path=u=>[3.06*u,0],options={shuffle:true,facing:[1.53,2],travelSeconds:1.04,endYaw:0};
 let count=0,wasUp=[false,false],front;
 for(let i=1;i<400;i++){
  const p=i/400,actor=courtFootwork(path,p,options);
  assert.ok(Number.isFinite(actor.runCycle));
  assert.equal(actor.travelMotion,undefined);
  for(let side=0;side<2;side++){
   const up=actor.feet[side][1]>.0001;
   if(up&&!wasUp[side])count++;
   wasUp[side]=up;
  }
  front=[actor.facing[0]-path(p)[0],actor.facing[1]];
  if(i===180)assert.ok(front[0]>.9);
 }
 assert.ok(count>=4&&count<=6,`distinct swings: ${count}`);
 assert.ok(front[1]>.99);
});
