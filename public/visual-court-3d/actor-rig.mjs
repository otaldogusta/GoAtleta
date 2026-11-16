import {createActorAnatomy} from './actor-anatomy.mjs';
import {updateBlockerAnatomy} from './blocker-rig.mjs';

// Joint positions are local metres, facing +Z. These are pose shapes, not a
// second motion clock: the host supplies pose, blend, facing, position and jump.
const pose=(crouch,lean,stride,stance,left,right)=>new Float64Array([crouch,lean,stride,stance,...left,...right]);
const relaxed=pose(.02,0,0,0,[-.25,1.15,.035,-.23,.94,.10,2.9],[.25,1.15,.035,.23,.94,.10,2.9]);
const poses={
 setter:{
  ready:relaxed,
  load:pose(.22,.07,0,.03,[-.28,1.30,.10,-.12,1.60,.18,.25],[.28,1.30,.10,.12,1.60,.18,.25]),
  rise:pose(.08,.03,0,.01,[-.24,1.56,.10,-.10,1.92,.15,.2],[.24,1.56,.10,.10,1.92,.15,.2]),
  contact:pose(0,0,0,0,[-.22,1.80,.11,-.085,2.165,.17,.2],[.22,1.80,.11,.085,2.165,.17,.2]),
  follow:pose(0,.02,0,0,[-.20,1.86,.17,-.085,2.195,.27,.35],[.20,1.86,.17,.085,2.195,.27,.35]),
  backfollow:pose(0,-.06,0,0,[-.22,1.86,-.11,-.085,2.20,-.23,-.35],[.22,1.86,-.11,.085,2.20,-.23,-.35]),
 },
 passer:{
  ready:pose(.22,.10,0,.08,[-.28,1.09,.17,-.17,.90,.32,2.4],[.28,1.09,.17,.17,.90,.32,2.4]),
  load:pose(.34,.14,0,.10,[-.25,.99,.22,-.10,.82,.50,2.1],[.25,.99,.22,.10,.82,.50,2.1]),
  contact:pose(.40,.18,0,.11,[-.17,.94,.32,-.055,.78,.67,1.9],[.17,.94,.32,.055,.78,.67,1.9]),
  follow:pose(.18,.10,0,.08,[-.18,1.18,.35,-.055,1.15,.72,1.6],[.18,1.18,.35,.055,1.15,.72,1.6]),
 },
 attacker:{
  ready:relaxed,
  approach:pose(.10,.04,.17,.01,[-.24,1.28,.18,-.19,1.13,.32,2.5],[.27,1.14,-.12,.27,1.00,-.26,2.9]),
  plant:pose(.28,.12,.03,.03,[-.25,1.00,-.15,-.28,.82,-.36,2.9],[.25,1.00,-.15,.28,.82,-.36,2.9]),
  draw:pose(0,-.04,.04,0,[-.25,1.65,.15,-.22,1.92,.30,.1],[.32,1.67,-.12,.22,1.88,-.24,-.15]),
  contact:pose(0,.03,0,0,[-.26,1.36,.15,-.32,1.18,.35,2.6],[.20,1.89,.08,.13,2.255,.18,.05]),
  follow:pose(.10,.14,.08,.01,[-.28,1.13,.10,-.31,.96,.22,2.8],[.14,1.35,.30,-.12,1.02,.54,2.1]),
  land:pose(.30,.10,.07,.04,[-.27,1.01,.17,-.20,.84,.31,2.5],[.27,1.01,.17,.20,.84,.31,2.5]),
 },
 server:{
  ready:pose(0,0,.04,.01,[-.21,1.25,.26,-.08,1.62,.58,1.2],[.25,1.18,.10,.23,.97,.22,2.9]),
  toss:pose(0,.01,.05,.01,[-.21,1.72,.16,-.09,2.065,.35,.1],[.30,1.65,-.12,.22,1.86,-.24,-.15]),
  draw:pose(0,-.04,.06,.01,[-.24,1.44,.20,-.16,1.78,.38,.2],[.32,1.65,-.12,.25,1.85,-.26,-.15]),
  contact:pose(0,.04,.04,.01,[-.25,1.34,.20,-.30,1.17,.35,2.6],[.23,1.81,.15,.13,2.145,.34,.05]),
  follow:pose(.08,.12,.09,.01,[-.27,1.16,.12,-.30,.96,.26,2.7],[.15,1.34,.32,-.10,1.03,.57,2.1]),
  idle:relaxed,
 },
};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>value*value*(3-2*value);

// Keep both arm segments connected and within a human reach. The bend plane
// follows the authored pose, so approaching a contact does not flip an elbow.
function fitElbow(arm,sx,sy,sz,weight){
 let vx=arm[3]-sx,vy=arm[4]-sy,vz=arm[5]-sz,distance=Math.hypot(vx,vy,vz);
 if(distance<1e-7){vz=.01;distance=.01;arm[5]=sz+.01;}
 if(distance>.859){const ratio=.859/distance;vx*=ratio;vy*=ratio;vz*=ratio;distance=.859;arm[3]=sx+vx;arm[4]=sy+vy;arm[5]=sz+vz;}
 let px=arm[0]-sx,py=arm[1]-sy,pz=arm[2]-sz;
 const projection=(px*vx+py*vy+pz*vz)/(distance*distance);px-=projection*vx;py-=projection*vy;pz-=projection*vz;
 let length=Math.hypot(px,py,pz);
 if(length<1e-7){px=-vz;py=0;pz=vx;length=Math.hypot(px,pz);if(length<1e-7){px=1;length=1;}}
 const height=Math.sqrt(Math.max(0,.43*.43-distance*distance/4))/length;
 arm[0]+=(sx+vx/2+px*height-arm[0])*weight;arm[1]+=(sy+vy/2+py*height-arm[1])*weight;arm[2]+=(sz+vz/2+pz*height-arm[2])*weight;
}

/** A complete 3D player. World position/elevation and contact shadow stay outside. */
export function createActorRig(parent){
 const anatomy=createActorAnatomy(parent),shape=new Float64Array(18),arm=new Float64Array(6),blockerPose={jump:0,crouch:0,extension:0,handAngle:0};
 let lastRole,lastPose,lastPrevious,lastBlend,lastMirror,lastJump,lastScale,lastCrouch,lastExtension,lastAngle;
 let lastContactX,lastContactY,lastContactZ,lastContactWeight;
 function update(actor={}){
  const role=actor.poseRole==='blocker'?'blocker':Object.hasOwn(poses,actor.poseRole)?actor.poseRole:'setter';
  const jump=Math.max(0,finite(actor.jump));
  if(role==='blocker'){
   const crouch=bounded(finite(actor.crouch),0,.4),extension=bounded(finite(actor.extension,actor.pose==='contact'?1:0),0,1),angle=finite(actor.handAngle);
   if(lastRole===role&&lastJump===jump&&lastCrouch===crouch&&lastExtension===extension&&lastAngle===angle)return;
   blockerPose.jump=jump;blockerPose.crouch=crouch;blockerPose.extension=extension;blockerPose.handAngle=angle;
   updateBlockerAnatomy(anatomy,blockerPose);
   lastRole=role;lastJump=jump;lastCrouch=crouch;lastExtension=extension;lastAngle=angle;return;
  }
  const choices=poses[role],name=Object.hasOwn(choices,actor.pose)?actor.pose:'ready';
  const previous=Object.hasOwn(choices,actor.previousPose)?actor.previousPose:name;
  const blend=bounded(finite(actor.poseBlend,1),0,1),mirror=actor.mirror===true;
  const scale=bounded(finite(actor.poseScale,.95),.5,1.5),fx=finite(actor.facing?.[0]),fz=finite(actor.facing?.[1],1);
  const yaw=Math.hypot(fx,fz)>1e-8?Math.atan2(fx,fz):0;
  const contact=actor.contactTarget,position=actor.position;
  let contactX,contactY,contactZ;
  const contactWeight=bounded(finite(actor.contactWeight,1),0,1)*(name==='contact'&&previous!==name?blend:1);
  if((name==='contact'||role==='server'&&(name==='ready'||name==='toss'))&&contact&&position
    &&Number.isFinite(contact.x)&&Number.isFinite(contact.y)&&Number.isFinite(contact.z)&&Number.isFinite(position.x)&&Number.isFinite(position.y)&&Number.isFinite(position.z)){
   const dx=contact.x-position.x,dz=contact.z-position.z,cosine=Math.cos(yaw),sine=Math.sin(yaw);
   contactX=(dx*cosine-dz*sine)/scale;contactY=(contact.y-position.y-jump)/scale;contactZ=(dx*sine+dz*cosine)/scale;
  }
  anatomy.group.rotation.y=yaw;
  if(lastRole===role&&lastPose===name&&lastPrevious===previous&&lastBlend===blend&&lastMirror===mirror&&lastJump===jump&&lastScale===scale
    &&lastContactX===contactX&&lastContactY===contactY&&lastContactZ===contactZ&&lastContactWeight===contactWeight)return;
  const target=choices[name],origin=choices[previous];
  for(let i=0;i<shape.length;i++)shape[i]=origin[i]+(target[i]-origin[i])*blend;
  anatomy.updateBody(shape[0],jump,yaw,scale,shape[1],shape[2]*(mirror?-1:1),shape[3]);
  for(let n=0;n<2;n++){
   const offset=4+(mirror?1-n:n)*7,sign=mirror?-1:1;
   arm[0]=shape[offset]*sign;arm[1]=shape[offset+1];arm[2]=shape[offset+2];arm[3]=shape[offset+3]*sign;arm[4]=shape[offset+4];arm[5]=shape[offset+5];
   let handYaw=0;
   const paired=role==='passer'||role==='setter',targetArm=role==='server'&&(name==='ready'||name==='toss')?(mirror?1:0):(mirror?0:1);
   if(contactX!==undefined&&contactWeight>0&&(paired||n===targetArm)){
    const shoulderX=paired?0:(n?1:-1)*.18,shoulderY=1.43-shape[0],shoulderZ=.025+shape[1];
    const vx=contactX-shoulderX,vy=contactY-shoulderY,vz=contactZ-shoulderZ,distance=Math.hypot(vx,vy,vz),metres=distance*scale;
    const weight=contactWeight*(1-smooth(bounded((metres-.9)/.35,0,1)));
    if(weight>0&&distance>1e-7){
     const radius=.12/(scale*distance),horizontal=Math.hypot(vx,vz),side=n?1:-1;
     const spread=paired?side*.055:0,tangentX=horizontal>1e-7?vz/horizontal:1,tangentZ=horizontal>1e-7?-vx/horizontal:0;
     arm[3]+=(contactX-vx*radius+spread*tangentX-arm[3])*weight;
     arm[4]+=(contactY-vy*radius-arm[4])*weight;
     arm[5]+=(contactZ-vz*radius+spread*tangentZ-arm[5])*weight;
     fitElbow(arm,side*.18,shoulderY,shoulderZ,weight);handYaw=Math.atan2(vx,vz)*weight;
    }
   }
   anatomy.setArm(n,arm[0],arm[1],arm[2],arm[3],arm[4],arm[5],shape[offset+6],0,.15,handYaw);
  }
  anatomy.measureHeight();
  lastRole=role;lastPose=name;lastPrevious=previous;lastBlend=blend;lastMirror=mirror;lastJump=jump;lastScale=scale;
  lastContactX=contactX;lastContactY=contactY;lastContactZ=contactZ;lastContactWeight=contactWeight;
 }
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
