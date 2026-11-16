import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './three.module.min.js';
import {courtSolidMaterial,createContactShadow,contactShadowProfile,updateContactShadow} from './renderer-appearance.mjs';
import {createCourtHoverPainter,pickCourtObject} from './renderer-interaction.mjs';

test('solid materials retain the local albedo and muted, non-metallic ball response',()=>{
 const albedo=new THREE.Texture(),ball=courtSolidMaterial('#ffffff','ball',albedo),cone=courtSolidMaterial('#ef9d3d'),post=courtSolidMaterial('#b5bdc9','post');
 assert.ok(ball.isMeshStandardMaterial);assert.equal(ball.map,albedo);assert.equal(ball.emissiveMap,albedo);
 assert.equal(ball.metalness,0);assert.ok(ball.roughness>=.5);assert.ok(ball.emissiveIntensity<.15);
 assert.equal(cone.color.getHexString(),'ef9d3d');assert.ok(post.metalness>0&&post.metalness<.2);
});

test('contact shadows share a small texture with smooth alpha and fully transparent edges',()=>{
 const actor=createContactShadow('actor'),ball=createContactShadow('ball'),texture=actor.material.map,{width,height,data}=texture.image;
 assert.equal(texture,ball.material.map);assert.equal(width,64);assert.equal(height,64);
 assert.ok(data[((32*width)+32)*4+3]>240);
 for(let i=0;i<width;i++)for(const index of [i,(height-1)*width+i,i*width,i*width+width-1])assert.equal(data[index*4+3],0);
 const alphas=new Set();for(let i=3;i<data.length;i+=4)alphas.add(data[i]);assert.ok(alphas.size>80);
 assert.equal(actor.material.depthWrite,false);assert.equal(actor.userData.interactionIgnore,true);
});

test('higher materials and jumping players broaden and fade their contact without leaving the floor',()=>{
 for(const kind of ['actor','ball','cone','target','ladder']){
  const low=contactShadowProfile(kind,.32,0),high=contactShadowProfile(kind,.32,8);
  assert.ok(high.x>low.x&&high.z>low.z);assert.ok(high.opacity<low.opacity&&high.opacity>0);
  const parent=new THREE.Group(),shadow=createContactShadow(kind,.32);parent.position.y=2.5;parent.add(shadow);
  updateContactShadow(shadow,2.5,3.2,25);parent.updateMatrixWorld(true);
  assert.ok(Math.abs(shadow.getWorldPosition(new THREE.Vector3()).y-.009)<1e-10);
  const profile=contactShadowProfile(kind,.32,3.2);assert.equal(shadow.material.opacity,profile.opacity);
 }
 assert.deepEqual(contactShadowProfile('ball',.32,-3),contactShadowProfile('ball',.32,0));
 assert.deepEqual(contactShadowProfile('ball',.32,Infinity),contactShadowProfile('ball',.32,0));
});

test('the elongated ladder shadow follows the actual world-space rotation of its rails',()=>{
 for(const rotation of [0,25,45,-45,90,180]){
  const ladder=new THREE.Group(),shadow=createContactShadow('ladder',.32);
  ladder.rotation.y=-rotation*Math.PI/180;updateContactShadow(shadow,2,2,rotation);
  ladder.updateMatrixWorld(true);shadow.updateMatrixWorld(true);
  const railAxis=new THREE.Vector3(0,0,1).transformDirection(ladder.matrixWorld);
  const shadowAxis=new THREE.Vector3(0,1,0).transformDirection(shadow.matrixWorld);
  assert.ok(Math.abs(railAxis.dot(shadowAxis))>1-1e-10,`rotation ${rotation} must preserve parallel axes`);
 }
});

test('hover still restores a lit object exactly and never brightens its contact shadow',()=>{
 const group=new THREE.Group(),material=courtSolidMaterial('#19c87b'),object=new THREE.Mesh(new THREE.ConeGeometry(.2,.5),material),shadow=createContactShadow('cone');
 group.add(object,shadow);updateContactShadow(shadow,0);const color=material.color.clone(),emissive=material.emissive.clone(),opacity=shadow.material.opacity,painter=createCourtHoverPainter();
 painter.paint(group);assert.equal(material.color.equals(color),false);assert.ok(material.emissive.equals(emissive));assert.equal(shadow.material.opacity,opacity);
 assert.equal(shadow.material.color.getHexString(),'ffffff');painter.clear();assert.ok(material.color.equals(color));assert.equal(shadow.material.opacity,opacity);
});

test('a projected shadow cannot enlarge the selectable object footprint',()=>{
 const group=new THREE.Group(),ball=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),courtSolidMaterial('#ffffff','ball')),shadow=createContactShadow('ball');
 ball.position.y=1.12;ball.userData.objectId='ball';shadow.userData.objectId='ball';group.add(ball,shadow);updateContactShadow(shadow,0,1);group.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(.16,2,0),new THREE.Vector3(0,-1,0)),frame={actors:[],drawings:[{id:'ball',kind:'ball'}],hide:[]};
 assert.ok(ray.intersectObject(shadow).length>0);assert.equal(pickCourtObject(ray,[group],frame),null);
 ray.set(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));assert.equal(pickCourtObject(ray,[group],frame),'ball');
 group.visible=false;assert.equal(pickCourtObject(ray,[group],frame),null);
});
