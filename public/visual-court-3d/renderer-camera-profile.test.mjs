import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationCameraDistance,resizedSimulationCameraDistance} from './renderer-camera-profile.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-11,`${actual} != ${expected}`);

test('simulation front and orbital camera baselines keep the approved desktop and compact profiles',()=>{
 assert.equal(simulationCameraDistance('attack','front',false),21.024);
 assert.equal(simulationCameraDistance('receive','front',false),28.6373);
 for(const mode of ['attack','receive'])for(const view of ['front','side','orbit']){
  assert.equal(simulationCameraDistance(mode,view,true),40);
  if(view!=='front')assert.equal(simulationCameraDistance(mode,view,false),25.138);
 }
});

test('resizing to mobile matches a fresh mobile view at the same user zoom',()=>{
 for(const mode of ['attack','receive'])for(const view of ['front','side','orbit'])for(const zoom of [.5,1,1.4,4]){
  const desktop=simulationCameraDistance(mode,view,false)/zoom;
  const mobile=resizedSimulationCameraDistance(desktop,mode,view,false,true);
  near(mobile,40/zoom);
  near(resizedSimulationCameraDistance(mobile,mode,view,true,false),desktop);
 }
});

test('a user-chosen distance retains its profile ratio through repeated breakpoint changes',()=>{
 for(const mode of ['attack','receive'])for(const view of ['front','side','orbit']){
  const initial=37.18,baseline=simulationCameraDistance(mode,view,false);
  let distance=initial;
  for(let index=0;index<20;index++){
   distance=resizedSimulationCameraDistance(distance,mode,view,false,true);
   near(distance/40,initial/baseline);
   distance=resizedSimulationCameraDistance(distance,mode,view,true,false);
  }
  near(distance,initial);
 }
});

test('same-breakpoint resize, density changes and duplicate notifications never drift distance',()=>{
 for(const compact of [false,true]){
  const distance=37.181234567;
  for(const mode of ['attack','receive'])for(const view of ['front','side','orbit']){
   assert.equal(resizedSimulationCameraDistance(distance,mode,view,compact,compact),distance);
  }
 }
});
