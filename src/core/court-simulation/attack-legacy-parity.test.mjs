import assert from 'node:assert/strict';
import test from 'node:test';
import { attackFormation, attackPresets, sampleAttack } from './attack-motion.js';
import { attackApproachLateral, attackApproachProgress, CAPTURED_APPROACH_METRES } from './attack-approach.js';
import { ATTACK_CLIP_JOINT, ATTACK_CLIP_SIZE, sampleAttackClip } from '../../../public/visual-court-3d/attack-captured-clip.mjs';
import { attackClipTiming } from './attack-clip-timing.js';
import { sampleBlockerPose } from './blocker-motion.js';
import { attackPresets as legacyPresets, sampleAttack as sampleReference } from '../__tests__/fixtures/court-reference/attack-motion.mjs';

const legacyFrame = frame => {
 const { attackArc, attackGuide, backRowApproach, setHand, ...result } = frame;
 // The hitter and the blockers use new approaches. The remaining poses,
 // timing, contacts and flight still follow the same reference.
 result.actors = result.actors.map((actor, index) => {
  if(index===3)return { role:actor.role, side:actor.side, mirror:actor.mirror };
  if(actor.role==='blocker'){
   const {position,feet,feetWeight,plantedStance,blockFrame,blockMirror,runCycle,runDrive,travelMotion,facing,...pose}=actor;
   // The run to the pin has a short flight between footfalls before the
   // blocking jump starts. Still compare the entire blocking jump itself.
   return runCycle===undefined?pose:{...pose,jump:0};
  }
  return actor;
 });
 if (result.flight) {
  const { attackArc, attackGuide, ...flight } = result.flight;
  result.flight = flight;
 }
 return result;
};

test('the wing starts set and the central closes from inside the court before jumping', () => {
 for (const [preset,wing,middle] of [['4',1,2],['5',1,2]]) {
  const options={preset,blockers:2,layers:{pass:true,attack:true,block:true}};
  const initial=sampleAttack(0,options);
  const at=seconds=>sampleAttack(initial.attackContact+seconds/initial.duration,options);
  const set=sampleAttack(initial.setContact,options);
  const takeoff=at(-.154);
  assert.equal(initial.actors[middle].position[0],0);
  const triple=sampleAttack(0,{...options,blockers:3});
  assert.deepEqual([1,2,5].map(slot=>triple.actors[slot].position[0]),preset==='4'?[-3.65,0,3.65]:[3.65,0,-3.65]);
  assert.deepEqual(set.actors[middle].position,initial.actors[middle].position);
  assert.ok(Math.abs(initial.actors[wing].position[0])>3);
  assert.ok(Math.abs(takeoff.actors[middle].position[0])>2);
  assert.deepEqual(takeoff.actors[middle].position,at(0).actors[middle].position);
  const first=sampleAttack(initial.setContact+.04/initial.duration,options).actors[middle];
  const firstFoot=preset==='4'?1:0;
  assert.ok(first.feet[firstFoot][1]>0);
  assert.deepEqual(first.feet[1-firstFoot],set.actors[middle].feet[1-firstFoot]);
  const travelSeconds=(initial.attackContact-initial.setContact)*initial.duration-.224;
  const sampleCount=160;
  const close=Array.from({length:sampleCount+1},(_,i)=>
   sampleAttack(initial.setContact+travelSeconds*i/(sampleCount*initial.duration),options).actors[middle]);
  const footAt=frame=>close.find(actor=>actor.blockFrame>=frame-1e-6).feet[firstFoot];
  assert.ok(Math.abs(footAt(14)[3])>.9);
  assert.equal(footAt(14)[3],footAt(19)[3]);
  assert.ok(Math.abs(footAt(32)[3])<1e-8);
  const average=Math.abs(close.at(-1).position[0]-close[0].position[0])/travelSeconds;
  for(let i=1;i<close.length;i++){
   const speed=Math.abs(close[i].position[0]-close[i-1].position[0])*sampleCount/travelSeconds;
   assert.ok(speed<average*2,'the crossing step carries the hips without a sudden burst');
  }
  const planted=at(-.22).actors[middle];
  assert.equal(planted.jump,0);
  assert.deepEqual(planted.feet,takeoff.actors[middle].feet);
  assert.ok(planted.feet.every(foot=>foot[1]===0));
  assert.ok(planted.blockFrame>=32);
  assert.equal(at(-.5).actors[middle].blockMirror,preset==='5');
  assert.equal(at(0).actors[middle].blockFrame,undefined);
  const lifts=[0,0], airborne=[false,false];
  for(let i=0;i<=160;i++){
   const feet=sampleAttack(initial.setContact+(initial.attackContact-initial.setContact)*i/160,options).actors[middle].feet;
   for(let j=0;j<2;j++){
    const lifted=(feet?.[j][1]??0)>.001;
    if(lifted&&!airborne[j])lifts[j]++;
    airborne[j]=lifted;
   }
  }
  assert.deepEqual(lifts,preset==='4'?[1,2]:[2,1]);
  assert.ok(at(-.1).actors[middle].jump>0);
  assert.equal(at(-.1).actors[middle].jump,at(-.1).actors[wing].jump);
  for(let i=0;i<=100;i++){
   const frame=sampleAttack(i/100,options);
   for(const slot of [wing,middle]) assert.ok(Math.abs(frame.actors[slot].position[0])<4.5);
  }
 }
});

test('a quick set leaves real time for the block to close, including the far wing and no-pass replays',()=>{
 for(const pass of [false,true])for(const blockers of [2,3]){
  for(const [preset,edits] of [['1',{}],['tempo-costas',{}],['metro',{x:-1.4,hitOverride:[-1.35,.9],attackArc:1.7}]]){
   const config={preset,blockers,...edits,layers:{pass,attack:true,block:true}};
   const initial=sampleAttack(0,config),duration=initial.duration;
   const at=seconds=>sampleAttack(seconds/duration,config);
   const hit=initial.attackContact*duration,set=initial.setContact*duration;
   const slots=[1,2,5].slice(0,blockers);
   assert.equal(initial.actors[2].position[0],0);
   assert.ok(Math.abs(initial.actors[1].position[0])>3.5);
   const peak=slots.map(()=>0),previous=slots.map(slot=>initial.actors[slot].position[0]);
   for(let sample=1;sample<=Math.ceil(hit*120);sample++){
    const actors=at(sample/120).actors;
    slots.forEach((slot,n)=>{
     const x=actors[slot].position[0];
     peak[n]=Math.max(peak[n],Math.abs(x-previous[n])*120);
     previous[n]=x;
    });
   }
   assert.ok(peak.every(speed=>speed<=6.05),`${preset} ${blockers}: ${peak} m/s`);
   const planted=at(hit-.19),airborne=at(hit-.10);
   for(const slot of slots){
    assert.ok(Math.abs(planted.actors[slot].position[0]-airborne.actors[slot].position[0])<1e-8);
    assert.equal(planted.actors[slot].jump,0);
    assert.ok(airborne.actors[slot].jump>0);
    assert.equal(airborne.actors[slot].jump,airborne.actors[1].jump);
   }
   const sameBall=sampleAttack(0,{...config,layers:{...config.layers,block:false}});
   assert.ok(Math.abs(hit-set-(sameBall.attackContact-sameBall.setContact)*sameBall.duration)<1e-8);
   for(const [seconds,target] of [[set,initial.setHand],[hit,initial.flight.hit]]){
    assert.ok(Math.hypot(...at(seconds).ball.map((v,i)=>v-target[i]))<1e-8);
   }
   if(!pass&&blockers===3)assert.ok(set>sameBall.setContact*sameBall.duration);
  }
 }
});

test('manual blockers stay on the edited marks without extending the attack clock',()=>{
 const config={preset:'tempo-costas',blockers:3,manualBlockers:[1,2,5],layers:{pass:false,attack:true,block:true}};
 const bases=attackFormation();
 bases[5]=[3.6,0,-.6];
 const initial=sampleAttack(0,{...config,bases});
 assert.ok(Math.abs(initial.setContact*initial.duration-.532)<1e-8);
 for(const progress of [0,initial.setContact,initial.attackContact]){
  const frame=sampleAttack(progress,{...config,bases});
  for(const slot of config.manualBlockers)assert.deepEqual(frame.actors[slot].position,bases[slot]);
 }
});

for (const preset of legacyPresets) for (const blockers of [1, 2, 3]) {
 test(`set calibration preserves the incoming pass and the default outgoing flight: ${preset.name}/${blockers}`, () => {
  for (const pass of [false, true]) {
   const options = { preset: preset.name, blockers, attackHand: preset.x > 0 ? 'left' : 'right', layers: { attack: true, block: true, pass } };
   const timing = sampleReference(0, options);
   const calibrated = sampleAttack(0, options);
   assert.deepEqual(calibrated.ball, timing.ball);
   if (preset.name === 'pipe' || preset.name === 'bic') {
    assert.deepEqual(calibrated.flight.hit, timing.flight.hit);
    assert.equal(calibrated.flight.collisions[0].type, 'tape');
   } else assert.deepEqual(legacyFrame(calibrated).flight, timing.flight);
   assert.deepEqual(calibrated.walls, timing.walls);
   for (const progress of [0, calibrated.setContact, calibrated.attackContact, .85, 1]) {
    const frame = sampleAttack(progress, options);
    assert.deepEqual(frame, sampleAttack(progress, { ...options, attackArc: null }));
    if (preset.name === '4' || preset.name === '5'){
     const reference=legacyFrame(sampleReference(progress, options));
     const afterHit=(progress-frame.attackContact)*frame.duration;
     if(afterHit>.484)for(const actor of reference.actors)if(actor.role==='blocker')actor.crouch=sampleBlockerPose(afterHit).crouch;
     assert.deepEqual(legacyFrame(frame),reference);
    }
   }
  }
 });
}

test('each set has a distinct flight and faster variants stay lower and reach the hitter sooner', () => {
 const measurements = new Map(attackPresets.map(({name, flight})=>{
  const options={preset:name,layers:{attack:true,pass:true}}, timing=sampleAttack(0,options);
  const {setContact,attackContact,duration}=timing;
  const apex=Math.max(...Array.from({length:101},(_,i)=>sampleAttack(setContact+(attackContact-setContact)*i/100,options).ball[1]));
  assert.ok(Math.abs((attackContact-setContact)*duration-flight)<1e-8);
  assert.deepEqual(sampleAttack(attackContact,options).ball,timing.flight.hit);
  return [name,{apex,flight}];
 }));
 assert.equal(new Set([...measurements.values()].map(({apex})=>apex.toFixed(2))).size,attackPresets.length);
 for(const [slow,fast] of [['4','go'],['5','red'],['2','31'],['31','1'],['pipe','bic']]){
  assert.ok(measurements.get(slow).apex>measurements.get(fast).apex+.10);
  assert.ok(measurements.get(slow).flight>measurements.get(fast).flight+.16);
 }
 const options={preset:'1',layers:{attack:true,pass:true}}, timing=sampleAttack(0,options);
 assert.ok(sampleAttack(timing.setContact,options).actors[3].jump>0);
});

test('both blockers absorb the landing after the hand collision window', () => {
 assert.ok(sampleBlockerPose(.484).jump<1e-8);
 assert.ok(sampleBlockerPose(.484).crouch<1e-8);
 assert.ok(sampleBlockerPose(.584).crouch>.15);
 assert.ok(sampleBlockerPose(.784).crouch<1e-8);
});

test('the China requests the single-foot slide before travelling toward the exit in flight', () => {
 for(const attackHand of ['right','left']){
  const options={preset:'china',attackHand,layers:{attack:true,pass:true}};
  const timing=sampleAttack(0,options);
  const before=sampleAttack(timing.attackContact-.43/timing.duration,options).actors[3];
  const hit=sampleAttack(timing.attackContact,options).actors[3];
  assert.equal(before.jump,0);
  assert.equal(before.attackSlide,true);
  assert.ok(hit.jump>.6 && hit.position[0]>before.position[0]+.5);
 }
});

test('back-row attacks plant behind the three-meter line and advance only in the air', () => {
 for(const preset of ['pipe','bic','fundo-1']) for(const attackHand of ['right','left']){
  const options={preset,attackHand,bases:undefined,layers:{attack:true,pass:true}};
  const timing=sampleAttack(0,options),takeoff=timing.backRowApproach[1];
  const frames=Array.from({length:401},(_,i)=>sampleAttack(i/400*timing.attackContact,options).actors[3]);
  const grounded=frames.filter(actor=>actor.jump===0);
  assert.ok(grounded.every(actor=>actor.attackTakeoffDepth===takeoff[2] && actor.position[2]>3));
  assert.ok(Math.abs(grounded.at(-1).position[2]-takeoff[2])<.02);
  const strike=frames.at(-1);
  assert.ok(strike.jump>.6 && strike.position[2]<3);
  const landing=sampleAttack(1,options).actors[3];
  assert.equal(landing.jump,0);
  assert.ok(landing.position[2]<strike.position[2]);
 }
});

test('the same attack preset mirrors the captured stride for a left-hander and defaults to right-handed', () => {
 for (const preset of attackPresets) {
  const options = { preset: preset.name, layers: { attack: true } };
  for (const attackHand of [undefined, 'right', 'left']) {
   const config = { ...options, attackHand };
   const timing = sampleAttack(0, config);
   const at = seconds => sampleAttack(timing.attackContact + seconds / timing.duration, config).actors[3];
   assert.equal(at(0).mirror, attackHand === 'left');
   const approach=at(-.6),right=sampleAttack(timing.attackContact-.6/timing.duration,options).actors[3];
   assert.equal(approach.attackFrame,right.attackFrame);
   if(attackHand!=='left')assert.deepEqual(approach.position,right.position);
   assert.equal(timing.actors[3].attackFrame,1);
   assert.equal(approach.attackSlide,preset.name==='china');
   if(approach.attackFrame>=70)assert.equal(approach.feet,undefined);
  }
 }
});

test('the edited approach translates the root on the same frame as the Blender stride', () => {
 const pose=new Float32Array(ATTACK_CLIP_SIZE);
 const root=ATTACK_CLIP_JOINT.rootMotion;
 const acrossStart=sampleAttackClip(12,pose)[root],acrossEnd=sampleAttackClip(132,pose)[root];
 function capturedPath(frame){
  sampleAttackClip(Math.max(12,Math.min(132,frame)),pose);
  const along=pose[root+2]/CAPTURED_APPROACH_METRES;
  return {along,across:pose[root]-acrossStart-(acrossEnd-acrossStart)*along};
 }
 for(let frame=12;frame<=132;frame+=1/32){
  const source=capturedPath(frame),progress=attackApproachProgress(frame);
  assert.ok(Math.abs(progress-source.along)*CAPTURED_APPROACH_METRES<.003);
  assert.ok(Math.abs(attackApproachLateral(frame,progress)-source.across)<.003);
 }
 for(const attackHand of ['left','right'])for(const start of [[-4.2,0,3],[-5.35,0,3.65],[-3.9,0,.65]]){
  const bases=attackFormation();bases[3]=start;
  const options={preset:'4',attackHand,bases,layers:{attack:true,pass:true}},timing=sampleAttack(0,options);
  const end=[-3.9,0,.65],dx=end[0]-start[0],dz=end[2]-start[2];
  const distance=Math.hypot(dx,dz);
  for(let i=0;i<=150;i++){
   const actor=sampleAttack(i/150*timing.attackContact,options).actors[3];
   const {along,across}=capturedPath(actor.attackFrame);
   const sway=distance?(attackHand==='left'?1:-1)*.9*across/distance:0;
   assert.ok(Math.hypot(actor.position[0]-start[0]-dx*along-dz*sway,actor.position[2]-start[2]-dz*along+dx*sway)
     <.001*distance+.003);
   assert.ok(Math.abs(actor.attackStrideScale*.9*CAPTURED_APPROACH_METRES-distance)<1e-9);
   if(actor.attackFrame<=117 && distance){
    assert.ok(Math.abs(actor.facing[0]-actor.position[0]-dx/distance)<1e-9);
    assert.ok(Math.abs(actor.facing[1]-actor.position[2]-dz/distance)<1e-9);
   }
  }
 }
});

test('long edited paths add alternating supported steps before the final captured approach', () => {
 const bases=attackFormation();bases[3]=[3,0,7.5];
 const options={preset:'4',bases,layers:{attack:true,pass:true}},timing=sampleAttack(0,options);
 const ordinary=sampleAttack(0,{...options,bases:attackFormation()});
 assert.equal(timing.attackContact,ordinary.attackContact);
 const distance=Math.hypot(3.9+3,7.5-.65);
 const finalLength=CAPTURED_APPROACH_METRES*.9;
 const liftCount=[0,0],maxSpan=.55;
 let previous;
 for(let i=0;i<=1200;i++){
  const actor=sampleAttack(timing.attackContact*i/1200,options).actors[3];
  assert.ok(Math.abs(actor.attackStrideScale-1)<1e-8);
  if(actor.attackFrame>=12)assert.equal(actor.attackLeadIn,0);
  if(previous){
   assert.ok(Math.abs(previous.attackLeadIn-actor.attackLeadIn)<.06,'smooth gait handover');
   assert.ok(Math.hypot(previous.position[0]-actor.position[0],previous.position[2]-actor.position[2])<.06);
  }
  if(actor.attackLeadIn>.995){
   assert.ok(actor.attackFrame<12 && actor.feet.length===2);
   for(let n=0;n<2;n++){
    const foot=actor.feet[n],prior=previous?.feet?.[n];
    assert.ok(Math.hypot(foot[0]-actor.position[0],foot[2]-actor.position[2])<maxSpan);
    if(prior&&prior[1]===0 && foot[1]>0)liftCount[n]++;
    if(prior&&prior[1]===0 && foot[1]===0)assert.deepEqual(foot,prior);
   }
  }
  if(actor.attackFrame>=12 && actor.attackFrame<=132){
   const ratio=(distance-finalLength+finalLength*attackApproachProgress(actor.attackFrame))/distance;
   const along=((actor.position[0]-3)*(-6.9)+(actor.position[2]-7.5)*(-6.85))/(distance*distance);
   assert.ok(Math.abs(along-ratio)<1e-8);
  }
  previous=actor;
 }
 assert.ok(liftCount.every(n=>n>=2));
});

test('short handle edits keep the recorded steps and enter the extra run continuously', () => {
 const natural=CAPTURED_APPROACH_METRES*.9;
 function frames(surplus){
  const bases=attackFormation();bases[3]=[-3.9,0,.65+natural+surplus];
  const options={preset:'4',bases,layers:{attack:true,pass:true}},timing=sampleAttack(0,options);
  return Array.from({length:121},(_,i)=>sampleAttack(i/120*timing.attackContact,options).actors[3]);
 }
 const small=frames(.22);
 for(const actor of small){
  assert.equal(actor.attackLeadIn,0);
  if(actor.attackFrame<=12) assert.equal(actor.position[2],small[0].position[2]);
 }
 for(const boundary of [.25,.65]){
  const before=frames(boundary-.0001),after=frames(boundary+.0001);
  for(let i=0;i<before.length;i++){
   assert.ok(Math.abs(before[i].attackLeadIn-after[i].attackLeadIn)<.002);
   assert.ok(Math.abs(before[i].position[2]-after[i].position[2])<.001);
   assert.ok(Math.abs(before[i].attackFrame-after[i].attackFrame)<.04);
  }
 }
});

test('the resting capture loads the first step smoothly, including short sets without a pass', () => {
 for(const approach of [0,.03,.6]){
  const pose=t=>attackClipTiming(t,approach,.9,1.45,1.89,.22).attackFrame;
  assert.equal(pose(0),1);
  const first=Math.max(approach,.9*.2);
  assert.equal(pose(first),12);
  const epsilon=.00001,before=(pose(first)-pose(first-epsilon))/epsilon,after=(pose(first+epsilon)-pose(first))/epsilon;
  assert.ok(before>0 && Math.abs(before-after)<.01*before);
 }
});

test('the attacker takes off by the apex of the editable high set and meets quick sets near the jump peak', () => {
 for (const pass of [false, true]) for (const setHeight of [.22, 1.8, 2.6]) {
  const options = { preset: '4', setHeight, layers: { attack: true, block: true, pass } };
  const timing = sampleAttack(0, options);
  const at = seconds => sampleAttack(timing.attackContact + seconds / timing.duration, options).actors[3];
  const setApex = timing.setContact + (timing.attackContact-timing.setContact)*(.5+.72/(8*setHeight));
  const apex = sampleAttack(setApex, options);
  const apexBefore = sampleAttack(setApex-.001, options), apexAfter = sampleAttack(setApex+.001, options);
  assert.ok(apex.ball[1]>apexBefore.ball[1] && apex.ball[1]>apexAfter.ball[1]);
  assert.ok(apex.actors[3].jump>.12);
  assert.equal(at(-.8).jump, 0);
  assert.equal(at(-.45).pose, setHeight < 1 ? 'plant' : 'draw');
  assert.equal(at(-.1).pose, 'contact');
  assert.ok(at(0).poseBlend > .999999);
  assert.ok(at(0).jump > .88);
  assert.deepEqual(at(-.16).position, at(0).position);
  assert.equal(at(.5).jump, 0);
  assert.equal(at(.5).pose, 'land');
 }
});

test('the Blender clock crosses its footfalls, swing and landing without a speed jump', () => {
 for(const [approach,takeoff,contact,landing] of [[.2,1.1,1.55,1.99],[.2,1.1,1.72,2.16]]){
  const frame=time=>attackClipTiming(time,approach,takeoff,contact,landing).attackFrame;
  const epsilon=.00001;
  for(const [time,expected] of [[takeoff-.11,117],[takeoff,132],[contact-.14,141],[contact,145],[landing,159]]){
   assert.ok(Math.abs(frame(time)-expected)<1e-8);
   const before=(frame(time)-frame(time-epsilon))/epsilon, after=(frame(time+epsilon)-frame(time))/epsilon;
   assert.ok(before>0 && after>0);
   assert.ok(Math.abs(before-after)<.01*before,`speed discontinuity at frame ${expected}`);
  }
  assert.equal(frame(approach-.1),12);
  assert.equal(frame(landing+.3),172);
 }
});
