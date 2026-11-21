import {createActorAnatomy} from './actor-anatomy.mjs';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
/** The canonical blocker clock owns jump/hand placement; the camera never does. */
export function updateBlockerAnatomy(anatomy,pose={}){
 const jump=Math.max(0,finite(pose.jump)),crouch=Math.max(0,Math.min(.4,finite(pose.crouch))),extension=Math.max(0,Math.min(1,finite(pose.extension)));
 const shoulder=1.43-crouch;
 anatomy.updateBody(crouch,jump,finite(pose.handAngle)*Math.PI/180,.95,.36*crouch+.06*extension,0,.04+.15*crouch);
 for(let n=0;n<2;n++){
  const side=n?1:-1,elbowX=side*(.32-.14*extension),elbowY=shoulder-.14+.45*extension,elbowZ=.07+.16*extension;
  const handX=side*(.26-.06*extension),handY=shoulder+.12+.51*extension,handZ=.04+.40*extension;
  anatomy.setArm(n,elbowX,elbowY,elbowZ,handX,handY,handZ,0,-side*.08*extension,extension);
 }
 anatomy.measureHeight();
}

/** Compatibility entry point; textures and camera are intentionally unnecessary. */
export function createBlocker(parent,_textures){
 const anatomy=createActorAnatomy(parent);anatomy.group.name='blocker-body';
 const update=(pose={},_camera)=>updateBlockerAnatomy(anatomy,pose);
 update();return {group:anatomy.group,update,get height(){return anatomy.height;}};
}
