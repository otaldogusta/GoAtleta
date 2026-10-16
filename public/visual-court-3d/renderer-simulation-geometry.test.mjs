import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationHandleEdit,isHeightHandle,previewAttackCurve,actorPoseView} from './renderer-simulation-geometry.mjs';
import {createSimulationGuides} from './renderer-simulation.mjs';

test('handle preview uses world coordinates and bounds height without owning settings',()=>{
 const handle={kind:'set',point:{x:0,y:4,z:1},value:1.8},before=JSON.stringify(handle);
 assert.deepEqual(simulationHandleEdit(handle,{x:0,y:6,z:1},2),{kind:'set',point:{x:0,y:6,z:1},value:3.8});
 assert.equal(simulationHandleEdit(handle,{x:0,y:9,z:1},8).value,5);
 assert.equal(simulationHandleEdit({...handle,kind:'pass'},{x:0,y:0,z:1},-8).value,.4);
 assert.equal(JSON.stringify(handle),before);
 assert.equal(simulationHandleEdit(handle,{x:NaN,y:2,z:1}),null);
 assert.equal(simulationHandleEdit({kind:'foreign'},{x:1,y:1,z:1}),null);
});
test('horizontal handles keep strike, target and serve gestures within their court domains',()=>{
 assert.deepEqual(simulationHandleEdit({kind:'target'},{x:20,y:.12,z:5}),{kind:'target',point:{x:9,y:.12,z:-.75}});
 assert.deepEqual(simulationHandleEdit({kind:'serve'},{x:-9,y:.03,z:13}),{kind:'serve',point:{x:-4.5,y:.03,z:9}});
 assert.deepEqual(simulationHandleEdit({kind:'hit'},{x:8,y:3,z:-3}),{kind:'hit',point:{x:4.43,y:3,z:.1}});
});
test('attack curvature edits only its value and retains the intent midpoint footprint',()=>{
 const handle={kind:'attack',point:{x:-.7,y:1.7,z:-2.2},value:.14},before=JSON.stringify(handle);
 const edit=simulationHandleEdit(handle,{x:3,y:2.9,z:-8},1.2);
 assert.equal(edit.kind,'attack');assert.deepEqual(edit.point,{x:-.7,y:2.9,z:-2.2});
 assert.ok(Math.abs(edit.value-1.34)<1e-12);
 assert.equal(simulationHandleEdit(handle,{x:4,y:3,z:1},0).value,handle.value);
 assert.equal(simulationHandleEdit(handle,{x:0,y:9,z:0},20).value,4);
 assert.equal(simulationHandleEdit(handle,{x:0,y:0,z:0},-20).value,.03);
 assert.equal(JSON.stringify(handle),before);
});
test('all height handles preserve horizontal coordinates and reject malformed values',()=>{
 for(const kind of ['set','pass','attack']){
  const handle={kind,point:{x:-2,y:3,z:.6},value:1.8};
  assert.equal(isHeightHandle(kind),true);
  const edit=simulationHandleEdit(handle,{x:8,y:3.12,z:-10},.12);
  assert.equal(edit.point.x,handle.point.x);assert.equal(edit.point.z,handle.point.z);
  assert.ok(Math.abs(edit.value-1.92)<1e-12);
  assert.equal(simulationHandleEdit({...handle,value:NaN},{x:0,y:3,z:0},.1),null);
  assert.equal(simulationHandleEdit({...handle,point:{x:NaN,y:3,z:0}},{x:0,y:3,z:0},.1),null);
  assert.equal(simulationHandleEdit(handle,{x:0,y:3,z:0},Infinity),null);
 }
 for(const kind of ['hit','target','serve','foreign','toString'])assert.equal(isHeightHandle(kind),false);
});
function attackGuide(){
 const value=.12,points=Array.from({length:65},(_,index)=>{const u=index/64;return {x:-3.8+6*u,y:3+(0.12-3)*u+4*u*(1-u)*value,z:.6-7*u};}),middle=points[32];
 return {guideKey:'host-guide',ball:{x:-3,y:2,z:-1},config:{attackArc:null},walls:[{center:{x:-3,y:3,z:-.25}}],outcome:'Mão 1 → Chão · dentro',
  handles:[{kind:'attack',point:middle,value},{kind:'hit',point:points[0]}],
  paths:[{id:'set',points:[{x:1,y:2,z:1},points[0]]},{id:'attack-intent',points,color:'#72b6ef',opacity:.4},{id:'attack',points:[points[0],points[10]]},{id:'rebound-1',points:[points[10],points[12]]}],
  markers:[{id:'attack-curve',kind:'dot',point:middle},{id:'hit',kind:'ring',point:points[0]},{id:'contact-0-block',kind:'ring',point:points[10]},{id:'contact-dot-0',kind:'dot',point:points[10]},{id:'landing',kind:'cross',point:points[64]}],
 };
}
test('live attack preview deforms all 65 host points exactly while preserving contact, target and horizontal coordinates',()=>{
 const data=attackGuide(),before=JSON.stringify(data),preview=previewAttackCurve(data,1.8),source=data.paths.find(path=>path.id==='attack-intent').points,points=preview.paths.find(path=>path.id==='attack-intent').points;
 assert.equal(points.length,65);assert.equal(points[0],source[0]);assert.equal(points.at(-1),source.at(-1));
 points.forEach((point,index)=>{const u=index/64;assert.equal(point.x,source[index].x);assert.equal(point.z,source[index].z);assert.ok(Math.abs(point.y-source[index].y-4*u*(1-u)*(1.8-.12))<1e-12);});
 assert.deepEqual(preview.handles[0],{kind:'attack',point:points[32],value:1.8});
 assert.deepEqual(preview.markers.find(marker=>marker.id==='attack-curve').point,points[32]);
 assert.equal(preview.handles[1],data.handles[1]);assert.equal(preview.ball,data.ball);assert.equal(preview.config,data.config);assert.equal(preview.walls,data.walls);
 assert.deepEqual(preview.paths.map(path=>path.id),['set','attack-intent']);assert.deepEqual(preview.markers.map(marker=>marker.id),['attack-curve','hit']);assert.equal(preview.outcome,'');
 assert.equal(JSON.stringify(data),before);
});
test('attack preview is reversible, bounded and safely discarded without mutating its source',()=>{
 const data=attackGuide(),before=JSON.stringify(data),high=previewAttackCurve(data,4),lowered=previewAttackCurve(high,.12);
 const original=data.paths.find(path=>path.id==='attack-intent').points,restored=lowered.paths.find(path=>path.id==='attack-intent').points;
 restored.forEach((point,index)=>{assert.equal(point.x,original[index].x);assert.equal(point.z,original[index].z);assert.ok(Math.abs(point.y-original[index].y)<1e-12);});
 assert.equal(previewAttackCurve(data,.12),data);assert.equal(previewAttackCurve(data,NaN),data);assert.equal(previewAttackCurve(data,Infinity),data);
 assert.equal(previewAttackCurve(data,20).handles[0].value,4);assert.equal(previewAttackCurve(data,-20).handles[0].value,.03);
 const missing={...data,paths:data.paths.filter(path=>path.id!=='attack-intent')};assert.equal(previewAttackCurve(missing,2),missing);
 assert.equal(JSON.stringify(data),before);
});
test('sampled front attack and setter side poses retain exact facing and mirroring',()=>{
 const actor={poseRole:'attacker',poseScale:.9,position:{z:1},facing:[-1,0],side:false,mirror:true};
 assert.deepEqual(actorPoseView(actor,0),{side:false,view:'front',flip:true});
 assert.equal(actorPoseView({...actor,poseRole:'setter',side:true},0).view,'side');
 assert.equal(actorPoseView({...actor,poseRole:'setter',side:true,facing:[1,0]},0).flip,true);
 assert.equal(actorPoseView({...actor,poseRole:'setter',side:true,facing:[-1,0]},0).flip,false);
 assert.equal(actorPoseView({...actor,poseRole:'passer'},Math.PI/2).view,'side');
});
test('guide geometry consumes host paths, contact clocks and wall poses without a motion engine',()=>{
 const data={paths:[{id:'set',points:[{x:1,y:2,z:1},{x:0,y:4,z:1},{x:-3,y:3,z:.5}],color:'#72b6ef',opacity:.85},{id:'attack',points:[{x:-3,y:3,z:.5},{x:-2,y:2,z:-1},{x:0,y:.1,z:-5}],dashed:true,color:'#e89095',opacity:.8,arrow:1}],markers:[{id:'contact',kind:'ring',point:{x:-2,y:2,z:-1},color:'#ef858c',contactTime:2.7}],walls:[{center:{x:-3,y:2.9,z:0},width:.7,height:.6,angle:30}]};
 const before=JSON.stringify(data),group=createSimulationGuides(data);
 assert.equal(group.name,'simulation-guides');
 assert.ok(group.getObjectByName('set').geometry.type==='TubeGeometry');
 assert.equal(group.getObjectByName('attack').material.type,'LineDashedMaterial');
 assert.equal(group.getObjectByName('contact').userData.contactTime,2.7);
 const wall=group.children.find(child=>child.geometry?.type==='PlaneGeometry');
 assert.equal(wall.position.x,-3);assert.equal(wall.rotation.y,Math.PI/6);
 assert.equal(JSON.stringify(data),before);
});
