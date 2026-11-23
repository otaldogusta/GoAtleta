import {createActorAnatomy} from './actor-anatomy.mjs?v=blocker-closing-plant-20261122';
import {blockerRunYaw,updateBlockerAnatomy} from './blocker-rig.mjs?v=blocker-closing-plant-20261122';
import {createCapturedAttacker} from './captured-attacker-rig.mjs?v=attack-knee-20261122';
import {createReceptionRunner} from './reception-run-rig.mjs?v=cmu-p1-20261123';

// Joint positions are local metres, facing +Z. These are pose shapes, not a
// second motion clock: the host supplies pose, blend, facing, position and jump.
const pose=(crouch,lean,stride,stance,left,right)=>new Float64Array([crouch,lean,stride,stance,...left,...right]);
const relaxed=pose(.02,0,0,0,[-.25,1.15,.035,-.23,.94,.10,2.9],[.25,1.15,.035,.23,.94,.10,2.9]);
const poses={
 setter:{
  ready:relaxed,
  load:pose(.23,.065,.045,.055,[-.32,1.26,.16,-.13,1.59,.26,.55],[.32,1.26,.16,.13,1.59,.26,.55]),
  rise:pose(.105,.035,.035,.035,[-.30,1.52,.15,-.11,1.91,.22,.36],[.30,1.52,.15,.11,1.91,.22,.36]),
  contact:pose(0,0,0,0,[-.22,1.80,.11,-.085,2.165,.17,.2],[.22,1.80,.11,.085,2.165,.17,.2]),
  follow:pose(.045,.065,.035,.030,[-.23,1.77,.21,-.11,2.08,.39,.72],[.23,1.77,.21,.11,2.08,.39,.72]),
  backfollow:pose(.045,-.055,.035,.030,[-.24,1.79,-.07,-.11,2.09,-.26,-.59],[.24,1.79,-.07,.11,2.09,-.26,-.59]),
 },
 passer:{
  ready:pose(.22,.10,.05,.10,[-.29,1.03,.22,-.19,.86,.42,2.3],[.29,1.03,.22,.19,.86,.42,2.3]),
  load:pose(.34,.16,.075,.12,[-.22,.91,.32,-.08,.73,.57,2.02],[.22,.91,.32,.08,.73,.57,2.02]),
  contact:pose(.30,.145,.075,.12,[-.14,.94,.405,-.055,.78,.67,1.90],[.14,.94,.405,.055,.78,.67,1.90]),
  follow:pose(.19,.115,.07,.11,[-.145,1.06,.42,-.055,1.005,.735,1.77],[.145,1.06,.42,.055,1.005,.735,1.77]),
 },
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
 server:{
  ready:pose(.045,.015,.10,.03,[-.21,1.25,.26,-.08,1.62,.58,1.2],[.25,1.18,.10,.23,.97,.22,2.9]),
  toss:pose(.055,.01,.11,.03,[-.22,1.69,.17,-.09,2.06,.35,.14],[.31,1.49,-.10,.28,1.72,-.22,-.24]),
  draw:pose(.10,-.055,.13,.045,[-.23,1.52,.23,-.15,1.87,.37,.27],[.40,1.39,-.19,.28,1.75,-.28,-.19]),
  contact:pose(.015,.045,.10,.025,[-.25,1.35,.18,-.28,1.17,.32,2.55],[.24,1.79,.14,.13,2.145,.34,.12]),
  follow:pose(.11,.12,.11,.045,[-.27,1.17,.11,-.29,.98,.23,2.70],[.18,1.40,.34,-.14,1.12,.51,2.17]),
  idle:relaxed,
 },
};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>value*value*(3-2*value);
function tracksBall(role,stage,arm){
 if(stage==='contact')return role==='setter'||role==='passer'||arm===1;
 return role==='server'&&arm===0&&(stage==='ready'||stage==='toss');
}

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
 let lastContactX,lastContactY,lastContactZ,lastContactWeight,lastFeet;
 const feet=[new Float64Array(4),new Float64Array(4)];
 let capturedAttack,capturedRun;
 function update(actor={}){
  const role=actor.poseRole==='blocker'?'blocker':Object.hasOwn(poses,actor.poseRole)?actor.poseRole:'setter';
  const jump=Math.max(0,finite(actor.jump));
  if(role==='blocker'){
   const crouch=bounded(finite(actor.crouch),0,.4),extension=bounded(finite(actor.extension,actor.pose==='contact'?1:0),0,1),angle=finite(actor.handAngle);
   const anchors=actor.position&&actor.feet?.length===2?actor.feet:null, weight=anchors?bounded(finite(actor.feetWeight,1),0,1):0;
   const clipFrame=actor.blockFrame,clipMirror=actor.blockMirror===true;
   if(!weight&&!blockerPose.feetWeight&&lastRole===role&&lastJump===jump&&lastCrouch===crouch&&lastExtension===extension&&lastAngle===angle&&blockerPose.clipFrame===clipFrame&&blockerPose.clipMirror===clipMirror)return;
   if(weight){
    const yaw=angle*Math.PI/180+blockerRunYaw(clipFrame,clipMirror),c=Math.cos(yaw),s=Math.sin(yaw);
    for(let n=0;n<2;n++){
     const [x,lift,z,heading]=anchors[1-n],dx=x-actor.position.x,dz=z-actor.position.z;
     feet[n][0]=(dx*c-dz*s)/.95;feet[n][1]=lift/.95;
     feet[n][2]=(dx*s+dz*c)/.95;feet[n][3]=heading-yaw;
    }
   }
   blockerPose.jump=jump;blockerPose.crouch=crouch;blockerPose.extension=extension;blockerPose.handAngle=angle;
   blockerPose.feet=weight?feet:null;blockerPose.feetWeight=weight;
   blockerPose.clipFrame=clipFrame;blockerPose.clipMirror=clipMirror;
   updateBlockerAnatomy(anatomy,blockerPose);
   lastRole=role;lastJump=jump;lastCrouch=crouch;lastExtension=extension;lastAngle=angle;return;
  }
  const choices=poses[role],name=Object.hasOwn(choices,actor.pose)?actor.pose:'ready';
  const previous=Object.hasOwn(choices,actor.previousPose)?actor.previousPose:name;
  const blend=bounded(finite(actor.poseBlend,1),0,1),mirror=actor.mirror===true;
  const scale=bounded(finite(actor.poseScale,.95),.5,1.5),fx=finite(actor.facing?.[0]),fz=finite(actor.facing?.[1],1);
  const yaw=Math.hypot(fx,fz)>1e-8?Math.atan2(fx,fz):0;
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
    &&lastContactX===contactX&&lastContactY===contactY&&lastContactZ===contactZ&&lastContactWeight===contactWeight)return;
  const target=choices[name],origin=choices[previous];
  if(blend===1)shape.set(target);
  else for(let i=0;i<shape.length;i++)shape[i]=origin[i]+(target[i]-origin[i])*blend;
  const sign=mirror?-1:1;
  const run=role==='attacker'&&name==='approach';
  const stepping=run&&!planted&&previous===name&&blend>0&&blend<1;
  const angle=blend*2*Math.PI;
  const swing=stepping?Math.cos(angle):1;
  const feetWeight=bounded(finite(actor.feetWeight,1),0,1);
  const stride=planted?(feet[1][2]-feet[0][2])*sign:0;
  const counterSwing=planted?bounded(.5+stride,0,1)*feetWeight:(1-swing)/2;
  const stepLift=stepping?-.155*Math.sin(angle)*sign:0;
  const readyWeight=Number(previous==='ready')*(1-blend)+Number(name==='ready')*blend;
  const shuffleSwing=planted&&(role==='passer'||role==='setter')?
   bounded(stride+(feet[1][1]-feet[0][1])*sign,-1,1)*readyWeight*feetWeight:0;
  if(planted){
   // Rise out of the receiving stance while travelling. Blend back into
   // the action's own stance as the feet settle, especially for a pass.
   const travelWeight=readyWeight*feetWeight;
   shape[0]-=Math.max(0,shape[0]-.045)*travelWeight;
   shape[1]-=Math.max(0,shape[1]-.06)*travelWeight;
   for(let n=0;n<2;n++){
    const [x,lift,z]=feet[n],span=Math.hypot(x-(n?1:-1)*.095,z-.065);
    const maxHeight=Math.sqrt(Math.max(.20,.94**2-span**2));
    shape[0]=Math.max(shape[0],(.825-lift-maxHeight)*feetWeight);
   }
  }
  anatomy.updateBody(shape[0],jump,yaw,scale,shape[1],shape[2]*swing*sign,shape[3],stepLift,planted?feet:null,feetWeight);
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
   // During a receiving shuffle the hands stay in front of the chest. A
   // smaller counter-swing follows the stance and fades as the platform sets.
   const freeArm=(sideIndex===0?1:-1)*shuffleSwing;
   arm[2]+=.055*freeArm;arm[5]+=.10*freeArm;
   arm[0]*=sign;arm[3]*=sign;
   let handYaw=0;
   const paired=role==='passer'||role==='setter';
   // Fade each hand independently: the tossing hand releases before the
   // hitting hand engages, and the passing platform lingers into its follow.
   const priorTrack=Number(tracksBall(role,previous,sideIndex));
   const nextTrack=Number(tracksBall(role,name,sideIndex));
   const track=priorTrack+(nextTrack-priorTrack)*blend;
   if(contactX!==undefined&&contactWeight*track>0){
    const shoulderX=paired?0:(n?1:-1)*.18,shoulderY=1.43-shape[0],shoulderZ=.025+shape[1];
    const vx=contactX-shoulderX,vy=contactY-shoulderY,vz=contactZ-shoulderZ,distance=Math.hypot(vx,vy,vz),metres=distance*scale;
    const reach=.859*scale+.12;
    const weight=contactWeight*track*(1-smooth(bounded((metres-reach)/.35,0,1)));
    if(weight>0&&distance>1e-7){
     const radius=.12/(scale*distance),side=n?1:-1;
     // For a ball straight overhead, retain the arm ordering and the fingers'
     // forward direction. A tiny passage behind the head must not turn them 180°.
     const bearing=Math.atan2(vx,Math.max(.12,vz));
     const pairedYaw=bearing*(role==='setter'?.32:.72);
     const spread=paired?side*.055:0,tangentX=Math.cos(pairedYaw),tangentZ=-Math.sin(pairedYaw);
     arm[3]+=(contactX-vx*radius+spread*tangentX-arm[3])*weight;
     arm[4]+=(contactY-vy*radius-arm[4])*weight;
     arm[5]+=(contactZ-vz*radius+spread*tangentZ-arm[5])*weight;
     fitElbow(arm,side*.18,shoulderY,shoulderZ,weight,role==='attacker'?0:side);
     handYaw=(paired?pairedYaw:bearing)*weight;
    }
   }
   anatomy.setArm(n,arm[0],arm[1],arm[2],arm[3],arm[4],arm[5],pitch,0,.15,handYaw);
  }
  if(planted&&Number.isFinite(actor.runCycle)&&actor.runCycle>=0&&actor.runCycle<2){
   capturedRun??=createReceptionRunner(anatomy);
   capturedRun(actor.runCycle,feetWeight,feet);
  }
  anatomy.measureHeight();
  lastRole=role;lastPose=name;lastPrevious=previous;lastBlend=blend;lastMirror=mirror;lastJump=jump;lastScale=scale;
  lastContactX=contactX;lastContactY=contactY;lastContactZ=contactZ;lastContactWeight=contactWeight;
  lastFeet=planted;
 }
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
