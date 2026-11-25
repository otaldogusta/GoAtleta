import {createActorAnatomy} from './actor-anatomy.mjs?v=athlete-anatomy-20261125';
import {blockClipValue,blockTorso} from './block-captured-clip.js?v=swing-block-torso';
import {Vector3} from './three.module.min.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const upperArm=.32,elbowToPalm=.33;
const reachAxis=new Vector3(),bendAxis=new Vector3();

// The palm is a ball-contact target. Let the shoulder rise and reach forward
// at extension, then solve the elbow using the recorded swing as its pole.
function placeArm(anatomy,n,ex,ey,ez,hx,hy,hz,pitch,palmTilt,fan,yaw=0){
 const shoulder=anatomy.group.getObjectByName(n?'right-shoulder':'left-shoulder').position;
 reachAxis.set(hx,hy,hz).sub(shoulder);
 const reach=reachAxis.length();
 reachAxis.multiplyScalar(1/Math.max(reach,1e-8));
 const distance=Math.min(reach,upperArm+elbowToPalm-.001);
 shoulder.addScaledVector(reachAxis,reach-distance);
 bendAxis.set(ex,ey,ez).sub(shoulder);
 bendAxis.addScaledVector(reachAxis,-bendAxis.dot(reachAxis));
 if(bendAxis.lengthSq()<1e-8){
  bendAxis.set(n?1:-1,0,0);
  bendAxis.addScaledVector(reachAxis,-bendAxis.dot(reachAxis));
 }
 const along=(upperArm**2-elbowToPalm**2+distance**2)/(2*Math.max(distance,1e-8));
 bendAxis.normalize().multiplyScalar(Math.sqrt(Math.max(0,upperArm**2-along**2)));
 bendAxis.add(shoulder).addScaledVector(reachAxis,along);
 anatomy.setArm(n,bendAxis.x,bendAxis.y,bendAxis.z,hx,hy,hz,pitch,palmTilt,fan,yaw);
}
export function blockerRunYaw(frame,mirror){
 return Number.isFinite(frame)?blockClipValue(frame,blockTorso.pelvisYaw)*(mirror?-1:1):0;
}
/** The canonical blocker clock owns jump/hand placement; the camera never does. */
export function updateBlockerAnatomy(anatomy,pose={}){
 const jump=Math.max(0,finite(pose.jump)),extension=Math.max(0,Math.min(1,finite(pose.extension)));
 const feetWeight=pose.feet&&pose.plantedStance?1:finite(pose.feetWeight);
 const frame=finite(pose.clipFrame,46),sign=pose.clipMirror?-1:1;
 const runYaw=blockerRunYaw(frame,pose.clipMirror),sin=Math.sin(runYaw),cos=Math.cos(runYaw);
 const hipDepthScale=1-Math.abs(sin);
 const blend=Math.max(0,Math.min(1,(46-frame)/5)),weight=blend*blend*(3-2*blend);
 const mix=(base,clip)=>base+(clip-base)*weight;
 let crouch=mix(Math.max(0,Math.min(.4,finite(pose.crouch))),blockClipValue(frame,blockTorso.load));
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
 // Start the captured chest vertically above the moving pelvis, then apply
 // the measured lean once. Both foot anchors remain in the pelvis frame.
 const hipZ=-.13*crouch/.26*hipDepthScale;
 const lean=mix(.36*crouch+.06*extension,hipZ-.025);
 anatomy.updateBody(crouch,jump,finite(pose.handAngle)*Math.PI/180+runYaw,.95,lean,0,.04+.15*crouch,0,pose.feet,feetWeight,hipDepthScale);
 if(weight){
  const chestYaw=sign*blockClipValue(frame,blockTorso.chestYaw)-runYaw;
  anatomy.articulateTrunk(weight*blockClipValue(frame,blockTorso.pitch),weight*chestYaw,0);
  anatomy.faceHead(weight*(sign*blockClipValue(frame,blockTorso.gazeYaw)-runYaw));
 }
 for(let n=0;n<2;n++){
  const side=n?1:-1,elbowX=side*(.32-.14*extension),elbowY=shoulder-.14+.45*extension,elbowZ=.07+.16*extension;
  const handX=side*(.26-.06*extension),handY=shoulder+.12+.51*extension,handZ=.04+.40*extension;
  if(!weight){placeArm(anatomy,n,elbowX,elbowY,elbowZ,handX,handY,handZ,0,-side*.08*extension,extension);continue;}
  const e=8+9*(pose.clipMirror?n:1-n),h=e+3,w=h+3,hip=.92-crouch,baseZ=-.13*crouch/.26*hipDepthScale;
  const vx=sign*(blockClipValue(frame,h)-blockClipValue(frame,w));
  const vy=blockClipValue(frame,h+1)-blockClipValue(frame,w+1);
  const vz=blockClipValue(frame,h+2)-blockClipValue(frame,w+2);
  const ex=sign*blockClipValue(frame,e),ez=blockClipValue(frame,e+2),hx=sign*blockClipValue(frame,h),hz=blockClipValue(frame,h+2);
  const localVX=vx*cos-vz*sin,localVZ=vx*sin+vz*cos;
  // Retarget the two recorded swing directions to this athlete. Using the raw
  // elbow positions against our moving shoulder used to shrink the upper arm
  // by a third as the torso rotated through the crossing step.
  const shoulderJoint=anatomy.group.getObjectByName(n?'right-shoulder':'left-shoulder').position;
  const upperX=ex*cos-ez*sin-shoulderJoint.x,upperY=hip+blockClipValue(frame,e+1)-shoulderJoint.y;
  const upperZ=baseZ+ex*sin+ez*cos-shoulderJoint.z;
  const upperScale=upperArm/Math.max(1e-6,Math.hypot(upperX,upperY,upperZ));
  const clipElbowX=shoulderJoint.x+upperScale*upperX,clipElbowY=shoulderJoint.y+upperScale*upperY;
  const clipElbowZ=shoulderJoint.z+upperScale*upperZ;
  const foreX=(hx-ex)*cos-(hz-ez)*sin,foreY=blockClipValue(frame,h+1)-blockClipValue(frame,e+1);
  const foreZ=(hx-ex)*sin+(hz-ez)*cos;
  const foreScale=elbowToPalm/Math.max(1e-6,Math.hypot(foreX,foreY,foreZ));
  const handLength=Math.max(1e-6,Math.hypot(localVX,vy,localVZ));
  const fingerY=mix(1,vy/handLength),fingerForward=weight*Math.hypot(localVX,localVZ)/handLength;
  placeArm(anatomy,n,mix(elbowX,clipElbowX),mix(elbowY,clipElbowY),mix(elbowZ,clipElbowZ),
   mix(handX,clipElbowX+foreX*foreScale),mix(handY,clipElbowY+foreY*foreScale),mix(handZ,clipElbowZ+foreZ*foreScale),
   Math.atan2(fingerForward,fingerY),-side*.08*extension,extension,Math.atan2(localVX,localVZ)*weight);
 }
 anatomy.measureHeight();
}

/** Compatibility entry point; textures and camera are intentionally unnecessary. */
export function createBlocker(parent,_textures){
 const anatomy=createActorAnatomy(parent);anatomy.group.name='blocker-body';
 const update=(pose={},_camera)=>updateBlockerAnatomy(anatomy,pose);
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
