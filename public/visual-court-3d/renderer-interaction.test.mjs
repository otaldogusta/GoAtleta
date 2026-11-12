import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {targetPickSurface,pickCourtObject,courtHoverState,createCourtHoverPainter} from './renderer-interaction.mjs';

function targetFixture(height=0){
 const group=new THREE.Group();group.position.set(2,height+.025,-1);
 for(const radius of [.32,.16]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.018,8,40),new THREE.MeshBasicMaterial({color:'#ffffff'}));ring.rotation.x=-Math.PI/2;ring.userData.objectId='target';group.add(ring);}
 const pick=targetPickSurface(.32,'target');group.add(pick);group.updateMatrixWorld(true);
 const frame={actors:[],drawings:[{id:'target',kind:'target'}],hide:[],selected:[]};
 return {group,pick,frame};
}
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
