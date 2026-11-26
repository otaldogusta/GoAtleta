import {clamp,limitPoint} from './renderer-geometry.mjs';
import {CAMERA_MOTION} from './renderer-camera-motion.mjs?v=court-under-orbit-20261125';

export const pointerDragThreshold=type=>type==='touch'?8:5;
export const emptyTouchContacts=()=>({points:new Map(),pair:null,suppressed:false});

/** Once two fingers take over, no remaining finger may resume the cancelled edit. */
export function advanceTouchContacts(state,phase,id,point){
 const points=new Map(state.points);let pair=state.pair,suppressed=state.suppressed,action='none';
 if(phase==='down')points.set(id,{...point});
 else if(phase==='move'){if(!points.has(id))return {...state,action};points.set(id,{...point});}
 else points.delete(id);
 if(!suppressed&&phase==='down'&&points.size>=2){pair=[...points.keys()].slice(0,2);suppressed=true;action='begin';}
 else if(suppressed&&pair){
  if(pair.some(key=>!points.has(key))){pair=null;action='finish';}
  else if(phase==='move'&&pair.includes(id))action='update';
 }
 if(!points.size){pair=null;suppressed=false;}
 return {points,pair,suppressed,action};
}
export function cancelTouchContacts(state){return {points:new Map(state.points),pair:null,suppressed:state.points.size>0};}
export function touchPair(state){return state.pair?.map(id=>state.points.get(id))||null;}

export function orbitPointerDrag(start,pixel,current,viewport,pointerType){
 const touch=pointerType==='touch',yaw=touch?2.4/Math.max(320,viewport.width):.005,pitch=touch?1.5/Math.max(400,viewport.height):.003;
 return {azimuth:start.azimuth-(current.x-pixel.x)*yaw,elevation:clamp(start.elevation+(current.y-pixel.y)*pitch,CAMERA_MOTION.minElevation,CAMERA_MOTION.maxElevation)};
}

/** Clamp the destination, never the grab point: high/edge hits retain their initial offset. */
export function boundedObjectDrag(point,start,anchor){
 if(!anchor)return point;
 const candidate={x:anchor.x+point.x-start.x,y:anchor.y+point.y-start.y},destination=limitPoint(candidate);
 if(candidate.x===destination.x&&candidate.y===destination.y)return point;
 return {x:start.x+destination.x-anchor.x,y:start.y+destination.y-anchor.y};
}

/** The host confirms synchronously in its next local revision, independently of autosave. */
export function shouldReleaseMovePreview(pending,next){
 if(!pending)return false;
 if(pending.token!==next.token||pending.revision!==next.revision||pending.stepId!==next.frame?.stepId||pending.tool!==next.tool||next.active===false||next.disabled)return true;
 const hidden=new Set(next.frame.hide||[]);
 return pending.ids.some(id=>{
  const actor=next.frame.actors.find(item=>item.id===id),drawing=next.frame.drawings.find(item=>item.id===id),object=actor||drawing;
  return !object||object.locked||object.hidden||hidden.has(actor?'actors':'drawings');
 });
}

/** Keep zoom intention across a constrained layout; clamping only affects this frame. */
export function resizeCameraZoom(distance,previousFit,nextFit,limits,ratio=null){
 const valid=value=>Number.isFinite(value)&&value>0;
 const intention=valid(ratio)?ratio:valid(distance)&&valid(previousFit)?distance/previousFit:1;
 return {distance:clamp(intention*(valid(nextFit)?nextFit:limits.min),limits.min,limits.max),ratio:intention};
}

const midpoint=pair=>({x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});
const span=pair=>Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
function basis(azimuth,elevation){
 return {right:{x:Math.cos(azimuth),y:0,z:-Math.sin(azimuth)},up:{x:-Math.sin(azimuth)*Math.sin(elevation),y:Math.cos(elevation),z:-Math.cos(azimuth)*Math.sin(elevation)}};
}

export function panPointerDrag(camera,dx,dy,height){
 const {right,up}=basis(camera.azimuth,camera.elevation);
 const scale=2*camera.distance*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height);
 return {
  x:camera.target.x+(-dx*right.x+dy*up.x)*scale,
  y:camera.target.y+dy*up.y*scale,
  z:camera.target.z+(-dx*right.z+dy*up.z)*scale,
 };
}

/** The midpoint holds one point on the camera-facing plane through the orbit target. */
export function beginTouchCamera(pair,camera,viewport,limits){
 const center=midpoint(pair),height=Math.max(1,viewport.height),width=Math.max(1,viewport.width),scale=2*Math.tan(camera.fov*Math.PI/360)/height,{right,up}=basis(camera.azimuth,camera.elevation);
 const px=center.x-width/2,py=height/2-center.y,wpp=camera.distance*scale;
 const anchor={x:camera.target.x+(right.x*px+up.x*py)*wpp,y:camera.target.y+(right.y*px+up.y*py)*wpp,z:camera.target.z+(right.z*px+up.z*py)*wpp};
 return {distance:camera.distance,span:Math.max(16,span(pair)),center,anchor,right,up,scale,width,height,limits:{...limits}};
}
export function moveTouchCamera(start,pair){
 const center=midpoint(pair),distance=clamp(start.distance*start.span/Math.max(16,span(pair)),start.limits.min,start.limits.max),wpp=distance*start.scale;
 const px=center.x-start.width/2,py=start.height/2-center.y,{right,up,anchor}=start;
 return {distance,target:{x:anchor.x-(right.x*px+up.x*py)*wpp,y:anchor.y-(right.y*px+up.y*py)*wpp,z:anchor.z-(right.z*px+up.z*py)*wpp}};
}
