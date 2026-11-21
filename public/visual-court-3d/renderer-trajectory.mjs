import * as THREE from './three.module.min.js';
import {clamp,isWorldPoint,curvePoints} from './renderer-geometry.mjs';

const kinds=['start','middle','end'];
const maximum=8.12,floorClearance=.025;
const validProfile=value=>value&&kinds.every(key=>Number.isFinite(value[key]));
export function resolvedTrajectoryHeights(drawing){
 if(validProfile(drawing.trajectoryHeights))return {...drawing.trajectoryHeights};
 const points=drawing.points||[],start=points[0]?.y??floorClearance,end=points.at(-1)?.y??floorClearance;
 return {start,middle:(start+end)/2,end};
}
export function trajectoryY(profile,u){
 return clamp((1-u)*profile.start+u*profile.end+4*u*(1-u)*(profile.middle-(profile.start+profile.end)/2),0,maximum);
}
function parameters(points,kind){
 if(kind==='curve')return points.map((_,index)=>index/Math.max(1,points.length-1));
 const lengths=points.map((p,index)=>index?Math.hypot(p.x-points[index-1].x,p.z-points[index-1].z):0),total=lengths.reduce((sum,length)=>sum+length,0);let travelled=0;
 return lengths.map((length,index)=>{travelled+=length;return total?travelled/total:index/Math.max(1,points.length-1);});
}
export function trajectoryProfilePoints(points,kind,profile){
 const times=parameters(points,kind);return points.map((point,index)=>({...point,y:trajectoryY(profile,times[index])}));
}
function samples(drawing,landscape){
 const source=(drawing.points||[]).filter(isWorldPoint),base=drawing.kind==='curve'?curvePoints(source,landscape,drawing.curveMode):source,times=parameters(base,drawing.kind);
 if(!validProfile(drawing.trajectoryHeights))return base.map((point,index)=>({point,u:times[index]}));
 const profile=drawing.trajectoryHeights,result=[];
 for(let i=0;i<base.length;i++){
  const a=base[Math.max(0,i-1)],b=base[i],u0=times[Math.max(0,i-1)],u1=times[i],steps=i&&drawing.kind!=='curve'?Math.max(1,Math.ceil((u1-u0)*32)):1;
  const fractions=i?Array.from({length:steps},(_,step)=>(step+1)/steps):[0];
  if(i&&u0<.5&&u1>.5){const middle=(.5-u0)/(u1-u0);if(!fractions.some(value=>Math.abs(value-middle)<1e-12))fractions.push(middle);fractions.sort((a,b)=>a-b);}
  for(const fraction of fractions){
   const u=u0+(u1-u0)*fraction;
   result.push({point:{x:a.x+(b.x-a.x)*fraction,y:Math.max(floorClearance,trajectoryY(profile,u)),z:a.z+(b.z-a.z)*fraction},u});
  }
 }
 return result;
}
export function trajectoryStroke(drawing,landscape=false){
 const stroke=samples(drawing,landscape),progress=drawing.traceProgress??1;
 if(progress<=0)return [];
 if(progress>=1)return stroke.map(item=>item.point);
 const next=stroke.findIndex(item=>item.u>progress);
 if(next<=0)return stroke.map(item=>item.point);
 const prefix=stroke.slice(0,next).map(item=>item.point),a=stroke[next-1],b=stroke[next];
 if(a.u<progress){
  const t=(progress-a.u)/(b.u-a.u);
  prefix.push({x:a.point.x+(b.point.x-a.point.x)*t,y:a.point.y+(b.point.y-a.point.y)*t,z:a.point.z+(b.point.z-a.point.z)*t});
 }
 return prefix;
}
export function trajectoryTipDirection(stroke,tracing=false){
 const end=stroke.at(-1),previous=stroke.length-2,first=tracing?0:previous;
 if(previous<0)return null;
 const direction=new THREE.Vector3();
 for(let index=previous;index>=first;index--){
  const point=stroke[index];direction.set(end.x-point.x,end.y-point.y,end.z-point.z);
  if(direction.lengthSq()>.0001)return direction.normalize();
 }
 return null;
}
export function trajectoryHandlePoint(drawing,kind,landscape=false){
 const stroke=samples(drawing,landscape);if(!stroke.length)return null;
 const at=kind==='start'?0:kind==='end'?1:.5;
 const upper=stroke.findIndex(item=>item.u>=at);if(upper<=0)return {...stroke[upper===0?0:stroke.length-1].point};
 const a=stroke[upper-1],b=stroke[upper],u=b.u>a.u?(at-a.u)/(b.u-a.u):0;
 return {x:a.point.x+(b.point.x-a.point.x)*u,y:a.point.y+(b.point.y-a.point.y)*u,z:a.point.z+(b.point.z-a.point.z)*u};
}

/** Keep 44 px controls clear of a linked ball, each other and the editor chrome. */
export function trajectoryControlLayout(handles,width,height,topInset=0,bottomInset=0,selectionActionsBounds=null){
 const left=Math.min(88,width/2),right=Math.max(left,width-28),top=Math.min(height-22,Math.max(0,topInset)+22),bottom=Math.max(top,height-Math.max(0,bottomInset)-22);
 const bounds=selectionActionsBounds,menu=bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)&&bounds.width>0&&bounds.height>0?{left:bounds.x-26,right:bounds.x+bounds.width+26,top:bounds.y-26,bottom:bounds.y+bounds.height+26}:null;
 const outsideMenu=point=>!menu||point.x<=menu.left||point.x>=menu.right||point.y<=menu.top||point.y>=menu.bottom;
 const placed=[],protectedPoints=handles.filter(item=>item.linked),offsets=[[0,0],[0,-52],[0,52],[-52,0],[52,0],[-52,-52],[52,-52],[-52,52],[52,52],[-104,0],[104,0]];
 for(const handle of handles){
  const base=handle.preferred||handle,candidates=offsets.map(([dx,dy])=>({x:base.x+dx,y:base.y+dy}));
  if(menu)candidates.push({x:menu.left,y:base.y},{x:menu.right,y:base.y},{x:base.x,y:menu.top},{x:base.x,y:menu.bottom});
  const limited=candidates.map(point=>({x:clamp(point.x,left,right),y:clamp(point.y,top,bottom)})).sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y));
  const clear=limited.filter(outsideMenu),available=clear.length?clear:limited;
  const separation=point=>Math.min(Infinity,...placed.map(other=>Math.hypot(point.x-other.x,point.y-other.y)),...protectedPoints.map(other=>Math.hypot(point.x-other.x,point.y-other.y)));
  const chosen=available.find(point=>separation(point)>=48)||available.reduce((best,point)=>separation(point)>separation(best)?point:best,available[0]);
  placed.push({...handle,...chosen,tether:Math.hypot(chosen.x-handle.x,chosen.y-handle.y)>2?{x:handle.x,y:handle.y,length:Math.hypot(chosen.x-handle.x,chosen.y-handle.y),angle:Math.atan2(chosen.y-handle.y,chosen.x-handle.x)*180/Math.PI}:null});
 }
 return placed;
}

/** The selection uses the exact authored stroke in XYZ, including its dash clock. */
export function createTrajectorySelection(drawing,landscape=false){
 const group=new THREE.Group();group.userData.interactionIgnore=true;const points=trajectoryStroke(drawing,landscape).map(p=>new THREE.Vector3(p.x,p.y,p.z));
 if(points.length<2)return group;
 const options={color:'#dceaff',transparent:true,opacity:.65,depthWrite:false};
 const material=drawing.dashed?new THREE.LineDashedMaterial({...options,dashSize:.16,gapSize:.12}):new THREE.LineBasicMaterial(options);
 const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);trace.renderOrder=1;if(drawing.dashed)trace.computeLineDistances();group.add(trace);
 const end=points.at(-1),direction=trajectoryTipDirection(points,drawing.traceProgress!==undefined);
 if(direction){
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.096,.292,12),new THREE.MeshBasicMaterial({...options,side:THREE.BackSide}));
  tip.position.copy(end);tip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(tip);
 }
 return group;
}

export function trajectoryHandleTarget(frame,packet,kind){
 if(!frame||!packet?.trajectoryHandles||packet.disabled||packet.active===false||packet.tool!=='select'||frame.selected?.length!==1||!kinds.includes(kind)||(frame.hide||[]).includes('drawings'))return null;
 const drawing=frame.drawings.find(item=>item.id===frame.selected[0]);
 if(!drawing||!['arrow','curve'].includes(drawing.kind)||drawing.locked||drawing.hidden||drawing.simulated||drawing.points.length<2)return null;
 const handle=drawing.trajectoryHandles?.find(item=>item.kind===kind),point=trajectoryHandlePoint(drawing,kind,Boolean(packet.landscape));
 if(!handle||!point||![handle.value,handle.min,handle.max].every(Number.isFinite))return null;
 return {id:drawing.id,kind,point,value:handle.value,min:handle.min,max:handle.max,editable:Boolean(handle.editable),startBallId:drawing.startBallId};
}
export function trajectoryHeightValue(target,delta){return target&&Number.isFinite(delta)?clamp(target.value+delta,target.min,target.max):null;}
/** Upright editing plane: height is world Y and lateral follows the camera yaw. */
export function trajectoryDragPlane(direction,point){
 if(!isWorldPoint(direction)||!isWorldPoint(point))return null;
 const normal=new THREE.Vector3(direction.x,0,direction.z);if(normal.lengthSq()<1e-8)return null;
 return new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(),new THREE.Vector3(point.x,point.y,point.z));
}
export function trajectoryPlanePoint(ray,plane){
 if(!plane||!ray||Math.abs(plane.normal.dot(ray.direction))<1e-4)return null;
 const point=ray.intersectPlane(plane,new THREE.Vector3());return isWorldPoint(point)?point:null;
}
export function trajectoryPointValue(target,delta){
 if(!target||!isWorldPoint(target.point)||!isWorldPoint(delta))return null;
 const y=trajectoryHeightValue(target,delta.y);if(y===null)return null;
 return {x:clamp(target.point.x+delta.x,-6.3,6.3),y,z:clamp(target.point.z+delta.z,-11.7,11.7)};
}
export function trajectoryLateralDelta(direction,distance){
 if(!isWorldPoint(direction)||!Number.isFinite(distance))return null;
 const length=Math.hypot(direction.x,direction.z);return length>1e-4?{x:-direction.z/length*distance,y:0,z:direction.x/length*distance}:null;
}
export function shouldCancelTrajectoryDrag(drag,next){
 if(!drag)return false;const target=trajectoryHandleTarget(next.frame,next,drag.kind);
 return !target?.editable||drag.id!==target.id||drag.token!==next.token||drag.revision!==next.revision||drag.stepId!==next.frame.stepId||drag.initial!==target.value||drag.startBallId!==target.startBallId||['x','y','z'].some(axis=>drag.point[axis]!==target.point[axis])||drag.cameraView!==next.cameraView||drag.cameraReset!==next.cameraReset||drag.zoom!==next.zoom;
}
export function trajectoryDragCommand(drag,next,cancelled=false){
 if(cancelled||!drag?.moved||shouldCancelTrajectoryDrag(drag,next)||!Number.isFinite(drag.value)||Math.abs(drag.value-drag.initial)<1e-8)return null;
 return {id:drag.id,handle:drag.kind,value:clamp(drag.value,drag.min,drag.max)};
}
export function trajectoryPointDragCommand(drag,next,cancelled=false){
 if(cancelled||!drag?.moved||shouldCancelTrajectoryDrag(drag,next)||!isWorldPoint(drag.destination))return null;
 const point=trajectoryPointValue({...drag,value:drag.initial},{x:drag.destination.x-drag.point.x,y:drag.destination.y-drag.initial,z:drag.destination.z-drag.point.z});
 if(!point||Math.hypot(point.x-drag.point.x,point.y-drag.initial,point.z-drag.point.z)<1e-8)return null;
 return {id:drag.id,handle:drag.kind,point};
}
/** Only unlinked endpoint/middle edits; linked starts use the existing ball elevation preview. */
export function previewTrajectoryProfile(frame,drag){
 if(!drag)return frame;
 return {...frame,drawings:frame.drawings.map(drawing=>{
  if(drawing.id!==drag.id)return drawing;
  const profile={...resolvedTrajectoryHeights(drawing),[drag.kind]:clamp(drag.value,drag.min,drag.max)};
  return {...drawing,trajectoryHeights:profile,points:trajectoryProfilePoints(drawing.points,drawing.kind,profile),trajectoryHandles:drawing.trajectoryHandles?.map(handle=>handle.kind===drag.kind?{...handle,value:profile[drag.kind]}:handle)};
 })};
}
/** Same on-curve handle geometry as the canonical 2D editor; world metres only. */
export function previewTrajectoryPoint(frame,drag,landscape=false){
 if(!drag?.destination)return previewTrajectoryProfile(frame,drag);
 return {...frame,drawings:frame.drawings.map(drawing=>{
  if(drawing.id!==drag.id)return drawing;
  const destination=drag.destination,original=trajectoryHandlePoint(drawing,drag.kind,landscape);if(!original)return drawing;
  let shape=drawing;
  if(Math.hypot((destination.x-original.x)/9,(destination.z-original.z)/18)>=1e-8){
   const start=drag.kind==='start'?destination:drawing.points[0],end=drag.kind==='end'?destination:drawing.points.at(-1);
   if(drag.kind==='middle'){
    const dx=end.x-start.x,dz=end.z-start.z,px=destination.x-start.x,pz=destination.z-start.z,t=(px*dx+pz*dz)/(dx*dx+dz*dz||1);
    if(t>=0&&t<=1&&Math.hypot(px-t*dx,pz-t*dz)<=1e-10){const {curveMode:_curveMode,...straight}=drawing;shape={...straight,kind:'arrow',points:[start,end]};}
    else shape={...drawing,kind:'curve',curveMode:'through-point',points:[start,destination,end]};
   }else if(drawing.kind==='curve'){
    const middle=trajectoryHandlePoint(drawing,'middle',landscape),dx=destination.x-original.x,dz=destination.z-original.z;
    shape={...drawing,curveMode:'through-point',points:[start,{...middle,x:clamp(middle.x+dx/4,-6.3,6.3),z:clamp(middle.z+dz/4,-11.7,11.7)},end]};
   }else shape={...drawing,points:drawing.points.map((point,index)=>index===(drag.kind==='start'?0:drawing.points.length-1)?destination:point)};
  }
  const previous=resolvedTrajectoryHeights(drawing),profile={...previous,[drag.kind]:clamp(destination.y,drag.min,drag.max)},heightChanged=Math.abs(profile[drag.kind]-previous[drag.kind])>1e-8;
  return {...shape,...(drawing.trajectoryHeights||heightChanged?{trajectoryHeights:profile}:{}),points:trajectoryProfilePoints(shape.points,shape.kind,profile),trajectoryHandles:drawing.trajectoryHandles?.map(handle=>handle.kind===drag.kind?{...handle,value:profile[drag.kind]}:handle)};
 })};
}
