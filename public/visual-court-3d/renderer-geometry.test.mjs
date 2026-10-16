import test from 'node:test';
import assert from 'node:assert/strict';
import {worldToCourt,courtToWorld,snapPoint,snappedGesture,curvePoints,editableIds,movementTrail} from './renderer-geometry.mjs';
test('regulation coordinates round-trip without orientation changes',()=>{
 for(const point of [{x:0,y:0},{x:1,y:1},{x:.2,y:.85},{x:-.2,y:1.15}]){
  const result=worldToCourt(courtToWorld(point));assert.ok(Math.abs(result.x-point.x)<1e-12);assert.ok(Math.abs(result.y-point.y)<1e-12);
 }
});
test('grid snaps drag anchor, not the pointer offset',()=>{
 const anchor={x:.21,y:.78},start={x:.3,y:.6},point={x:.4,y:.8};
 const result=snappedGesture(point,start,anchor,true,'select','free');
 assert.deepEqual(snapPoint({x:anchor.x+point.x-start.x,y:anchor.y+point.y-start.y}),{x:anchor.x+result.x-start.x,y:anchor.y+result.y-start.y});
 assert.equal(snappedGesture(point,start,anchor,true,'animate','free'),point);
});
test('curve preserves exact author endpoints',()=>{
 const a={x:-3,y:.03,z:5},b={x:2,y:.03,z:1},points=curvePoints([a,b]);assert.deepEqual(points[0],a);assert.deepEqual(points.at(-1),b);
});
test('curve control follows the same portrait and landscape projection as 2D',()=>{
 const points=[{x:-3,y:.03,z:5},{x:2,y:.03,z:1}];
 const portrait=curvePoints(points),landscape=curvePoints(points,true);
 assert.ok(Math.abs(portrait[16].x-(-.5+.325))<1e-12);
 assert.ok(Math.abs(landscape[16].x-(-.5-.325))<1e-12);
 assert.equal(portrait[16].z,landscape[16].z);
 assert.deepEqual(landscape[0],points[0]);assert.deepEqual(landscape.at(-1),points.at(-1));
});
test('locked, unknown and removed objects cannot be dragged',()=>{
 assert.deepEqual(editableIds(['a','locked','deleted','drawing'],{actors:[{id:'a'},{id:'locked',locked:true}],drawings:[{id:'drawing'}]}),['a','drawing']);
});
test('movement trail uses the shared clock and ends behind the current token',()=>{
 const points=[{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:0,z:4}];
 assert.deepEqual(movementTrail(points,0),[]);
 assert.deepEqual(movementTrail(points,.5,.55).at(-1),{x:1.45,y:0,z:0});
 assert.deepEqual(movementTrail(points,.75,.55).at(-1),{x:2,y:0,z:1.45});
});
