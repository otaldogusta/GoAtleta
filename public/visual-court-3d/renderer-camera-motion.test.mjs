import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_MOTION,sampleCameraAngularVelocity,releaseCameraMotion,integrateCameraMotion} from './renderer-camera-motion.mjs';

const near=(actual,expected,tolerance=1e-11)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function run(hz,angles={azimuth:.3,elevation:.6},velocity={azimuth:2,elevation:.5,timeMs:100}){
 let state={...angles,motion:releaseCameraMotion(velocity,100)},frames=0;
 while(state.motion&&frames<200){state=integrateCameraMotion(state,state.motion,1000/hz);frames++;}
 assert.equal(state.motion,null);
 return {...state,frames};
}

test('samples actual angular deltas in seconds and bounds unusually fast drags',()=>{
 const delta={azimuth:.02,elevation:-.01},before=JSON.stringify(delta);
 assert.deepEqual(sampleCameraAngularVelocity(null,delta,20,100),{azimuth:1,elevation:-.5,timeMs:100});
 assert.deepEqual(sampleCameraAngularVelocity(null,{azimuth:9,elevation:-9},1,100),{azimuth:3,elevation:-2,timeMs:100});
 assert.equal(JSON.stringify(delta),before);
});

test('constant angular movement samples equally at 30, 60 and 120Hz',()=>{
 for(const hz of [30,60,120]){
  const dt=1000/hz;
  let velocity=null;
  for(let i=1;i<=12;i++)velocity=sampleCameraAngularVelocity(velocity,{azimuth:1.2*dt/1000,elevation:-.4*dt/1000},dt,i*dt);
  near(velocity.azimuth,1.2);near(velocity.elevation,-.4);
 }
});

test('fresh samples smooth same-direction changes but reversals and stops take effect immediately',()=>{
 const old={azimuth:2,elevation:1,timeMs:100},before=JSON.stringify(old);
 const smoothed=sampleCameraAngularVelocity(old,{azimuth:.01,elevation:.005},20,120);
 assert.ok(smoothed.azimuth>.5&&smoothed.azimuth<2);
 assert.ok(smoothed.elevation>.25&&smoothed.elevation<1);
 const reversed=sampleCameraAngularVelocity(old,{azimuth:-.02,elevation:0},20,120);
 assert.deepEqual(reversed,{azimuth:-1,elevation:0,timeMs:120});
 assert.equal(releaseCameraMotion(sampleCameraAngularVelocity(old,{azimuth:0,elevation:0},20,120),120),null);
 assert.equal(JSON.stringify(old),before);
});

test('releasing is positionless and refuses old samples, clock reversal and malformed velocities',()=>{
 const velocity={azimuth:1,elevation:.4,timeMs:100},before=JSON.stringify(velocity);
 assert.deepEqual(releaseCameraMotion(velocity,180),{azimuth:1,elevation:.4,elapsedMs:0});
 assert.equal(releaseCameraMotion(velocity,180.001),null);
 assert.equal(releaseCameraMotion(velocity,99),null);
 for(const invalid of [null,{azimuth:NaN,elevation:1,timeMs:100},{azimuth:1,elevation:Infinity,timeMs:100},{azimuth:1,elevation:1,timeMs:NaN}])assert.equal(releaseCameraMotion(invalid,100),null);
 assert.equal(releaseCameraMotion(velocity,Infinity),null);
 assert.equal(JSON.stringify(velocity),before);
});

test('long pauses never retain stale fling velocity and invalid deltas cannot poison the next sample',()=>{
 const old={azimuth:3,elevation:2,timeMs:100};
 assert.deepEqual(sampleCameraAngularVelocity(old,{azimuth:.3,elevation:.2},200,300),{azimuth:0,elevation:0,timeMs:300});
 assert.deepEqual(sampleCameraAngularVelocity(old,{azimuth:.02,elevation:.01},20,300),{azimuth:1,elevation:.5,timeMs:300});
 for(const dt of [0,-1,NaN,Infinity])assert.equal(releaseCameraMotion(sampleCameraAngularVelocity(old,{azimuth:.02,elevation:.01},dt,120),120),null);
 assert.equal(releaseCameraMotion(sampleCameraAngularVelocity(old,{azimuth:NaN,elevation:.01},20,120),120),null);
 assert.equal(releaseCameraMotion(sampleCameraAngularVelocity(old,{azimuth:.02,elevation:.01},20,NaN),120),null);
 assert.equal(releaseCameraMotion(sampleCameraAngularVelocity(old,{azimuth:.02,elevation:.01},20,90),90),null);
});

test('exponential displacement matches the closed form without a release jump or mutable state',()=>{
 const angles={azimuth:.3,elevation:.6},motion={azimuth:2,elevation:.5,elapsedMs:0},before=JSON.stringify({angles,motion});
 const zero=integrateCameraMotion(angles,motion,0);
 assert.equal(zero.azimuth,angles.azimuth);assert.equal(zero.elevation,angles.elevation);
 const next=integrateCameraMotion(angles,motion,20),integral=(1-Math.exp(-14*.02))/14;
 near(next.azimuth,angles.azimuth+2*integral);near(next.elevation,angles.elevation+.5*integral);
 near(next.motion.azimuth,2*Math.exp(-14*.02));
 assert.equal(JSON.stringify({angles,motion}),before);
});

test('30, 60 and 120Hz finish at the same orientation within a short glide',()=>{
 const states=[30,60,120].map(hz=>run(hz));
 for(const state of states){near(state.azimuth,states[0].azimuth);near(state.elevation,states[0].elevation);}
 states.forEach((state,index)=>assert.ok(state.frames/[30,60,120][index]>=.2&&state.frames/[30,60,120][index]<=.4));
 // At the velocity cap the total possible yaw is under thirteen degrees.
 const fast=run(120,{azimuth:0,elevation:.6},{azimuth:3,elevation:0,timeMs:100});
 assert.ok(fast.azimuth<13*Math.PI/180);
});

test('the cutoff instant is exact across frame sizes, including a slow final drift',()=>{
 for(const velocity of [{azimuth:.04,elevation:0,timeMs:100},{azimuth:.7,elevation:.2,timeMs:100}]){
  const states=[30,60,120].map(hz=>run(hz,{azimuth:0,elevation:.6},velocity));
  const speed=Math.hypot(velocity.azimuth,velocity.elevation),seconds=Math.min(.35,Math.log(speed/.02)/14),integral=(1-Math.exp(-14*seconds))/14;
  for(const state of states){near(state.azimuth,velocity.azimuth*integral);near(state.elevation,.6+velocity.elevation*integral);}
 }
 assert.equal(releaseCameraMotion({azimuth:.02,elevation:0,timeMs:100},100),null);
});

test('pitch reaches each pole without rebound or stored outward velocity, while yaw continues',()=>{
 for(const [elevation,pitch,bound] of [[1.24,2,1.25],[.13,-2,.12]]){
  const angles={azimuth:0,elevation},motion={azimuth:1,elevation:pitch,elapsedMs:0};
  const first=integrateCameraMotion(angles,motion,30);
  assert.equal(first.elevation,bound);assert.equal(first.motion.elevation,0);assert.ok(first.azimuth>0);
  const next=integrateCameraMotion(first,first.motion,30);
  assert.equal(next.elevation,bound);assert.ok(next.azimuth>first.azimuth);
  const states=[30,60,120].map(hz=>run(hz,angles,{azimuth:1,elevation:pitch,timeMs:100}));
  for(const state of states){assert.equal(state.elevation,bound);near(state.azimuth,states[0].azimuth);}
 }
 const stopped=integrateCameraMotion({azimuth:0,elevation:1.25},{azimuth:0,elevation:2,elapsedMs:0},16);
 assert.deepEqual(stopped,{azimuth:0,elevation:1.25,motion:null});
});

test('custom pitch bounds and a pitch-only collision stop exactly at the bound',()=>{
 const options={minElevation:.2,maxElevation:1},angles={azimuth:0,elevation:.99};
 const next=integrateCameraMotion(angles,{azimuth:0,elevation:2,elapsedMs:0},50,options);
 assert.deepEqual(next,{azimuth:0,elevation:1,motion:null});
 const inward=integrateCameraMotion({azimuth:0,elevation:1},{azimuth:0,elevation:-1,elapsedMs:0},16,options);
 assert.ok(inward.elevation<1&&inward.elevation>=.2);
});

test('bounded elapsed time, malformed input and repeated stopped frames remain finite and stationary',()=>{
 const angles={azimuth:.3,elevation:.6},motion={azimuth:2,elevation:.5,elapsedMs:CAMERA_MOTION.maxDurationMs};
 assert.deepEqual(integrateCameraMotion(angles,motion,16),{...angles,motion:null});
 assert.deepEqual(integrateCameraMotion(angles,null,16),{...angles,motion:null});
 for(const dt of [-1,NaN,Infinity])assert.deepEqual(integrateCameraMotion(angles,{...motion,elapsedMs:0},dt),{...angles,motion:null});
 const invalid=integrateCameraMotion({azimuth:NaN,elevation:Infinity},{azimuth:Infinity,elevation:0,elapsedMs:0},16,{minElevation:NaN,maxElevation:0});
 assert.deepEqual(invalid,{azimuth:0,elevation:.12,motion:null});
 const long=integrateCameraMotion(angles,{...motion,elapsedMs:0},1000);
 assert.equal(long.motion,null);assert.ok(Number.isFinite(long.azimuth)&&Number.isFinite(long.elevation));
 assert.deepEqual(integrateCameraMotion(long,long.motion,16),long);
});
