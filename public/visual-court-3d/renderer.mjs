import * as THREE from './three.module.min.js';
import {createActorRig} from './actor-rig.mjs?v=defense-ready-hands-20261126';
import {clamp,isWorldPoint,worldToCourt,courtToWorld,limitPoint,snapPoint,snappedGesture,curvePoints,editableIds,movementTrail,shouldCancelFrameGesture} from './renderer-geometry.mjs';
import {isHeightHandle,previewAttackCurve,previewServeTarget,simulationHandleEdit} from './renderer-simulation-geometry.mjs?v=serve-target-preview-20261123';
import {createSimulationGuides,serveNetCrossing} from './renderer-simulation.mjs';
import {renderPixelRatio,syncRendererResolution} from './renderer-resolution.mjs';
import {CAMERA_MOTION,sampleCameraAngularVelocity,releaseCameraMotion,integrateCameraMotion} from './renderer-camera-motion.mjs?v=court-under-orbit-20261125';
import {collectFrameFitPoints,fitCameraDistance} from './renderer-camera-framing.mjs';
import {bindRendererLifecycle} from './renderer-lifecycle.mjs';
import {elevationTarget,elevationValue,elevationKeyValue,shouldCancelElevationDrag,elevationDragCommand,previewCourtObjects,elevationControlLayout,authorMovementPlaneY} from './renderer-elevation.mjs';
import {targetPickSurface,pickCourtObject,pickCourtHit,pickCourtTouchHit,courtHoverState,createCourtHoverPainter} from './renderer-interaction.mjs';
import {courtSolidMaterial,createContactShadow,updateContactShadow} from './renderer-appearance.mjs';
import {pointerDragThreshold,emptyTouchContacts,advanceTouchContacts,cancelTouchContacts,touchPair,orbitPointerDrag,panPointerDrag,boundedObjectDrag,beginTouchCamera,moveTouchCamera,shouldReleaseMovePreview,resizeCameraZoom} from './renderer-pointer-gestures.mjs?v=court-under-orbit-20261125';
import {trajectoryStroke,trajectoryTipDirection,createTrajectorySelection,trajectoryHandleTarget,trajectoryHandlePoint,trajectoryControlLayout,trajectoryHeightValue,trajectoryDragPlane,trajectoryPlanePoint,trajectoryPointValue,trajectoryLateralDelta,shouldCancelTrajectoryDrag,trajectoryPointDragCommand,previewTrajectoryPoint} from './renderer-trajectory.mjs?v=defense-attack-trace-20261120';
import {renderedNetContact,showsNetWarning,netWarningLayout} from './renderer-net-warning.mjs?v=net-floor-20261122';
import {BALL_RADIUS,NET_TOP,NET_BOTTOM,NET_WIDTH,TOP_BAND_HEIGHT,BOTTOM_BAND_HEIGHT,TOP_BAND_DEPTH,BOTTOM_BAND_DEPTH,TOP_BAND_CENTER,BOTTOM_BAND_CENTER} from './court-net.js';

// This surface renders the parent editor's frame. It has no document, timeline,
// presets, persistence or undo stack. Only camera and uncommitted gestures live here.
const CHANNEL='goatleta-court-3d',VERSION=1;
const canvas=document.querySelector('#scene'),labels=document.querySelector('#labels'),error=document.querySelector('#error');
const handleLayer=document.querySelector('#simulation-handles');
const netWarningLayer=document.querySelector('#net-warnings'),netWarnings=new Map();
let token='',revision=0,active=true,packet=null,frame=null,pending=0,gesture=null,preview=null,lastAnchor=undefined;
let elevationDrag=null,elevationButton=null,elevationTether=null;
let pendingMovePreview=null,pendingMoveTimer=0,resizeZoomIntent=null;
let pendingElevationPreview=null,pendingElevationTimer=0;
let trajectoryDrag=null,pendingTrajectoryPreview=null,pendingTrajectoryTimer=0;
const trajectoryButtons=new Map(),trajectoryTethers=new Map();
let touchContacts=emptyTouchContacts(),touchCamera=null,suppressTouchClick=false;
let hoveredId=null;
const hoverPainter=createCourtHoverPainter();
const scene=new THREE.Scene();scene.background=new THREE.Color('#09090f');
let renderer,lifecycle;
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
let azimuth=0,elevation=.3656,distance=20.5,cameraView='front',lastZoom=1,lastCameraReset=undefined,lastHalf=false,lastSimulationMode=null;
let lastViewport={width:innerWidth,height:innerHeight,topInset:0,bottomInset:0};
let cameraMotion=null,cameraMotionTime=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function stopCameraMotion(){cameraMotion=null;cameraMotionTime=0;}
document.addEventListener('pointerdown',event=>{stopCameraMotion();if(event.pointerType==='touch'||event.button!==2)clearHover();},{capture:true});
document.addEventListener('keydown',()=>{stopCameraMotion();clearHover();},{capture:true});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopCameraMotion();});
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
function invalidate(){if(active&&renderer&&!document.hidden&&!lifecycle?.isSuspended()&&!pending)pending=requestAnimationFrame(render);}
function clearHover(){if(!hoveredId)return;hoveredId=null;hoverPainter.clear();canvas.dataset.hoveredId='';for(const object of actorMap.values())delete object.label.dataset.hovered;invalidate();}
function hoverObject(id,pointerType){
 const hover=courtHoverState(id,frame,packet,pointerType,Boolean(gesture||handleDrag||elevationDrag||trajectoryDrag||cameraMotion||touchContacts.suppressed||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)||!active);
 const next=hover?.id||null;if(next!==hoveredId){hoveredId=next;canvas.dataset.hoveredId=next||'';invalidate();}
 return hover;
}

const apron=mesh(new THREE.PlaneGeometry(18,28),material('#090c13'));apron.rotation.x=-Math.PI/2;
const court=mesh(new THREE.PlaneGeometry(9,18),material('#0a1123',{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));court.rotation.x=-Math.PI/2;
const courtGroup=new THREE.Group();scene.add(courtGroup);
for(const z of [-9,0,9])line([[-4.5,.012,z],[4.5,.012,z]],'#456397',false,courtGroup);
for(const x of [-4.5,4.5])line([[x,.012,-9],[x,.012,9]],'#456397',false,courtGroup);
// Floor strips keep a visible width at oblique camera angles. All 22 marks
// share one draw call, with normal depth testing against the players and net.
const attackMarks=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,.05).rotateX(-Math.PI/2),
 new THREE.MeshBasicMaterial({color:'#8ca8d4',polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),22);
const markTransform=new THREE.Matrix4();
let markIndex=0;
for(const z of [-3,3]){
 attackMarks.setMatrixAt(markIndex++,markTransform.makeScale(9,1,1).setPosition(0,.02,z));
 // Five 15 cm marks separated by 20 cm on each side, as in the 2D court.
 for(const side of [-1,1])for(let i=0;i<5;i++){
  const center=4.5+.20+.075+i*.35;
  attackMarks.setMatrixAt(markIndex++,markTransform.makeScale(.15,1,1).setPosition(side*center,.02,z));
 }
}
courtGroup.add(attackMarks);
line([[-9,.01,-14],[9,.01,-14],[9,.01,14],[-9,.01,14],[-9,.01,-14]],'#242934');
const grid=new THREE.Group();scene.add(grid);
for(let x=-4;x<4.5;x+=.5)line([[x,.015,-9],[x,.015,9]],'#6687b4',false,grid,.12);
for(let z=-8.5;z<9;z+=.5)line([[-4.5,.015,z],[4.5,.015,z]],'#6687b4',false,grid,.12);
grid.visible=false;
const net=new THREE.Group();scene.add(net);
const netCenter=(NET_TOP+NET_BOTTOM)/2,netHalfWidth=NET_WIDTH/2;
const netSurface=mesh(new THREE.PlaneGeometry(NET_WIDTH,NET_TOP-NET_BOTTOM),material('#98a7c1',{transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}),net);netSurface.position.y=netCenter;
const strands=[];
for(let i=0;i<=100;i++)strands.push(new THREE.Vector3(i*.1-netHalfWidth,NET_BOTTOM,0),new THREE.Vector3(i*.1-netHalfWidth,NET_TOP,0));
for(let i=1;i<10;i++)strands.push(new THREE.Vector3(-netHalfWidth,NET_BOTTOM+i*.1,0),new THREE.Vector3(netHalfWidth,NET_BOTTOM+i*.1,0));
net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strands),new THREE.LineBasicMaterial({color:'#8b97ad',transparent:true,opacity:.08})));
const tape=courtSolidMaterial('#b5bdc9'),postMaterial=courtSolidMaterial('#b5bdc9','post');
mesh(new THREE.BoxGeometry(NET_WIDTH,TOP_BAND_HEIGHT,TOP_BAND_DEPTH),tape,net).position.y=TOP_BAND_CENTER;
mesh(new THREE.BoxGeometry(NET_WIDTH,BOTTOM_BAND_HEIGHT,BOTTOM_BAND_DEPTH),tape,net).position.y=BOTTOM_BAND_CENTER;
for(const x of [-5.35,5.35]){
 mesh(new THREE.CylinderGeometry(.035,.045,2.55,10),postMaterial,net).position.set(x,2.55/2,0);
 mesh(new THREE.BoxGeometry(.05,1,.03),tape,net).position.set(Math.sign(x)*4.5,netCenter,0);
 mesh(new THREE.CylinderGeometry(.005,.005,1,6),tape,net).position.set(Math.sign(x)*4.525,netCenter,0);
 for(let j=0;j<8;j++)mesh(new THREE.CylinderGeometry(.005,.005,.1,6),courtSolidMaterial(j%2?'#df5d64':'#dfe2e5'),net).position.set(Math.sign(x)*4.525,NET_TOP+.05+j*.1,0);
}
const loader=new THREE.TextureLoader();
const ballTexture=loader.load('./reference/ball.webp',texture=>{texture.colorSpace=THREE.SRGBColorSpace;invalidate();});
function colorOf(value,fallback='#609ce8'){return typeof value==='string'&&/^#[\da-f]{3,8}$/i.test(value)?value:fallback;}
function makeActor(actor){
 const group=new THREE.Group();scene.add(group);
 const shadow=createContactShadow('actor');group.add(shadow);
 const rig=createActorRig(group);
 rig.group.traverse(part=>{if(part.isMesh)part.userData.objectId=actor.id;});
 const selection=mesh(new THREE.RingGeometry(.36,.41,40),material('#b9d9ff',{side:THREE.DoubleSide,transparent:true,opacity:.9}),group);selection.rotation.x=-Math.PI/2;selection.position.y=.026;
 selection.userData.interactionIgnore=true;
 const label=document.createElement('button');label.className='actor-label';label.type='button';labels.append(label);
 label.addEventListener('click',event=>{if(packet?.disabled||!active)return;selectObject(actor.id,event.shiftKey||packet.multiple);canvas.focus();});
 label.addEventListener('pointerenter',event=>hoverObject(actor.id,event.pointerType));
 label.addEventListener('pointermove',event=>{if(!event.buttons)hoverObject(actor.id,event.pointerType);});
 label.addEventListener('pointerleave',()=>{if(hoveredId===actor.id)clearHover();});
 const positionBadge=document.createElement("span");
 positionBadge.className="actor-position";positionBadge.hidden=true;positionBadge.setAttribute("aria-hidden","true");labels.append(positionBadge);
 const result={group,shadow,rig,selection,label,positionBadge,height:1.9};actorMap.set(actor.id,result);return result;
}
function applyActor(actor,object,contactBall,attackImpact){
 object.group.position.set(actor.position.x,actor.position.y,actor.position.z);
 updateContactShadow(object.shadow,actor.position.y,actor.position.y+Math.max(0,actor.jump||0));
 const tint=colorOf(actor.color);
 const opacity=actor.opacity??1;
 object.rig.group.traverse(child=>{
  const mat=child.material;
  if(!mat?.color)return;
  mat.color.set(tint);
  const transparent=opacity<1;
  if(mat.transparent!==transparent){mat.transparent=transparent;mat.depthWrite=!transparent;mat.needsUpdate=true;}
  mat.opacity=opacity;
 });
 object.label.style.opacity=String(opacity);
 object.positionBadge.style.opacity=String(opacity);
 object.shadow.visible=opacity===1;
 const contactTarget=actor.contactTarget ?? (actor.poseRole==='attacker'&&actor.contactWeight!==undefined?attackImpact:
  actor.pose==='contact'||actor.previousPose==='contact'&&(actor.poseBlend??1)<1||
  actor.poseRole==='server'&&(['ready','toss'].includes(actor.pose)||['ready','toss'].includes(actor.previousPose)&&(actor.poseBlend??1)<1)?contactBall:undefined);
 object.rig.update(contactTarget?{...actor,contactTarget}:actor);object.height=object.rig.height;
 object.group.visible=opacity>0&&!frame.hide.includes('actors');object.selection.visible=frame.selected.includes(actor.id);object.label.textContent=actor.label;object.label.setAttribute('aria-label',`Selecionar jogador ${actor.label}${actor.rotationPosition ? ` · posição ${actor.rotationPosition}` : ""}`);object.label.setAttribute('aria-pressed',String(frame.selected.includes(actor.id)));object.label.disabled=packet.disabled;object.label.dataset.hovered=String(hoveredId===actor.id);
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
  const stroke=['arrow','curve'].includes(drawing.kind)?trajectoryStroke(drawing,Boolean(packet?.landscape)):points;
  if(!stroke.length)return group;
  line(drawing.kind==='area'?[...stroke,stroke[0]]:stroke,color,Boolean(drawing.dashed),group);
  if(drawing.kind==='area'&&points.length>2){
   // The original Defense board used this generated ID for the same editable area.
   const blockShadow=drawing.id==='defense-block-shadow'||drawing.id==='board_mwecn3c3_goz1ka3k';
   const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
   // Give the shadow priority over the offset court floor at grazing angles.
   const fill=mesh(new THREE.ShapeGeometry(shape),material(color,{
    transparent:true,opacity:blockShadow?.52:.2,side:THREE.DoubleSide,depthWrite:false,
    ...(blockShadow?{polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}:{})
   }),group);
   fill.rotation.x=-Math.PI/2;
   fill.position.y=first.y-.005;
  }
  if(['arrow','curve'].includes(drawing.kind)&&stroke.length>1){const direction=trajectoryTipDirection(stroke,drawing.traceProgress!==undefined);if(direction){const cone=mesh(new THREE.ConeGeometry(.09,.28,12),material(color),group);cone.position.copy(vector(stroke.at(-1)));cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);}}
 }else if(drawing.kind==='ball')mesh(new THREE.SphereGeometry(BALL_RADIUS,24,16),courtSolidMaterial('#ffffff','ball',ballTexture),group).position.copy(vector(first));
 else if(drawing.kind==='cone'){const cone=mesh(new THREE.ConeGeometry(size*.45,size,16),courtSolidMaterial(color),group);cone.position.set(first.x,first.y+size*.5,first.z);mesh(new THREE.BoxGeometry(size*1.15,.045,size*1.15),courtSolidMaterial(color),group).position.set(first.x,first.y+.022,first.z);}
 else if(drawing.kind==='target'){for(const radius of [size,size*.5]){const ring=mesh(new THREE.TorusGeometry(radius,.018,8,40),courtSolidMaterial(color),group);ring.rotation.x=-Math.PI/2;ring.position.copy(vector(first));}const pick=targetPickSurface(size,drawing.id);pick.position.copy(vector(first));group.add(pick);}
 else if(drawing.kind==='ladder'){const ladder=new THREE.Group();group.add(ladder);ladder.position.copy(vector(first));ladder.rotation.y=-(drawing.rotation||0)*Math.PI/180;for(const x of [-.62,.62])mesh(new THREE.BoxGeometry(size*.14,.05,size*4),courtSolidMaterial('#263445'),ladder).position.x=x*size;for(const z of [-1.65,-.825,0,.825,1.65])mesh(new THREE.BoxGeometry(size*1.3,.05,size*.16),courtSolidMaterial(color),ladder).position.z=z*size;}
 else if(drawing.kind==='text'){const text=makeText(drawing.text,color,drawing.size);text.position.set(first.x,first.y+.28,first.z);group.add(text);}
 group.traverse(child=>{child.userData.objectId=drawing.id;});return group;
}
function updateDrawings(drawings){
 const ids=new Set(frame.drawings.map(d=>d.id));for(const [id,object] of drawingMap)if(!ids.has(id)){dispose(object.group);drawingMap.delete(id);}
 for(const drawing of drawings){
  const materialPoint=['ball','cone','target','ladder'].includes(drawing.kind)?drawing.points[0]:null,local=materialPoint?{...drawing,points:drawing.points.map(p=>({x:p.x-materialPoint.x,y:p.y-materialPoint.y,z:p.z-materialPoint.z})),motion:undefined}:drawing;
  const key=JSON.stringify([local,Boolean(packet.landscape)]);let object=drawingMap.get(drawing.id);
  if(!object||object.key!==key){
   if(object)dispose(object.group);const group=buildDrawing(local);scene.add(group);const trajectory=['arrow','curve'].includes(drawing.kind),selection=trajectory?createTrajectorySelection(local,Boolean(packet.landscape)):new THREE.Group();selection.userData.interactionIgnore=true;group.add(selection);const points=local.points;
   if(drawing.kind==='area'&&points.length>2){
    const contour=line([...points,points[0]],'#e3efff',Boolean(drawing.dashed),selection,.8);contour.renderOrder=1;contour.material.depthWrite=false;
   }else if(points.length&&!trajectory&&drawing.kind!=='area'){const padding=Math.max(.18,(drawing.size||28)/100),xs=points.map(p=>p.x),zs=points.map(p=>p.z),x1=Math.min(...xs)-padding,x2=Math.max(...xs)+padding,z1=Math.min(...zs)-padding,z2=Math.max(...zs)+padding;line([[x1,.035,z1],[x2,.035,z1],[x2,.035,z2],[x1,.035,z2],[x1,.035,z1]],'#e3efff',true,selection,.8);}
   const shadow=materialPoint?createContactShadow(drawing.kind,clamp(Number(drawing.size)||28,12,80)/100):null;if(shadow)group.add(shadow);
   object={group,key,selection,shadow};drawingMap.set(drawing.id,object);
  }
  const height=materialPoint?.y||0;
  // Keep the sphere clear of the painted lines at floor contact.
  const renderedY=drawing.kind==='ball'&&materialPoint?Math.max(height,BALL_RADIUS+.003):height;
  object.group.position.set(materialPoint?.x||0,renderedY,materialPoint?.z||0);object.group.visible=!frame.hide.includes('drawings');object.selection.visible=frame.selected.includes(drawing.id);
  if(object.shadow)updateContactShadow(object.shadow,materialPoint.y,materialPoint.y-(drawing.kind==='ball'?.12:.025),drawing.kind==='ladder'?drawing.rotation||0:0);
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
const handleButtons=new Map(),handleNames={set:'Altura do levantamento',pass:'Altura do passe',attack:'Curva do ataque',hit:'Contato do ataque',target:'Destino do ataque',serve:'Destino do saque','approach-start':'Início da passada','approach-end':'Fim da passada'};
function updateSimulation(){
 const original=frame.simulation,drag=handleDrag,edit=drag?.moved?simulationHandleEdit(drag.handle,drag.last,drag.last.y-drag.handle.point.y):null;

 const data=edit?.kind==='attack'?previewAttackCurve(original,edit.value):edit?.kind==='serve'?previewServeTarget(original,edit.point):original;
 if(!data){if(simulationGuides){dispose(simulationGuides);simulationGuides=null;}simulationKey='';delete canvas.dataset.serveNetCrossing;for(const button of handleButtons.values())button.hidden=true;return;}
 const key=data===original?data.guideKey:JSON.stringify([data.guideKey,edit]);
 if(simulationKey!==key){if(simulationGuides)dispose(simulationGuides);simulationGuides=createSimulationGuides(data);scene.add(simulationGuides);simulationKey=key;const crossing=serveNetCrossing(simulationGuides);if(crossing)canvas.dataset.serveNetCrossing=JSON.stringify(crossing);else delete canvas.dataset.serveNetCrossing;}
 simulationGuides.visible=data.guidesVisible&&!frame.hide.includes('movements');
 const approach=simulationGuides.getObjectByName('approach');
 if(approach&&['approach-start','approach-end'].includes(handleDrag?.kind)){
  const edit=simulationHandleEdit(handleDrag.handle,handleDrag.last);
  if(edit){
   const positions=approach.geometry.attributes.position;
   positions.setXYZ(edit.kind==='approach-start'?0:1,edit.point.x,edit.point.y,edit.point.z);
   positions.needsUpdate=true;approach.geometry.computeBoundingSphere();approach.computeLineDistances();
  }
 }
 for(const marker of simulationGuides.children)if(marker.userData.contactTime!==undefined){const elapsed=data.elapsedSeconds-marker.userData.contactTime,pulse=elapsed>=0?Math.exp(-elapsed*12):0;marker.scale.setScalar(1+pulse*.7);marker.material.opacity=.65+pulse*.35;}
 const handles=new Map((data.handles||[]).map(handle=>[handle.kind,handle]));
 for(const [kind,name] of Object.entries(handleNames)){
  let button=handleButtons.get(kind);if(!button){button=makeGuideHandle(kind,name);handleButtons.set(kind,button);handleLayer.append(button);}
  const handle=handles.get(kind),at=handleDrag?.kind===kind&&kind!=='attack'?simulationHandleEdit(handle,handleDrag.last,handleDrag.last.y-handle.point.y)?.point:handle?.point,position=at?project(vector(at)):null;
  button.hidden=!handle||!simulationGuides.visible||!packet.simulationHandles||!position?.visible;button.disabled=packet.disabled&&!(packet.allowServeHandle&&kind==='serve');
  if(position){button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;}
 }
}
function updateHandlePoint(event){
 const drag=handleDrag;if(!drag||drag.pointerId!==event.pointerId)return false;
 if(!drag.moved&&Math.hypot(event.clientX-drag.pixel.x,event.clientY-drag.pixel.y)<pointerDragThreshold(drag.pointerType))return false;
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
 if(drag.kind==='approach-start'||drag.kind==='approach-end')simulationKey='';
 if(!cancelled&&drag.moved&&drag.revision===revision&&(!packet.disabled||packet.allowServeHandle&&drag.kind==='serve')){const edit=simulationHandleEdit(drag.handle,drag.last,drag.last.y-drag.handle.point.y);if(edit&&(edit.value===undefined||Math.abs(edit.value-drag.handle.value)>1e-8))emit('simulation-handle',edit,drag.revision);}
 invalidate();
}
function guideHandleButton(kind,name,className){
 const button=document.createElement('button');button.type='button';button.className=`guide-handle ${className}`;button.id=`handle-${kind}`;button.setAttribute('aria-label',name);button.title=`Arraste para ajustar: ${name.toLowerCase()}. Use as setas para ajustar.`;return button;
}
function makeGuideHandle(kind,name){
 const button=guideHandleButton(kind,name,`${isHeightHandle(kind)?'apex':kind==='target'||kind==='serve'?'target':''} ${kind==='serve'?'serve':''}`);
 button.addEventListener('pointerdown',event=>{
  if(packet?.disabled&&!(packet.allowServeHandle&&kind==='serve')||!active||event.button!==0||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;const handle=frame?.simulation?.handles.find(item=>item.kind===kind);if(!handle)return;event.preventDefault();event.stopPropagation();cancelGesture(true);
  const plane=new THREE.Plane(),at=vector(handle.point);plane.setFromNormalAndCoplanarPoint(isHeightHandle(kind)?camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(0,1,0),at);cast(event);const start=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
  handleDrag={kind,handle,revision,pointerId:event.pointerId,pointerType:event.pointerType,pixel:{x:event.clientX,y:event.clientY},plane,start,last:{...handle.point},moved:false};button.setPointerCapture(event.pointerId);button.focus();invalidate();
 });
 button.addEventListener('pointermove',event=>{if(!updateHandlePoint(event))return;event.preventDefault();event.stopPropagation();invalidate();});
 button.addEventListener('pointerup',event=>finishHandle(event));button.addEventListener('pointercancel',event=>finishHandle(event,true));button.addEventListener('lostpointercapture',event=>finishHandle(event,true));
 button.addEventListener('keydown',event=>{
  if(!event.key.startsWith('Arrow')||packet?.disabled&&!(packet.allowServeHandle&&kind==='serve')||!active)return;event.preventDefault();event.stopPropagation();const handle=frame?.simulation?.handles.find(item=>item.kind===kind);if(!handle)return;const at={...handle.point},direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1,height=isHeightHandle(kind);if(height)at.y+=direction*.12;else{at.x+=event.key==='ArrowLeft'?-.25:event.key==='ArrowRight'?.25:0;at.z+=event.key==='ArrowUp'?-.25:event.key==='ArrowDown'?.25:0;}const edit=simulationHandleEdit(handle,at,height?direction*.12:0);if(edit&&(edit.value===undefined||Math.abs(edit.value-handle.value)>1e-8))emit('simulation-handle',edit);
 });
 return button;
}
function updateElevationPoint(event){
 const drag=elevationDrag;if(!drag||drag.pointerId!==event.pointerId||shouldCancelElevationDrag(drag,{...packet,frame}))return false;
 if(!drag.moved&&Math.hypot(event.clientX-drag.pixel.x,event.clientY-drag.pixel.y)<pointerDragThreshold(drag.pointerType))return false;
 cast(event);const point=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)return false;
 const value=elevationValue(drag.initial,point.y-drag.start.y);if(value===null)return false;
 drag.value=value;drag.moved=true;return true;
}
function finishElevation(event,cancelled=false){
 const drag=elevationDrag;if(!drag||drag.pointerId!==event.pointerId)return;
 if(!cancelled)updateElevationPoint(event);elevationDrag=null;
 const command=elevationDragCommand(drag,{...packet,frame},cancelled);if(command){holdElevationPreview(drag);emit('elevation',command,drag.revision);}invalidate();
}
function makeElevationHandle(){
 const button=guideHandleButton('elevation','Altura','elevation'),label=document.createElement('span');label.className='elevation-label';label.setAttribute('aria-hidden','true');button.append(label);
 elevationTether=document.createElement('div');elevationTether.className='elevation-tether';elevationTether.setAttribute('aria-hidden','true');elevationTether.hidden=true;handleLayer.append(elevationTether);
 button.title='Arraste para ajustar a altura. Setas para cima/baixo: 0,1 m. Shift: 0,5 m. Home: piso.';
 button.addEventListener('pointerdown',event=>{
  const selected=elevationTarget(frame,packet);if(!selected||!active||event.button!==0||elevationDrag||trajectoryDrag||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview||event.isPrimary===false)return;event.preventDefault();event.stopPropagation();cancelGesture(true);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),vector(selected.point));cast(event);const start=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
  elevationDrag={id:selected.id,point:{...selected.point},initial:selected.value,value:selected.value,stepId:frame.stepId,token,revision,cameraView:packet.cameraView,cameraReset:packet.cameraReset,zoom:packet.zoom,pointerId:event.pointerId,pointerType:event.pointerType,plane,start,pixel:{x:event.clientX,y:event.clientY},moved:false};button.setPointerCapture(event.pointerId);button.focus();invalidate();
 });
 button.addEventListener('pointermove',event=>{if(!updateElevationPoint(event))return;event.preventDefault();event.stopPropagation();invalidate();});
 button.addEventListener('pointerup',event=>finishElevation(event));button.addEventListener('pointercancel',event=>finishElevation(event,true));button.addEventListener('lostpointercapture',event=>finishElevation(event,true));
 button.addEventListener('blur',()=>{if(elevationDrag)cancelGesture();});
 button.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelGesture();return;}
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const selected=elevationTarget(frame,packet);if(!selected||!active)return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();if(elevationDrag||trajectoryDrag||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
  const value=elevationKeyValue(selected.value,event.key,event.shiftKey);if(value!==null&&Math.abs(value-selected.value)>1e-8)emit('elevation',{id:selected.id,value});
 });
 handleLayer.append(button);return button;
}
function updateElevationHandle(displayFrame){
 if(!elevationButton)elevationButton=makeElevationHandle();
 const selected=elevationTarget(frame,packet),object=selected&&(selected.actor?displayFrame.actors:displayFrame.drawings).find(item=>item.id===selected.id);
 const point=object?(selected.actor?object.position:object.points[0]):null;
 const position=point?project(vector(point).add(new THREE.Vector3(0,selected.actor?(actorMap.get(selected.id)?.height||1.9)*.65:.35,0))):null;
 const layout=position?elevationControlLayout(position,innerWidth,innerHeight,packet.selectionTopInset,packet.selectionBottomInset):null;
 elevationButton.hidden=!selected||!layout;elevationButton.disabled=!selected;elevationTether.hidden=!selected||!layout?.tether;
 if(!selected||!layout)return;
 const heightPreview=elevationDrag||pendingElevationPreview,value=heightPreview?.id===selected.id?heightPreview.value:selected.value,text=`Altura · ${value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} m`;
 elevationButton.style.left=`${layout.x}px`;elevationButton.style.top=`${layout.y}px`;elevationButton.dataset.labelSide=layout.labelSide;elevationButton.dataset.value=String(value);
 if(layout.tether){const line=layout.tether;elevationTether.style.left=`${line.x}px`;elevationTether.style.top=`${line.y}px`;elevationTether.style.width=`${line.length}px`;elevationTether.style.transform=`rotate(${line.angle}deg)`;}
 elevationButton.setAttribute('aria-label',text);elevationButton.firstElementChild.textContent=text;
}
const areaButtons=new Map();
function selectedArea(frame,packet){
 if(!packet?.areaHandles||packet.active===false||packet.disabled||packet.tool!=='select'||frame?.selected.length!==1||frame.hide.includes('drawings'))return null;
 const drawing=frame.drawings.find(item=>item.id===frame.selected[0]);
 return drawing?.kind==='area'&&!drawing.locked&&!drawing.hidden&&!drawing.motion?.length&&drawing.points.length>=3?drawing:null;
}
function areaVertexPosition(point,dx,dz){
 const at=limitPoint(worldToCourt({x:point.x+dx,z:point.z+dz}));
 return {...courtToWorld(at),y:point.y};
}
function areaVertexCommand(target,destination){
 if(!isWorldPoint(destination)||Math.hypot(destination.x-target.point.x,destination.z-target.point.z)<1e-8)return null;
 return {id:target.id,vertex:target.vertex,point:limitPoint(worldToCourt(destination))};
}
function shouldCancelAuthorGrip(drag,next){
 if(drag?.kind!=='area')return shouldCancelTrajectoryDrag(drag,next);
 const area=selectedArea(next.frame,next),point=area?.points[drag.vertex];
 return !point||area.id!==drag.id||drag.token!==next.token||drag.revision!==next.revision||drag.stepId!==next.frame.stepId
  ||point.x!==drag.point.x||point.y!==drag.point.y||point.z!==drag.point.z
  ||drag.cameraView!==next.cameraView||drag.cameraReset!==next.cameraReset||drag.zoom!==next.zoom;
}
function makeAreaHandle(vertex){
 const button=guideHandleButton(`area-vertex-${vertex}`,`Ajustar vértice ${vertex+1} da área`,'');
 button.title='Arraste no plano da quadra ou use as setas. Shift: 0,5 m.';
 const tether=document.createElement('div');tether.className='elevation-tether';tether.setAttribute('aria-hidden','true');tether.hidden=true;handleLayer.append(tether);
 button.addEventListener('pointerdown',event=>{
  const area=selectedArea(frame,packet),point=area?.points[vertex];
  if(!point||!active||event.button!==0||event.isPrimary===false||trajectoryDrag||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
  event.preventDefault();event.stopPropagation();cancelGesture(true);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),vector(point));cast(event);const start=trajectoryPlanePoint(ray.ray,plane);if(!start)return;
  trajectoryDrag={kind:'area',id:area.id,vertex,point,stepId:frame.stepId,token,revision,cameraView:packet.cameraView,cameraReset:packet.cameraReset,zoom:packet.zoom,pointerId:event.pointerId,pointerType:event.pointerType,plane,start,pixel:{x:event.clientX,y:event.clientY},moved:false};
  button.setPointerCapture(event.pointerId);button.focus();invalidate();
 });
 button.addEventListener('pointermove',event=>{if(updateTrajectoryPoint(event)){event.preventDefault();event.stopPropagation();invalidate();}});
 button.addEventListener('pointerup',event=>finishTrajectory(event));
 button.addEventListener('pointercancel',event=>finishTrajectory(event,true));
 button.addEventListener('lostpointercapture',event=>finishTrajectory(event,true));
 button.addEventListener('blur',()=>{if(trajectoryDrag?.kind==='area'&&trajectoryDrag.vertex===vertex)cancelGesture();});
 button.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelGesture();return;}
  if(event.ctrlKey||event.metaKey||event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  const area=selectedArea(frame,packet),point=area?.points[vertex];if(!point||!active)return;
  event.preventDefault();event.stopPropagation();if(trajectoryDrag||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
  const cameraDirection=camera.getWorldDirection(new THREE.Vector3()),step=event.shiftKey?.5:.1;
  const right=trajectoryLateralDelta(cameraDirection,step);if(!right)return;
  const [dx,dz]=event.key==='ArrowLeft'?[-right.x,-right.z]:event.key==='ArrowRight'?[right.x,right.z]:event.key==='ArrowUp'?[right.z,-right.x]:[-right.z,right.x];
  const command=areaVertexCommand({id:area.id,vertex,point},areaVertexPosition(point,dx,dz));
  if(command)emit('area-vertex',command);
 });
 handleLayer.append(button);return {button,tether};
}
function sparseAreaHandles(projected){
 const visible=[],cells=new Map(),gap=44,actions=packet.selectionActionsBounds;
 for(const handle of projected){
  const {x,y,vertex}=handle,dragging=trajectoryDrag?.kind==='area'&&trajectoryDrag.vertex===vertex;
  if(!dragging&&(x<88||x>innerWidth-28||y<(packet.selectionTopInset||0)+22||y>innerHeight-(packet.selectionBottomInset||0)-22
    ||actions&&x>actions.x-22&&x<actions.x+actions.width+22&&y>actions.y-22&&y<actions.y+actions.height+22))continue;
  const col=Math.floor(x/gap),row=Math.floor(y/gap);
  let close=false;
  for(let dx=-1;dx<=1&&!close;dx++)for(let dy=-1;dy<=1&&!close;dy++){
   const other=cells.get(`${col+dx},${row+dy}`);
   close=Boolean(other&&Math.hypot(x-other.x,y-other.y)<gap);
  }
  if(close&&!dragging)continue;
  cells.set(`${col},${row}`,handle);visible.push(handle);
 }
 return visible;
}
function updateAreaHandles(displayFrame){
 const area=selectedArea(frame,packet),drawing=area&&displayFrame.drawings.find(item=>item.id===area.id);
 const projected=[];
 drawing?.points.forEach((point,vertex)=>{
  const screen=project(vector(point));
  if(screen.visible||trajectoryDrag?.kind==='area'&&trajectoryDrag.vertex===vertex)projected.push({...screen,vertex});
 });
 const layouts=(drawing?.points.length||0)>12?sparseAreaHandles(projected):trajectoryControlLayout(projected,innerWidth,innerHeight,packet.selectionTopInset,packet.selectionBottomInset,packet.selectionActionsBounds);
 const visible=new Set(layouts.map(item=>item.vertex));
 for(const [vertex,{button,tether}] of areaButtons)if(!visible.has(vertex)){button.remove();tether.remove();areaButtons.delete(vertex);}
 for(const position of layouts){
  const {vertex}=position;
  if(!areaButtons.has(vertex))areaButtons.set(vertex,makeAreaHandle(vertex));
  const {button,tether}=areaButtons.get(vertex);
  button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;tether.hidden=!position.tether;
  if(position.tether){const at=position.tether;tether.style.left=`${at.x}px`;tether.style.top=`${at.y}px`;tether.style.width=`${at.length}px`;tether.style.transform=`rotate(${at.angle}deg)`;}
 }
}
function trajectoryDisplayFrame(base){
 const drag=trajectoryDrag||pendingTrajectoryPreview;if(!drag)return base;
 if(drag.kind==='area')return drag.destination?{...base,drawings:base.drawings.map(drawing=>drawing.id===drag.id
  ?{...drawing,points:drawing.points.map((point,index)=>index===drag.vertex?drag.destination:point)}:drawing)}:base;
 if(drag.kind==='start'&&drag.startBallId){const move=drag.destination?{ids:[drag.startBallId],delta:{x:(drag.destination.x-drag.point.x)/9,y:(drag.destination.z-drag.point.z)/18}}:null;return previewCourtObjects(base,move,{id:drag.startBallId,value:Math.max(0,drag.value-.12)});}
 return previewTrajectoryPoint(base,drag,Boolean(packet.landscape));
}
function updateTrajectoryPoint(event){
 const drag=trajectoryDrag;if(!drag||drag.pointerId!==event.pointerId||shouldCancelAuthorGrip(drag,{...packet,frame}))return false;
 if(!drag.moved&&Math.hypot(event.clientX-drag.pixel.x,event.clientY-drag.pixel.y)<pointerDragThreshold(drag.pointerType))return false;
 cast(event);const at=trajectoryPlanePoint(ray.ray,drag.plane);if(!at)return false;
 if(drag.kind==='area'){
  drag.destination=areaVertexPosition(drag.point,at.x-drag.start.x,at.z-drag.start.z);drag.moved=true;return true;
 }
 // Remove perspective drift from vertical-only motion, including displaced grips.
 cast({clientX:drag.pixel.x,clientY:event.clientY});const upright=trajectoryPlanePoint(ray.ray,drag.plane);if(!upright)return false;
 const destination=trajectoryPointValue({...drag,value:drag.initial},{x:at.x-upright.x,y:at.y-drag.start.y,z:at.z-upright.z});if(!destination)return false;
 drag.destination=destination;drag.value=destination.y;drag.moved=true;return true;
}
function finishTrajectory(event,cancelled=false){
 const drag=trajectoryDrag;if(!drag||event.pointerId!==drag.pointerId)return;if(!cancelled)updateTrajectoryPoint(event);trajectoryDrag=null;
 const next={...packet,frame},area=drag.kind==='area';
 const command=area?(!cancelled&&drag.moved&&!shouldCancelAuthorGrip(drag,next)?areaVertexCommand(drag,drag.destination):null):trajectoryPointDragCommand(drag,next,cancelled);
 if(command){holdTrajectoryPreview(drag);emit(area?'area-vertex':'trajectory-point',command,drag.revision);}invalidate();
}
function makeTrajectoryHandle(kind){
 const names={start:'início',middle:'meio',end:'final'},button=guideHandleButton(`trajectory-${kind}`,`Ajustar ${names[kind]} da trajetória`,kind==='middle'?'trajectory apex':'trajectory');
 button.title='Arraste para os lados e para ajustar a altura. Setas esquerda/direita: posição; cima/baixo: altura. Shift: 0,5 m. Home: piso.';
 const label=document.createElement('span');label.className='elevation-label';label.setAttribute('aria-hidden','true');button.append(label);
 const tether=document.createElement('div');tether.className='elevation-tether';tether.setAttribute('aria-hidden','true');tether.hidden=true;trajectoryTethers.set(kind,tether);handleLayer.append(tether);
 button.addEventListener('pointerdown',event=>{
  const selected=trajectoryHandleTarget(frame,packet,kind);if(!selected?.editable||event.button!==0||!active||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
  event.preventDefault();event.stopPropagation();cancelGesture(true);
  const plane=trajectoryDragPlane(camera.getWorldDirection(new THREE.Vector3()),selected.point);cast(event);const start=trajectoryPlanePoint(ray.ray,plane);if(!start)return;
  trajectoryDrag={...selected,initial:selected.value,stepId:frame.stepId,token,revision,cameraView:packet.cameraView,cameraReset:packet.cameraReset,zoom:packet.zoom,pointerId:event.pointerId,pointerType:event.pointerType,plane,start,pixel:{x:event.clientX,y:event.clientY},moved:false};button.setPointerCapture(event.pointerId);button.focus();invalidate();
 });
 button.addEventListener('pointermove',event=>{if(updateTrajectoryPoint(event)){event.preventDefault();event.stopPropagation();invalidate();}});
 button.addEventListener('pointerup',event=>finishTrajectory(event));button.addEventListener('pointercancel',event=>finishTrajectory(event,true));button.addEventListener('lostpointercapture',event=>finishTrajectory(event,true));
 button.addEventListener('blur',()=>{if(trajectoryDrag?.kind===kind)cancelGesture();});
 button.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelGesture();return;}
  if(event.ctrlKey||event.metaKey||event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const selected=trajectoryHandleTarget(frame,packet,kind);if(!selected?.editable||trajectoryDrag||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const delta=trajectoryLateralDelta(camera.getWorldDirection(new THREE.Vector3()),(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?.5:.1)),point=delta&&trajectoryPointValue(selected,delta);if(point&&Math.hypot(point.x-selected.point.x,point.z-selected.point.z)>1e-8)emit('trajectory-point',{id:selected.id,handle:kind,point});return;}
  const value=event.key==='Home'?selected.min:event.key==='ArrowUp'?trajectoryHeightValue(selected,event.shiftKey?.5:.1):event.key==='ArrowDown'?trajectoryHeightValue(selected,event.shiftKey?-.5:-.1):null;
  if(value!==null&&Math.abs(value-selected.value)>1e-8)emit('trajectory-height',{id:selected.id,handle:kind,value});
 });
 handleLayer.append(button);return button;
}
function updateTrajectoryHandles(displayFrame){
 const projected=[];
 for(const kind of ['start','middle','end']){
  const selected=trajectoryHandleTarget(frame,packet,kind),drawing=selected&&displayFrame.drawings.find(item=>item.id===selected.id),point=drawing&&trajectoryHandlePoint(drawing,kind,Boolean(packet.landscape)),position=point&&project(vector(point));
  if(selected&&position?.visible){const linked=kind==='start'&&Boolean(selected.startBallId),preferred=linked?elevationControlLayout(position,innerWidth,innerHeight,packet.selectionTopInset,packet.selectionBottomInset):null;projected.push({kind,selected,...position,linked,preferred});}
 }
 const layouts=trajectoryControlLayout(projected,innerWidth,innerHeight,packet.selectionTopInset,packet.selectionBottomInset,packet.selectionActionsBounds);
 for(const kind of ['start','middle','end']){
  let button=trajectoryButtons.get(kind);if(!button){button=makeTrajectoryHandle(kind);trajectoryButtons.set(kind,button);}
  const position=layouts.find(item=>item.kind===kind),selected=position?.selected,tether=trajectoryTethers.get(kind);
  button.hidden=!selected;button.disabled=!selected?.editable;tether.hidden=!position?.tether;if(!selected||!position)continue;
  if(position.tether){const at=position.tether;tether.style.left=`${at.x}px`;tether.style.top=`${at.y}px`;tether.style.width=`${at.length}px`;tether.style.transform=`rotate(${at.angle}deg)`;}
  const drag=trajectoryDrag||pendingTrajectoryPreview,value=drag?.id===selected.id&&drag.kind===kind?drag.value:selected.value,text=`${kind==='start'?'Início':kind==='middle'?'Meio':'Final'} · ${value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} m`;
  button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;button.dataset.labelSide=position.x>innerWidth-150?'left':'right';button.dataset.dragging=String(drag?.id===selected.id&&drag.kind===kind);button.dataset.value=String(value);button.setAttribute('aria-label',`Ajustar trajetória · ${text}`);button.firstElementChild.textContent=text;
 }
}
function clearNetWarnings(){for(const entry of netWarnings.values())entry.node?.remove();netWarnings.clear();}
function updateNetWarnings(displayFrame){
 if(!net.visible||!active){clearNetWarnings();return;}
 const drawings=displayFrame.drawings.filter(drawing=>showsNetWarning(drawing,displayFrame,packet)),ids=new Set(drawings.map(drawing=>drawing.id));
 for(const [id,entry] of netWarnings)if(!ids.has(id)){entry.node?.remove();netWarnings.delete(id);}
 const obstacles=packet.selectionActionsBounds?[packet.selectionActionsBounds]:[];
 for(const button of [...handleButtons.values(),elevationButton,...trajectoryButtons.values()])if(button&&!button.hidden){const x=parseFloat(button.style.left),y=parseFloat(button.style.top);if(Number.isFinite(x+y))obstacles.push({x:x-22,y:y-22,width:44,height:44});}
 for(const drawing of drawings){
  const key=drawingMap.get(drawing.id)?.key;let entry=netWarnings.get(drawing.id);
  if(!entry||entry.key!==key){const contact=renderedNetContact(trajectoryStroke(drawing,Boolean(packet.landscape)));entry={key,contact,node:entry?.node||null,marker:entry?.marker,tether:entry?.tether};netWarnings.set(drawing.id,entry);}
  if(!entry.contact){entry.node?.remove();entry.node=null;continue;}
  if(!entry.node){
   const node=document.createElement('div');node.className='net-warning';node.setAttribute('role','note');node.dataset.drawingId=drawing.id;
   const icon=document.createElement('span');icon.className='net-warning-icon';icon.setAttribute('aria-hidden','true');icon.textContent='!';
   const text=document.createElement('span');text.textContent='Trajetória na rede';
   const marker=document.createElement('span');marker.className='net-warning-contact';marker.setAttribute('aria-hidden','true');
   const tether=document.createElement('span');tether.className='net-warning-tether';tether.setAttribute('aria-hidden','true');
   node.append(tether,marker,icon,text);netWarningLayer.append(node);entry.node=node;entry.marker=marker;entry.tether=tether;
  }
  const at=project(vector(entry.contact.point)),layout=netWarningLayout(at,{width:innerWidth,height:innerHeight,topInset:packet.selectionTopInset,bottomInset:packet.selectionBottomInset},obstacles);
  entry.node.hidden=!layout;if(!layout)continue;
  entry.node.style.left=`${layout.x}px`;entry.node.style.top=`${layout.y}px`;entry.node.style.width=`${layout.width}px`;entry.node.dataset.netPart=entry.contact.part;entry.node.dataset.worldPoint=JSON.stringify(entry.contact.point);obstacles.push(layout);
  const x=at.x-layout.x-1,y=at.y-layout.y-1,end={x:clamp(at.x,layout.x,layout.x+layout.width),y:clamp(at.y,layout.y,layout.y+layout.height)},dx=end.x-at.x,dy=end.y-at.y;
  entry.marker.style.left=`${x}px`;entry.marker.style.top=`${y}px`;entry.tether.style.left=`${x}px`;entry.tether.style.top=`${y}px`;entry.tether.style.width=`${Math.hypot(dx,dy)}px`;entry.tether.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
 }
}
function updateCamera(){camera.position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);camera.lookAt(target);camera.updateMatrixWorld();}
function viewportFitOptions(viewport){return {target,azimuth,elevation,fov:camera.fov,aspect:viewport.width/Math.max(1,viewport.height),...viewport,topInset:Math.max(24,Number(viewport.topInset)||0),bottomInset:Math.max(24,Number(viewport.bottomInset)||0),leftInset:viewport.width<700?64:56,rightInset:viewport.width<700?44:36,...{minDistance:12,maxDistance:140}};}
function currentViewport(width=innerWidth,height=innerHeight){return {width,height,topInset:packet?.selectionTopInset||0,bottomInset:packet?.selectionBottomInset||0};}
function fitCamera(){
 resizeZoomIntent=null;
 lastViewport=currentViewport();const points=collectFrameFitPoints(frame,{half:lastHalf,landscape:Boolean(packet?.landscape)}),limits=cameraDistanceLimits();
 distance=clamp(fitCameraDistance(points,viewportFitOptions(lastViewport))/lastZoom,limits.min,limits.max);updateCamera();
}
function applyView(view){
 clearHover();
 if(gesture||elevationDrag||trajectoryDrag||handleDrag||touchCamera)cancelGesture();else stopCameraMotion();
 cameraView=view;azimuth=view==='side'?Math.PI/2:view==='orbit'?.6145:0;
 if(frame?.simulation){
  const front=view==='front',attack=frame.simulation.mode==='attack';
  elevation=innerWidth<700&&innerHeight>innerWidth?.65:front?(attack?.30555:.2835):.3656;
  target.set(front?0:.304,front?(attack?1.239:1.2673):2.267,front?(attack?.082:-.76954):.893);
  fitCamera();return;
 }
 elevation=innerWidth<700&&innerHeight>innerWidth?.65:view==='side'?.45:.3656;target.set(0,view==='orbit'?2.267:view==='front'?.55:.9,lastHalf?1.4:view==='orbit'?.893:.8);fitCamera();
}
function resize(){
 if(!renderer||document.hidden||lifecycle?.isSuspended())return;clearHover();if(gesture||elevationDrag||trajectoryDrag||handleDrag||touchCamera)cancelGesture();stopCameraMotion();const bounds=canvas.getBoundingClientRect(),resolution=syncRendererResolution(renderer,bounds.width||innerWidth,bounds.height||innerHeight,devicePixelRatio);camera.aspect=resolution.width/resolution.height;camera.updateProjectionMatrix();canvas.dataset.pixelRatio=String(resolution.pixelRatio);
 const viewport=currentViewport(resolution.width,resolution.height);
 if(frame){const points=collectFrameFitPoints(frame,{half:lastHalf,landscape:Boolean(packet?.landscape)}),oldFit=fitCameraDistance(points,viewportFitOptions(lastViewport)),newFit=fitCameraDistance(points,viewportFitOptions(viewport)),nextZoom=resizeCameraZoom(distance,oldFit,newFit,cameraDistanceLimits(),resizeZoomIntent);distance=nextZoom.distance;resizeZoomIntent=nextZoom.ratio;}
 lastViewport=viewport;updateCamera();invalidate();
}
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
new ResizeObserver(resize).observe(document.documentElement);
let densityQuery=null;
function watchDensity(){if(densityQuery)densityQuery.removeEventListener('change',densityChanged);densityQuery=matchMedia(`(resolution: ${devicePixelRatio||1}dppx)`);densityQuery.addEventListener('change',densityChanged);}
function densityChanged(){watchDensity();resize();}
watchDensity();resize();
function project(point){const p=point.clone().project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2};}
function selectionAnchor(displayFrame){const id=frame.selected[0],actor=actorMap.get(id),drawing=displayFrame.drawings.find(d=>d.id===id);let point=null;if(actor?.group.visible)point=actor.group.position.clone().add(new THREE.Vector3(0,actor.height+.36,0));else if(drawing?.points[0])point=vector(drawing.points[0]).add(new THREE.Vector3(0,.6,0));const projected=point?project(point):null,next=projected?.visible?{x:Math.round(projected.x),y:Math.round(projected.y)}:null;if(lastAnchor===undefined||Boolean(next)!==Boolean(lastAnchor)||next&&lastAnchor&&(Math.abs(next.x-lastAnchor.x)>1||Math.abs(next.y-lastAnchor.y)>1)){lastAnchor=next;emit('selection-anchor',{anchor:next});}}
function render(now){pending=0;if(!frame||!active||!renderer||document.hidden||lifecycle?.isSuspended())return;
 hoverPainter.clear();
 if(cameraMotion&&(reducedMotion.matches||document.hidden||now-cameraMotionTime>CAMERA_MOTION.maxSampleGapMs))stopCameraMotion();
 if(cameraMotion){
  const next=integrateCameraMotion({azimuth,elevation},cameraMotion,Math.max(0,now-cameraMotionTime));
  azimuth=next.azimuth;elevation=next.elevation;cameraMotion=next.motion;cameraMotionTime=Math.max(now,cameraMotionTime);updateCamera();
 }
 if(renderer.getPixelRatio()!==renderPixelRatio(devicePixelRatio))resize();pickTargets.length=0;const actorIds=new Set(frame.actors.map(a=>a.id));for(const [id,object] of actorMap)if(!actorIds.has(id)){object.label.remove();object.positionBadge.remove();dispose(object.group);actorMap.delete(id);}
 const displayFrame=trajectoryDisplayFrame(previewCourtObjects(frame,preview,elevationDrag||pendingElevationPreview));
 const contactBall=displayFrame.simulation?(displayFrame.drawings.find(drawing=>drawing.id===displayFrame.simulation.ballId)?.points[0]||displayFrame.simulation.ball):undefined;
 // On the editable defense tableau the ball can already be moving under the pointer.
 const attackImpact=displayFrame.simulation?.mode==='defense' && displayFrame.progress===1 ? contactBall
  : displayFrame.simulation?.markers?.find(marker=>marker.id==='hit'||marker.id==='defense-hit')?.point;
 for(const actor of displayFrame.actors){const object=actorMap.get(actor.id)||makeActor(actor);applyActor(actor,object,contactBall,attackImpact);if(object.group.visible&&!actor.illustration)pickTargets.push(object.rig.group);const point=object.group.position.clone();point.y+=object.height+.18;const screen=project(point);object.label.hidden=!actor.label||!object.group.visible||!screen.visible;object.label.style.left=`${screen.x}px`;object.label.style.top=`${screen.y}px`;
  const badge=object.positionBadge;
  const feet=actor.rotationPosition&&object.group.visible?project(object.group.position):null;
  badge.hidden=!feet?.visible;
  if(feet?.visible){badge.textContent=String(actor.rotationPosition);badge.style.left=`${feet.x}px`;badge.style.top=`${feet.y+9}px`;}
 }
 updateDrawings(displayFrame.drawings);updatePaths();updateSimulation();updateElevationHandle(displayFrame);updateTrajectoryHandles(displayFrame);updateAreaHandles(displayFrame);grid.visible=Boolean(packet.grid)&&frame.court&&!packet.plain;court.visible=courtGroup.visible=Boolean(frame.court)&&!packet.plain;net.visible=Boolean(frame.net)&&!packet.plain;for(const object of drawingMap.values())if(object.group.visible)pickTargets.push(object.group);
 updateNetWarnings(displayFrame);
 if(hoveredId)hoverPainter.paint(actorMap.get(hoveredId)?.group||drawingMap.get(hoveredId)?.group);
 renderer.render(scene,camera);selectionAnchor(displayFrame);canvas.dataset.stepId=frame.stepId;canvas.dataset.progress=String(frame.progress);canvas.dataset.actorPositions=JSON.stringify(frame.actors.map(a=>({id:a.id,position:a.position})));canvas.dataset.renderedPositions=JSON.stringify([...actorMap.entries()].map(([id,a])=>({id,position:{x:a.group.position.x,y:a.group.position.y,z:a.group.position.z}})));canvas.dataset.selected=JSON.stringify(frame.selected);canvas.dataset.revision=String(revision);
 canvas.dataset.ballPosition=frame.simulation?JSON.stringify(frame.simulation.ball):'';canvas.dataset.simulationMode=frame.simulation?.mode||'';canvas.dataset.simulationDuration=String(frame.simulation?.duration||0);canvas.dataset.simulationOutcome=frame.simulation?.outcome||'';canvas.dataset.actorPoses=JSON.stringify(frame.actors.map(actor=>({id:actor.id,role:actor.poseRole,pose:actor.pose,jump:actor.jump,extension:actor.extension,handAngle:actor.handAngle,runCycle:actor.runCycle})));
 canvas.dataset.camera=JSON.stringify({azimuth,elevation,distance,target:target.toArray()});
 if(cameraMotion)invalidate();
}
function cast(event){pointer.set(event.clientX/Math.max(1,innerWidth)*2-1,1-event.clientY/Math.max(1,innerHeight)*2);ray.setFromCamera(pointer,camera);}
function groundPoint(event,plane=ground,bounded=true){cast(event);const result=ray.ray.intersectPlane(plane,new THREE.Vector3());return result?bounded?limitPoint(worldToCourt(result)):worldToCourt(result):null;}
function hitObject(event){cast(event);return pickCourtObject(ray,pickTargets,frame);}
function pointerHit(event){cast(event);return event.pointerType==='touch'?pickCourtTouchHit(ray,pickTargets,frame,camera,{x:event.clientX,y:event.clientY},{width:innerWidth,height:innerHeight}):pickCourtHit(ray,pickTargets,frame);}
function selectObject(id,multiple){const ids=multiple?(frame.selected.includes(id)?frame.selected.filter(value=>value!==id):[...frame.selected,id]):frame.selected.includes(id)?frame.selected:[id];emit('select',{ids});return ids;}
function anchorFor(id){const actor=frame.actors.find(a=>a.id===id),drawing=frame.drawings.find(d=>d.id===id);return actor?worldToCourt(actor.position):drawing?.points[0]?worldToCourt(drawing.points[0]):null;}
function clearPendingMovePreview(){if(pendingMoveTimer)clearTimeout(pendingMoveTimer);pendingMoveTimer=0;if(pendingMovePreview)preview=null;pendingMovePreview=null;}
function holdMovePreview(ids,delta){
 clearPendingMovePreview();preview={ids:[...ids],delta:{...delta}};pendingMovePreview={token,revision,stepId:frame.stepId,tool:packet.tool,ids:[...ids]};
 const held=pendingMovePreview;pendingMoveTimer=setTimeout(()=>{if(pendingMovePreview===held){clearPendingMovePreview();invalidate();}},1200);
}
function clearPendingElevationPreview(){if(pendingElevationTimer)clearTimeout(pendingElevationTimer);pendingElevationTimer=0;pendingElevationPreview=null;}
function holdElevationPreview(drag){
 clearPendingElevationPreview();pendingElevationPreview={...drag,point:{...drag.point}};
 const held=pendingElevationPreview;pendingElevationTimer=setTimeout(()=>{if(pendingElevationPreview===held){clearPendingElevationPreview();invalidate();}},1200);
}
function clearPendingTrajectoryPreview(){if(pendingTrajectoryTimer)clearTimeout(pendingTrajectoryTimer);pendingTrajectoryTimer=0;pendingTrajectoryPreview=null;}
function holdTrajectoryPreview(drag){
 clearPendingTrajectoryPreview();pendingTrajectoryPreview={...drag,point:{...drag.point},...(drag.destination?{destination:{...drag.destination}}:{})};
 const held=pendingTrajectoryPreview;pendingTrajectoryTimer=setTimeout(()=>{if(pendingTrajectoryPreview===held){clearPendingTrajectoryPreview();invalidate();}},1200);
}
function cancelGesture(preserveContacts=false,forgetContacts=false){clearHover();stopCameraMotion();clearPendingMovePreview();clearPendingElevationPreview();clearPendingTrajectoryPreview();gesture=null;preview=null;if(handleDrag?.kind?.startsWith('approach-'))simulationKey='';handleDrag=null;elevationDrag=null;trajectoryDrag=null;touchCamera=null;if(!preserveContacts)touchContacts=forgetContacts?emptyTouchContacts():cancelTouchContacts(touchContacts);setDraft(null);canvas.style.cursor='default';invalidate();}
function cameraDistanceLimits(){return {min:2.5,max:140};}
function consumeTouch(event){event.preventDefault();event.stopPropagation();}
document.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='touch'){suppressTouchClick=false;return;}if(!frame||!active)return;
 if(!touchContacts.points.size)suppressTouchClick=false;
 touchContacts=advanceTouchContacts(touchContacts,'down',event.pointerId,{x:event.clientX,y:event.clientY});
 if(touchContacts.action==='begin'){
  cancelGesture(true);suppressTouchClick=true;
  touchCamera={...beginTouchCamera(touchPair(touchContacts),{azimuth,elevation,distance,target,fov:camera.fov},{width:innerWidth,height:innerHeight},cameraDistanceLimits()),revision,token,tool:packet.tool,stepId:frame.stepId,cameraView:packet.cameraView,cameraReset:packet.cameraReset,zoom:packet.zoom};
  for(const id of touchContacts.pair)canvas.setPointerCapture(id);canvas.style.cursor='grabbing';
 }else if(touchContacts.suppressed)canvas.setPointerCapture(event.pointerId);
 if(touchContacts.suppressed)consumeTouch(event);
},{capture:true,passive:false});
document.addEventListener('pointermove',event=>{
 if(event.pointerType!=='touch'||!touchContacts.points.has(event.pointerId))return;
 touchContacts=advanceTouchContacts(touchContacts,'move',event.pointerId,{x:event.clientX,y:event.clientY});
 if(touchContacts.action==='update'&&touchCamera){resizeZoomIntent=null;const next=moveTouchCamera(touchCamera,touchPair(touchContacts));distance=next.distance;target.set(next.target.x,next.target.y,next.target.z);updateCamera();invalidate();}
 if(touchContacts.suppressed)consumeTouch(event);
},{capture:true,passive:false});
function finishTouchContact(event){
 if(event.pointerType!=='touch'||!touchContacts.points.has(event.pointerId))return;
 const suppressed=touchContacts.suppressed;touchContacts=advanceTouchContacts(touchContacts,event.type==='pointerup'?'up':'cancel',event.pointerId);
 if(touchContacts.action==='finish'||!touchContacts.points.size){touchCamera=null;canvas.style.cursor='default';}
 if(suppressed)consumeTouch(event);
}
document.addEventListener('pointerup',finishTouchContact,{capture:true,passive:false});document.addEventListener('pointercancel',finishTouchContact,{capture:true,passive:false});
document.addEventListener('lostpointercapture',event=>{if(event.target===canvas&&touchContacts.points.has(event.pointerId)){touchContacts=advanceTouchContacts(touchContacts,'cancel',event.pointerId);cancelGesture();}},{capture:true});
document.addEventListener('click',event=>{if(suppressTouchClick&&event.detail){event.preventDefault();event.stopPropagation();}},{capture:true});
function moveCameraGesture(g,event){
 resizeZoomIntent=null;
 if(g.cameraPan){
  const next=panPointerDrag({azimuth,elevation,distance,target:g.cameraPan,fov:camera.fov},
   event.clientX-g.pixel.x,event.clientY-g.pixel.y,innerHeight);
  target.set(next.x,next.y,next.z);g.cameraPixel={x:event.clientX,y:event.clientY};updateCamera();invalidate();return;
 }
 const next=orbitPointerDrag(g,g.pixel,{x:event.clientX,y:event.clientY},{width:innerWidth,height:innerHeight},g.pointerType),nextAzimuth=next.azimuth,nextElevation=next.elevation,now=performance.now();
 g.cameraVelocity=sampleCameraAngularVelocity(g.cameraVelocity,{azimuth:nextAzimuth-azimuth,elevation:nextElevation-elevation},now-g.cameraTime,now);
 g.cameraTime=now;g.cameraPixel={x:event.clientX,y:event.clientY};azimuth=nextAzimuth;elevation=nextElevation;updateCamera();invalidate();
}
canvas.addEventListener('pointerdown',event=>{
 stopCameraMotion();if(!frame||!active||event.button>2||gesture||elevationDrag||trajectoryDrag||handleDrag||touchContacts.suppressed||pendingMovePreview||pendingElevationPreview||pendingTrajectoryPreview)return;
 const rightOrbit=event.button===2;
 canvas.focus();const hit=rightOrbit?null:pointerHit(event),id=hit?.id,tool=packet.tool||'select';
 if(rightOrbit)clearHover();
 const cameraPan=!rightOrbit&&(event.button===1||event.shiftKey&&!id||tool==='pan'&&!packet.disabled);
 const cameraDrag=rightOrbit||cameraPan||tool==='pan'||packet.disabled||['select','animate'].includes(tool)&&!id;
 const editingObject=!cameraDrag&&['select','animate'].includes(tool)&&Boolean(id),planeY=editingObject?(Number.isFinite(hit?.point?.y)?hit.point.y:authorMovementPlaneY(frame,id)):0,plane=planeY?new THREE.Plane(new THREE.Vector3(0,1,0),-planeY):ground;
 const start=cameraDrag?null:groundPoint(event,plane,!editingObject);if(!cameraDrag&&!start)return;let ids=[];
 if(!cameraDrag&&editingObject)ids=selectObject(id,event.shiftKey||packet.multiple);
 const point=start&&packet.grid&&!['select','animate','pan','pen','area'].includes(tool)?snapPoint(start):start;
 gesture={pointerId:event.pointerId,pointerType:event.pointerType,revision,start:point,plane,pixel:{x:event.clientX,y:event.clientY},last:point,points:point?[point]:[],ids:editableIds(ids,frame),anchor:anchorFor(ids[0]),cameraDrag,deselectOnTap:cameraDrag&&!id&&!packet.disabled&&tool==='select'&&!packet.multiple&&event.button===0,azimuth,elevation,cameraTime:performance.now(),cameraPixel:{x:event.clientX,y:event.clientY},cameraVelocity:null,tool,moved:false,duplicate:event.altKey&&tool==='select'};
 if(cameraPan)gesture.cameraPan=target.clone();
 canvas.setPointerCapture(event.pointerId);canvas.style.cursor=cameraDrag?'grabbing':gesture.ids.length?'move':id?'pointer':'default';event.preventDefault();
});
function updatePointerGesture(g,event){
 if(g.pointerId!==event.pointerId)return;if(!g.moved&&Math.hypot(event.clientX-g.pixel.x,event.clientY-g.pixel.y)<pointerDragThreshold(g.pointerType))return;g.moved=true;
 if(g.cameraDrag){moveCameraGesture(g,event);return;}
 let point=groundPoint(event,g.plane,!['select','animate'].includes(g.tool));if(!point)return;
 if(['select','animate'].includes(g.tool))point=boundedObjectDrag(snappedGesture(point,g.start,g.anchor,packet.grid,g.tool,packet.motionMode),g.start,g.anchor);
 else if(packet.grid&&!['pen','area','pan'].includes(g.tool))point=snapPoint(point);
 g.last=point;if(['animate','pen','area'].includes(g.tool)){if(packet.motionMode==='straight'&&g.tool==='animate')g.points=[g.start,point];else if(g.points.length<300)g.points.push(point);else g.points[g.points.length-1]=point;}else g.points=[g.start,point];
 if(['select','animate'].includes(g.tool)){preview={ids:g.ids,delta:{x:point.x-g.start.x,y:point.y-g.start.y}};if(g.tool==='animate'&&g.anchor&&g.ids.length){const points=g.points.map(p=>courtToWorld({x:g.anchor.x+p.x-g.start.x,y:g.anchor.y+p.y-g.start.y}));setDraft({id:'preview',kind:'arrow',points,color:packet.color||'#ffffff',dashed:true,size:28,rotation:0});}invalidate();}
 else if(!['player','text','pan'].includes(g.tool))setDraft({id:'preview',kind:g.tool,points:g.points.map(courtToWorld),color:packet.color||'#ffffff',dashed:packet.dashed,size:32,rotation:0});
}
canvas.addEventListener('pointermove',event=>{
 if(!gesture){const hover=hoverObject(event.buttons?null:hitObject(event),event.pointerType);canvas.style.cursor=hover?.cursor||(packet?.tool==='pan'||packet?.disabled?'grab':'default');return;}
 updatePointerGesture(gesture,event);
});
function finishGesture(event,cancelled=false){const g=gesture;if(!g||event.pointerId!==g.pointerId)return;if(!cancelled&&(!g.cameraDrag||event.clientX!==g.cameraPixel.x||event.clientY!==g.cameraPixel.y))updatePointerGesture(g,event);gesture=null;
 if(!cancelled&&g.deselectOnTap&&!g.moved&&g.revision===revision)emit('select',{ids:[]});
 if(!cancelled&&g.cameraDrag&&g.moved){
  if(event.clientX!==g.cameraPixel.x||event.clientY!==g.cameraPixel.y)moveCameraGesture(g,event);
  const now=performance.now();cameraMotion=!reducedMotion.matches&&!document.hidden?releaseCameraMotion(g.cameraVelocity,now):null;cameraMotionTime=now;
 }
 if(!cancelled&&!g.cameraDrag&&!packet.disabled&&g.revision===revision){
 if(['select','animate'].includes(g.tool)&&g.moved&&g.ids.length){const path=g.tool==='animate'?(packet.motionMode==='straight'?[g.start,g.last]:g.points).map(p=>({x:p.x-g.start.x,y:p.y-g.start.y})):undefined,delta={x:g.last.x-g.start.x,y:g.last.y-g.start.y};holdMovePreview(g.ids,delta);emit('move',{ids:g.ids,delta,...(path?{path}:{}),duplicate:g.duplicate},g.revision);}
 else if(g.tool==='player')emit('add-player',{point:g.start},g.revision);
 else if(!['select','animate','pan','player'].includes(g.tool)){const needsStroke=['arrow','curve','pen','area'].includes(g.tool);if(!needsStroke||g.moved)emit('draw',{drawing:{kind:g.tool,points:needsStroke?g.points:[g.start],color:packet.color||'#ffffff',dashed:Boolean(packet.dashed),size:32,rotation:0,...(g.tool==='text'?{text:'Anotação'}:{})}},g.revision);}
 }if(!pendingMovePreview)preview=null;setDraft(null);canvas.style.cursor='default';invalidate();}
canvas.addEventListener('pointerup',event=>finishGesture(event));canvas.addEventListener('pointercancel',event=>finishGesture(event,true));canvas.addEventListener('lostpointercapture',event=>{if(gesture?.pointerId===event.pointerId)cancelGesture();});
canvas.addEventListener('pointerleave',()=>{clearHover();if(!gesture)canvas.style.cursor='default';});
canvas.addEventListener('dblclick',event=>{if(packet?.disabled)return;const id=hitObject(event);if(frame?.drawings.some(d=>d.id===id&&d.kind==='text'))emit('edit-text',{id});});
canvas.addEventListener('wheel',event=>{event.preventDefault();clearHover();if(elevationDrag||trajectoryDrag||handleDrag||gesture&&!gesture.cameraDrag||touchContacts.suppressed)return;stopCameraMotion();resizeZoomIntent=null;const limits=cameraDistanceLimits();distance=clamp(distance*Math.exp(event.deltaY*.001),limits.min,limits.max);updateCamera();invalidate();},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('keydown',event=>{
 if(!frame||!active)return;const modifier=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();let command=null;
 if(modifier&&key==='z')command=event.shiftKey?'redo':'undo';else if(modifier&&key==='y')command='redo';else if(modifier&&key==='s')command='save';else if(modifier&&key==='c')command='copy';else if(modifier&&key==='v')command='paste';else if(modifier&&key==='a')command='select-all';else if(key==='delete'||key==='backspace')command='delete';else if(key==='escape'){cancelGesture();command='escape';}else if(key===' '){command='play';}else if(key==='v')command='select-tool';else if(key.startsWith('arrow'))command=`nudge-${key.slice(5)}`;
 if(command){event.preventDefault();event.stopPropagation();emit('shortcut',{key:command,shift:event.shiftKey});}
});
window.addEventListener('blur',()=>cancelGesture(false,true));
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;const data=event.data;
 if(!data||data.channel!==CHANNEL||data.version!==VERSION||data.type!=='frame'||typeof data.token!=='string'||!data.token||!Number.isSafeInteger(data.revision)||data.revision<0)return;
 if(token&&data.token!==token){cancelGesture();lastAnchor=undefined;}
 const next=data.frame;if(!next||!Array.isArray(next.actors)||!Array.isArray(next.drawings)||!Array.isArray(next.selected)||!Array.isArray(next.hide)||typeof next.stepId!=='string'||!next.actors.every(actor=>typeof actor.id==='string'&&isWorldPoint(actor.position))||!next.drawings.every(drawing=>typeof drawing.id==='string'&&Array.isArray(drawing.points)&&drawing.points.every(isWorldPoint)))return;
 if(shouldReleaseMovePreview(pendingMovePreview,data))clearPendingMovePreview();
 if(shouldCancelElevationDrag(pendingElevationPreview,data))clearPendingElevationPreview();
 if(shouldCancelAuthorGrip(pendingTrajectoryPreview,data))clearPendingTrajectoryPreview();
 if(token!==data.token||revision!==data.revision||frame&&frame.stepId!==next.stepId)resizeZoomIntent=null;
 clearHover();
 const layoutChanged=packet&&(packet.selectionTopInset!==data.selectionTopInset||packet.selectionBottomInset!==data.selectionBottomInset);
 if(frame&&next.stepId!==frame.stepId||packet&&packet.tool!==data.tool)stopCameraMotion();
 const changedTouch=touchCamera&&(touchCamera.revision!==data.revision||touchCamera.token!==data.token||touchCamera.stepId!==next.stepId||touchCamera.tool!==data.tool||touchCamera.cameraView!==data.cameraView||touchCamera.cameraReset!==data.cameraReset||touchCamera.zoom!==data.zoom||data.active===false);
 if(shouldCancelFrameGesture(gesture,data)||shouldCancelElevationDrag(elevationDrag,data)||shouldCancelAuthorGrip(trajectoryDrag,data)||changedTouch||handleDrag&&(handleDrag.revision!==data.revision||data.disabled&&!(data.allowServeHandle&&handleDrag.kind==='serve')||data.active===false))cancelGesture();token=data.token;revision=data.revision;packet=data;frame=next;active=data.active!==false;
 if(!active){cancelGesture();clearNetWarnings();if(pending){cancelAnimationFrame(pending);pending=0;}return;}
 if(layoutChanged)resize();
 const zoom=clamp(Number(data.zoom)||1,.3,10);if(zoom!==lastZoom){stopCameraMotion();resizeZoomIntent=null;const limits=cameraDistanceLimits();distance=clamp(distance*lastZoom/zoom,limits.min,limits.max);lastZoom=zoom;updateCamera();}
 const simulationMode=frame.simulation?.mode||null,simulationChanged=simulationMode!==lastSimulationMode;lastSimulationMode=simulationMode;
 if(['front','side','orbit'].includes(data.cameraView)&&(simulationChanged||data.cameraView!==cameraView||data.cameraReset!==lastCameraReset||Boolean(data.half)!==lastHalf)){lastCameraReset=data.cameraReset;lastHalf=Boolean(data.half);applyView(data.cameraView);}
 if(!renderer)emit('error',{message:error.textContent});else invalidate();
});
// Retries cover listener installation ordering; no document state is retained.
let readyTries=0;const readyTimer=setInterval(()=>{if(token||++readyTries>30){clearInterval(readyTimer);return;}emit('ready');},200);emit('ready');
lifecycle=bindRendererLifecycle({canvas,document,window,
 onSuspend(){cancelGesture(false,true);if(pending){cancelAnimationFrame(pending);pending=0;}},
 onResume(){if(renderer){if(active){resize();invalidate();}emit('ready');}},
});
