import {clamp,isWorldPoint} from './renderer-geometry.mjs';

const materialKinds=new Set(['ball','cone','target','ladder']);
export function authorMovementPlaneY(frame,id){
 const actor=frame.actors.find(item=>item.id===id),drawing=frame.drawings.find(item=>item.id===id),object=actor||drawing,point=actor?.position||drawing?.points[0];
 return object&&!object.locked&&!object.hidden&&!object.simulated&&Number.isFinite(object.elevation)&&object.elevation>0&&isWorldPoint(point)?point.y:0;
}
/** Extra camera bounds only for raised author materials; floor framing stays unchanged. */
export function elevatedMaterialFitPoints(frame){
 if((frame.hide||[]).includes('drawings'))return [];
 return frame.drawings.flatMap(drawing=>{
  const point=drawing.points[0];if(!materialKinds.has(drawing.kind)||drawing.simulated||drawing.hidden||!isWorldPoint(point)||!Number.isFinite(drawing.elevation)||drawing.elevation<=0)return [];
  const size=clamp(Number(drawing.size)||28,12,80)/100;
  const rise=drawing.kind==='ball'?.12:drawing.kind==='cone'?size:.03;
  const radius=drawing.kind==='ball'?.12:drawing.kind==='ladder'?size*2:size;
  return [{x:point.x-radius,y:point.y,z:point.z-radius},{x:point.x+radius,y:point.y+rise+.8,z:point.z+radius}];
 });
}
export function elevationControlLayout(position,width,height,topInset=0,bottomInset=0){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y)||width<100||height<100)return null;
 const right=position.x<176,x=clamp(position.x+(right?112:-64),right?154:112,Math.max(154,width-60));
 const labelSide=right||x<150?'above':'left';
 const top=clamp(Number(topInset)||0,0,height-80),bottom=clamp(Number(bottomInset)||0,0,height-top-80);
 const minY=top+(labelSide==='above'?40:22),maxY=Math.max(minY,height-bottom-22),y=clamp(position.y,minY,maxY);
 const displaced=Math.abs(x-(position.x+(right?112:-64)))>.5||Math.abs(y-position.y)>.5;
 const edge={x:clamp(position.x,74,width-8),y:clamp(position.y,top+4,height-bottom-4)};
 return {x,y,labelSide,tether:displaced?{x:edge.x,y:edge.y,length:Math.hypot(x-edge.x,y-edge.y),angle:Math.atan2(y-edge.y,x-edge.x)*180/Math.PI}:null};
}
export function elevationTarget(frame,packet){
 if(!frame||!packet?.elevationHandles||packet.disabled||packet.active===false||packet.tool!=='select'||frame.selected?.length!==1)return null;
 const id=frame.selected[0],actor=frame.actors.find(item=>item.id===id),drawing=frame.drawings.find(item=>item.id===id);
 const object=actor||drawing,point=actor?.position||drawing?.points[0];
 if(!object||object.locked||object.hidden||object.simulated||!isWorldPoint(point)||!Number.isFinite(object.elevation)||object.elevation<0||object.elevation>8||(frame.hide||[]).includes(actor?'actors':'drawings')||!actor&&!materialKinds.has(drawing.kind))return null;
 return {id,point,value:object.elevation,actor:Boolean(actor)};
}
export function elevationValue(value,delta){return Number.isFinite(value)&&Number.isFinite(delta)?clamp(value+delta,0,8):null;}
export function elevationKeyValue(value,key,shift=false){
 if(!Number.isFinite(value))return null;
 return key==='Home'?0:key==='ArrowUp'?elevationValue(value,shift?.5:.1):key==='ArrowDown'?elevationValue(value,shift?-.5:-.1):null;
}
export function shouldCancelElevationDrag(drag,next){
 if(!drag)return false;
 const target=elevationTarget(next.frame,next);
 return !target||drag.revision!==next.revision||drag.token!==next.token||drag.stepId!==next.frame.stepId||drag.id!==target.id||drag.initial!==target.value||['x','y','z'].some(axis=>drag.point[axis]!==target.point[axis])||drag.cameraView!==next.cameraView||drag.cameraReset!==next.cameraReset||drag.zoom!==next.zoom;
}
export function elevationDragCommand(drag,next,cancelled=false){
 if(cancelled||!drag?.moved||shouldCancelElevationDrag(drag,next)||!Number.isFinite(drag.value)||Math.abs(drag.value-drag.initial)<1e-8)return null;
 return {id:drag.id,value:clamp(drag.value,0,8)};
}

/** Presentation-only offsets. The canonical frame remains untouched until drop. */
export function previewCourtObjects(frame,move,height){
 if(!move&&!height)return frame;
 const moved=new Set(move?.ids||[]),dx=(move?.delta.x||0)*9,dz=(move?.delta.y||0)*18;
 const offset=object=>({x:moved.has(object.id)?dx:0,z:moved.has(object.id)?dz:0,y:height?.id===object.id&&Number.isFinite(object.elevation)&&Number.isFinite(height.value)?clamp(height.value,0,8)-object.elevation:0});
 const translate=(point,delta)=>({x:point.x+delta.x,y:point.y+delta.y,z:point.z+delta.z});
 const actors=frame.actors.map(actor=>{const delta=offset(actor);return delta.x||delta.y||delta.z?{...actor,position:translate(actor.position,delta)}:actor;});
 const drawings=frame.drawings.map(drawing=>{const delta=offset(drawing);return delta.x||delta.y||delta.z?{...drawing,points:drawing.points.map(point=>translate(point,delta))}:drawing;});
 const balls=new Map(drawings.filter(d=>d.kind==='ball'&&d.points[0]).map(d=>[d.id,d.points[0]]));
 return {...frame,actors,drawings:drawings.map(drawing=>{
  if(!drawing.startBallId||!['arrow','curve'].includes(drawing.kind)||drawing.points.length<2)return drawing;
  // The host detaches an arrow moved without its ball and projects it onto the floor.
  if(moved.has(drawing.id)&&!moved.has(drawing.startBallId)){const {startBallId:_startBallId,...detached}=drawing;return {...detached,points:drawing.points.map(point=>({...point,y:.025}))};}
  const ball=balls.get(drawing.startBallId),start=drawing.points[0];if(!ball)return drawing;
  const delta={x:ball.x-start.x,y:ball.y-start.y,z:ball.z-start.z};if(!delta.x&&!delta.y&&!delta.z)return drawing;
  const points=[...drawing.points];points[0]={...ball};
  const through=drawing.kind==='curve'&&drawing.curveMode==='through-point'&&points.length===3;
  if(through){const middle=points[1];points[1]={...middle,x:clamp(middle.x+delta.x/4,-6.3,6.3),z:clamp(middle.z+delta.z/4,-11.7,11.7)};}
  const distances=points.map((point,index)=>index?Math.hypot(point.x-points[index-1].x,point.z-points[index-1].z):0),total=distances.reduce((sum,length)=>sum+length,0);let travelled=0;
  return {...drawing,points:points.map((point,index)=>{travelled+=distances[index];if(index===0||index===points.length-1)return point;const t=through?index/2:total?travelled/total:index/(points.length-1);return {...point,y:ball.y+(points.at(-1).y-ball.y)*t};})};
 })};
}
