import {clamp,isWorldPoint} from './renderer-geometry.mjs';

const heightRanges={set:[.15,5],pass:[.4,4],attack:[.03,4]};
export const isHeightHandle=kind=>Object.hasOwn(heightRanges,kind);

/** Uncommitted presentation gesture only; the host validates and writes settings. */
export function simulationHandleEdit(handle,point,deltaY=0){
 if(!handle||!isWorldPoint(point)||!Number.isFinite(deltaY))return null;
 const kind=handle.kind,at={x:clamp(point.x,-9,9),y:clamp(point.y,0,9),z:clamp(point.z,-12,12)};
 if(isHeightHandle(kind)){
  if(!Number.isFinite(handle.value)||!isWorldPoint(handle.point))return null;
  const [min,max]=heightRanges[kind];
  return {kind,point:{...at,x:clamp(handle.point.x,-9,9),z:clamp(handle.point.z,-12,12)},value:clamp(handle.value+deltaY,min,max)};
 }
 if(!['hit','target','serve'].includes(kind))return null;
 if(kind==='hit'){at.x=clamp(at.x,-4.43,4.43);at.z=clamp(at.z,.1,4.4);}
 if(kind==='target')at.z=clamp(at.z,-12,-.75);
 if(kind==='serve'){at.x=clamp(at.x,-4.5,4.5);at.z=clamp(at.z,.15,9);}
 return {kind,point:at};
}

/** Deform the host's intent guide only; discarding this value restores its frame. */
export function previewAttackCurve(data,value){
 if(!data||!Number.isFinite(value))return data;
 const handle=data.handles?.find(item=>item.kind==='attack'),intent=data.paths?.find(path=>path.id==='attack-intent');
 if(!handle||!Number.isFinite(handle.value)||!intent||intent.points.length<3||!intent.points.every(isWorldPoint))return data;
 const bounded=clamp(value,.03,4),delta=bounded-handle.value;
 if(Math.abs(delta)<1e-12)return data;
 const last=intent.points.length-1,points=intent.points.map((point,index)=>{
  if(index===0||index===last)return point;
  const u=index/last;return {...point,y:point.y+4*u*(1-u)*delta};
 });
 const middle=points[Math.floor(last/2)];
 return {...data,
  paths:data.paths.filter(path=>path.id!=='attack'&&!path.id.startsWith('rebound-')).map(path=>path===intent?{...path,points,opacity:.85}:path),
  markers:(data.markers||[]).filter(marker=>marker.id!=='landing'&&!marker.id.startsWith('contact-')).map(marker=>marker.id==='attack-curve'?{...marker,point:{...middle}}:marker),
  handles:data.handles.map(item=>item===handle?{...item,point:{...middle},value:bounded}:item),
  outcome:'',
 };
}

/** The renderer consumes sampled headings; it never advances an animation clock. */
export function actorPoseView(actor,azimuth){
 const dx=actor.facing?.[0]??0,dz=actor.facing?.[1]??(actor.position.z>0?-1:1);
 const screen=dx*Math.cos(azimuth)-dz*Math.sin(azimuth);
 const sampled=Number.isFinite(actor.poseScale);
 const side=sampled
  ? Boolean(actor.side)||(actor.poseRole==='passer'&&Math.abs(Math.sin(azimuth))>.35)||(actor.poseRole==='attacker'&&Math.abs(Math.sin(azimuth))>.65)||(actor.poseRole==='server'&&Math.abs(screen)>Math.abs(dx*Math.sin(azimuth)+dz*Math.cos(azimuth))*.8)
  : actor.side===true||Math.abs(screen)>Math.abs(dx*Math.sin(azimuth)+dz*Math.cos(azimuth))*.8;
 return {side,view:side?'side':'front',flip:side?screen>0:Boolean(actor.mirror)};
}
