import {isWorldPoint} from './renderer-geometry.mjs';
import {NET_TOP,NET_BOTTOM,NET_WIDTH,TOP_BAND_HEIGHT,BOTTOM_BAND_HEIGHT,TOP_BAND_DEPTH,BOTTOM_BAND_DEPTH} from './court-net.js';

// The visible mesh and the two BoxGeometry tapes in renderer.mjs. No ball radius,
// posts, antennas or volleyball-rule envelope is added to this visual contact test.
export const RENDERED_NET_BOUNDS=Object.freeze([
 {part:'mesh',min:{x:-NET_WIDTH/2,y:NET_BOTTOM,z:0},max:{x:NET_WIDTH/2,y:NET_TOP,z:0}},
 {part:'top-tape',min:{x:-NET_WIDTH/2,y:NET_TOP-TOP_BAND_HEIGHT,z:-TOP_BAND_DEPTH/2},max:{x:NET_WIDTH/2,y:NET_TOP,z:TOP_BAND_DEPTH/2}},
 {part:'bottom-tape',min:{x:-NET_WIDTH/2,y:NET_BOTTOM,z:-BOTTOM_BAND_DEPTH/2},max:{x:NET_WIDTH/2,y:NET_BOTTOM+BOTTOM_BAND_HEIGHT,z:BOTTOM_BAND_DEPTH/2}},
]);
const epsilon=1e-9;
function segmentBox(a,b,bounds){
 let enter=0,exit=1;
 for(const axis of ['x','y','z']){
  const delta=b[axis]-a[axis],low=bounds.min[axis],high=bounds.max[axis];
  if(Math.abs(delta)<epsilon){if(a[axis]<low-epsilon||a[axis]>high+epsilon)return null;continue;}
  const t0=(low-a[axis])/delta,t1=(high-a[axis])/delta;
  enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
  if(enter>exit+epsilon)return null;
 }
 return enter<=1&&exit>=0?Math.max(0,enter):null;
}
/** First contact on the rendered polyline, including endpoint and coplanar contact. */
export function renderedNetContact(points){
 for(let index=1;index<(points?.length||0);index++){
  const a=points[index-1],b=points[index];if(!isWorldPoint(a)||!isWorldPoint(b)||Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)<epsilon)continue;
  let hit=null;
  for(const bounds of RENDERED_NET_BOUNDS){const u=segmentBox(a,b,bounds);if(u!==null&&(!hit||u<hit.u))hit={u,part:bounds.part};}
  if(hit)return {part:hit.part,segment:index-1,point:{x:a.x+(b.x-a.x)*hit.u,y:a.y+(b.y-a.y)*hit.u,z:a.z+(b.z-a.z)*hit.u}};
 }
 return null;
}
export function showsNetWarning(drawing,frame,packet){
 return Boolean(frame?.net&&!packet?.plain&&packet?.active!==false&&drawing&&!drawing.hidden&&!drawing.simulated&&['arrow','curve'].includes(drawing.kind)&&!(frame.hide||[]).includes('drawings'));
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rectangle=rect=>rect&&[rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0;
const overlaps=(a,b)=>a.x<b.x+b.width+4&&a.x+a.width>b.x-4&&a.y<b.y+b.height+4&&a.y+a.height>b.y-4;
/** Keep the small, non-interactive label above contact and outside editor controls. */
export function netWarningLayout(point,viewport,obstacles=[]){
 if(!point||point.visible===false||!Number.isFinite(point.x+point.y))return null;
 const width=Math.min(132,viewport.width-24),height=26,left=Math.min(64,viewport.width-width-12),right=viewport.width-width-12;
 const top=Math.max(8,Number(viewport.topInset)||0)+4,bottom=viewport.height-Math.max(8,Number(viewport.bottomInset)||0)-height-4;
 if(width<=0||bottom<top||point.x<0||point.x>viewport.width||point.y<0||point.y>viewport.height)return null;
 const base={x:clamp(point.x-width/2,left,right),y:clamp(point.y-height-10,top,bottom)},blocked=obstacles.filter(rectangle);
 const candidates=[];
 for(const dy of [0,-32,-64,-96])for(const dx of [0,-138,138])candidates.push({x:base.x+dx,y:base.y+dy});
 for(const obstacle of blocked)candidates.push({x:obstacle.x-width-6,y:base.y},{x:obstacle.x+obstacle.width+6,y:base.y},{x:base.x,y:obstacle.y-height-6});
 const limited=candidates.map(at=>({x:clamp(at.x,left,right),y:clamp(at.y,top,bottom),width,height})).sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y));
 const available=limited.filter(at=>blocked.every(obstacle=>!overlaps(at,obstacle)));
 return available.find(at=>at.y+at.height<=point.y-6)||available[0]||null;
}
