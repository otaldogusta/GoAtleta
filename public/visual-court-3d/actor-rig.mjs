import {createActorAnatomy} from './actor-anatomy.mjs?v=p1-running-stride-20261123';
import {blockerRunYaw,updateBlockerAnatomy} from './blocker-rig.mjs?v=authored-travel-20261123';
import {createCapturedAttacker} from './captured-attacker-rig.mjs?v=attack-knee-20261122';
import {createReceptionRunner} from './reception-run-rig.mjs?v=court-running-stride-20261123';
import {createSkillMotionRig} from './skill-motion-rig.mjs?v=reception-attack-ready-20261123';

// Joint positions are local metres, facing +Z. These are pose shapes, not a
// second motion clock: the host supplies pose, blend, facing, position and jump.
const pose=(crouch,lean,stride,stance,left,right)=>new Float64Array([crouch,lean,stride,stance,...left,...right]);
const relaxed=pose(.02,0,0,0,[-.25,1.15,.035,-.23,.94,.10,2.9],[.25,1.15,.035,.23,.94,.10,2.9]);
const poses={
 setter:{ready:1,load:1,rise:1,contact:1,follow:1,backfollow:1},
 passer:{ready:1,load:1,contact:1,follow:1},
 attacker:{
  ready:relaxed,
  approach:pose(.035,.075,.31,.015,[-.23,1.15,-.11,-.21,1.01,-.29,2.9],[.25,1.23,.24,.20,1.16,.48,2.2]),
  plant:pose(.30,.17,.135,.06,[-.23,.98,-.23,-.27,.82,-.49,2.8],[.23,.98,-.25,.27,.83,-.51,2.8]),
  launch:pose(.03,.03,.035,.035,[-.25,1.62,.17,-.17,1.99,.27,.28],[.25,1.62,.17,.17,1.99,.27,.28]),
  draw:pose(.015,-.07,.065,.01,[-.26,1.65,.23,-.15,2.02,.40,.21],[.38,1.66,-.17,.26,1.93,-.30,-.32]),
  contact:pose(0,.03,0,0,[-.26,1.36,.15,-.32,1.18,.35,2.6],[.20,1.89,.08,.13,2.255,.18,.05]),
  follow:pose(.08,.20,.08,.02,[-.31,1.19,.09,-.38,1.03,.21,2.8],[.13,1.39,.40,-.23,1.02,.57,2.6]),
  land:pose(.33,.16,.065,.075,[-.29,.98,.19,-.33,.81,.37,2.5],[.29,.98,.19,.33,.81,.37,2.5]),
 },
 server:{ready:1,toss:1,draw:1,contact:1,follow:1,idle:1},
};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>value*value*(3-2*value);

// Keep both arm segments connected and within a human reach. The bend plane
// follows the authored pose, so approaching a contact does not flip an elbow.
function fitElbow(arm,sx,sy,sz,weight,outward){
 let vx=arm[3]-sx,vy=arm[4]-sy,vz=arm[5]-sz,distance=Math.hypot(vx,vy,vz);
 if(distance<1e-7){vz=.01;distance=.01;arm[5]=sz+.01;}
 if(distance>.859){const ratio=.859/distance;vx*=ratio;vy*=ratio;vz*=ratio;distance=.859;arm[3]=sx+vx;arm[4]=sy+vy;arm[5]=sz+vz;}
 // The outside/rear pole keeps an elbow on its anatomical side of the
 // shoulder-to-palm line even when a lateral pass sweeps across the body.
 let px=arm[0]-sx+outward*.26,py=arm[1]-sy,pz=arm[2]-sz-Math.abs(outward)*.20;
 const projection=(px*vx+py*vy+pz*vz)/(distance*distance);px-=projection*vx;py-=projection*vy;pz-=projection*vz;
 let length=Math.hypot(px,py,pz);
 if(length<1e-7){px=-vz;py=0;pz=vx;length=Math.hypot(px,pz);if(length<1e-7){px=1;length=1;}}
 const height=Math.sqrt(Math.max(0,.43*.43-distance*distance/4))/length;
 arm[0]+=(sx+vx/2+px*height-arm[0])*weight;arm[1]+=(sy+vy/2+py*height-arm[1])*weight;arm[2]+=(sz+vz/2+pz*height-arm[2])*weight;
}

/** A complete 3D player. World position/elevation and contact shadow stay outside. */
export function createActorRig(parent){
 const anatomy=createActorAnatomy(parent),shape=new Float64Array(18),arm=new Float64Array(6),blockerPose={jump:0,crouch:0,extension:0,handAngle:0,feet:null,feetWeight:0};
 let lastRole,lastPose,lastPrevious,lastBlend,lastMirror,lastJump,lastScale,lastCrouch,lastExtension,lastAngle;
 let lastContactX,lastContactY,lastContactZ,lastContactWeight,lastFeet,lastSkill,lastProgress,lastSide;
 let lastReadiness,lastReadyLeft;
 const feet=[new Float64Array(4),new Float64Array(4)];
 let capturedAttack,capturedRun,skillRig;
 function applyTravel(actor,weight){
  const travel=actor.travelMotion;
  const cycle=travel?.phase??actor.runCycle;
  if(!Number.isFinite(cycle)||cycle<0||cycle>=2)return;
  // Give the arms and trunk to the ball gesture as contact approaches.
  // Their planted footprints are already resolved by the underlying rig.
  if(Number.isFinite(actor.skillProgress)){
   weight*=smooth(bounded((Math.abs(actor.skillProgress)-.38)/.42,0,1));
  }
  if(weight<=0)return;
  capturedRun??=createReceptionRunner(anatomy);
  capturedRun(cycle,weight,feet,travel,actor.runDrive);
 }
 function update(actor={}){
  const role=actor.poseRole==='blocker'?'blocker':Object.hasOwn(poses,actor.poseRole)?actor.poseRole:'setter';
  const jump=Math.max(0,finite(actor.jump));
  if(role==='blocker'){
   const crouch=bounded(finite(actor.crouch),0,.4),extension=bounded(finite(actor.extension,actor.pose==='contact'?1:0),0,1);
   const running=Number.isFinite(actor.runCycle)&&actor.facing;
   const angle=running?Math.atan2(actor.facing[0],actor.facing[1])*180/Math.PI:finite(actor.handAngle);
   const anchors=actor.position&&actor.feet?.length===2?actor.feet:null, weight=anchors?bounded(finite(actor.feetWeight,1),0,1):0;
   const planted=Boolean(anchors&&actor.plantedStance);
   const clipFrame=actor.blockFrame,clipMirror=actor.blockMirror===true;
   if(!weight&&!planted&&!blockerPose.feet&&lastRole===role&&lastJump===jump&&lastCrouch===crouch&&lastExtension===extension&&lastAngle===angle&&blockerPose.clipFrame===clipFrame&&blockerPose.clipMirror===clipMirror)return;
   if(weight||planted){
    const yaw=angle*Math.PI/180+blockerRunYaw(clipFrame,clipMirror),c=Math.cos(yaw),s=Math.sin(yaw);
    for(let n=0;n<2;n++){
     const [x,lift,z,heading]=anchors[1-n],dx=x-actor.position.x,dz=z-actor.position.z;
     feet[n][0]=(dx*c-dz*s)/.95;feet[n][1]=lift/.95;
     feet[n][2]=(dx*s+dz*c)/.95;feet[n][3]=heading-yaw;
    }
   }
   blockerPose.jump=jump;blockerPose.crouch=crouch;blockerPose.extension=extension;blockerPose.handAngle=angle;
   blockerPose.feet=weight||planted?feet:null;blockerPose.feetWeight=weight;blockerPose.plantedStance=planted;
   blockerPose.clipFrame=clipFrame;blockerPose.clipMirror=clipMirror;
   updateBlockerAnatomy(anatomy,blockerPose);
   if((running||actor.travelMotion)&&weight){
    applyTravel(actor,weight*(1-smooth(bounded(crouch/.16+extension,0,1))));
    anatomy.measureHeight();
   }
   lastRole=role;lastJump=jump;lastCrouch=crouch;lastExtension=extension;lastAngle=angle;return;
  }
  const choices=poses[role],name=Object.hasOwn(choices,actor.pose)?actor.pose:'ready';
  const previous=Object.hasOwn(choices,actor.previousPose)?actor.previousPose:name;
  const blend=bounded(finite(actor.poseBlend,1),0,1),mirror=actor.mirror===true;
  const scale=bounded(finite(actor.poseScale,.95),.5,1.5),fx=finite(actor.facing?.[0]),fz=finite(actor.facing?.[1],1);
  const yaw=Math.hypot(fx,fz)>1e-8?Math.atan2(fx,fz):0;
  const readiness=bounded(finite(actor.attackReadiness),0,1);
  const contact=actor.contactTarget,position=actor.position;
  const planted=Boolean(position&&actor.feet?.length===2);
  if(planted){
   const cosine=Math.cos(yaw),sine=Math.sin(yaw);
   for(let n=0;n<2;n++){
    const [x,lift,z,footYaw]=actor.feet[n],dx=x-position.x,dz=z-position.z;
    feet[n][0]=(dx*cosine-dz*sine)/scale;
    feet[n][1]=lift/scale;
    feet[n][2]=(dx*sine+dz*cosine)/scale;
    feet[n][3]=Math.atan2(Math.sin(footYaw-yaw),Math.cos(footYaw-yaw));
   }
  }
  if(role==='attacker' && Number.isFinite(actor.attackFrame)){
   capturedAttack??=createCapturedAttacker(anatomy);
   capturedAttack(actor,yaw,scale,jump,planted?feet:null);
   lastRole='captured-attack';return;
  }
  let contactX,contactY,contactZ;
  const contactWeight=bounded(finite(actor.contactWeight,1),0,1);
  if(contact&&position
    &&Number.isFinite(contact.x)&&Number.isFinite(contact.y)&&Number.isFinite(contact.z)&&Number.isFinite(position.x)&&Number.isFinite(position.y)&&Number.isFinite(position.z)){
   const dx=contact.x-position.x,dz=contact.z-position.z,cosine=Math.cos(yaw),sine=Math.sin(yaw);
   contactX=(dx*cosine-dz*sine)/scale;contactY=(contact.y-position.y-jump)/scale;contactZ=(dx*sine+dz*cosine)/scale;
  }
  anatomy.group.rotation.y=yaw;
  if(!planted&&!lastFeet&&lastRole===role&&lastPose===name&&lastPrevious===previous&&lastBlend===blend&&lastMirror===mirror&&lastJump===jump&&lastScale===scale
    &&lastContactX===contactX&&lastContactY===contactY&&lastContactZ===contactZ&&lastContactWeight===contactWeight
    &&lastSkill===actor.skillMotion&&lastProgress===actor.skillProgress&&lastSide===actor.skillSide
    &&lastReadiness===readiness&&lastReadyLeft===actor.attackReadyLeft)return;
  lastRole=role;lastPose=name;lastPrevious=previous;lastBlend=blend;lastMirror=mirror;lastJump=jump;lastScale=scale;
  lastContactX=contactX;lastContactY=contactY;lastContactZ=contactZ;lastContactWeight=contactWeight;
  lastFeet=planted;lastSkill=actor.skillMotion;lastProgress=actor.skillProgress;lastSide=actor.skillSide;
  lastReadiness=readiness;lastReadyLeft=actor.attackReadyLeft;
  if(role!=='attacker'){
   skillRig??=createSkillMotionRig(anatomy);
   skillRig(actor,role,name,previous,blend,yaw,scale,jump,planted?feet:null,contactWeight,
    contactX===undefined?null:[contactX,contactY,contactZ],readiness);
   if(planted)applyTravel(actor,bounded(finite(actor.feetWeight,1),0,1)*(1-readiness));
   anatomy.measureHeight();
   return;
  }
  const target=choices[name],origin=choices[previous];
  if(blend===1)shape.set(target);
  else for(let i=0;i<shape.length;i++)shape[i]=origin[i]+(target[i]-origin[i])*blend;
  const sign=mirror?-1:1;
  const run=name==='approach';
  const stepping=run&&!planted&&previous===name&&blend>0&&blend<1;
  const angle=blend*2*Math.PI;
  const swing=stepping?Math.cos(angle):1;
  const feetWeight=bounded(finite(actor.feetWeight,1),0,1);
  const stride=planted?(feet[1][2]-feet[0][2])*sign:0;
  const counterSwing=planted?bounded(.5+stride,0,1)*feetWeight:(1-swing)/2;
  const stepLift=stepping?-.155*Math.sin(angle)*sign:0;
  const readyWeight=Number(previous==='ready')*(1-blend)+Number(name==='ready')*blend;
  if(planted){
   const travelWeight=readyWeight*feetWeight;
   shape[0]-=Math.max(0,shape[0]-.045)*travelWeight;
   shape[1]-=Math.max(0,shape[1]-.06)*travelWeight;
   for(let n=0;n<2;n++){
    const [x,lift,z]=feet[n],span=Math.hypot(x-(n?1:-1)*.095,z-.065);
    const maxHeight=Math.sqrt(Math.max(.20,.94**2-span**2));
    shape[0]=Math.max(shape[0],(.825-lift-maxHeight)*feetWeight);
   }
  }
  const plantWeight=planted&&actor.plantedStance?1:feetWeight;
  anatomy.updateBody(shape[0],jump,yaw,scale,shape[1],shape[2]*swing*sign,shape[3],stepLift,planted?feet:null,plantWeight);
  for(let n=0;n<2;n++){
   const sideIndex=mirror?1-n:n,offset=4+sideIndex*7;
   let pitch=shape[offset+6];
   for(let axis=0;axis<arm.length;axis++)arm[axis]=shape[offset+axis];
   if(stepping||run&&planted){
    const opposite=4+(1-sideIndex)*7;
    for(let axis=0;axis<arm.length;axis++){
     const lateral=axis===0||axis===3?-1:1;
     arm[axis]+=(lateral*shape[opposite+axis]-arm[axis])*counterSwing;
    }
    pitch+=(shape[opposite+6]-pitch)*counterSwing;
   }
   arm[0]*=sign;arm[3]*=sign;
   let handYaw=0;
   const priorTrack=Number(previous==='contact'&&sideIndex===1);
   const nextTrack=Number(name==='contact'&&sideIndex===1);
   const track=priorTrack+(nextTrack-priorTrack)*blend;
   if(contactX!==undefined&&contactWeight*track>0){
    const shoulderX=(n?1:-1)*.18,shoulderY=1.43-shape[0],shoulderZ=.025+shape[1];
    const vx=contactX-shoulderX,vy=contactY-shoulderY,vz=contactZ-shoulderZ,distance=Math.hypot(vx,vy,vz),metres=distance*scale;
    const reach=.859*scale+.12;
    const weight=contactWeight*track*(1-smooth(bounded((metres-reach)/.35,0,1)));
    if(weight>0&&distance>1e-7){
     const radius=.12/(scale*distance);
     arm[3]+=(contactX-vx*radius-arm[3])*weight;
     arm[4]+=(contactY-vy*radius-arm[4])*weight;
     arm[5]+=(contactZ-vz*radius-arm[5])*weight;
     fitElbow(arm,shoulderX,shoulderY,shoulderZ,weight,0);
     handYaw=Math.atan2(vx,Math.max(.12,vz))*weight;
    }
   }
   anatomy.setArm(n,arm[0],arm[1],arm[2],arm[3],arm[4],arm[5],pitch,0,.15,handYaw);
  }
  if(planted)applyTravel(actor,feetWeight);
  anatomy.measureHeight();
 }
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
