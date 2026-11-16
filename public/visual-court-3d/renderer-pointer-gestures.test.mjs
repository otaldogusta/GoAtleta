import test from 'node:test';
import assert from 'node:assert/strict';
import {pointerDragThreshold,emptyTouchContacts,advanceTouchContacts,cancelTouchContacts,touchPair,orbitPointerDrag,boundedObjectDrag,beginTouchCamera,moveTouchCamera,shouldReleaseMovePreview,resizeCameraZoom} from './renderer-pointer-gestures.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const point=(x,y)=>({x,y});

test('one finger permits editing; the second takes over once and never changes the first grab point',()=>{
 const first=advanceTouchContacts(emptyTouchContacts(),'down',7,point(90,200));
 assert.equal(first.suppressed,false);assert.equal(first.action,'none');assert.equal(touchPair(first),null);
 const second=advanceTouchContacts(first,'down',9,point(220,230));
 assert.equal(second.action,'begin');assert.equal(second.suppressed,true);assert.deepEqual(second.pair,[7,9]);
 assert.deepEqual(first.points.get(7),point(90,200));assert.equal(first.points.size,1,'input is not mutated');
 const moved=advanceTouchContacts(second,'move',9,point(240,260));assert.equal(moved.action,'update');
 assert.deepEqual(touchPair(moved),[point(90,200),point(240,260)]);
});

test('lifting either finger freezes all residual touches until the whole sequence ends',()=>{
 for(const removed of [1,2]){
  let state=advanceTouchContacts(emptyTouchContacts(),'down',1,point(100,100));
  state=advanceTouchContacts(state,'down',2,point(200,100));
  state=advanceTouchContacts(state,'down',3,point(250,100));assert.deepEqual(state.pair,[1,2]);assert.equal(state.action,'none');
  state=advanceTouchContacts(state,'up',removed);assert.equal(state.action,'finish');assert.equal(state.suppressed,true);assert.equal(state.pair,null);
  state=advanceTouchContacts(state,'move',3,point(260,100));assert.equal(state.action,'none');assert.equal(state.suppressed,true);
  state=advanceTouchContacts(state,'down',4,point(300,100));assert.equal(state.action,'none');assert.equal(state.pair,null);
  for(const id of [...state.points.keys()])state=advanceTouchContacts(state,'up',id);
  assert.deepEqual(state.points,new Map());assert.equal(state.suppressed,false);
  state=advanceTouchContacts(state,'down',5,point(10,10));assert.equal(state.suppressed,false);assert.equal(state.action,'none');
 }
});

test('cancel, revision change or lost capture cannot revive a pending edit from a remaining pointer',()=>{
 let state=advanceTouchContacts(emptyTouchContacts(),'down',1,point(20,20));
 state=cancelTouchContacts(state);assert.equal(state.suppressed,true);
 state=advanceTouchContacts(state,'down',2,point(40,40));assert.equal(state.action,'none');assert.equal(state.pair,null);
 state=advanceTouchContacts(state,'cancel',1);assert.equal(state.suppressed,true);
 state=advanceTouchContacts(state,'cancel',2);assert.equal(state.suppressed,false);
 const stale=advanceTouchContacts(state,'move',1,point(100,100));assert.equal(stale.points.size,0);assert.equal(stale.action,'none');
});

test('touch jitter threshold is eight pixels while mouse sensitivity remains compatible',()=>{
 assert.equal(pointerDragThreshold('touch'),8);assert.equal(pointerDragThreshold('mouse'),5);assert.equal(pointerDragThreshold('pen'),5);
 const angles={azimuth:.5,elevation:.4};
 const mouse=orbitPointerDrag(angles,point(100,100),point(200,150),{width:1307,height:857},'mouse');near(mouse.azimuth,0);near(mouse.elevation,.55);
 const phone=orbitPointerDrag(angles,point(0,0),point(390/4,844/4),{width:390,height:844},'touch');
 const tablet=orbitPointerDrag(angles,point(0,0),point(834/4,1194/4),{width:834,height:1194},'touch');
 near(phone.azimuth,tablet.azimuth);near(phone.elevation,tablet.elevation);
 assert.equal(orbitPointerDrag(angles,point(0,0),point(0,9999),{width:390,height:844},'touch').elevation,1.25);
});

test('an offset grab beyond the court remains stationary at zero delta and reaches the full destination bounds',()=>{
 const start=point(1.4,-.4),anchor=point(.8,.5);
 assert.deepEqual(boundedObjectDrag(start,start,anchor),start);
 const moved=boundedObjectDrag(point(2.4,-1.4),start,anchor);
 near(anchor.x+moved.x-start.x,1.2);near(anchor.y+moved.y-start.y,-.15);
 const normal=boundedObjectDrag(point(1.45,-.3),start,anchor);near(normal.x,1.45);near(normal.y,-.3);
});

test('a committed preview survives old frames but releases before a new revision or invalid context',()=>{
 const pending={token:'local',revision:3,stepId:'step',tool:'select',ids:['actor']},next={token:'local',revision:3,tool:'select',active:true,disabled:false,frame:{stepId:'step',hide:[],actors:[{id:'actor'}],drawings:[]}};
 assert.equal(shouldReleaseMovePreview(pending,next),false);
 for(const change of [{revision:4},{token:'other'},{tool:'animate'},{active:false},{disabled:true}])assert.equal(shouldReleaseMovePreview(pending,{...next,...change}),true);
 for(const change of [{stepId:'other'},{actors:[]},{hide:['actors']},{actors:[{id:'actor',locked:true}]},{actors:[{id:'actor',hidden:true}]}])assert.equal(shouldReleaseMovePreview(pending,{...next,frame:{...next.frame,...change}}),true);
});

test('responsive clamping at both limits never erases the original zoom intention',()=>{
 const limits={min:12,max:140};
 for(const [distance,oldFit,newFit,bound] of [[100,40,80,140],[15,80,20,12]]){
  let state=resizeCameraZoom(distance,oldFit,newFit,limits);assert.equal(state.distance,bound);
  for(let i=0;i<20;i++){
   state=resizeCameraZoom(state.distance,newFit,oldFit,limits,state.ratio);near(state.distance,distance);
   state=resizeCameraZoom(state.distance,oldFit,newFit,limits,state.ratio);assert.equal(state.distance,bound);
  }
 }
 const changedByUser=resizeCameraZoom(100,80,40,limits,null);assert.equal(changedByUser.distance,50);
});

test('pinch starts without a jump and preserves its original midpoint anchor while zooming',()=>{
 const pair=[point(100,300),point(300,500)],camera={azimuth:.7,elevation:.4,distance:40,target:{x:1,y:1.2,z:2},fov:39},viewport={width:390,height:844};
 const start=beginTouchCamera(pair,camera,viewport,{min:12,max:140}),same=moveTouchCamera(start,pair);
 near(same.distance,camera.distance);for(const axis of ['x','y','z'])near(same.target[axis],camera.target[axis]);
 const zoomed=moveTouchCamera(start,[point(0,200),point(400,600)]);near(zoomed.distance,20);
 const center=point(200,400),wpp=zoomed.distance*start.scale,px=center.x-viewport.width/2,py=viewport.height/2-center.y;
 for(const axis of ['x','y','z'])near(zoomed.target[axis]+(start.right[axis]*px+start.up[axis]*py)*wpp,start.anchor[axis]);
 assert.equal(start.distance,40);assert.deepEqual(camera.target,{x:1,y:1.2,z:2});
});

test('two-finger pan and pinch use the initial state without event-rate drift or singular distance',()=>{
 const pair=[point(100,200),point(200,200)],camera={azimuth:0,elevation:.4,distance:30,target:{x:0,y:1,z:0},fov:39};
 const start=beginTouchCamera(pair,camera,{width:390,height:844},{min:12,max:100}),pan=moveTouchCamera(start,[point(130,240),point(230,240)]);
 near(pan.distance,30);assert.ok(pan.target.x<0&&pan.target.y>1&&pan.target.z<0);
 for(let i=0;i<30;i++)moveTouchCamera(start,[point(100-i,200),point(200+i,200)]);
 assert.deepEqual(moveTouchCamera(start,[point(130,240),point(230,240)]),pan);
 assert.equal(moveTouchCamera(start,[point(-10000,0),point(10000,0)]).distance,12);
 assert.equal(moveTouchCamera(start,[point(150,200),point(150,200)]).distance,100);
 const close=beginTouchCamera([point(150,200),point(150,200)],camera,{width:390,height:844},{min:12,max:100});
 near(moveTouchCamera(close,[point(150,200),point(150,200)]).distance,30);
});
