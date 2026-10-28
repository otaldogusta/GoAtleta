import * as THREE from './three.module.min.js';
import {createBlocker} from './blocker-rig.mjs';
import {clamp,isWorldPoint,worldToCourt,courtToWorld,limitPoint,snapPoint,snappedGesture,curvePoints,editableIds,movementTrail,shouldCancelFrameGesture} from './renderer-geometry.mjs';
import {actorPoseView,isHeightHandle,previewAttackCurve,simulationHandleEdit} from './renderer-simulation-geometry.mjs';
import {createSimulationGuides,serveNetCrossing} from './renderer-simulation.mjs';
import {renderPixelRatio,syncRendererResolution} from './renderer-resolution.mjs';
import {CAMERA_MOTION,sampleCameraAngularVelocity,releaseCameraMotion,integrateCameraMotion} from './renderer-camera-motion.mjs';
import {simulationCameraDistance,resizedSimulationCameraDistance} from './renderer-camera-profile.mjs';

// This surface renders the parent editor's frame. It has no document, timeline,
// presets, persistence or undo stack. Only camera and uncommitted gestures live here.
const CHANNEL='goatleta-court-3d',VERSION=1;
const canvas=document.querySelector('#scene'),labels=document.querySelector('#labels'),error=document.querySelector('#error');
const handleLayer=document.querySelector('#simulation-handles'),feedback=document.querySelector('#simulation-feedback');
let token='',revision=0,active=true,packet=null,frame=null,pending=0,gesture=null,preview=null,lastAnchor=undefined;
const scene=new THREE.Scene();scene.background=new THREE.Color('#09090f');
let renderer;
function emit(type,detail={},gestureRevision=revision){
 parent.postMessage({channel:CHANNEL,version:VERSION,type,token,revision:gestureRevision,...detail},location.origin);
}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(renderPixelRatio(devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;
}catch{
 error.hidden=false;error.textContent='Não foi possível abrir a vista 3D neste navegador. A jogada continua disponível na Quadra 2D.';
 emit('error',{message:error.textContent});
}
const camera=new THREE.PerspectiveCamera(39,1,.1,180);
scene.add(new THREE.HemisphereLight(0xc9dcff,0x53658a,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-8,15,9);scene.add(sun);
const target=new THREE.Vector3(0,.55,.8);
let azimuth=0,elevation=.3656,distance=20.5,cameraView='front',lastZoom=1,lastCameraReset=undefined,lastHalf=false,lastAspect=innerWidth/Math.max(1,innerHeight),lastSimulationMode=null,lastCompact=innerWidth<600;
let cameraMotion=null,cameraMotionTime=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function stopCameraMotion(){cameraMotion=null;cameraMotionTime=0;}
document.addEventListener('pointerdown',stopCameraMotion,{capture:true});
document.addEventListener('keydown',stopCameraMotion,{capture:true});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopCameraMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
const sphere=new THREE.SphereGeometry(1,16,12),actorMap=new Map(),drawingMap=new Map();
const pickTargets=[],ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
ray.params.Line.threshold=.16;
function mesh(geometry,material,parent=scene){const object=new THREE.Mesh(geometry,material);parent.add(object);return object;}
function material(color,extra={}){return new THREE.MeshBasicMaterial({color,...extra});}
function vector(p){return new THREE.Vector3(p.x,p.y,p.z);}
function line(points,color='#456397',dashed=false,parent=scene,opacity=1){
 const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>Array.isArray(p)?new THREE.Vector3(...p):vector(p)));
 const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.16,gapSize:.12,transparent:true,opacity}):new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity});
 const object=new THREE.Line(geometry,mat);if(dashed)object.computeLineDistances();parent.add(object);return object;
}
function dispose(root){const geometries=new Set(),materials=new Set();root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const mat of [].concat(object.material))materials.add(mat);});for(const geometry of geometries)if(geometry!==sphere)geometry.dispose();for(const mat of materials){if(mat.userData.ownTexture)mat.map?.dispose();mat.dispose();}root.removeFromParent();}
function invalidate(){if(active&&renderer&&!pending)pending=requestAnimationFrame(render);}

const apron=mesh(new THREE.PlaneGeometry(18,28),material('#090c13'));apron.rotation.x=-Math.PI/2;
const court=mesh(new THREE.PlaneGeometry(9,18),material('#0a1123'));court.rotation.x=-Math.PI/2;court.position.y=.005;
const courtGroup=new THREE.Group();scene.add(courtGroup);
for(const z of [-9,-3,0,3,9])line([[-4.5,.012,z],[4.5,.012,z]],'#456397',false,courtGroup);
for(const x of [-4.5,4.5])line([[x,.012,-9],[x,.012,9]],'#456397',false,courtGroup);
line([[-9,.01,-14],[9,.01,-14],[9,.01,14],[-9,.01,14],[-9,.01,-14]],'#242934');
const grid=new THREE.Group();scene.add(grid);
for(let x=-4;x<4.5;x+=.5)line([[x,.015,-9],[x,.015,9]],'#6687b4',false,grid,.12);
for(let z=-8.5;z<9;z+=.5)line([[-4.5,.015,z],[4.5,.015,z]],'#6687b4',false,grid,.12);
grid.visible=false;
const net=new THREE.Group();scene.add(net);
const netSurface=mesh(new THREE.PlaneGeometry(10.5,1),material('#98a7c1',{transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}),net);netSurface.position.y=1.93;
for(let x=-5.25;x<5.26;x+=.25)line([[x,1.43,0],[x,2.43,0]],'#8b97ad',false,net,.025);
for(let y=1.43;y<2.44;y+=.2)line([[-5.25,y,0],[5.25,y,0]],'#8b97ad',false,net,.025);
const tape=material('#b5bdc9');
mesh(new THREE.BoxGeometry(10.55,.065,.035),tape,net).position.y=2.43;
mesh(new THREE.BoxGeometry(10.55,.025,.025),tape,net).position.y=1.43;
for(const x of [-5.35,5.35]){
 mesh(new THREE.CylinderGeometry(.035,.045,2.6,10),tape,net).position.set(x,1.3,0);
 mesh(new THREE.BoxGeometry(.045,1,.03),tape,net).position.set(Math.sign(x)*4.5,1.93,0);
 for(let j=0;j<16;j++)mesh(new THREE.CylinderGeometry(.014,.014,.1,6),material(j%2?'#df5d64':'#dfe2e5'),net).position.set(Math.sign(x)*4.5,1.73+j*.1,0);
}
const loader=new THREE.TextureLoader(),poses={},mirroredPoses={};
const poseNames={setter:['ready','load','rise','contact','follow','backfollow'],passer:['ready','load','contact','follow'],attacker:['ready','approach','plant','draw','contact','follow','land'],server:['ready','toss','draw','contact','follow','idle']};
for(const [role,names] of Object.entries(poseNames))for(const view of ['front','side'])for(const pose of names){const key=`${role}/${view}/${pose}`;poses[key]=loader.load(`./reference/${key}.png`,texture=>{texture.colorSpace=THREE.SRGBColorSpace;invalidate();});}
const ballTexture=loader.load('./reference/ball.webp',texture=>{texture.colorSpace=THREE.SRGBColorSpace;invalidate();});
const heights={setter:{ready:1.9,load:1.66,rise:1.89,contact:2.25,follow:2.28,backfollow:2.32},attacker:{ready:1.9,approach:1.81,plant:1.68,draw:2.15,contact:2.34,follow:1.78,land:1.54},passer:{ready:1.55,load:1.46,contact:1.33,follow:1.55},server:{ready:1.9,toss:2.15,draw:1.89,contact:2.23,follow:1.82,idle:1.9}};
function colorOf(value,fallback='#609ce8'){return typeof value==='string'&&/^#[\da-f]{3,8}$/i.test(value)?value:fallback;}
function makeActor(actor){
 const group=new THREE.Group();scene.add(group);
 const body=new THREE.Sprite(new THREE.SpriteMaterial({map:poses['setter/front/ready'],color:colorOf(actor.color),transparent:true,alphaTest:.04,depthWrite:false}));body.center.set(.5,0);group.add(body);
 const previousBody=new THREE.Sprite(body.material.clone());previousBody.center.set(.5,0);previousBody.visible=false;group.add(previousBody);
 const shadow=mesh(new THREE.CircleGeometry(.22,24),material('#000000',{transparent:true,opacity:.18,depthWrite:false}),group);shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;
 const blocker=createBlocker(group,{ready:poses['setter/front/ready'],load:poses['setter/front/load']});
 const pick=mesh(new THREE.CylinderGeometry(.32,.39,1.9,8),new THREE.MeshBasicMaterial({visible:false}),group);pick.position.y=.95;pick.userData.objectId=actor.id;
 const selection=mesh(new THREE.RingGeometry(.36,.41,40),material('#b9d9ff',{side:THREE.DoubleSide,transparent:true,opacity:.9}),group);selection.rotation.x=-Math.PI/2;selection.position.y=.026;
 const label=document.createElement('button');label.className='actor-label';label.type='button';labels.append(label);
 label.addEventListener('click',event=>{if(packet?.disabled||!active)return;selectObject(actor.id,event.shiftKey||packet.multiple);canvas.focus();});
 const result={group,body,previousBody,shadow,blocker,pick,selection,label,height:1.9};actorMap.set(actor.id,result);return result;
}
function textureFor(key,flip){const source=poses[key]||poses['setter/front/ready'];if(!flip||!source.image)return source;if(!mirroredPoses[key]){const texture=source.clone();texture.repeat.x=-1;texture.offset.x=1;texture.needsUpdate=true;mirroredPoses[key]=texture;}return mirroredPoses[key];}
function applyActor(actor,object){
 const delta=preview?.ids.includes(actor.id)?preview.delta:null;
 object.group.position.set(actor.position.x+(delta?.x||0)*9,actor.position.y,actor.position.z+(delta?.y||0)*18);
 const role=Object.hasOwn(poseNames,actor.poseRole)?actor.poseRole:'setter',pose=poseNames[role].includes(actor.pose)?actor.pose:'ready';
 const isBlocker=actor.poseRole==='blocker';object.body.visible=!isBlocker;object.blocker.group.visible=isBlocker;
 object.previousBody.visible=false;object.body.material.opacity=1;
 const tint=colorOf(actor.color);
 if(isBlocker){object.blocker.group.traverse(child=>{if(child.material?.color)child.material.color.set(tint);});object.blocker.update({jump:actor.jump||0,crouch:actor.crouch||0,extension:actor.extension??(actor.pose==='contact'?1:0),handAngle:actor.handAngle||0},camera);object.height=2.2+(actor.jump||0);}
 else{
  const {view,flip}=actorPoseView(actor,azimuth),texture=textureFor(`${role}/${view}/${pose}`,flip);
  const multiplier=actor.poseScale??(role==='setter'?.9:role==='passer'?.96:.9),height=heights[role][pose]*multiplier;
  object.body.material.map=texture;object.body.material.color.set(tint);object.body.position.y=Math.max(0,actor.jump||0);object.body.scale.set(height*(texture.image?texture.image.width/texture.image.height:.38),height,1);object.height=height+(actor.jump||0);
  if(actor.poseBlend<1&&actor.previousPose!==pose&&poseNames[role].includes(actor.previousPose)){
   const previousView=typeof actor.previousSide==='boolean'?(actor.previousSide?'side':'front'):view,previous=textureFor(`${role}/${previousView}/${actor.previousPose}`,flip),h=heights[role][actor.previousPose]*multiplier;
   object.previousBody.visible=true;object.previousBody.material.map=previous;object.previousBody.material.color.set(tint);object.previousBody.material.opacity=1-clamp(actor.poseBlend,0,1);object.previousBody.position.copy(object.body.position);object.previousBody.scale.set(h*(previous.image?previous.image.width/previous.image.height:.38),h,1);object.body.material.opacity=clamp(actor.poseBlend,0,1);
  }
 }
 object.group.visible=!frame.hide.includes('actors');object.selection.visible=frame.selected.includes(actor.id);object.label.textContent=actor.label;object.label.setAttribute('aria-label',`Selecionar jogador ${actor.label}`);object.label.setAttribute('aria-pressed',String(frame.selected.includes(actor.id)));object.label.disabled=packet.disabled;
}
function makeText(text,color,size){
 const bitmap=document.createElement('canvas');bitmap.width=1024;bitmap.height=192;const context=bitmap.getContext('2d');context.font='600 64px Arial';context.textAlign='center';context.textBaseline='middle';context.fillStyle=color;context.fillText(String(text||'Anotação').slice(0,200),512,96,1000);
 const texture=new THREE.CanvasTexture(bitmap),mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});mat.userData.ownTexture=true;const sprite=new THREE.Sprite(mat);sprite.scale.set(3.2*Math.max(.5,size/28),.6*Math.max(.5,size/28),1);return sprite;
}
function buildDrawing(drawing){
 const group=new THREE.Group(),points=drawing.points.filter(isWorldPoint).map(p=>({...p}));group.userData.objectId=drawing.id;
 if(!points.length)return group;
 const color=colorOf(drawing.color,'#ffffff'),first=points[0],size=clamp(Number(drawing.size)||28,12,80)/100;
 if(['arrow','curve','pen','area'].includes(drawing.kind)){
  const stroke=drawing.kind==='curve'?curvePoints(points,Boolean(packet?.landscape)):points;
  line(drawing.kind==='area'?[...stroke,stroke[0]]:stroke,color,Boolean(drawing.dashed),group);
  if(drawing.kind==='area'&&points.length>2){const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z))),fill=mesh(new THREE.ShapeGeometry(shape),material(color,{transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false}),group);fill.rotation.x=-Math.PI/2;fill.position.y=first.y-.005;}
  if(['arrow','curve'].includes(drawing.kind)&&stroke.length>1){const end=vector(stroke.at(-1)),direction=end.clone().sub(vector(stroke.at(-2)));if(direction.lengthSq()>.0001){const cone=mesh(new THREE.ConeGeometry(.09,.28,12),material(color),group);cone.position.copy(end);cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}}
 }else if(drawing.kind==='ball')mesh(new THREE.SphereGeometry(.12,24,16),material('#ffffff',{map:ballTexture}),group).position.copy(vector(first));
 else if(drawing.kind==='cone'){const cone=mesh(new THREE.ConeGeometry(size*.45,size,16),material(color),group);cone.position.set(first.x,first.y+size*.5,first.z);mesh(new THREE.BoxGeometry(size*1.15,.045,size*1.15),material(color),group).position.set(first.x,first.y+.022,first.z);}
 else if(drawing.kind==='target'){for(const radius of [size,size*.5]){const ring=mesh(new THREE.TorusGeometry(radius,.018,8,40),material(color),group);ring.rotation.x=-Math.PI/2;ring.position.copy(vector(first));}}
 else if(drawing.kind==='ladder'){const ladder=new THREE.Group();group.add(ladder);ladder.position.copy(vector(first));ladder.rotation.y=-(drawing.rotation||0)*Math.PI/180;for(const x of [-.62,.62])mesh(new THREE.BoxGeometry(size*.14,.05,size*4),material('#263445'),ladder).position.x=x*size;for(const z of [-1.65,-.825,0,.825,1.65])mesh(new THREE.BoxGeometry(size*1.3,.05,size*.16),material(color),ladder).position.z=z*size;}
 else if(drawing.kind==='text'){const text=makeText(drawing.text,color,drawing.size);text.position.set(first.x,first.y+.28,first.z);group.add(text);}
 group.traverse(child=>{child.userData.objectId=drawing.id;});return group;
}
function updateDrawings(){
 const ids=new Set(frame.drawings.map(d=>d.id));for(const [id,object] of drawingMap)if(!ids.has(id)){dispose(object.group);drawingMap.delete(id);}
 for(const drawing of frame.drawings){
  const ballPoint=drawing.kind==='ball'?drawing.points[0]:null,local=ballPoint?{...drawing,points:[{x:0,y:0,z:0}],motion:undefined}:drawing;
  const key=JSON.stringify([local,Boolean(packet.landscape)]);let object=drawingMap.get(drawing.id);
  if(!object||object.key!==key){
   if(object)dispose(object.group);const group=buildDrawing(local);scene.add(group);const selection=new THREE.Group();group.add(selection);const points=local.points;
   if(points.length){const padding=Math.max(.18,(drawing.size||28)/100),xs=points.map(p=>p.x),zs=points.map(p=>p.z),x1=Math.min(...xs)-padding,x2=Math.max(...xs)+padding,z1=Math.min(...zs)-padding,z2=Math.max(...zs)+padding;line([[x1,.035,z1],[x2,.035,z1],[x2,.035,z2],[x1,.035,z2],[x1,.035,z1]],'#e3efff',true,selection,.8);}
   object={group,key,selection};drawingMap.set(drawing.id,object);
  }
  const delta=preview?.ids.includes(drawing.id)?preview.delta:null;object.group.position.set((ballPoint?.x||0)+(delta?.x||0)*9,ballPoint?.y||0,(ballPoint?.z||0)+(delta?.y||0)*18);object.group.visible=!frame.hide.includes('drawings');object.selection.visible=frame.selected.includes(drawing.id);
  if(drawing.simulated&&object.group.children[0]){
   const ball=object.group.children[0],simulation=frame.simulation;
   ball.rotation.x=simulation?.mode==='receive'?(simulation.ballSpin||0):(simulation?.elapsedSeconds||0)*5;
   ball.rotation.z=simulation?.mode==='receive'?0:(simulation?.elapsedSeconds||0)*3;
  }
 }
}
let pathGroup=new THREE.Group(),pathKey='',draftGroup=null;
scene.add(pathGroup);
function updatePaths(){
 const key=JSON.stringify([frame.progress,frame.actors.map(a=>[a.id,a.path,a.color]),frame.drawings.map(d=>[d.id,d.motion,d.color,d.size])]);if(pathKey!==key){dispose(pathGroup);pathGroup=new THREE.Group();scene.add(pathGroup);for(const actor of frame.actors){const trail=movementTrail(actor.path||[],frame.progress);if(trail.length>1)line(trail,colorOf(actor.color),true,pathGroup,.45);}for(const drawing of frame.drawings){const trail=movementTrail(drawing.motion||[],frame.progress,(drawing.size||28)*.0085+.03);if(trail.length>1)line(trail,colorOf(drawing.color),true,pathGroup,.45);}pathKey=key;}pathGroup.visible=!frame.hide.includes('movements');
}
function setDraft(drawing){if(draftGroup)dispose(draftGroup);draftGroup=drawing?buildDrawing(drawing):null;if(draftGroup)scene.add(draftGroup);invalidate();}
let simulationGuides=null,simulationKey='',handleDrag=null;
const handleButtons=new Map(),handleNames={set:'Altura do levantamento',pass:'Altura do passe',attack:'Curva do ataque',hit:'Contato do ataque',target:'Destino do ataque',serve:'Destino do saque'};
const ballShadow=mesh(new THREE.CircleGeometry(.21,24),material('#000000',{transparent:true,opacity:.2,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;ballShadow.visible=false;
function updateSimulation(){
 const original=frame.simulation,drag=handleDrag?.kind==='attack'?handleDrag:null;
 const curveEdit=drag?simulationHandleEdit(drag.handle,drag.last,drag.last.y-drag.handle.point.y):null;
 const data=original&&curveEdit?previewAttackCurve(original,curveEdit.value):original;
 if(!data){if(simulationGuides){dispose(simulationGuides);simulationGuides=null;}simulationKey='';delete canvas.dataset.serveNetCrossing;for(const button of handleButtons.values())button.hidden=true;feedback.hidden=true;ballShadow.visible=false;return;}
 const key=data===original?data.guideKey:JSON.stringify([data.guideKey,'attack-preview',curveEdit.value]);
 if(simulationKey!==key){if(simulationGuides)dispose(simulationGuides);simulationGuides=createSimulationGuides(data);scene.add(simulationGuides);simulationKey=key;const crossing=serveNetCrossing(simulationGuides);if(crossing)canvas.dataset.serveNetCrossing=JSON.stringify(crossing);else delete canvas.dataset.serveNetCrossing;}
 simulationGuides.visible=data.guidesVisible&&!frame.hide.includes('movements');
 for(const marker of simulationGuides.children)if(marker.userData.contactTime!==undefined){const elapsed=data.elapsedSeconds-marker.userData.contactTime,pulse=elapsed>=0?Math.exp(-elapsed*12):0;marker.scale.setScalar(1+pulse*.7);marker.material.opacity=.65+pulse*.35;}
 const ball=drawingMap.get(data.ballId);ballShadow.visible=Boolean(ball?.group.visible);ballShadow.position.set(data.ball.x,.028,data.ball.z);
 feedback.hidden=!data.outcome;if(feedback.textContent!==data.outcome)feedback.textContent=data.outcome;feedback.dataset.blocked=String(data.blocked);
 const handles=new Map((data.handles||[]).map(handle=>[handle.kind,handle]));
 for(const [kind,name] of Object.entries(handleNames)){
  let button=handleButtons.get(kind);if(!button){button=makeGuideHandle(kind,name);handleButtons.set(kind,button);handleLayer.append(button);}
  const handle=handles.get(kind),at=handleDrag?.kind===kind&&kind!=='attack'?handleDrag.last:handle?.point,position=at?project(vector(at)):null;
  button.hidden=!handle||!data.guidesVisible||!packet.simulationHandles||!position?.visible;button.disabled=packet.disabled&&!(packet.allowServeHandle&&kind==='serve');
  if(position){button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;}
 }
}
function updateHandlePoint(event){
 const drag=handleDrag;if(!drag||drag.pointerId!==event.pointerId)return false;
 cast(event);const at=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!at)return false;
 const offset=at.sub(drag.start),point=vector(drag.handle.point).add(offset),height=isHeightHandle(drag.kind);
 drag.last=height?{...drag.handle.point,y:point.y}:{x:point.x,y:point.y,z:point.z};
 drag.moved=drag.moved||(height?Math.abs(offset.y)>.02:offset.lengthSq()>.0004);
 return true;
}
function finishHandle(event,cancelled=false){
 const drag=handleDrag;if(!drag||drag.pointerId!==event.pointerId)return;
 if(!cancelled)updateHandlePoint(event);
 handleDrag=null;
 if(!cancelled&&drag.moved&&drag.revision===revision&&(!packet.disabled||packet.allowServeHandle&&drag.kind==='serve')){const edit=simulationHandleEdit(drag.handle,drag.last,drag.last.y-drag.handle.point.y);if(edit&&(edit.value===undefined||Math.abs(edit.value-drag.handle.value)>1e-8))emit('simulation-handle',edit,drag.revision);}
 invalidate();
}
function makeGuideHandle(kind,name){
 const button=document.createElement('button');button.type='button';button.className=`guide-handle ${isHeightHandle(kind)?'apex':kind==='target'||kind==='serve'?'target':''} ${kind==='serve'?'serve':''}`;button.id=`handle-${kind}`;button.setAttribute('aria-label',name);button.title=`Arraste para ajustar: ${name.toLowerCase()}. Use as setas para ajustar.`;
 button.addEventListener('pointerdown',event=>{
  if(packet?.disabled&&!(packet.allowServeHandle&&kind==='serve')||!active||event.button!==0)return;const handle=frame?.simulation?.handles.find(item=>item.kind===kind);if(!handle)return;event.preventDefault();event.stopPropagation();cancelGesture();
  const plane=new THREE.Plane(),at=vector(handle.point);plane.setFromNormalAndCoplanarPoint(isHeightHandle(kind)?camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(0,1,0),at);cast(event);const start=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
  handleDrag={kind,handle,revision,pointerId:event.pointerId,plane,start,last:{...handle.point},moved:false};button.setPointerCapture(event.pointerId);button.focus();invalidate();
 });
 button.addEventListener('pointermove',event=>{if(!updateHandlePoint(event))return;event.preventDefault();event.stopPropagation();invalidate();});
 button.addEventListener('pointerup',event=>finishHandle(event));button.addEventListener('pointercancel',event=>finishHandle(event,true));button.addEventListener('lostpointercapture',event=>finishHandle(event,true));
 button.addEventListener('keydown',event=>{
  if(!event.key.startsWith('Arrow')||packet?.disabled&&!(packet.allowServeHandle&&kind==='serve')||!active)return;event.preventDefault();event.stopPropagation();const handle=frame?.simulation?.handles.find(item=>item.kind===kind);if(!handle)return;const at={...handle.point},direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1,height=isHeightHandle(kind);if(height)at.y+=direction*.12;else{at.x+=event.key==='ArrowLeft'?-.25:event.key==='ArrowRight'?.25:0;at.z+=event.key==='ArrowUp'?-.25:event.key==='ArrowDown'?.25:0;}const edit=simulationHandleEdit(handle,at,height?direction*.12:0);if(edit&&(edit.value===undefined||Math.abs(edit.value-handle.value)>1e-8))emit('simulation-handle',edit);
 });
 return button;
}
function updateCamera(){camera.position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);camera.lookAt(target);camera.updateMatrixWorld();}
function fitCamera(){
 const points=[new THREE.Vector3(-4.5,0,9),new THREE.Vector3(4.5,0,9)];
 if(frame)for(const actor of frame.actors){points.push(vector(actor.position),vector(actor.position).add(new THREE.Vector3(0,2.2,0)));for(const point of actor.path||[])points.push(vector(point).add(new THREE.Vector3(0,2.2,0)));}
 // Fit occupied positions as well as the near baseline; distant opponents stay
 // visible without forcing every near-half drill into a full-court overview.
 for(let attempt=0;attempt<16;attempt++){updateCamera();const fits=points.every(point=>{const p=point.clone().project(camera);return Math.abs(p.x)<=.91&&p.y>=-.76&&p.y<=.68&&p.z<1;});if(fits)break;distance*=1.065;}
 updateCamera();
}
function applyView(view){
 if(gesture?.cameraDrag)cancelGesture();else stopCameraMotion();
 cameraView=view;azimuth=view==='side'?Math.PI/2:view==='orbit'?.6145:0;
 if(frame?.simulation){
  const front=view==='front',attack=frame.simulation.mode==='attack';
  elevation=front?(attack?.30555:.2835):.3656;
  target.set(front?0:.304,front?(attack?1.239:1.2673):2.267,front?(attack?.082:-.76954):.893);
  lastCompact=innerWidth<600;distance=simulationCameraDistance(frame.simulation.mode,view,lastCompact)/lastZoom;
  updateCamera();return;
 }
 elevation=view==='side'?.45:.3656;target.set(0,view==='orbit'?2.267:view==='front'?.55:.9,lastHalf?1.4:view==='orbit'?.893:.8);distance=(view==='front'?20.5:view==='orbit'?25.138:25)/lastZoom;fitCamera();
}
function resize(){
 if(!renderer)return;stopCameraMotion();const bounds=canvas.getBoundingClientRect(),resolution=syncRendererResolution(renderer,bounds.width||innerWidth,bounds.height||innerHeight,devicePixelRatio);camera.aspect=resolution.width/resolution.height;camera.updateProjectionMatrix();canvas.dataset.pixelRatio=String(resolution.pixelRatio);
 const compact=innerWidth<600;
 if(frame?.simulation){distance=resizedSimulationCameraDistance(distance,frame.simulation.mode,cameraView,lastCompact,compact);updateCamera();}
 else if(Math.abs(camera.aspect-lastAspect)>.001){const oldFit=Math.max(1,1/lastAspect),newFit=Math.max(1,1/camera.aspect);distance*=newFit/oldFit;fitCamera();}else updateCamera();
 lastAspect=camera.aspect;lastCompact=compact;invalidate();
}
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
new ResizeObserver(resize).observe(document.documentElement);
let densityQuery=null;
function watchDensity(){if(densityQuery)densityQuery.removeEventListener('change',densityChanged);densityQuery=matchMedia(`(resolution: ${devicePixelRatio||1}dppx)`);densityQuery.addEventListener('change',densityChanged);}
function densityChanged(){watchDensity();resize();}
watchDensity();resize();
function project(point){const p=point.clone().project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2};}
function selectionAnchor(){const id=frame.selected[0],actor=actorMap.get(id),drawing=frame.drawings.find(d=>d.id===id);let point=null;if(actor?.group.visible)point=actor.group.position.clone().add(new THREE.Vector3(0,actor.height+.36,0));else if(drawing?.points[0]){point=vector(drawing.points[0]).add(new THREE.Vector3(0,.6,0));if(preview?.ids.includes(id)){point.x+=preview.delta.x*9;point.z+=preview.delta.y*18;}}const projected=point?project(point):null,next=projected?.visible?{x:Math.round(projected.x),y:Math.round(projected.y)}:null;if(lastAnchor===undefined||Boolean(next)!==Boolean(lastAnchor)||next&&lastAnchor&&(Math.abs(next.x-lastAnchor.x)>1||Math.abs(next.y-lastAnchor.y)>1)){lastAnchor=next;emit('selection-anchor',{anchor:next});}}
function render(now){pending=0;if(!frame||!active||!renderer)return;
 if(cameraMotion&&(reducedMotion.matches||document.hidden||now-cameraMotionTime>CAMERA_MOTION.maxSampleGapMs))stopCameraMotion();
 if(cameraMotion){
  const next=integrateCameraMotion({azimuth,elevation},cameraMotion,Math.max(0,now-cameraMotionTime));
  azimuth=next.azimuth;elevation=next.elevation;cameraMotion=next.motion;cameraMotionTime=Math.max(now,cameraMotionTime);updateCamera();
 }
 if(renderer.getPixelRatio()!==renderPixelRatio(devicePixelRatio))resize();pickTargets.length=0;const actorIds=new Set(frame.actors.map(a=>a.id));for(const [id,object] of actorMap)if(!actorIds.has(id)){object.label.remove();dispose(object.group);actorMap.delete(id);}
 for(const actor of frame.actors){const object=actorMap.get(actor.id)||makeActor(actor);applyActor(actor,object);if(object.group.visible)pickTargets.push(object.pick);const point=object.group.position.clone();point.y+=object.height+.18;const screen=project(point);object.label.hidden=!actor.label||!object.group.visible||!screen.visible;object.label.style.left=`${screen.x}px`;object.label.style.top=`${screen.y}px`;}
 updateDrawings();updatePaths();updateSimulation();grid.visible=Boolean(packet.grid)&&frame.court&&!packet.plain;court.visible=courtGroup.visible=Boolean(frame.court)&&!packet.plain;net.visible=Boolean(frame.net)&&!packet.plain;for(const object of drawingMap.values())if(object.group.visible)pickTargets.push(object.group);
 renderer.render(scene,camera);selectionAnchor();canvas.dataset.stepId=frame.stepId;canvas.dataset.progress=String(frame.progress);canvas.dataset.actorPositions=JSON.stringify(frame.actors.map(a=>({id:a.id,position:a.position})));canvas.dataset.renderedPositions=JSON.stringify([...actorMap.entries()].map(([id,a])=>({id,position:{x:a.group.position.x,y:a.group.position.y,z:a.group.position.z}})));canvas.dataset.selected=JSON.stringify(frame.selected);canvas.dataset.revision=String(revision);
 canvas.dataset.ballPosition=frame.simulation?JSON.stringify(frame.simulation.ball):'';canvas.dataset.simulationMode=frame.simulation?.mode||'';canvas.dataset.simulationDuration=String(frame.simulation?.duration||0);canvas.dataset.simulationOutcome=frame.simulation?.outcome||'';canvas.dataset.actorPoses=JSON.stringify(frame.actors.map(actor=>({id:actor.id,role:actor.poseRole,pose:actor.pose,jump:actor.jump,extension:actor.extension,handAngle:actor.handAngle})));
 canvas.dataset.camera=JSON.stringify({azimuth,elevation,distance,target:target.toArray()});
 if(cameraMotion)invalidate();
}
function cast(event){pointer.set(event.clientX/Math.max(1,innerWidth)*2-1,1-event.clientY/Math.max(1,innerHeight)*2);ray.setFromCamera(pointer,camera);}
function groundPoint(event){cast(event);const result=ray.ray.intersectPlane(ground,new THREE.Vector3());return result?limitPoint(worldToCourt(result)):null;}
function hitObject(event){cast(event);const hit=ray.intersectObjects(pickTargets,true).find(hit=>hit.object.userData.objectId);return hit?.object.userData.objectId||null;}
function selectObject(id,multiple){const ids=multiple?(frame.selected.includes(id)?frame.selected.filter(value=>value!==id):[...frame.selected,id]):frame.selected.includes(id)?frame.selected:[id];emit('select',{ids});return ids;}
function anchorFor(id){const actor=frame.actors.find(a=>a.id===id),drawing=frame.drawings.find(d=>d.id===id);return actor?worldToCourt(actor.position):drawing?.points[0]?worldToCourt(drawing.points[0]):null;}
function cancelGesture(){stopCameraMotion();gesture=null;preview=null;handleDrag=null;setDraft(null);canvas.style.cursor='default';invalidate();}
function moveCameraGesture(g,event){
 const nextAzimuth=g.azimuth-(event.clientX-g.pixel.x)*.005,nextElevation=clamp(g.elevation+(event.clientY-g.pixel.y)*.003,.12,1.25),now=performance.now();
 g.cameraVelocity=sampleCameraAngularVelocity(g.cameraVelocity,{azimuth:nextAzimuth-azimuth,elevation:nextElevation-elevation},now-g.cameraTime,now);
 g.cameraTime=now;g.cameraPixel={x:event.clientX,y:event.clientY};azimuth=nextAzimuth;elevation=nextElevation;updateCamera();invalidate();
}
canvas.addEventListener('pointerdown',event=>{
 stopCameraMotion();if(!frame||!active||event.button>1)return;canvas.focus();const start=groundPoint(event);if(!start)return;const id=hitObject(event),tool=packet.tool||'select';let ids=[];
 if(!packet.disabled&&['select','animate'].includes(tool)&&id)ids=selectObject(id,event.shiftKey||packet.multiple);
 else if(!packet.disabled&&tool==='select'&&!id&&!packet.multiple)emit('select',{ids:[]});
 const cameraDrag=tool==='pan'||packet.disabled||['select','animate'].includes(tool)&&!id||event.button===1;
 const point=packet.grid&&!['select','animate','pan','pen','area'].includes(tool)?snapPoint(start):start;
 gesture={pointerId:event.pointerId,revision,start:point,pixel:{x:event.clientX,y:event.clientY},last:point,points:[point],ids:editableIds(ids,frame),anchor:anchorFor(ids[0]),cameraDrag,azimuth,elevation,cameraTime:performance.now(),cameraPixel:{x:event.clientX,y:event.clientY},cameraVelocity:null,tool,moved:false,duplicate:event.altKey&&tool==='select'};
 canvas.setPointerCapture(event.pointerId);canvas.style.cursor=cameraDrag?'grabbing':'move';event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
 if(!gesture){canvas.style.cursor=hitObject(event)?'grab':'default';return;}
 const g=gesture;if(g.pointerId!==event.pointerId)return;if(!g.moved&&Math.hypot(event.clientX-g.pixel.x,event.clientY-g.pixel.y)<5)return;g.moved=true;
 if(g.cameraDrag){moveCameraGesture(g,event);return;}
 let point=groundPoint(event);if(!point)return;
 if(['select','animate'].includes(g.tool))point=snappedGesture(point,g.start,g.anchor,packet.grid,g.tool,packet.motionMode);
 else if(packet.grid&&!['pen','area','pan'].includes(g.tool))point=snapPoint(point);
 g.last=point;if(['animate','pen','area'].includes(g.tool)){if(packet.motionMode==='straight'&&g.tool==='animate')g.points=[g.start,point];else if(g.points.length<300)g.points.push(point);else g.points[g.points.length-1]=point;}else g.points=[g.start,point];
 if(['select','animate'].includes(g.tool)){preview={ids:g.ids,delta:{x:point.x-g.start.x,y:point.y-g.start.y}};if(g.tool==='animate'&&g.anchor&&g.ids.length){const points=g.points.map(p=>courtToWorld({x:g.anchor.x+p.x-g.start.x,y:g.anchor.y+p.y-g.start.y}));setDraft({id:'preview',kind:'arrow',points,color:packet.color||'#ffffff',dashed:true,size:28,rotation:0});}invalidate();}
 else if(!['player','text','pan'].includes(g.tool))setDraft({id:'preview',kind:g.tool,points:g.points.map(courtToWorld),color:packet.color||'#ffffff',dashed:packet.dashed,size:32,rotation:0});
});
function finishGesture(event,cancelled=false){const g=gesture;if(!g||event.pointerId!==g.pointerId)return;gesture=null;
 if(!cancelled&&g.cameraDrag&&g.moved){
  if(event.clientX!==g.cameraPixel.x||event.clientY!==g.cameraPixel.y)moveCameraGesture(g,event);
  const now=performance.now();cameraMotion=!reducedMotion.matches&&!document.hidden?releaseCameraMotion(g.cameraVelocity,now):null;cameraMotionTime=now;
 }
 if(!cancelled&&!g.cameraDrag&&!packet.disabled&&g.revision===revision){
 if(['select','animate'].includes(g.tool)&&g.moved&&g.ids.length){const path=g.tool==='animate'?(packet.motionMode==='straight'?[g.start,g.last]:g.points).map(p=>({x:p.x-g.start.x,y:p.y-g.start.y})):undefined;emit('move',{ids:g.ids,delta:{x:g.last.x-g.start.x,y:g.last.y-g.start.y},...(path?{path}:{}),duplicate:g.duplicate},g.revision);}
 else if(g.tool==='player')emit('add-player',{point:g.start},g.revision);
 else if(!['select','animate','pan','player'].includes(g.tool)){const needsStroke=['arrow','curve','pen','area'].includes(g.tool);if(!needsStroke||g.moved)emit('draw',{drawing:{kind:g.tool,points:needsStroke?g.points:[g.start],color:packet.color||'#ffffff',dashed:Boolean(packet.dashed),size:32,rotation:0,...(g.tool==='text'?{text:'Anotação'}:{})}},g.revision);}
 }preview=null;setDraft(null);canvas.style.cursor='default';invalidate();}
canvas.addEventListener('pointerup',event=>finishGesture(event));canvas.addEventListener('pointercancel',event=>finishGesture(event,true));canvas.addEventListener('lostpointercapture',event=>{if(gesture?.pointerId===event.pointerId)cancelGesture();});
canvas.addEventListener('dblclick',event=>{if(packet?.disabled)return;const id=hitObject(event);if(frame?.drawings.some(d=>d.id===id&&d.kind==='text'))emit('edit-text',{id});});
canvas.addEventListener('wheel',event=>{event.preventDefault();stopCameraMotion();distance=clamp(distance*Math.exp(event.deltaY*.001),12,65);updateCamera();invalidate();},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('keydown',event=>{
 if(!frame||!active)return;const modifier=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();let command=null;
 if(modifier&&key==='z')command=event.shiftKey?'redo':'undo';else if(modifier&&key==='y')command='redo';else if(modifier&&key==='s')command='save';else if(modifier&&key==='c')command='copy';else if(modifier&&key==='v')command='paste';else if(modifier&&key==='a')command='select-all';else if(key==='delete'||key==='backspace')command='delete';else if(key==='escape'){cancelGesture();command='escape';}else if(key===' '){command='play';}else if(key==='v')command='select-tool';else if(key.startsWith('arrow'))command=`nudge-${key.slice(5)}`;
 if(command){event.preventDefault();event.stopPropagation();emit('shortcut',{key:command,shift:event.shiftKey});}
});
window.addEventListener('blur',cancelGesture);
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;const data=event.data;
 if(!data||data.channel!==CHANNEL||data.version!==VERSION||data.type!=='frame'||typeof data.token!=='string'||!data.token||!Number.isSafeInteger(data.revision)||data.revision<0)return;
 if(token&&data.token!==token){cancelGesture();lastAnchor=undefined;}
 const next=data.frame;if(!next||!Array.isArray(next.actors)||!Array.isArray(next.drawings)||!Array.isArray(next.selected)||!Array.isArray(next.hide)||typeof next.stepId!=='string'||!next.actors.every(actor=>typeof actor.id==='string'&&isWorldPoint(actor.position))||!next.drawings.every(drawing=>typeof drawing.id==='string'&&Array.isArray(drawing.points)&&drawing.points.every(isWorldPoint)))return;
 if(frame&&next.stepId!==frame.stepId||packet&&packet.tool!==data.tool)stopCameraMotion();
 if(shouldCancelFrameGesture(gesture,data)||handleDrag&&(handleDrag.revision!==data.revision||data.disabled&&!(data.allowServeHandle&&handleDrag.kind==='serve')||data.active===false))cancelGesture();token=data.token;revision=data.revision;packet=data;frame=next;active=data.active!==false;
 if(!active){cancelGesture();if(pending){cancelAnimationFrame(pending);pending=0;}return;}
 const zoom=clamp(Number(data.zoom)||1,.3,4);if(zoom!==lastZoom){stopCameraMotion();distance=clamp(distance*lastZoom/zoom,12,65);lastZoom=zoom;updateCamera();}
 const simulationMode=frame.simulation?.mode||null,simulationChanged=simulationMode!==lastSimulationMode;lastSimulationMode=simulationMode;
 if(['front','side','orbit'].includes(data.cameraView)&&(simulationChanged||data.cameraView!==cameraView||data.cameraReset!==lastCameraReset||Boolean(data.half)!==lastHalf)){lastCameraReset=data.cameraReset;lastHalf=Boolean(data.half);applyView(data.cameraView);}
 if(!renderer)emit('error',{message:error.textContent});else invalidate();
});
// Retries cover listener installation ordering; no document state is retained.
let readyTries=0;const readyTimer=setInterval(()=>{if(token||++readyTries>30){clearInterval(readyTimer);return;}emit('ready');},200);emit('ready');
