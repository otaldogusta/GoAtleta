import {createActorAnatomy} from './actor-anatomy.mjs';
import {blockClipValue} from './block-captured-clip.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export function blockerRunYaw(frame,mirror){
 return Number.isFinite(frame)?blockClipValue(frame,1)*(mirror?-1:1):0;
}
/** The canonical blocker clock owns jump/hand placement; the camera never does. */
export function updateBlockerAnatomy(anatomy,pose={}){
 const jump=Math.max(0,finite(pose.jump)),extension=Math.max(0,Math.min(1,finite(pose.extension)));
 const feetWeight=finite(pose.feetWeight);
 const frame=finite(pose.clipFrame,46),sign=pose.clipMirror?-1:1;
 const runYaw=blockerRunYaw(frame,pose.clipMirror),sin=Math.sin(runYaw),cos=Math.cos(runYaw);
 const hipDepthScale=1-Math.abs(sin);
 // The moving central loads on the closing plant (frames 32–38).
 // The stationary wing still uses the shared contact pose clock.
 const plant=Math.max(0,Math.min(1,(frame-32)/6));
 let crouch=frame<46?.26*Math.sin(Math.PI*plant):Math.max(0,Math.min(.4,finite(pose.crouch)));
 // Keep knee flexion when the clip's approach is stretched to court distance.
 // Lower the pelvis instead of pulling either planted foot off its mark.
 if(pose.feet&&feetWeight){
  for(let pass=0;pass<3;pass++){
   const pelvisDepth=-.13*crouch/.26*hipDepthScale;
   for(let n=0;n<2;n++){
    const [x,lift,z,yaw]=pose.feet[n],side=n===0?-1:1;
    const span=Math.hypot(x-.065*Math.sin(yaw)-side*.095,z-.065*Math.cos(yaw)-pelvisDepth);
    const maxHeight=Math.sqrt(Math.max(.015,.919**2-span**2));
    crouch=Math.max(crouch,Math.min(.56,(.825-lift-maxHeight)*feetWeight));
   }
  }
 }
 const shoulder=1.43-crouch;
 const blend=Math.max(0,Math.min(1,(46-frame)/5)),weight=blend*blend*(3-2*blend);
 const mix=(base,clip)=>base+(clip-base)*weight;
 anatomy.updateBody(crouch,jump,finite(pose.handAngle)*Math.PI/180+runYaw,.95,.36*crouch+.06*extension,0,.04+.15*crouch,0,pose.feet,feetWeight,hipDepthScale);
 if(weight)anatomy.articulateTrunk(weight*blockClipValue(frame,0),0,0);
 for(let n=0;n<2;n++){
  const side=n?1:-1,elbowX=side*(.32-.14*extension),elbowY=shoulder-.14+.45*extension,elbowZ=.07+.16*extension;
  const handX=side*(.26-.06*extension),handY=shoulder+.12+.51*extension,handZ=.04+.40*extension;
  if(!weight){anatomy.setArm(n,elbowX,elbowY,elbowZ,handX,handY,handZ,0,-side*.08*extension,extension);continue;}
  const e=8+9*(pose.clipMirror?n:1-n),h=e+3,w=h+3,hip=.92-crouch,baseZ=-.13*crouch/.26*hipDepthScale;
  const vx=sign*(blockClipValue(frame,h)-blockClipValue(frame,w));
  const vy=blockClipValue(frame,h+1)-blockClipValue(frame,w+1);
  const vz=blockClipValue(frame,h+2)-blockClipValue(frame,w+2);
  const ex=sign*blockClipValue(frame,e),ez=blockClipValue(frame,e+2),hx=sign*blockClipValue(frame,h),hz=blockClipValue(frame,h+2);
  const localVX=vx*cos-vz*sin,localVZ=vx*sin+vz*cos;
  anatomy.setArm(n,mix(elbowX,ex*cos-ez*sin),mix(elbowY,hip+blockClipValue(frame,e+1)),mix(elbowZ,baseZ+ex*sin+ez*cos),
   mix(handX,hx*cos-hz*sin),mix(handY,hip+blockClipValue(frame,h+1)),mix(handZ,baseZ+hx*sin+hz*cos),
   weight*Math.atan2(localVZ,vy),-side*.08*extension,extension,weight*Math.atan2(localVX,Math.hypot(vy,localVZ)));
 }
 anatomy.measureHeight();
}

/** Compatibility entry point; textures and camera are intentionally unnecessary. */
export function createBlocker(parent,_textures){
 const anatomy=createActorAnatomy(parent);anatomy.group.name='blocker-body';
 const update=(pose={},_camera)=>updateBlockerAnatomy(anatomy,pose);
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
