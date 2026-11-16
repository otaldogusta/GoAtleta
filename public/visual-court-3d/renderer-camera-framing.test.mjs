import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {collectFrameFitPoints,fitCameraDistance,resizedFitDistance} from './renderer-camera-framing.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function projectAll(points,options){
 const distance=fitCameraDistance(points,options),{target,azimuth,elevation,width,height}=options;
 const camera=new THREE.PerspectiveCamera(options.fov||39,width/height,.1,180);
 camera.position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);
 camera.lookAt(new THREE.Vector3(target.x,target.y,target.z));camera.updateMatrixWorld();
 for(const p of points){
  const projected=new THREE.Vector3(p.x,p.y,p.z).project(camera);
  const x=(projected.x+1)*width/2,y=(1-projected.y)*height/2;
  assert.ok(x>=options.leftInset-1e-7&&x<=width-options.rightInset+1e-7,`x ${x}, width ${width}`);
  assert.ok(y>=options.topInset-1e-7&&y<=height-options.bottomInset+1e-7,`y ${y}, height ${height}`);
  assert.ok(projected.z>=-1&&projected.z<1);
 }
 return distance;
}
const fixture=()=>({court:true,net:true,hide:[],actors:[
 {id:'raised-player',position:{x:-2,y:8,z:5},path:[]},
 {id:'runner',position:{x:0,y:0,z:0},path:[{x:-3,y:0,z:-7},{x:4,y:0,z:7}]},
],drawings:[{id:'raised-ball',kind:'ball',size:32,points:[{x:4,y:8.12,z:-8}]}]});

test('actual perspective projections fit portrait, landscape and desktop useful areas',()=>{
 const points=collectFrameFitPoints(fixture());
 for(const [width,height] of [[320,568],[390,844],[844,390],[1243,699]])for(const azimuth of [0,.6145,Math.PI/2]){
  projectAll(points,{width,height,azimuth,elevation:width<600?.65:.45,target:{x:0,y:1.2,z:0},topInset:Math.min(144,height*.35),bottomInset:Math.min(120,height*.3),leftInset:60,rightInset:24});
 }
});

test('fit supports asymmetric margins and a translated camera target',()=>{
 const points=collectFrameFitPoints(fixture());
 projectAll(points,{width:390,height:844,azimuth:-1.1,elevation:.75,target:{x:1.5,y:1.8,z:-1.2},topInset:160,bottomInset:110,leftInset:68,rightInset:12});
});

test('complete guide paths frame the server and high flight without following sampled simulation state',()=>{
 const frame={court:true,net:true,hide:[],actors:[{id:'server',simulated:true,position:{x:2,y:0,z:-12},jump:0}],drawings:[{id:'ball',kind:'ball',simulated:true,points:[{x:2,y:2,z:-12}]}],simulation:{ball:{x:2,y:2,z:-12},paths:[{id:'serve',points:[{x:2,y:3,z:-12},{x:0,y:10,z:0},{x:-1,y:0,z:8}]}],markers:[{point:{x:5,y:.03,z:8}}],handles:[{point:{x:0,y:10,z:0}}],walls:[]}};
 const before=collectFrameFitPoints(frame);
 assert.ok(before.some(p=>p.z<-12));assert.ok(before.some(p=>p.y>=10));
 frame.progress=.8;frame.actors[0].position={x:3,y:1,z:2};frame.actors[0].jump=1;frame.drawings[0].points=[{x:-1,y:4,z:7}];frame.simulation.ball=frame.drawings[0].points[0];
 assert.deepEqual(collectFrameFitPoints(frame),before);
 projectAll(before,{width:390,height:844,azimuth:0,elevation:.65,target:{x:0,y:1.2,z:0},topInset:144,bottomInset:120,leftInset:60,rightInset:20});
});

test('authored motion bounds do not depend on the sampled position and never mutate frame input',()=>{
 const frame=fixture();frame.drawings[0].motion=[{x:-4,y:8.12,z:-8},{x:4,y:8.12,z:8}];
 const source=JSON.stringify(frame),before=collectFrameFitPoints(frame);assert.equal(JSON.stringify(frame),source);
 frame.actors[1].position={x:4,y:0,z:7};frame.drawings[0].points=[{x:4,y:8.12,z:8}];
 assert.deepEqual(collectFrameFitPoints(frame),before);
});

test('simulation wall bounds use the plane center, half height and actual rotation',()=>{
 const frame={court:false,net:false,hide:[],actors:[],drawings:[],simulation:{paths:[],markers:[],handles:[],walls:[{center:{x:1,y:2,z:3},width:4,height:2,angle:90}]}};
 const points=collectFrameFitPoints(frame);
 assert.equal(points.length,4);for(const p of points){near(p.x,1);assert.ok([1,3].includes(p.y));assert.ok([1,5].includes(p.z));}
});

test('hidden objects and invalid points cannot enlarge fit; half court keeps its near half',()=>{
 const clean={court:true,net:false,hide:[],actors:[],drawings:[]},expected=collectFrameFitPoints(clean,{half:true});
 const dirty={...clean,actors:[{hidden:true,position:{x:200,y:100,z:200}}],drawings:[{hidden:true,kind:'ball',points:[{x:200,y:100,z:200}]},{kind:'arrow',points:[null,{x:Infinity,y:0,z:0}]}]};
 assert.deepEqual(collectFrameFitPoints(dirty,{half:true}),expected);assert.ok(expected.every(p=>p.z>=0));
 dirty.hide=['actors','drawings'];dirty.actors[0].hidden=false;dirty.drawings[0].hidden=false;assert.deepEqual(collectFrameFitPoints(dirty,{half:true}),expected);
});

test('repeated responsive fits preserve the selected zoom ratio without accumulating drift',()=>{
 const points=collectFrameFitPoints(fixture()),base={target:{x:1,y:2,z:-1},azimuth:.6,elevation:.65,topInset:144,bottomInset:110,leftInset:60,rightInset:20};
 const portrait=fitCameraDistance(points,{...base,width:390,height:844}),landscape=fitCameraDistance(points,{...base,width:844,height:390});
 const initial=portrait/.75;let distance=initial;
 for(let i=0;i<30;i++){distance=resizedFitDistance(distance,portrait,landscape);near(distance/landscape,initial/portrait);distance=resizedFitDistance(distance,landscape,portrait);}
 near(distance,initial);assert.equal(resizedFitDistance(distance,portrait,portrait),distance);
});

test('invalid dimensions and extreme bounds have finite safe distance limits',()=>{
 assert.equal(fitCameraDistance([]),12);
 assert.equal(fitCameraDistance([{x:1e6,y:1e6,z:1e6}]),140);
 for(const options of [{width:0,height:NaN,aspect:Infinity},{topInset:Infinity,bottomInset:-100,leftInset:1e6,rightInset:1e6},{fov:0,minDistance:NaN,maxDistance:-1}]){
  const distance=fitCameraDistance(collectFrameFitPoints(fixture()),options);assert.ok(Number.isFinite(distance)&&distance>=.2&&distance<=140);
 }
});

test('fit includes the sampled apex of an author trajectory with only two raw endpoints',()=>{
 const frame={court:true,net:true,hide:[],actors:[],drawings:[{kind:'arrow',points:[{x:-3,y:.025,z:3},{x:3,y:.025,z:-3}],trajectoryHeights:{start:.025,middle:8.12,end:.025}}]};
 const points=collectFrameFitPoints(frame);assert.ok(points.some(point=>point.y===8.12));
 projectAll(points,{width:390,height:844,azimuth:0,elevation:.65,target:{x:0,y:1.2,z:0},topInset:144,bottomInset:120,leftInset:64,rightInset:44});
});
