import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {curvePoints} from './renderer-geometry.mjs';
import {trajectoryStroke,trajectoryHandlePoint,trajectoryControlLayout,createTrajectorySelection,trajectoryHandleTarget,trajectoryDragCommand,shouldCancelTrajectoryDrag,previewTrajectoryProfile,trajectoryDragPlane,trajectoryPlanePoint,trajectoryPointValue,trajectoryLateralDelta,trajectoryPointDragCommand,previewTrajectoryPoint} from './renderer-trajectory.mjs';
import {previewCourtObjects} from './renderer-elevation.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const drawing=()=>({id:'arrow',kind:'arrow',points:[{x:-2,y:.025,z:3},{x:3,y:.025,z:-4}],trajectoryHandles:['start','middle','end'].map(kind=>({kind,value:.025,min:0,max:8.12,editable:true}))});
const fixture=()=>({stepId:'step',selected:['arrow'],hide:[],actors:[],drawings:[drawing()]});
const packet=frame=>({frame,trajectoryHandles:true,tool:'select',active:true,disabled:false,token:'token',revision:4,cameraView:'front',cameraReset:0,zoom:1,landscape:false});
const drag=(frame,kind='middle')=>({...trajectoryHandleTarget(frame,packet(frame),kind),initial:.025,value:3,stepId:'step',token:'token',revision:4,cameraView:'front',cameraReset:0,zoom:1,moved:true});

test('legacy arrows and curves keep their exact stroke until a height profile is authored',()=>{
 const item=drawing();assert.deepEqual(trajectoryStroke(item),item.points);
 for(const landscape of [false,true]){item.kind='curve';assert.deepEqual(trajectoryStroke(item,landscape),curvePoints(item.points,landscape));}
});
test('explicit height passes through start, middle and end without changing the XZ plan',()=>{
 const item={...drawing(),trajectoryHeights:{start:1,middle:4,end:2}},stroke=trajectoryStroke(item);
 assert.equal(stroke.length,33);near(stroke[0].y,1);near(stroke[16].y,4);near(stroke.at(-1).y,2);
 stroke.forEach((point,i)=>{near(point.x,-2+5*i/32);near(point.z,3-7*i/32);});
 for(const landscape of [false,true]){
  const curve={...item,kind:'curve'},shown=trajectoryStroke(curve,landscape),base=curvePoints(curve.points,landscape);
  assert.deepEqual(shown.map(({x,z})=>({x,z})),base.map(({x,z})=>({x,z})));
  assert.deepEqual(trajectoryHandlePoint(curve,'middle',landscape),shown[16]);
 }
});
test('polyline middle follows half the XZ length and keeps every authored corner',()=>{
 const item={...drawing(),points:[{x:0,y:1,z:0},{x:1,y:1,z:0},{x:1,y:1,z:9}],trajectoryHeights:{start:1,middle:3,end:1}},stroke=trajectoryStroke(item),middle=trajectoryHandlePoint(item,'middle');
 near(middle.x,1);near(middle.z,4);near(middle.y,3);assert.ok(stroke.some(point=>point.x===1&&point.z===0));
});
test('selection and arrow tip follow the same elevated dashed path without a floor rectangle',()=>{
 const item={...drawing(),dashed:true,trajectoryHeights:{start:2,middle:4,end:1}},stroke=trajectoryStroke(item),selection=createTrajectorySelection(item),trace=selection.children[0],positions=trace.geometry.attributes.position;
 assert.equal(selection.userData.interactionIgnore,true);assert.equal(trace.material.isLineDashedMaterial,true);assert.equal(trace.material.dashSize,.16);assert.equal(trace.material.gapSize,.12);
 assert.equal(positions.count,stroke.length);stroke.forEach((point,index)=>{near(positions.getX(index),point.x);near(positions.getY(index),point.y);near(positions.getZ(index),point.z);});
 assert.deepEqual(selection.children[1].position.toArray(),Object.values(stroke.at(-1)));
});
test('zero and overshooting profiles stay above the floor and within the height limit',()=>{
 for(const profile of [{start:0,middle:0,end:0},{start:8.12,middle:8.12,end:0},{start:0,middle:0,end:8.12}]){
  const item={...drawing(),trajectoryHeights:profile},stroke=trajectoryStroke(item);assert.ok(stroke.every(point=>point.y>=.025&&point.y<=8.12));
  near(trajectoryHandlePoint(item,'middle').y,Math.max(.025,profile.middle));
 }
});
test('44 px trajectory controls leave the linked ball, one another and editor controls accessible',()=>{
 for(const [width,height,top,bottom] of [[390,844,144,120],[819,379,120,100]]){
  const points=[{kind:'start',x:200,y:height/2,linked:true,preferred:{x:136,y:height/2}},{kind:'middle',x:208,y:height/2+2},{kind:'end',x:212,y:height/2+5}];
  const layouts=trajectoryControlLayout(points,width,height,top,bottom);
  for(const at of layouts){assert.ok(at.x-22>=66&&at.x+22<=width);assert.ok(at.y-22>=top&&at.y+22<=height-bottom);assert.ok(Math.hypot(at.x-200,at.y-height/2)>=48);}
  for(let i=0;i<layouts.length;i++)for(let j=i+1;j<layouts.length;j++)assert.ok(Math.hypot(layouts[i].x-layouts[j].x,layouts[i].y-layouts[j].y)>=48);
  assert.ok(layouts[0].tether);
 }
});

test('portrait middle handle leaves the measured host actions menu with its entire touch target',()=>{
 const menu={x:194,y:308,width:48,height:178},points=[{kind:'start',x:170,y:430,linked:true,preferred:{x:106,y:430}},{kind:'middle',x:218.8,y:367.7},{kind:'end',x:290,y:286}],layouts=trajectoryControlLayout(points,379,819,144,120,menu);
 const overlaps=at=>at.x+26>menu.x&&at.x-26<menu.x+menu.width&&at.y+26>menu.y&&at.y-26<menu.y+menu.height;
 for(const at of layouts){assert.equal(overlaps(at),false,at.kind+' must clear host actions');assert.ok(at.x-22>=66&&at.x+22<=379);}
 assert.ok(layouts.find(item=>item.kind==='middle').tether);
 for(let i=0;i<layouts.length;i++)for(let j=i+1;j<layouts.length;j++)assert.ok(Math.hypot(layouts[i].x-layouts[j].x,layouts[i].y-layouts[j].y)>=48);
 for(const absent of [null,{x:0,y:0,width:0,height:0},{x:NaN,y:0,width:48,height:178}])assert.deepEqual(trajectoryControlLayout(points,379,819,144,120,absent),trajectoryControlLayout(points,379,819,144,120));
});
test('height handles require one editable authored trajectory and retain a locked linked start as disabled',()=>{
 const frame=fixture();assert.equal(trajectoryHandleTarget(frame,packet(frame),'middle').editable,true);
 frame.drawings[0].trajectoryHandles[0].editable=false;assert.equal(trajectoryHandleTarget(frame,packet(frame),'start').editable,false);
 for(const change of [{disabled:true},{active:false},{tool:'animate'},{trajectoryHandles:false}])assert.equal(trajectoryHandleTarget(frame,{...packet(frame),...change},'middle'),null);
 for(const property of ['hidden','locked','simulated']){frame.drawings[0][property]=true;assert.equal(trajectoryHandleTarget(frame,packet(frame),'middle'),null);delete frame.drawings[0][property];}
 frame.selected=['arrow','other'];assert.equal(trajectoryHandleTarget(frame,packet(frame),'middle'),null);
});
test('trajectory commit validates selection, context and source point while preview never changes XZ',()=>{
 const frame=fixture(),gesture=drag(frame),before=JSON.stringify(frame),shown=previewTrajectoryProfile(frame,gesture);
 assert.equal(JSON.stringify(frame),before);assert.deepEqual(shown.drawings[0].points.map(({x,z})=>({x,z})),frame.drawings[0].points.map(({x,z})=>({x,z})));
 near(trajectoryStroke(shown.drawings[0])[16].y,3);assert.deepEqual(trajectoryDragCommand(gesture,packet(frame)),{id:'arrow',handle:'middle',value:3});
 assert.equal(trajectoryDragCommand(gesture,packet(frame),true),null);
 for(const change of [{revision:5},{token:'other'},{zoom:2},{cameraReset:1},{cameraView:'side'}])assert.equal(shouldCancelTrajectoryDrag(gesture,{...packet(frame),...change}),true);
 frame.drawings[0].points[0].x++;assert.equal(shouldCancelTrajectoryDrag(gesture,packet(frame)),true);
});
test('linked ball height previews update all starts while explicit middle and end heights remain fixed',()=>{
 const frame=fixture(),arrow=frame.drawings[0];arrow.startBallId='ball';arrow.points[0].y=1.12;arrow.trajectoryHeights={start:1.12,middle:3,end:2};
 frame.drawings.push({id:'ball',kind:'ball',elevation:1,points:[{...arrow.points[0]}]});
 const shown=previewCourtObjects(frame,null,{id:'ball',value:4}),next=shown.drawings[0];
 assert.deepEqual(next.trajectoryHeights,{start:4.12,middle:3,end:2});near(trajectoryHandlePoint(next,'start').y,4.12);near(trajectoryHandlePoint(next,'middle').y,3);near(trajectoryHandlePoint(next,'end').y,2);
 const moved=previewCourtObjects(frame,{ids:['arrow'],delta:{x:.1,y:0}},null).drawings[0];assert.equal(moved.startBallId,undefined);assert.deepEqual(moved.trajectoryHeights,arrow.trajectoryHeights);
});
test('upright drag planes stay finite at mobile and oblique pitches and reject parallel rays',()=>{
 const point=new THREE.Vector3(-1,2,3);
 for(const pitch of [.25,.65,1.4])for(const yaw of [0,.6145,Math.PI/2]){
  const camera=new THREE.PerspectiveCamera(39,379/819,.1,200);camera.position.set(Math.sin(yaw)*Math.cos(pitch)*25,Math.sin(pitch)*25,Math.cos(yaw)*Math.cos(pitch)*25);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const direction=camera.getWorldDirection(new THREE.Vector3()),plane=trajectoryDragPlane(direction,point),ray=new THREE.Raycaster(),screen=point.clone().project(camera);near(plane.normal.y,0);
  ray.setFromCamera(new THREE.Vector2(screen.x,screen.y),camera);const hit=trajectoryPlanePoint(ray.ray,plane);assert.ok(hit);near(hit.distanceTo(point),0);
  const lateral=trajectoryLateralDelta(direction,.5);near(Math.hypot(lateral.x,lateral.z),.5);near(lateral.y,0);near(plane.normal.dot(new THREE.Vector3(lateral.x,lateral.y,lateral.z)),0);
  assert.equal(trajectoryPlanePoint(new THREE.Ray(point,new THREE.Vector3(0,1,0)),plane),null);
 }
 assert.equal(trajectoryDragPlane({x:0,y:-1,z:0},point),null);assert.equal(trajectoryPlanePoint(new THREE.Ray(point,new THREE.Vector3(NaN,0,0)),trajectoryDragPlane({x:0,y:0,z:-1},point)),null);
});
test('XYZ commands clamp the point, retain guard checks and allow lateral-only edits',()=>{
 const frame=fixture(),gesture=drag(frame),target=trajectoryHandleTarget(frame,packet(frame),'middle');
 const destination=trajectoryPointValue(target,{x:100,y:100,z:-100});assert.deepEqual(destination,{x:6.3,y:8.12,z:-11.7});
 gesture.destination={...gesture.point,x:gesture.point.x+.5,y:gesture.initial};gesture.value=gesture.initial;
 assert.deepEqual(trajectoryPointDragCommand(gesture,packet(frame)),{id:'arrow',handle:'middle',point:gesture.destination});
 assert.equal(trajectoryPointDragCommand(gesture,packet(frame),true),null);assert.equal(trajectoryPointDragCommand(gesture,{...packet(frame),revision:5}),null);
 assert.equal(trajectoryPointValue(target,{x:NaN,y:0,z:0}),null);
 near(trajectoryPointValue({...target,min:.12,value:.12},{x:0,y:-10,z:0}).y,.12);
});
test('middle lateral previews reshape the same on-curve point without creating an elevation profile',()=>{
 const frame=fixture(),gesture=drag(frame);gesture.destination={...gesture.point,x:gesture.point.x+1,y:gesture.initial};
 const before=JSON.stringify(frame),shown=previewTrajectoryPoint(frame,gesture),curve=shown.drawings[0];assert.equal(JSON.stringify(frame),before);
 assert.equal(curve.kind,'curve');assert.equal(curve.curveMode,'through-point');assert.equal(curve.trajectoryHeights,undefined);near(trajectoryHandlePoint(curve,'middle').x,gesture.destination.x);
 const middle=trajectoryHandlePoint(curve,'middle'),straight=previewTrajectoryPoint(shown,{...gesture,point:middle,destination:{x:.5,y:.025,z:-.5}}).drawings[0];assert.equal(straight.kind,'arrow');assert.equal(straight.points.length,2);
});
test('endpoint lateral previews preserve the quadratic control in both orientations and polyline corners',()=>{
 for(const landscape of [false,true]){
  const frame=fixture();frame.drawings[0].kind='curve';const gesture=drag(frame,'end'),oldMiddle=trajectoryHandlePoint(frame.drawings[0],'middle',landscape);
  gesture.point=trajectoryHandlePoint(frame.drawings[0],'end',landscape);gesture.destination={...gesture.point,x:gesture.point.x+1,y:gesture.initial,z:gesture.point.z+2};
  const shape=previewTrajectoryPoint(frame,gesture,landscape).drawings[0],middle=trajectoryHandlePoint(shape,'middle',landscape);assert.equal(shape.curveMode,'through-point');assert.equal(shape.trajectoryHeights,undefined);near(middle.x,oldMiddle.x+.25);near(middle.z,oldMiddle.z+.5);
 }
 const frame=fixture();frame.drawings[0].points.splice(1,0,{x:0,y:.025,z:2});const gesture=drag(frame,'end');gesture.destination={...gesture.point,x:4,y:.025};const shape=previewTrajectoryPoint(frame,gesture).drawings[0];assert.equal(shape.kind,'arrow');assert.deepEqual(shape.points[1],frame.drawings[0].points[1]);
});
test('pure height keeps the plan while diagonal edits preserve explicit other heights',()=>{
 const frame=fixture(),gesture=drag(frame);gesture.destination={...gesture.point,y:3};const raised=previewTrajectoryPoint(frame,gesture).drawings[0];assert.equal(raised.kind,'arrow');near(trajectoryHandlePoint(raised,'middle').y,3);
 assert.deepEqual(raised.points.map(({x,z})=>({x,z})),frame.drawings[0].points.map(({x,z})=>({x,z})));
 frame.drawings[0].trajectoryHeights={start:1,middle:2,end:1.5};gesture.destination={...gesture.point,x:1,y:4};const diagonal=previewTrajectoryPoint(frame,gesture).drawings[0];assert.equal(diagonal.kind,'curve');assert.deepEqual(diagonal.trajectoryHeights,{start:1,middle:4,end:1.5});near(trajectoryHandlePoint(diagonal,'middle').x,1);near(trajectoryHandlePoint(diagonal,'middle').y,4);
});
