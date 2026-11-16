// Framing consumes the canonical frame; it never samples or changes a trajectory.
import {trajectoryStroke} from './renderer-trajectory.mjs';
const finite=Number.isFinite;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const point=value=>value&&finite(value.x)&&finite(value.y)&&finite(value.z);
const list=value=>Array.isArray(value)?value:[];
const numeric=(value,fallback)=>finite(value)?value:fallback;

/** Complete paths keep the fit independent from the currently sampled ball.
 * Simulated actors have no static bases in the renderer frame, so the occupied
 * court uses a stable player-height envelope rather than their changing poses.
 */
export function collectFrameFitPoints(frame,{half=false,landscape=false}={}){
 const points=[],hidden=new Set(list(frame?.hide)),simulation=frame?.simulation;
 const add=value=>{if(point(value))points.push({x:value.x,y:value.y,z:value.z});};
 const box=(at,rx,ry,rz)=>{if(!point(at))return;for(const x of [-rx,rx])for(const y of [0,ry])for(const z of [-rz,rz])add({x:at.x+x,y:at.y+y,z:at.z+z});};
 const courtCorners=(height=0)=>{for(const x of [-4.5,4.5])for(const z of [half?0:-9,9])add({x,y:height,z});};
 if(frame?.court&&!hidden.has('court'))courtCorners();
 if(frame?.net&&!hidden.has('court'))for(const x of [-5.4,5.4])for(const y of [0,3.25])add({x,y,z:0});
 const actors=hidden.has('actors')?[]:list(frame?.actors).filter(actor=>!actor.hidden);
 const drawings=hidden.has('drawings')?[]:list(frame?.drawings).filter(drawing=>!drawing.hidden);
 const simulatedActors=Boolean(simulation&&actors.some(actor=>actor.simulated));
 if(simulatedActors){courtCorners();courtCorners(3.4);}
 for(const actor of actors){
  if(simulation&&actor.simulated)continue;
  const path=list(actor.path).filter(point),locations=path.length?path:[actor.position];
  for(const at of locations)box(at,.42,2.65+Math.max(0,numeric(actor.jump,0)),.42);
 }
 for(const drawing of drawings){
  if(simulation&&drawing.simulated)continue;
  const stroke=list(drawing.points).filter(point),motion=list(drawing.motion).filter(point);
  const size=clamp(numeric(drawing.size,28),12,80)/100;
  if(['ball','cone','target','ladder'].includes(drawing.kind)){
   const radius=drawing.kind==='ball'?.12:drawing.kind==='ladder'?size*2.1:size+.03;
   const height=drawing.kind==='ball'?.24:drawing.kind==='cone'?size:.06;
   for(const at of motion.length?motion:stroke)box(drawing.kind==='ball'?{...at,y:at.y-.12}:at,radius,height,radius);
  }else for(const at of ['arrow','curve'].includes(drawing.kind)?trajectoryStroke(drawing,landscape):stroke){add(at);if(drawing.kind==='text')box(at,1.6*Math.max(.5,size/.28),.65,.1);}
 }
 const showSimulation=simulation&&(simulatedActors||drawings.some(drawing=>drawing.simulated)||!hidden.has('movements')&&simulation.guidesVisible!==false);
 if(showSimulation){
  for(const path of list(simulation.paths)){
   for(const at of list(path.points)){add(at);if(point(at))add({...at,y:at.y+.2});}
   // The server stands outside the end line. The complete serve guide starts
   // at contact, so include the same X/Z down to the floor, not a sampled pose.
   if(simulatedActors&&path.id==='serve'&&point(path.points?.[0])){
    const start=path.points[0];box({x:start.x,y:0,z:start.z},.65,Math.max(3.4,start.y+.35),.65);
   }
  }
  for(const item of [...list(simulation.markers),...list(simulation.handles)])add(item.point);
  for(const wall of list(simulation.walls)){
   if(!point(wall.center))continue;
   const angle=numeric(wall.angle,0)*Math.PI/180,rx=Math.max(0,numeric(wall.width,0))*.5,ry=Math.max(0,numeric(wall.height,0))*.5;
   for(const x of [-rx,rx])for(const y of [-ry,ry])add({x:wall.center.x+x*Math.cos(angle),y:wall.center.y+y,z:wall.center.z-x*Math.sin(angle)});
  }
 }
 // An empty or fully hidden scene still has a useful framing reference.
 if(!points.length)courtCorners();
 return points;
}

/** Minimum camera distance for the same lookAt basis used by the renderer.
 * Insets are CSS pixels. Each is capped below half the viewport so even an
 * unusually short layout retains a valid central projection interval.
 */
export function fitCameraDistance(points,options={}){
 const target=point(options.target)?options.target:{x:0,y:0,z:0};
 const width=Math.max(1,numeric(options.width,1000)),height=Math.max(1,numeric(options.height,700));
 const aspect=Math.max(.01,numeric(options.aspect,width/height));
 const azimuth=numeric(options.azimuth,0),elevation=numeric(options.elevation,.3656);
 const sinA=Math.sin(azimuth),cosA=Math.cos(azimuth),sinE=Math.sin(elevation),cosE=Math.cos(elevation);
 const tan=Math.tan(clamp(numeric(options.fov,39),1,150)*Math.PI/360);
 const extent=(inset,dimension)=>1-2*clamp(numeric(inset,0),0,dimension*.44)/dimension;
 const left=extent(options.leftInset,width),right=extent(options.rightInset,width),top=extent(options.topInset,height),bottom=extent(options.bottomInset,height);
 const min=clamp(numeric(options.minDistance,12),.2,140),max=clamp(numeric(options.maxDistance,140),min,140);
 let distance=min;
 for(const at of list(points)){
  if(!point(at))continue;
  const dx=at.x-target.x,dy=at.y-target.y,dz=at.z-target.z;
  const x=dx*cosA-dz*sinA,y=-dx*sinA*sinE+dy*cosE-dz*cosA*sinE;
  const toward=dx*sinA*cosE+dy*sinE+dz*cosA*cosE;
  const horizontal=Math.abs(x)/(tan*aspect*(x<0?left:right));
  const vertical=Math.abs(y)/(tan*(y<0?bottom:top));
  distance=Math.max(distance,toward+Math.max(.11,horizontal,vertical));
 }
 return clamp(distance,min,max);
}

/** Preserve the user's zoom ratio; the caller applies its gesture limits. */
export function resizedFitDistance(distance,previousFit,nextFit){
 if(!finite(distance)||distance<=0)return finite(nextFit)&&nextFit>0?nextFit:12;
 if(!finite(previousFit)||previousFit<=0||!finite(nextFit)||nextFit<=0||previousFit===nextFit)return distance;
 return distance*nextFit/previousFit;
}
