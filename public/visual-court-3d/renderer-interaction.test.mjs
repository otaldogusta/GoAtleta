import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {createBlocker} from './blocker-rig.mjs';
import {createActorRig} from './actor-rig.mjs';
import {targetPickSurface,updateActorPickVolume,pickCourtHit,pickCourtTouchHit,pickCourtObject,courtHoverState,createCourtHoverPainter} from './renderer-interaction.mjs';

test('jumping players can be picked at their raised hands without selecting empty space below their feet',()=>{
 const parent=new THREE.Group(),pick=new THREE.Mesh(new THREE.CylinderGeometry(.32,.39,1.9,8),new THREE.MeshBasicMaterial({visible:false}));
 pick.userData.objectId='blocker';parent.add(pick);
 const frame={actors:[{id:'blocker'}],drawings:[],hide:[]};
 for(const elevation of [0,1.25]){
  parent.position.y=elevation;updateActorPickVolume(pick,3.05,.85);parent.updateMatrixWorld(true);
  const hit=y=>pickCourtObject(new THREE.Raycaster(new THREE.Vector3(0,elevation+y,5),new THREE.Vector3(0,0,-1)),[pick],frame);
  assert.equal(hit(2.8),'blocker');assert.equal(hit(1),'blocker');assert.equal(hit(.3),null);assert.equal(hit(3.2),null);
 }
});

test('the pick volume returns to the current body height when a player lands',()=>{
 const pick=new THREE.Mesh(new THREE.CylinderGeometry(.32,.39,1.9,8),new THREE.MeshBasicMaterial());
 updateActorPickVolume(pick,3.05,.85);updateActorPickVolume(pick,1.8,0);pick.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(pick);
 assert.ok(Math.abs(box.min.y)<1e-7);assert.ok(Math.abs(box.max.y-1.8)<1e-7);
 assert.equal(pick.scale.x,1);assert.equal(pick.scale.z,1);
});

test('volumetric blockers pick their actual hands from both sides without filling the gap between arms',()=>{
 for(const handAngle of [0,180])for(const elevation of [0,1.25]){
  const parent=new THREE.Group(),rig=createBlocker(parent);
  parent.position.set(0,elevation,handAngle===0?-1:1);
  rig.group.traverse(part=>{if(part.isMesh)part.userData.objectId='blocker';});
  rig.update({jump:.85,extension:1,handAngle});parent.updateMatrixWorld(true);
  const frame={actors:[{id:'blocker',locked:true}],drawings:[],hide:[]};
  const sign=handAngle===0?1:-1;
  for(const name of ['left-palm','right-palm','torso']){
   const point=rig.group.getObjectByName(name).getWorldPosition(new THREE.Vector3());
   const ray=aimedRay(point,point.clone().add(new THREE.Vector3(3,3,6*sign)));
   assert.equal(pickCourtObject(ray,[rig.group],frame),'blocker',`${name}, angle ${handAngle}, elevation ${elevation}`);
  }
  const left=rig.group.getObjectByName('left-palm').getWorldPosition(new THREE.Vector3());
  const gapRay=new THREE.Raycaster(new THREE.Vector3(0,left.y,parent.position.z+5*sign),new THREE.Vector3(0,0,-sign));
  assert.equal(pickCourtObject(gapRay,[rig.group],frame),null);
  const groundRay=new THREE.Raycaster(new THREE.Vector3(0,elevation+.2,parent.position.z+5*sign),new THREE.Vector3(0,0,-sign));
  assert.equal(pickCourtObject(groundRay,[rig.group],frame),null);
  const handRay=aimedRay(left,left.clone().add(new THREE.Vector3(3,3,6*sign)));
  rig.group.visible=false;assert.equal(pickCourtObject(handRay,[rig.group],frame),null);
  rig.group.visible=true;frame.actors[0].hidden=true;assert.equal(pickCourtObject(handRay,[rig.group],frame),null);
 }
});

function targetFixture(height=0){
 const group=new THREE.Group();group.position.set(2,height+.025,-1);
 for(const radius of [.32,.16]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.018,8,40),new THREE.MeshBasicMaterial({color:'#ffffff'}));ring.rotation.x=-Math.PI/2;ring.userData.objectId='target';group.add(ring);}
 const pick=targetPickSurface(.32,'target');group.add(pick);group.updateMatrixWorld(true);
 const frame={actors:[],drawings:[{id:'target',kind:'target'}],hide:[],selected:[]};
 return {group,pick,frame};
}

test('all player actions use their visible body for selection, hover and elevated dragging',()=>{
 for(const [poseRole,pose] of [['setter','contact'],['passer','ready'],['attacker','contact'],['server','toss'],['blocker','block']]){
  const parent=new THREE.Group(),rig=createActorRig(parent),id=`actor-${poseRole}`;
  parent.position.set(2,1.25,1);
  rig.group.traverse(part=>{if(part.isMesh)part.userData.objectId=id;});
  rig.update({poseRole,pose,facing:[-.6,-.8],jump:.5,extension:1,handAngle:180});parent.updateMatrixWorld(true);
  const frame={actors:[{id}],drawings:[],hide:[],selected:[]};
  for(const part of ['torso','left-palm','right-palm']){
   const point=rig.group.getObjectByName(part).getWorldPosition(new THREE.Vector3());
   const hit=pickCourtHit(aimedRay(point,point.clone().add(new THREE.Vector3(3,3,6))),[rig.group],frame);
   assert.equal(hit?.id,id,`${poseRole} ${part}`);assert.ok(hit.point.y>1.25,'the grabbed point follows elevation');
  }
  const torso=rig.group.getObjectByName('torso'),before=torso.material.color.clone(),painter=createCourtHoverPainter();
  painter.paint(rig.group);assert.equal(torso.material.color.equals(before),false);painter.clear();assert.ok(torso.material.color.equals(before));
  const point=torso.getWorldPosition(new THREE.Vector3()),ray=aimedRay(point);
  frame.actors[0].locked=true;assert.equal(pickCourtObject(ray,[rig.group],frame),id);
  frame.actors[0].hidden=true;assert.equal(pickCourtObject(ray,[rig.group],frame),null);
 }
});
function aimedRay(point,origin=new THREE.Vector3(5,5,10)){
 const camera=new THREE.PerspectiveCamera(39,1307/857,.1,180);camera.position.copy(origin);camera.lookAt(point);camera.updateMatrixWorld();
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);return ray;
}
const packet={tool:'select',active:true,disabled:false};

test('target center and annulus are hittable at floor and raised height from an inclined camera',()=>{
 for(const height of [0,2,8])for(const radius of [0,.1,.24,.32]){
  const {group,pick,frame}=targetFixture(height),point=group.position.clone().add(new THREE.Vector3(radius,0,0)),ray=aimedRay(point);
  assert.equal(pickCourtObject(ray,[group],frame),'target',`height ${height}, radius ${radius}`);
  assert.equal(pick.material.visible,false);assert.equal(pick.userData.pickOnly,true);
  if(radius===0){group.remove(pick);group.updateMatrixWorld(true);assert.equal(pickCourtObject(ray,[group],frame),null,'the old thin rings leave the center empty');}
 }
});

test('the target hit surface retains depth and does not steal hits from a nearer object',()=>{
 const {group,frame}=targetFixture(2),ray=aimedRay(group.position);
 const front=new THREE.Mesh(new THREE.SphereGeometry(.22,20,16),new THREE.MeshBasicMaterial({color:'#ffffff'}));front.userData.objectId='ball';front.position.copy(ray.ray.at(3,new THREE.Vector3()));front.updateMatrixWorld(true);
 frame.drawings.push({id:'ball',kind:'ball'});
 assert.equal(pickCourtObject(ray,[group,front],frame),'ball');
 front.position.copy(ray.ray.at(ray.ray.origin.distanceTo(group.position)+2,new THREE.Vector3()));front.updateMatrixWorld(true);
 assert.equal(pickCourtObject(ray,[front,group],frame),'target');
 const outside=aimedRay(group.position.clone().add(new THREE.Vector3(.5,0,0)));assert.equal(pickCourtObject(outside,[group],frame),null);
});

test('hidden layers and hidden scene objects never hit, while locked objects remain selectable',()=>{
 const {group,frame}=targetFixture(),ray=aimedRay(group.position);
 frame.drawings[0].locked=true;assert.equal(pickCourtObject(ray,[group],frame),'target');
 frame.drawings[0].hidden=true;assert.equal(pickCourtObject(ray,[group],frame),null);delete frame.drawings[0].hidden;
 frame.hide=['drawings'];assert.equal(pickCourtObject(ray,[group],frame),null);frame.hide=[];
 group.visible=false;assert.equal(pickCourtObject(ray,[group],frame),null);group.visible=true;
 assert.equal(pickCourtObject(ray,[group],{...frame,drawings:[]}),null);
});

test('decorative selection geometry is excluded even if it inherits an author id',()=>{
 const {group,frame}=targetFixture(),ray=aimedRay(group.position),decoration=new THREE.Group();decoration.userData.interactionIgnore=true;
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(.3),new THREE.MeshBasicMaterial({visible:false}));mesh.userData.objectId='decoration';mesh.position.copy(ray.ray.at(2,new THREE.Vector3()));decoration.add(mesh);decoration.updateMatrixWorld(true);
 frame.drawings.push({id:'decoration',kind:'target'});assert.equal(pickCourtObject(ray,[decoration,group],frame),'target');
});

test('all selectable drawing kinds and player labels share hover eligibility without editing selection',()=>{
 const frame={actors:[{id:'player',label:'1'}],drawings:['ball','cone','target','ladder','arrow','curve','pen','area','text'].map(kind=>({id:kind,kind})),hide:[],selected:['target']},snapshot=JSON.stringify(frame);
 for(const object of [...frame.actors,...frame.drawings])assert.deepEqual(courtHoverState(object.id,frame,packet),{id:object.id,cursor:'grab'});
 frame.actors[0].locked=true;assert.deepEqual(courtHoverState('player',frame,packet),{id:'player',cursor:'pointer'});delete frame.actors[0].locked;
 assert.equal(JSON.stringify(frame),snapshot);
});

test('touch, active gestures, camera, playback, tools and stale/hidden ids cannot retain hover',()=>{
 const frame={actors:[{id:'player'}],drawings:[{id:'target',kind:'target'}],hide:[],selected:[]};
 for(const change of [{disabled:true},{active:false},{tool:'pan'},{tool:'player'},{tool:'arrow'}])assert.equal(courtHoverState('target',frame,{...packet,...change}),null);
 assert.equal(courtHoverState('target',frame,packet,'touch'),null);assert.equal(courtHoverState('target',frame,packet,'mouse',true),null);
 assert.equal(courtHoverState('missing',frame,packet),null);
 frame.hide=['drawings'];assert.equal(courtHoverState('target',frame,packet),null);frame.hide=['actors'];assert.equal(courtHoverState('player',frame,packet),null);
 frame.hide=[];frame.drawings[0].hidden=true;assert.equal(courtHoverState('target',frame,packet),null);
 assert.equal(courtHoverState('player',frame,{...packet,tool:'animate'},'pen').id,'player');
});

test('hover softly tints even white materials, excludes decoration and restores exact authored colors',()=>{
 const root=new THREE.Group(),white=new THREE.MeshBasicMaterial({color:'#ffffff'}),colored=new THREE.MeshBasicMaterial({color:'#19c87b',transparent:true,opacity:.2});
 root.add(new THREE.Mesh(new THREE.SphereGeometry(.2),white),new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),colored));
 const selection=new THREE.Mesh(new THREE.RingGeometry(.2,.22),new THREE.MeshBasicMaterial({color:'#b9d9ff'}));selection.userData.interactionIgnore=true;root.add(selection);
 const pick=targetPickSurface(.3,'target');root.add(pick);
 const oldWhite=white.color.clone(),oldColor=colored.color.clone(),selectionColor=selection.material.color.clone(),pickColor=pick.material.color.clone(),painter=createCourtHoverPainter();
 painter.paint(root);assert.equal(white.color.equals(oldWhite),false);assert.ok(white.color.r<.75,'white ink receives visible blue contrast instead of an almost-white tint');assert.equal(colored.color.equals(oldColor),false);assert.equal(colored.opacity,.28);
 assert.ok(selection.material.color.equals(selectionColor));assert.ok(pick.material.color.equals(pickColor));
 const once=white.color.clone();painter.paint(root);assert.ok(white.color.equals(once),'hover does not accumulate across frames');
 painter.clear();assert.ok(white.color.equals(oldWhite));assert.ok(colored.color.equals(oldColor));assert.equal(colored.opacity,.2);
 painter.paint(root);painter.paint(null);assert.ok(white.color.equals(oldWhite));
});

test('hover follows visible sprites and groups without tinting hidden poses or leaking between objects',()=>{
 const root=new THREE.Group(),visible=new THREE.Sprite(new THREE.SpriteMaterial({color:'#ffffff'})),hidden=new THREE.Sprite(new THREE.SpriteMaterial({color:'#4389ff'}));hidden.visible=false;root.add(visible,hidden);
 const before=hidden.material.color.clone(),white=visible.material.color.clone(),other=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:'#ffdc53'})),painter=createCourtHoverPainter();
 painter.paint(root);assert.ok(hidden.material.color.equals(before));assert.equal(visible.material.color.equals(white),false);
 painter.paint(other);assert.ok(visible.material.color.equals(white));painter.clear();
});

function touchFixture(height=0,distance=20,width=390,heightPx=844){
 const point=new THREE.Vector3(0,height,0),camera=new THREE.PerspectiveCamera(39,width/heightPx,.1,180);
 camera.position.copy(point).add(new THREE.Vector3(0,0,distance));camera.lookAt(point);camera.updateMatrixWorld();
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.12,24,16),new THREE.MeshBasicMaterial());ball.position.copy(point);ball.userData.objectId='ball';ball.updateMatrixWorld(true);
 const frame={actors:[],drawings:[{id:'ball',kind:'ball'}],hide:[],selected:[]},viewport={width,height:heightPx};
 const at=(x,y)=>{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/heightPx*2),camera);return {ray,pointer:{x,y}};};
 return {ball,camera,frame,viewport,at};
}

test('exact picking supplies the grabbed world point without changing depth priority',()=>{
 const {ball,camera,frame,viewport,at}=touchFixture(2),{ray,pointer}=at(195,422);
 const hit=pickCourtHit(ray,[ball],frame),touch=pickCourtTouchHit(ray,[ball],frame,camera,pointer,viewport);
 assert.equal(hit.id,'ball');assert.ok(Math.abs(hit.point.y-2)<1e-8);assert.ok(hit.point.z>.1);
 assert.deepEqual(touch,hit);assert.equal(pickCourtObject(ray,[ball],frame),hit.id);
});

test('finger tolerance stays in CSS pixels for small elevated materials at different zooms',()=>{
 for(const height of [0,2,8])for(const distance of [12,25,60]){
  const {ball,camera,frame,viewport,at}=touchFixture(height,distance),{ray,pointer}=at(215,422);
  assert.equal(pickCourtObject(ray,[ball],frame),null);
  const touch=pickCourtTouchHit(ray,[ball],frame,camera,pointer,viewport);
  assert.equal(touch?.id,'ball');assert.ok(Math.abs(touch.point.y-height)<1e-8);
  const outside=at(240,422);assert.equal(pickCourtTouchHit(outside.ray,[ball],frame,camera,outside.pointer,viewport),null);
 }
});

test('touch expansion excludes hidden layers, decoration and annotation bounding boxes',()=>{
 const {ball,camera,frame,viewport,at}=touchFixture(),{ray,pointer}=at(215,422);
 const pick=()=>pickCourtTouchHit(ray,[ball],frame,camera,pointer,viewport);
 frame.drawings[0].locked=true;assert.equal(pick()?.id,'ball');
 frame.drawings[0].hidden=true;assert.equal(pick(),null);delete frame.drawings[0].hidden;
 frame.hide=['drawings'];assert.equal(pick(),null);frame.hide=[];
 ball.userData.interactionIgnore=true;assert.equal(pick(),null);delete ball.userData.interactionIgnore;
 frame.drawings[0].kind='area';assert.equal(pick(),null);
 frame.drawings[0].kind='arrow';assert.equal(pick(),null);
 frame.drawings[0].kind='ball';ball.visible=false;assert.equal(pick(),null);
});

test('touch prefers an exact object over a nearby expanded ball and preserves depth ties',()=>{
 const {ball,camera,frame,viewport,at}=touchFixture(),{ray,pointer}=at(215,422);
 const front=new THREE.Mesh(new THREE.SphereGeometry(.12,24,16),new THREE.MeshBasicMaterial());front.position.copy(ray.ray.at(10,new THREE.Vector3()));front.userData.objectId='front';front.updateMatrixWorld(true);frame.drawings.push({id:'front',kind:'ball'});
 assert.equal(pickCourtTouchHit(ray,[ball,front],frame,camera,pointer,viewport)?.id,'front');
 const back=ball.clone();back.position.z=-8;back.userData.objectId='back';back.updateMatrixWorld(true);frame.drawings.push({id:'back',kind:'ball'});
 assert.equal(pickCourtTouchHit(ray,[back,ball],frame,camera,pointer,viewport)?.id,'ball');
});
