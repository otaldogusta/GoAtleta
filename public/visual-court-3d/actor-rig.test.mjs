import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {createActorRig} from './actor-rig.mjs';
import {ATTACK_CLIP_JOINT as joint,ATTACK_CLIP_SIZE,sampleAttackClip} from './attack-captured-clip.mjs';
import {createBlocker} from './blocker-rig.mjs';
import {shoeSupportHeight} from './court-shoe.mjs';
import {attackFormation,sampleAttack} from '../../src/core/court-simulation/attack-motion.js';
import {sampleReception} from '../../src/core/court-simulation/reception-motion.js';
import {receptionFormation} from '../../src/core/court-simulation/formations.js';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const names={setter:['ready','load','rise','contact','follow','backfollow'],passer:['ready','load','contact','follow'],attacker:['ready','approach','plant','launch','draw','contact','follow','land'],server:['ready','toss','draw','contact','follow','idle']};
const part=(rig,name)=>rig.group.getObjectByName(name);
test('reception runners keep the hips up through their entire supported stride',()=>{
 const rig=fixture();
 for(let rotation=0;rotation<6;rotation++){
  const bases=[...receptionFormation('5-1',rotation),[1.7,0,-10.44]];
  const options={rotation,bases};
  for(let i=1;i<200;i++)for(const actor of sampleReception(i/200,options).actors){
   if(actor.feetWeight!==1 || (actor.pose!=='approach'&&actor.pose!=='ready'))continue;
   const [x,y,z]=actor.position;
   rig.update({...actor,poseRole:actor.role,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
   assert.ok(part(rig,'pelvis').position.y>.80,`rotation ${rotation+1} frame ${i} ${actor.pose}`);
  }
 }
});
const world=object=>object.getWorldPosition(new THREE.Vector3());
function checkSettingPads(rig,ball){
 for(const side of ['left','right'])for(const name of ['thumb','finger-0','finger-1','finger-2','finger-3']){
  const tip=part(rig,side+'-'+name).localToWorld(new THREE.Vector3(0,.5,0));
  near(tip.distanceTo(ball),.12,.009);
 }
}
function fixture(){const parent=new THREE.Group(),rig=createActorRig(parent);return {parent,group:rig.group,update:rig.update,get height(){return rig.height;}};}
function matrices(rig){rig.group.updateMatrixWorld(true);return rig.group.children.map(object=>({name:object.name,matrix:[...object.matrixWorld.elements]}));}

test('the two shoes share a tapered mesh with a stable heel and forefoot contact patch',()=>{
 const rig=fixture(),left=part(rig,'left-foot'),right=part(rig,'right-foot');
 assert.equal(left.geometry,right.geometry);
 const vertices=left.geometry.getAttribute('position'),size=left.geometry.boundingBox.getSize(new THREE.Vector3());
 near(size.x,.110,.001);near(size.z,.278,.001);
 const sole=[];
 for(let i=0;i<vertices.count;i++)if(vertices.getY(i)<-.05499)sole.push(vertices.getZ(i));
 assert.ok(Math.max(...sole)-Math.min(...sole)>.16,'the level outsole contacts at heel and forefoot');
 for(const actor of [
  {poseRole:'passer',pose:'ready'}, {poseRole:'attacker',attackFrame:150},
  {poseRole:'attacker',attackFrame:150,mirror:true}, {poseRole:'blocker',crouch:.19},
 ]){
  rig.update(actor);
  for(const side of ['left','right']){
   const shoe=part(rig,side+'-foot');
   assert.equal(Math.sign(shoe.scale.x),-Math.sign(part(rig,side+'-hip').position.x-part(rig,'pelvis').position.x));
  }
 }
 for(let pitch=-1;pitch<=1;pitch+=.1){
  const cosine=Math.sqrt(1-pitch*pitch);let lowest=Infinity;
  for(let i=0;i<vertices.count;i++)lowest=Math.min(lowest,vertices.getY(i)*cosine+vertices.getZ(i)*pitch);
  near(shoeSupportHeight(pitch),-lowest);
 }
});

test('receive hitters release their arms into the first approach pose over their planted shoes',()=>{
 const rig=fixture();
 for(const leftHanded of [false,true]){
  const lead=leftHanded?-1:1;
  const actor={poseRole:'passer',pose:'ready',position:{x:0,y:0,z:0},facing:[0,1],poseScale:1,
   feet:[[-.20,0,.14*lead,0],[.20,0,-.14*lead,0]],feetWeight:0,plantedStance:true,attackReadyLeft:leftHanded};
  rig.update({...actor,attackReadiness:0});
  const receiveHands=part(rig,'left-palm').position.distanceTo(part(rig,'right-palm').position);
  rig.update({...actor,attackReadiness:1});
  const pose=matrices(rig);
  const handGap=part(rig,'left-palm').position.distanceTo(part(rig,'right-palm').position);
  assert.ok(handGap>receiveHands+.15,'both arms open out of the passing platform');
  assert.ok(part(rig,'head').position.z>part(rig,'pelvis').position.z+.10,'weight carried forward');
  for(const [index,side] of ['left','right'].entries()){
   const [x,,z]=actor.feet[index],foot=part(rig,side+'-foot').position;
   near(foot.x,x);near(foot.z,z);near(foot.y,.055);
   const knee=part(rig,side+'-knee').position, ankle=part(rig,side+'-ankle').position, hip=part(rig,side+'-hip').position;
   assert.ok(knee.z>(hip.z+ankle.z)/2+.09,'knee flexes toward the toes');
   assert.ok(part(rig,side+'-palm').position.y<hip.y+.15,'hands are available for the approach');
  }
  const atEnd=part(rig,'right-palm').position.clone();
  rig.update({...actor,attackReadiness:.5});
  assert.ok(part(rig,'right-palm').position.distanceTo(atEnd)>.04);
  rig.update({...actor,attackReadiness:1});
  assert.deepEqual(matrices(rig),pose);
 }
});

test('P1 uses the captured limbs and keeps the outside shoe anchored while cutting',()=>{
 const rig=fixture(),bases=[...receptionFormation('5-1',0),[1.7,0,-10.44]];
 const frames=Array.from({length:1500},(_,index)=>sampleReception(index/1500,{bases}).actors[0]);
 const cut=frames.findIndex(actor=>actor.runCycle!==undefined&&actor.position[0]<bases[0][0]-.000001);
 assert.ok(cut>0);
 const render=(actor,runCycle=actor.runCycle)=>{
  const [x,y,z]=actor.position;
  rig.parent.position.set(x,y,z);
  rig.update({...actor,runCycle,poseRole:actor.role,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
 };
 const actor=frames[cut];
 render(actor,NaN);
 const arm=part(rig,'left-palm').position.clone();
 const shoulder=part(rig,'right-shoulder').position.clone();
 render(actor);
 assert.ok(arm.distanceTo(part(rig,'left-palm').position)>.03);
 assert.ok(shoulder.distanceTo(part(rig,'right-shoulder').position)>.02);
 const support=world(part(rig,'left-foot'));
 for(const frame of frames.slice(cut+1,cut+15)){
  render(frame);
  near(world(part(rig,'left-foot')).distanceTo(support),0);
 }
});

test('all sporting poses use one connected solid anatomy and a valid pose-specific height',()=>{
 const rig=fixture(),objects=[...rig.group.children],geometries=objects.map(object=>object.geometry),materials=objects.map(object=>object.material);
 for(const [poseRole,poses] of Object.entries(names))for(const pose of poses){
  rig.update({poseRole,pose,facing:[0,1],poseScale:.95,jump:0});rig.parent.updateMatrixWorld(true);
  assert.equal(rig.group.children.length,39);assert.ok(Number.isFinite(rig.height)&&rig.height>1.2&&rig.height<2.5,`${poseRole}/${pose}: ${rig.height}`);
  const box=new THREE.Box3().setFromObject(rig.group);assert.ok(rig.height>=box.max.y-1e-7);
  const surface=new THREE.Box3().setFromObject(rig.group,true);
  near(surface.min.y,0,.003);assert.ok(matrices(rig).every(object=>object.matrix.every(Number.isFinite)));
  for(const side of ['left','right'])for(const [bone,start,end] of [['upper-arm','shoulder','elbow'],['forearm','elbow','palm'],['thigh','hip','knee'],['shin','knee','ankle']]){
   const mesh=part(rig,`${side}-${bone}`),a=mesh.localToWorld(new THREE.Vector3(0,-.5,0)),b=mesh.localToWorld(new THREE.Vector3(0,.5,0));
   near(a.distanceTo(world(part(rig,`${side}-${start}`))),0);
   const joint=part(rig,`${side}-${end}`);
   if(poseRole==='setter'&&end==='palm')assert.ok(joint.worldToLocal(b).length()<1,'forearm joins inside the palm');
   else near(b.distanceTo(world(joint)),0);
  }
 }
 assert.deepEqual(rig.group.children,objects);assert.deepEqual(objects.map(object=>object.geometry),geometries);assert.deepEqual(objects.map(object=>object.material),materials);
 assert.ok(new Set(geometries).size<=10);assert.equal(new Set(materials).size,1);
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
 rig.update({poseRole:'setter',pose:'contact'});
 for(const side of ['left','right'])assert.ok(part(rig,side+'-palm').position.y>part(rig,'head').position.y+.20);
 rig.update({poseRole:'passer',pose:'contact'});assert.ok(part(rig,'left-palm').position.y<.8&&part(rig,'right-palm').position.y<.8);assert.ok(part(rig,'left-palm').position.distanceTo(part(rig,'right-palm').position)<.12);
 rig.update({poseRole:'server',pose:'toss'});
 assert.ok(part(rig,'left-palm').position.y>part(rig,'head').position.y&&part(rig,'right-palm').position.z<0);
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

test('the captured attack rolls over the planted foot and closes on the foot opposite the hitting arm',()=>{
 const rig=fixture(), sides=['left','right'];
 for(const [preset,startX] of [['4',-3],['5',3]]){
  const bases=attackFormation();bases[3][0]=startX;
  const options={preset,bases,attackHand:preset==='4'?'right':'left',layers:{pass:true,attack:true},targetOverride:[1,-3]}, timing=sampleAttack(0,options);
  const at=time=>sampleAttack(time/timing.duration,options);
  const start=(1.6+2.8*.18), takeoff=[...Array(700)].map((_,i)=>start+i*.002).find(time=>at(time).actors[3].pose==='launch');
  assert.ok(takeoff!==undefined);
  const feetAt=time=>{
   const actor=at(time).actors[3],[x,y,z]=actor.position;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'attacker',position:{x,y,z},poseScale:.9,facing:[actor.facing[0]-x,actor.facing[1]-z]});
   rig.parent.updateMatrixWorld(true);
   return sides.map(side=>{
    const foot=part(rig,`${side}-foot`),forward=new THREE.Vector3(0,0,1).transformDirection(foot.matrixWorld);
    return {center:world(foot),forward,knee:world(part(rig,side+'-knee'))};
   });
  };
  const opposite=preset==='4'?0:1, dominant=1-opposite;
  const feetAtFrame=frame=>{
   let lo=0,hi=timing.attackContact*timing.duration;
   for(let i=0;i<35;i++){
    const mid=(lo+hi)/2;
    if(at(mid).actors[3].attackFrame<frame)lo=mid;else hi=mid;
   }
   return feetAt(hi);
  };
  // Check support against the floor on the original capture clock. The heel
  // rolls up while the planted shoe stays at the same spot on the court.
  const horizontal=(a,b)=>Math.hypot(a.center.x-b.center.x,a.center.z-b.center.z);
  for(const [from,to,side] of [[30,50,dominant],[80,90,opposite],[105,116,dominant]]){
   const anchor=feetAtFrame(from)[side];
   for(let frame=from+1;frame<=to;frame++)assert.ok(horizontal(anchor,feetAtFrame(frame)[side])<.055,`support ${frame}`);
  }
  const lead=frame=>{
   const feet=feetAtFrame(frame);
   return feet[opposite].center.clone().sub(feet[dominant].center).dot(feet[dominant].forward);
  };
  assert.ok(lead(70)>.3 && lead(104)<-.3 && lead(117)>.18,'three authored footfalls');
  const close=feetAtFrame(125);
  // An IK pole flip can move a knee across the support line between two video frames.
  let previous=feetAt(start);
  for(let ms=1;start+ms/1000<=takeoff;ms++){
   const next=feetAt(start+ms/1000);
   for(let side=0;side<2;side++)assert.ok(next[side].knee.distanceTo(previous[side].knee)<.03,'knee continuity through plant');
   previous=next;
  }
  const setup=at(takeoff-.01).actors[3], [x,,z]=setup.position, [fx,fz]=setup.facing;
  assert.ok(close[opposite].center.clone().sub(close[dominant].center).dot(new THREE.Vector3(fx-x,0,fz-z))>.18);
  const set=sampleAttack(timing.setContact,options).ball;
  const impact=sampleAttack(timing.attackContact,options);
  for(const actor of [setup,impact.actors[3]]){
   const forward=actor.facing.map((value,i)=>value-actor.position[i*2]);
   near(forward[0]*(impact.ball[0]-set[0])+forward[1]*(impact.ball[2]-set[2]),0);
   assert.ok(forward[1]<0);
  }
 }
});

test('the court keeps the Blender pelvis height and leg lengths throughout the run and the last plant',()=>{
 const rig=fixture(),capture=new Float32Array(ATTACK_CLIP_SIZE);
 const captured=name=>new THREE.Vector3().fromArray(capture,joint[name]);
 for(const preset of ['4','5','china','pipe','fundo-1'])for(const attackHand of ['left','right']){
  const options={preset,attackHand,layers:{attack:true,pass:true,block:true}};
  const {attackContact}=sampleAttack(0,options);
  for(let i=0;i<300;i++){
   const actor=sampleAttack(i/300*attackContact,options).actors[3];
   if(actor.attackFrame>132)break;
   const [x,y,z]=actor.position;
   rig.update({...actor,poseRole:'attacker',poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
   if(actor.attackLeadIn>0)continue;
   sampleAttackClip(actor.attackFrame,capture);
   near(part(rig,'pelvis').position.y,capture[joint.pelvis+1]);
   for(const side of ['left','right']){
    const source=actor.mirror?(side==='right'?'left':'right'):side;
    const ankle=part(rig,side+'-ankle').position,knee=part(rig,side+'-knee').position,hip=part(rig,side+'-hip').position;
    near(hip.distanceTo(knee),captured(source+'Hip').distanceTo(captured(source+'Knee')));
    near(knee.distanceTo(ankle),captured(source+'Knee').distanceTo(captured(source+'Ankle')));
    const drive=actor.attackSlide && side===attackHand && actor.attackFrame>104;
    if(drive && actor.attackFrame>=122)assert.ok(ankle.y>capture[joint[source+'Ankle']+1]+.3);
    if(!drive)near(ankle.y,capture[joint[source+'Ankle']+1]);
   }
  }
 }
});

test('both knees flex forward relative to the turning pelvis on original and edited approaches',()=>{
 const rig=fixture(),up=new THREE.Vector3(0,1,0);
 for(const mirror of [false,true])for(const attackStrideScale of [.45,1,1.25]){
  for(let frame=1;frame<=172;frame+=.5){
   rig.update({poseRole:'attacker',attackFrame:frame,attackStrideScale,mirror});
   const left=part(rig,'left-hip').position,right=part(rig,'right-hip').position;
   const forward=left.clone().sub(right).cross(up).normalize();
   for(const side of ['left','right']){
    const hip=part(rig,side+'-hip').position;
    const axis=part(rig,side+'-ankle').position.clone().sub(hip).normalize();
    const bend=part(rig,side+'-knee').position.clone().sub(hip).projectOnPlane(axis);
    assert.ok(bend.dot(forward)>=-1e-8,`${side} knee behind the leg at frame ${frame}, stride ${attackStrideScale}, mirror ${mirror}`);
   }
  }
 }
});

test('an extended approach alternates grounded shoes before entering the captured three steps',()=>{
 const rig=fixture(),bases=attackFormation();
 bases[3]=[-4.2,0,7];
 for(const attackHand of ['right','left']){
  const options={bases,attackHand,preset:'4',layers:{pass:true,attack:true,block:true}};
  const {attackContact}=sampleAttack(0,options),supports=new Set();
  for(let i=0;i<600;i++){
   const actor=sampleAttack(i/600*attackContact,options).actors[3];
   if(actor.attackLeadIn<.9999)continue;
   const [x,y,z]=actor.position;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'attacker',poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z]});
   rig.parent.updateMatrixWorld(true);
   assert.ok(part(rig,'pelvis').position.y>.90,'upright lead-in');
   for(const [n,side] of ['right','left'].entries()){
    const [ax,lift,az]=actor.feet[n];
    if(lift || actor.feet[1-n][1]<.05)continue;
    supports.add(side);
    const foot=world(part(rig,side+'-foot'));
    assert.ok(Math.hypot(foot.x-ax,foot.z-az)<.04,'planted shoe stays on its footprint');
   }
  }
  assert.equal(supports.size,2);
 }
});

test('dragging the attack contact across the setter does not reverse the facing',()=>{
 const options={preset:'5',layers:{pass:true,attack:true}};
 const headings=[1.409,1.411].map(x=>{
  const selection={...options,hitOverride:[x,2]};
  const timing=sampleAttack(0,selection), {position,facing}=sampleAttack(timing.attackContact,selection).actors[3];
  return new THREE.Vector3(facing[0]-position[0],0,facing[1]-position[2]);
 });
 assert.ok(headings[0].angleTo(headings[1])<.01);
});

test('the front-row capture uses the same vertical jump as the simulation before contact correction',()=>{
 const rig=fixture(),options={preset:'4',layers:{attack:true,pass:true}},timing=sampleAttack(0,options);
 const hit=sampleAttack(timing.attackContact,options).ball;
 for(const offset of [-.8,-.3,-.15,0,.24,.5]){
  const actor=sampleAttack(timing.attackContact+offset/timing.duration,options).actors[3];
  const [x,y,z]=actor.position;
  rig.update({...actor,poseRole:'attacker',position:{x,y,z},contactWeight:0,
   contactTarget:{x:hit[0],y:hit[1],z:hit[2]}});
  near(rig.group.position.y,actor.jump);
 }
});

test('the back-row capture leaves both shoes behind the line and reaches the set in flight',()=>{
 const rig=fixture();
 for(const preset of ['pipe','bic','fundo-1']) for(const attackHand of ['left','right']){
  const options={preset,attackHand,layers:{pass:true,attack:true,block:true}},timing=sampleAttack(0,options);
  const hit=sampleAttack(timing.attackContact,options);
  const place=frame=>{
   const actor=frame.actors[3],[x,y,z]=actor.position,[bx,by,bz]=hit.ball;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'attacker',position:{x,y,z},poseScale:.9,facing:[actor.facing[0]-x,actor.facing[1]-z],
    contactTarget:{x:bx,y:by,z:bz}});
   rig.parent.updateMatrixWorld(true);
  };
  for(let i=0;i<240;i++){
   const frame=sampleAttack(i/240*timing.attackContact,options);
   if(frame.actors[3].jump>0)break;
   place(frame);
   for(const side of ['left','right'])assert.ok(world(part(rig,side+'-foot')).z-.145*.9>3);
  }
  place(hit);
  near(world(part(rig,attackHand+'-palm')).distanceTo(new THREE.Vector3(...hit.ball)),.12,1e-6);
 }
});

test('the captured arm swing and palm contact follow the set through replay, edited heights and mirrored attacks',()=>{
 const rig=fixture();
 for(const [preset,setHeight,pass,attackHand] of [['4',null,true,'right'],['4',null,true,'left'],['1',null,true,'right'],['5',null,true,'right'],['5',.45,false,'left'],['4',2.16,true,'right']]){
  const options={preset,setHeight,attackHand,layers:{pass,attack:true,block:true}}, timing=sampleAttack(0,options);
  const at=seconds=>sampleAttack(timing.attackContact+seconds/timing.duration,options);
  const impact=at(0).ball;
  const put=frame=>{
   const actor=frame.actors[3], [x,y,z]=actor.position;
   const target=actor.contactWeight===undefined?frame.ball:impact;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'attacker',position:{x,y,z},poseScale:.9,facing:[actor.facing[0]-x,actor.facing[1]-z],
    contactTarget:{x:target[0],y:target[1],z:target[2]}});
   rig.parent.updateMatrixWorld(true);
   return actor.mirror?'left-palm':'right-palm';
  };
  const poseAtClipFrame=wanted=>{
   let low=wanted>145?timing.attackContact:0,high=wanted>145?1:timing.attackContact;
   for(let i=0;i<32;i++){
    const mid=(low+high)*.5;
    if(sampleAttack(mid,options).actors[3].attackFrame<wanted)low=mid;
    else high=mid;
   }
   const sampled=sampleAttack(high,options);
   near(sampled.actors[3].attackFrame,wanted,1e-5);
   return put(sampled);
  };
  poseAtClipFrame(104);
  for(const side of ['left','right']){
   assert.ok(part(rig,side+'-palm').position.z<part(rig,side+'-shoulder').position.z-.35,'wide backswing at penultimate footfall');
  }
  poseAtClipFrame(132);
  for(const side of ['left','right']){
   assert.ok(part(rig,side+'-palm').position.y>part(rig,side+'-shoulder').position.y+.25,'both hands rise at takeoff');
  }
  const striker=poseAtClipFrame(141),hittingSide=striker.split('-')[0],guideSide=hittingSide==='right'?'left':'right';
  const elbow=part(rig,hittingSide+'-elbow').position,shoulder=part(rig,hittingSide+'-shoulder').position;
  assert.ok(Math.abs(elbow.y-shoulder.y)<.1 && elbow.z<shoulder.z-.2,'elbow drawn back at shoulder height');
  assert.ok(part(rig,guideSide+'-palm').position.y>part(rig,striker).position.y+.2,'guide hand points up before the whip');
  const draw=matrices(rig);
  poseAtClipFrame(143);
  assert.ok(elbow.z>part(rig,striker).position.z+.1,'elbow leads the accelerating hand');
  const ballAtHit=at(0);
  near(ballAtHit.actors[3].attackFrame,145);
  put(ballAtHit);
  const headPosition=world(part(rig,'head'));
  const forward=world(part(rig,'nose')).sub(headPosition);
  const up=headPosition.sub(world(part(rig,'pelvis')));
  const right=forward.cross(up);
  const shoulders=world(part(rig,'right-shoulder')).sub(world(part(rig,'left-shoulder')));
  assert.ok(shoulders.dot(right)>0,'the named right shoulder is on the visible anatomical right');
  near(world(part(rig,striker)).distanceTo(new THREE.Vector3(...ballAtHit.ball)),.12,1e-6);
  const hit=matrices(rig);
  put(at(.0449));
  const release=world(part(rig,striker));
  put(at(.0451));
  assert.ok(release.distanceTo(world(part(rig,striker)))<.01);
  poseAtClipFrame(150);
  assert.ok(part(rig,striker).position.y<1.4);
  poseAtClipFrame(141);
  assert.deepEqual(matrices(rig),draw);
  put(ballAtHit);
  assert.deepEqual(matrices(rig),hit);
 }
});

test('the spike strikes the rear surface and follows the outgoing shot with either hand',()=>{
 const rig=fixture();
 for(const preset of ['4','5','1','pipe','china'])for(const attackHand of ['left','right']){
  const options={preset,attackHand,layers:{pass:true,attack:true,block:true}};
  const timing=sampleAttack(0,options),velocity=timing.flight.segments[0].velocity;
  const outgoing=new THREE.Vector3(...velocity).normalize(),ball=new THREE.Vector3(...timing.flight.hit);
  const palm=part(rig,attackHand+'-palm');
  const at=seconds=>{
   const actor=sampleAttack(timing.attackContact+seconds/timing.duration,options).actors[3];
   const [x,y,z]=actor.position;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'attacker',poseScale:.9,position:{x,y,z},contactTarget:ball,spikeVelocity:velocity,
    facing:[actor.facing[0]-x,actor.facing[1]-z]});
   rig.parent.updateMatrixWorld(true);
   return world(palm);
  };
  const before=at(-.010),contact=at(0),toBall=ball.clone().sub(contact);
  near(toBall.length(),.12);
  near(toBall.normalize().dot(outgoing),1);
  const palmNormal=new THREE.Vector3(0,0,1).applyQuaternion(palm.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(palmNormal.dot(outgoing)>.9,'the broad palm faces the ball');
  assert.ok(contact.clone().sub(before).normalize().dot(outgoing)>.20,'the wrist advances into the shot');
  assert.ok(at(.010).sub(contact).normalize().dot(outgoing)>.7,'the hand follows the departing ball');
  near(at(0).distanceTo(contact),0);
 }
});

test('dragging the shot target through the back of an edited approach keeps the landing side continuous',()=>{
 const rig=fixture();
 const feet=[];
 for(const xTarget of [2.06346,2.07346]){
  const options={preset:'5',hitOverride:[.5,.65],targetOverride:[xTarget,-4.95],layers:{pass:true,attack:true}};
  const timing=sampleAttack(0,options),actor=sampleAttack(timing.attackContact,options).actors[3];
  const [x,y,z]=actor.position;
  rig.parent.position.set(x,y,z);
  rig.update({...actor,poseRole:'attacker',poseScale:.9,position:{x,y,z},facing:[actor.facing[0]-x,actor.facing[1]-z],
   spikeVelocity:timing.flight.segments[0].velocity,contactTarget:new THREE.Vector3(...timing.flight.hit)});
  rig.parent.updateMatrixWorld(true);
  feet.push(world(part(rig,'left-foot')));
 }
 assert.ok(feet[0].distanceTo(feet[1])<.005);
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
 checkSettingPads(rig,new THREE.Vector3(0,2.28,.17));
 for(const pose of ['ready','toss'])for(const mirror of [false,true]){
  const target={x:.03,y:pose==='ready'?1.72:2.15,z:pose==='ready'?.6:.36};
  rig.update({poseRole:'server',pose,poseScale:1,mirror,position:{x:0,y:0,z:0},facing:[0,1],contactTarget:target});rig.parent.updateMatrixWorld(true);
  near(world(part(rig,mirror?'right-palm':'left-palm')).distanceTo(new THREE.Vector3(target.x,target.y,target.z)),.12);
 }
});

test('the platform, overhead set and serving hands release the ball continuously on replay and scrub',()=>{
 const rig=fixture();
 for(const [poseRole,previousPose,pose,target] of [
  ['passer','contact','follow',{x:-.48,y:1.05,z:.23}],
  ['setter','contact','backfollow',{x:.04,y:2.14,z:.16}],
  ['server','contact','follow',{x:.12,y:2.20,z:.26}],
  ['server','toss','draw',{x:.03,y:2.16,z:.36}],
 ])for(const mirror of [false,true]){
  const actor={poseRole,position:{x:0,y:0,z:0},facing:[0,1],poseScale:1,mirror,contactTarget:target};
  const update=(phase,from,blend)=>rig.update({...actor,pose:phase,previousPose:from,poseBlend:blend});
  update(previousPose,previousPose,1);
  const contact=matrices(rig);
  const initialHands=['left','right'].map(side=>world(part(rig,side+'-palm')));
  const contactCenter=poseRole==='server'?initialHands[Number((previousPose==='contact')!==mirror)]:
   initialHands[0].clone().lerp(initialHands[1],.5);
  const ball=new THREE.Vector3(target.x,target.y,target.z);
  if(poseRole==='setter')checkSettingPads(rig,ball);
  else near(contactCenter.distanceTo(ball),.12);
  update(pose,previousPose,0);
  assert.deepEqual(matrices(rig),contact);
  update(pose,previousPose,.0001);
  for(const [n,side] of ['left','right'].entries())assert.ok(world(part(rig,side+'-palm')).distanceTo(initialHands[n])<.001);
  update(pose,previousPose,.53);
  const partial=matrices(rig);
  update(pose,previousPose,1);
  const released=matrices(rig);
  rig.update({...actor,pose,contactTarget:undefined});
  assert.deepEqual(matrices(rig),released);
  update(pose,previousPose,.53);
  assert.deepEqual(matrices(rig),partial);
 }
});

test('procedural passers, setters and servers use world-space plant locations through a change of facing',()=>{
 const rig=fixture(),feet=[[-.19,0,.16,-.15],[.23,.085,.06,.25]],scale=.9;
 for(const poseRole of ['passer','setter','server'])for(const x of [0,.09]){
  const position={x,y:0,z:0};
  rig.parent.position.set(x,0,0);
  rig.update({poseRole,pose:'contact',poseScale:scale,position,feet,feetWeight:1,facing:[x*2,1]});
  rig.parent.updateMatrixWorld(true);
  for(const [n,side] of ['left','right'].entries()){
   const [footX,lift,footZ,heading]=feet[n],shoe=part(rig,side+'-foot');
   near(world(shoe).distanceTo(new THREE.Vector3(footX,.055*scale+lift,footZ)),0);
   const forward=new THREE.Vector3(0,0,1).transformDirection(shoe.matrixWorld);
   near(forward.distanceTo(new THREE.Vector3(Math.sin(heading),0,Math.cos(heading))),0);
  }
 }
});

test('a grounded attacker keeps the support shoe in place while the travel clip fades',()=>{
 const rig=fixture(),feet=[[-.18,0,.12,0],[.20,0,-.08,0]];
 for(const weight of [1,.5,0]){
  const x=.08*(1-weight);
  rig.parent.position.x=x;
  rig.update({poseRole:'attacker',pose:'ready',position:{x,y:0,z:0},facing:[0,1],
   feet,feetWeight:weight,plantedStance:true});
  const support=world(part(rig,'left-foot'));
  near(support.x,feet[0][0]);
  near(support.z,feet[0][2]);
 }
});

test('the run uses the foot ahead to swing the opposite arm without a second animation clock',()=>{
 const rig=fixture();
 for(const leadingFoot of [0,1]){
  const feet=[0,1].map(n=>[n===0?-.15:.15,0,n===leadingFoot?.3:-.3,0]);
  rig.update({poseRole:'attacker',pose:'approach',facing:[0,1],position:{x:0,y:0,z:0},feet});
  const reaching=part(rig,(leadingFoot===0?'right':'left')+'-palm').position.z;
  const trailing=part(rig,(leadingFoot===0?'left':'right')+'-palm').position.z;
  assert.ok(reaching-trailing>.3);
 }
});

test('serve, reception and set in all six rotations put the designated hand or platform on the ball',()=>{
 const rig=fixture();
 for(const serve of ['Float','Topspin'])for(let rotation=0;rotation<6;rotation++){
  const options={system:'5-1',rotation,serve,bases:[...receptionFormation('5-1',rotation),[1.7,0,-10.44]]};
  const timing=sampleReception(0,options);
  for(const [slot,progress] of [[6,timing.serveContact],[timing.receiver,timing.receiveContact],[0,1]]){
   const frame=sampleReception(progress,options),actor=frame.actors[slot],[x,y,z]=actor.position;
   const [ballX,ballY,ballZ]=frame.ball,server=slot===6;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:actor.role,mirror:server,poseScale:server?1:.9,position:{x,y,z},
    facing:[actor.facing[0]-x,actor.facing[1]-z],contactTarget:{x:ballX,y:ballY,z:ballZ}});
   rig.parent.updateMatrixWorld(true);
   const hand=world(part(rig,'left-palm'));
   if(!server)hand.lerp(world(part(rig,'right-palm')),.5);
   const ball=new THREE.Vector3(ballX,ballY,ballZ);
   if(slot===0)checkSettingPads(rig,ball);
   else near(hand.distanceTo(ball),.12);
  }
 }
});
test('the Blender block approach keeps the rendered knee bent through the long crossing',()=>{
 const rig=fixture(), options={blockers:2,layers:{pass:true,attack:true,block:true}};
 for(const preset of ['4','5']){
  const slot=2, config={...options,preset};
  let strongestTurn=0;
  let runningDip=0,plantDip=0;
  for(let i=0;i<=160;i++){
   const actor=sampleAttack(i/160,config).actors[slot];
   if(!actor.feet||actor.feetWeight!==1)continue;
   const [x,y,z]=actor.position;
   rig.parent.position.set(x,y,z);
   rig.update({...actor,poseRole:'blocker',position:{x,y,z}});
   const dip=.92-part(rig,'pelvis').position.y;
   // The hips already begin accepting the plant on the penultimate shoe.
   if(actor.blockFrame<=26)runningDip=Math.max(runningDip,dip);
   if(actor.blockFrame>=32)plantDip=Math.max(plantDip,dip);
   if(Math.abs(rig.group.rotation.y)>Math.abs(strongestTurn))strongestTurn=rig.group.rotation.y;
   for(const side of ['left','right']){
    const hip=part(rig,side+'-hip').position,knee=part(rig,side+'-knee').position,ankle=part(rig,side+'-ankle').position;
    near(hip.distanceTo(knee),.46,1e-5);
    near(knee.distanceTo(ankle),.46,1e-5);
   }
  }
  assert.ok((preset==='4'?-strongestTurn:strongestTurn)>Math.PI/4);
  assert.ok(plantDip>runningDip+.1,`running dip ${runningDip}, plant dip ${plantDip}`);
 }
});
