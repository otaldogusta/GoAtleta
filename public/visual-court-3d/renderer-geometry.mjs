// Presentation transforms only. The parent editor owns all document data.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const isWorldPoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
export const worldToCourt=p=>({x:p.x/9+.5,y:p.z/18+.5});
export const courtToWorld=p=>({x:(p.x-.5)*9,y:.03,z:(p.y-.5)*18});
export const limitPoint=p=>({x:clamp(p.x,-.2,1.2),y:clamp(p.y,-.15,1.15)});
export const snapPoint=p=>({x:Math.round(p.x*18)/18,y:Math.round(p.y*36)/36});
export function snappedGesture(point,start,anchor,grid,tool,motionMode){
 if(!grid||!anchor||tool==='animate'&&motionMode!=='straight')return point;
 const destination=snapPoint({x:anchor.x+point.x-start.x,y:anchor.y+point.y-start.y});
 return {x:start.x+destination.x-anchor.x,y:start.y+destination.y-anchor.y};
}
export function curvePoints(points,landscape=false){
 if(points.length<2)return points;
 const a=points[0],b=points.at(-1),c={x:(a.x+b.x)/2+(landscape?-.65:.65),y:(a.y+b.y)/2,z:(a.z+b.z)/2-.65};
 return Array.from({length:33},(_,i)=>{const u=i/32,v=1-u;return {x:v*v*a.x+2*v*u*c.x+u*u*b.x,y:v*v*a.y+2*v*u*c.y+u*u*b.y,z:v*v*a.z+2*v*u*c.z+u*u*b.z};});
}
export function editableIds(ids,frame){
 const objects=[...frame.actors,...frame.drawings];
 return ids.filter(id=>objects.some(object=>object.id===id&&!object.locked));
}
/** The same equal-segment clock and rear-edge trim as the canonical 2D scene. */
export function movementTrail(points,progress,clearance=.55){
 if(points.length<2||progress<=0)return [];
 const segment=clamp(progress,0,1)*(points.length-1),index=Math.floor(segment),a=points[index],b=points[Math.min(index+1,points.length-1)],u=segment-index;
 const trail=[...points.slice(0,index+1),{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u}];
 let remaining=clearance;
 while(trail.length>1){const end=trail.at(-1),start=trail.at(-2),length=Math.hypot(end.x-start.x,end.z-start.z);if(length<=remaining){remaining-=length;trail.pop();continue;}const ratio=(length-remaining)/length;trail[trail.length-1]={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio,z:start.z+(end.z-start.z)*ratio};break;}
 return trail.length>1?trail:[];
}
