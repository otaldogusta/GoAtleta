import test from 'node:test';
import assert from 'node:assert/strict';
import {elevationTarget,elevationValue,elevationKeyValue,shouldCancelElevationDrag,elevationDragCommand,previewCourtObjects,elevatedMaterialFitPoints,elevationControlLayout,authorMovementPlaneY} from './renderer-elevation.mjs';
import {curvePoints} from './renderer-geometry.mjs';

function fixture(){
 const ball={id:'ball',kind:'ball',elevation:1,points:[{x:1,y:1.12,z:2}]},end={x:4,y:.025,z:-3};
 return {stepId:'step',hide:[],selected:['ball'],actors:[{id:'actor',elevation:0,position:{x:-1,y:0,z:3}}],drawings:[ball,
  {id:'arrow',kind:'arrow',startBallId:'ball',points:[{...ball.points[0]},end]},
  {id:'curve',kind:'curve',curveMode:'through-point',startBallId:'ball',points:[{...ball.points[0]},{x:4,y:(1.12+.025)/2,z:1},end]},
  {id:'other',kind:'cone',elevation:0,points:[{x:-2,y:.025,z:1}]},
 ]};
}
const packet=frame=>({frame,tool:'select',active:true,disabled:false,elevationHandles:true,revision:7,token:'test',cameraView:'front',cameraReset:0,zoom:1});
const drag=frame=>({id:'ball',initial:1,value:3,moved:true,point:{...frame.drawings[0].points[0]},stepId:frame.stepId,revision:7,token:'test',cameraView:'front',cameraReset:0,zoom:1});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} ≠ ${expected}`);

test('camera bounds include 8 m materials and control clearance without changing the floor baseline',()=>{
 for(const kind of ['ball','cone','target','ladder']){
  const point={x:1,y:8+(kind==='ball'?.12:.025),z:2},item={id:'raised',kind,elevation:8,size:32,points:[point]},frame={hide:[],drawings:[item]};
  const bounds=elevatedMaterialFitPoints(frame);
  assert.equal(bounds.length,2);assert.ok(bounds[0].x<point.x&&bounds[1].x>point.x);assert.ok(bounds[1].y>=point.y+.8);
  assert.deepEqual(elevatedMaterialFitPoints({...frame,simulation:{mode:'attack'}}),bounds);
  assert.deepEqual(elevatedMaterialFitPoints({...frame,drawings:[{...item,elevation:0,points:[{...point,y:kind==='ball'?.12:.025}]}]}),[]);
  assert.deepEqual(elevatedMaterialFitPoints({...frame,drawings:[{...item,simulated:true}]}),[]);
  assert.deepEqual(elevatedMaterialFitPoints({...frame,hide:['drawings']}),[]);
 }
});

test('off-screen height controls clear the header, footer, left toolbar and contextual actions',()=>{
 for(const [width,height] of [[1307,857],[390,844]])for(const point of [{x:width/2,y:-140},{x:24,y:-40},{x:100,y:450},{x:width+100,y:height+150}]){
  const layout=elevationControlLayout(point,width,height,144,170);
  assert.ok(layout.x-22>=90);assert.ok(layout.x+22<=width);assert.ok(layout.y-22>=144);assert.ok(layout.y+22<=height-170);
  if(layout.labelSide==='above')assert.ok(layout.y-36>=144);
  if(point.x<130){assert.ok(layout.x-22>=132);assert.equal(layout.labelSide,'above');}
  if(point.y<0||point.y>height){assert.ok(layout.tether);assert.ok(layout.tether.y>=144&&layout.tether.y<=height-170);}
 }
 const normal=elevationControlLayout({x:620,y:400},1307,857,144,170);assert.deepEqual(normal,{x:556,y:400,labelSide:'left',tether:null});
});

test('horizontal body drags use elevated author anchor Y while floor and engine retain the existing ground plane',()=>{
 const frame=fixture();assert.equal(authorMovementPlaneY(frame,'ball'),1.12);assert.equal(authorMovementPlaneY(frame,'actor'),0);
 frame.actors[0].elevation=2;frame.actors[0].position.y=2;assert.equal(authorMovementPlaneY(frame,'actor'),2);
 for(const kind of ['cone','target','ladder']){frame.drawings[3].kind=kind;frame.drawings[3].elevation=2;frame.drawings[3].points[0].y=2.025;assert.equal(authorMovementPlaneY(frame,'other'),2.025);}
 for(const property of ['simulated','locked','hidden']){frame.drawings[0][property]=true;assert.equal(authorMovementPlaneY(frame,'ball'),0);delete frame.drawings[0][property];}
 frame.drawings[0].elevation=0;assert.equal(authorMovementPlaneY(frame,'ball'),0);assert.equal(authorMovementPlaneY(frame,'missing'),0);
});

test('only a single editable author object with an explicit elevation capability exposes the handle',()=>{
 const frame=fixture(),state=packet(frame);
 assert.deepEqual(elevationTarget(frame,state),{id:'ball',point:frame.drawings[0].points[0],value:1,actor:false});
 frame.selected=['actor'];assert.equal(elevationTarget(frame,state).value,0);assert.equal(elevationTarget(frame,state).actor,true);
 for(const kind of ['ball','cone','target','ladder']){frame.selected=['other'];frame.drawings[3].kind=kind;assert.equal(elevationTarget(frame,state).id,'other');}
 for(const kind of ['arrow','curve','text','pen','area']){frame.drawings[3].kind=kind;assert.equal(elevationTarget(frame,state),null);}
});

test('read-only, playback, tools, multiple selection, hidden, locked and simulation cannot expose height editing',()=>{
 for(const change of [{disabled:true},{active:false},{elevationHandles:false},{tool:'animate'},{tool:'pan'}]){const frame=fixture();assert.equal(elevationTarget(frame,{...packet(frame),...change}),null);}
 for(const selected of [[],['ball','actor'],['missing']]){const frame={...fixture(),selected};assert.equal(elevationTarget(frame,packet(frame)),null);}
 for(const property of ['hidden','locked','simulated']){const frame=fixture();frame.drawings[0][property]=true;assert.equal(elevationTarget(frame,packet(frame)),null);}
 for(const value of [undefined,NaN,Infinity,-.1,8.1]){const frame=fixture();frame.drawings[0].elevation=value;assert.equal(elevationTarget(frame,packet(frame)),null);}
 for(const [id,layer] of [['ball','drawings'],['actor','actors']]){const frame=fixture();frame.selected=[id];frame.hide=[layer];assert.equal(elevationTarget(frame,packet(frame)),null);}
});

test('height clamps at 0..8 m and keyboard provides 0.1/0.5 m steps and Home',()=>{
 assert.equal(elevationValue(2,-9),0);assert.equal(elevationValue(2,9),8);
 assert.equal(elevationValue(2,Infinity),null);assert.equal(elevationValue(NaN,1),null);
 close(elevationKeyValue(2,'ArrowUp'),2.1);close(elevationKeyValue(2,'ArrowDown'),1.9);
 assert.equal(elevationKeyValue(2,'ArrowUp',true),2.5);assert.equal(elevationKeyValue(2,'ArrowDown',true),1.5);
 assert.equal(elevationKeyValue(2,'Home'),0);assert.equal(elevationKeyValue(8,'ArrowUp'),8);assert.equal(elevationKeyValue(0,'ArrowDown'),0);
 for(const key of ['ArrowLeft','ArrowRight','Enter','Escape'])assert.equal(elevationKeyValue(2,key),null);
});

test('only a completed moved gesture emits a command against its original valid frame',()=>{
 const frame=fixture(),state=packet(frame),gesture=drag(frame);
 assert.equal(shouldCancelElevationDrag(gesture,state),false);
 assert.deepEqual(elevationDragCommand(gesture,state),{id:'ball',value:3});
 assert.equal(elevationDragCommand(gesture,state,true),null);
 for(const change of [{moved:false},{value:1},{value:NaN}])assert.equal(elevationDragCommand({...gesture,...change},state),null);
 for(const change of [{revision:8},{token:'other'},{disabled:true},{active:false},{elevationHandles:false},{tool:'pan'},{cameraView:'side'},{cameraReset:1},{zoom:2}]){
  assert.equal(shouldCancelElevationDrag(gesture,{...state,...change}),true);assert.equal(elevationDragCommand(gesture,{...state,...change}),null);
 }
});

test('changes of step, selection, editability or canonical object position cancel an in-flight preview',()=>{
 for(const change of ['step','selection','height','position','locked','hidden','simulated','removed']){
  const frame=fixture(),gesture=drag(frame);
  if(change==='step')frame.stepId='next';else if(change==='selection')frame.selected=['actor'];else if(change==='height')frame.drawings[0].elevation=2;else if(change==='position')frame.drawings[0].points[0].x+=1;else if(change==='removed')frame.drawings.shift();else frame.drawings[0][change]=true;
  assert.equal(shouldCancelElevationDrag(gesture,packet(frame)),true,change);assert.equal(elevationDragCommand(gesture,packet(frame)),null,change);
 }
});

test('height preview is immutable, changes only Y and moves every linked start while preserving destinations',()=>{
 const frame=fixture(),before=JSON.stringify(frame),next=previewCourtObjects(frame,null,{id:'ball',value:3});
 const ball=next.drawings[0].points[0];assert.deepEqual(ball,{x:1,y:3.12,z:2});
 for(const index of [1,2]){assert.deepEqual(next.drawings[index].points[0],ball);assert.deepEqual(next.drawings[index].points.at(-1),frame.drawings[index].points.at(-1));}
 const middle=next.drawings[2].points[1];assert.equal(middle.x,frame.drawings[2].points[1].x);assert.equal(middle.z,frame.drawings[2].points[1].z);close(middle.y,(ball.y+.025)/2);
 close(curvePoints(next.drawings[2].points,false,'through-point')[16].y,middle.y);
 assert.equal(next.drawings[3],frame.drawings[3]);assert.equal(next.actors[0],frame.actors[0]);assert.equal(JSON.stringify(frame),before);
 assert.equal(previewCourtObjects(frame,null,null),frame);
});

test('author actor/material preview retains base height and bounds elevation without mutating XZ',()=>{
 const frame=fixture();let shown=previewCourtObjects(frame,null,{id:'actor',value:2});assert.deepEqual(shown.actors[0].position,{x:-1,y:2,z:3});
 shown=previewCourtObjects(frame,null,{id:'other',value:8});assert.deepEqual(shown.drawings[3].points[0],{x:-2,y:8.025,z:1});
 shown=previewCourtObjects(frame,null,{id:'ball',value:-4});close(shown.drawings[0].points[0].y,.12);
});

test('ball XZ preview preserves quadratic control and adjusts its linked midpoint by a quarter',()=>{
 const frame=fixture(),next=previewCourtObjects(frame,{ids:['ball'],delta:{x:.1,y:-.1}},null),before=frame.drawings[2],curve=next.drawings[2];
 close(next.drawings[0].points[0].x,1.9);close(next.drawings[0].points[0].z,.2);
 assert.deepEqual(curve.points[0],next.drawings[0].points[0]);assert.deepEqual(curve.points.at(-1),before.points.at(-1));
 for(const axis of ['x','z']){const control=points=>2*points[1][axis]-(points[0][axis]+points[2][axis])/2;close(control(curve.points),control(before.points));}
 assert.deepEqual(next.drawings[1].points.at(-1),frame.drawings[1].points.at(-1));
});

test('a selected arrow moves freely on its own and moves once when selected together with the ball',()=>{
 const frame=fixture();
 for(const id of ['arrow','curve']){
  const move={delta:{x:.1,y:.1},ids:[id]},original=frame.drawings.find(item=>item.id===id),alone=previewCourtObjects(frame,move,null).drawings.find(item=>item.id===id);
  assert.equal(alone.startBallId,undefined);
  alone.points.forEach((point,index)=>{close(point.x,original.points[index].x+.9);close(point.z,original.points[index].z+1.8);assert.equal(point.y,.025);});
  const together=previewCourtObjects(frame,{...move,ids:[id,'ball']},null),linked=together.drawings.find(item=>item.id===id);
  assert.equal(linked.startBallId,'ball');assert.deepEqual(linked.points[0],together.drawings[0].points[0]);
  linked.points.forEach((point,index)=>{close(point.x,alone.points[index].x);close(point.z,alone.points[index].z);close(point.y,original.points[index].y);});
 }
});

test('linked polylines retain their XZ vertices and slope to the current floor destination',()=>{
 const frame=fixture();frame.drawings[1].points.splice(1,0,{x:2,y:.5,z:1});
 const next=previewCourtObjects(frame,null,{id:'ball',value:4}).drawings[1].points;
 const first=Math.hypot(next[1].x-next[0].x,next[1].z-next[0].z),last=Math.hypot(next[2].x-next[1].x,next[2].z-next[1].z);
 close(next[1].y,4.12+(.025-4.12)*first/(first+last));assert.equal(next.at(-1).y,.025);
 assert.deepEqual(next.map(({x,z})=>({x,z})),frame.drawings[1].points.map(({x,z})=>({x,z})));
});
