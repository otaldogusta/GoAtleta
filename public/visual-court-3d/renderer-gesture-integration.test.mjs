import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from './three.module.min.js';
import * as geometry from './renderer-geometry.mjs';
import * as gestures from './renderer-pointer-gestures.mjs';
import * as motion from './renderer-camera-motion.mjs';
import * as elevationTools from './renderer-elevation.mjs';
import * as trajectoryTools from './renderer-trajectory.mjs';
import * as netWarningTools from './renderer-net-warning.mjs';

// Run the renderer's actual handlers, rather than reproducing their branches.
// This model covers capture -> target ordering, cancellation and warning DOM/cache;
// Three.js rays/cameras are real; picking, visual layout and physical touch still need browser checks.
const source=readFileSync(new URL('./renderer.mjs',import.meta.url),'utf8');
const start=source.indexOf('function selectObject('),end=source.indexOf('// Retries cover listener installation ordering');
assert.ok(start>=0&&end>start,'Update the integration boundary if renderer handlers move');
const handlers=source.slice(start,end);
const heightStart=source.indexOf('function updateElevationPoint('),heightEnd=source.indexOf('function updateElevationHandle(');
assert.ok(heightStart>=0&&heightEnd>heightStart,'Update the height-handler boundary if it moves');
const heightHandlers=source.slice(heightStart,heightEnd);
const trajectoryStart=source.indexOf('const areaButtons='),trajectoryEnd=source.indexOf('function updateTrajectoryHandles(');
assert.ok(trajectoryStart>=0&&trajectoryEnd>trajectoryStart,'Update the trajectory-handler boundary if it moves');
const trajectoryHandlers=source.slice(trajectoryStart,trajectoryEnd);
const drawingsStart=source.indexOf('function updateDrawings('),drawingsEnd=source.indexOf('let pathGroup=');
const warningsStart=source.indexOf('function clearNetWarnings('),warningsEnd=source.indexOf('function updateCamera(');
assert.ok(drawingsStart>=0&&drawingsEnd>drawingsStart&&warningsStart>=0&&warningsEnd>warningsStart,'Update the warning integration boundaries if they move');
const warningHandlers=source.slice(drawingsStart,drawingsEnd)+'\n'+source.slice(warningsStart,warningsEnd);
assert.ok(source.indexOf('updateDrawings(displayFrame.drawings);')<source.indexOf(' updateNetWarnings(displayFrame);'),'Warning cache must follow the actual displayed drawing update');
const displayExpression=source.match(/const displayFrame=([^;]+);/)?.[1];
const castHandler=source.match(/^function cast\(event\).+$/m)?.[0];
assert.ok(castHandler,'Use the actual pointer-to-ray transform');
assert.ok(displayExpression?.includes('previewCourtObjects'),'The integration must use the actual renderer preview composition');
assert.ok(handlers.includes("document.addEventListener('pointerdown'"));
assert.ok(handlers.includes("canvas.addEventListener('pointerup'"));
assert.ok(handlers.includes("window.addEventListener('message'"));

class DomNode {
 constructor(){this.capture=new EventTarget();this.bubble=new EventTarget();this.style={};this.dataset={};this.captured=new Set();this.errors=[];this.children=[];this.parentNode=null;}
 addEventListener(type,listener,options){
  const bus=options===true||options?.capture?this.capture:this.bubble;
  bus.addEventListener(type,event=>{try{listener(event);}catch(error){this.errors.push(error);}});
 }
 setPointerCapture(id){this.captured.add(id);}
 releasePointerCapture(id){this.captured.delete(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 setAttribute(name,value){this[name]=value;}
 append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}}
 focus(){}
 dispatch(event,capture=false){(capture?this.capture:this.bubble).dispatchEvent(event);if(this.errors.length)throw this.errors.shift();}
}

function fixture({tool='select',disabled=false,objectId='ball'}={}){
 const document=new DomNode(),canvas=new DomNode(),window=new DomNode(),commands=[],timers=new Map();
 document.hidden=false;document.createElement=()=>new DomNode();let clock=0,timerId=0,context;
 // An orthographic default makes one pixel exactly .01 m for legacy assertions.
 // Perspective cases replace this camera, retaining the renderer's actual cast().
 const camera=new THREE.OrthographicCamera(0,3.9,2,-6.44,.01,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.fov=39;
 const state={
  THREE,...geometry,...gestures,...motion,...elevationTools,...trajectoryTools,...netWarningTools,document,canvas,window,
  CHANNEL:'goatleta-court-3d',VERSION:1,parent:{},location:{origin:'http://localhost:8081'},renderer:{},error:{textContent:''},
  setTimeout:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},clearTimeout:id=>timers.delete(id),cancelAnimationFrame(){},
  innerWidth:390,innerHeight:844,performance:{now:()=>clock+=16},
  token:'test-token',revision:7,active:true,gesture:null,preview:null,handleDrag:null,elevationDrag:null,
  pendingMovePreview:null,pendingMoveTimer:0,resizeZoomIntent:null,pending:0,lastAnchor:undefined,
  pendingElevationPreview:null,pendingElevationTimer:0,elevationTether:null,handleLayer:new DomNode(),
  trajectoryDrag:null,pendingTrajectoryPreview:null,pendingTrajectoryTimer:0,trajectoryButtons:new Map(),trajectoryTethers:new Map(),
  drawingMap:new Map(),netWarnings:new Map(),netWarningLayer:new DomNode(),net:{visible:true},scene:new THREE.Group(),handleButtons:new Map(),elevationButton:null,
  buildDrawing:()=>new THREE.Group(),dispose:group=>group.removeFromParent(),line(){},createContactShadow:()=>null,
  project:point=>({x:200+point.x*10,y:400-point.y*30,visible:true}),
  lastZoom:1,lastSimulationMode:null,cameraView:'orbit',lastCameraReset:0,lastHalf:false,
  touchCamera:null,touchContacts:gestures.emptyTouchContacts(),suppressTouchClick:false,
  azimuth:.6,elevation:.4,distance:35,target:new THREE.Vector3(0,1,0),camera,pointer:new THREE.Vector2(),ray:new THREE.Raycaster(),
  cameraMotion:null,cameraMotionTime:0,reducedMotion:{matches:false},ground:new THREE.Plane(new THREE.Vector3(0,1,0),0),
  frame:{stepId:'test-step',hide:[],selected:[],actors:[{id:'player',elevation:0,position:{x:0,y:0,z:0}}],drawings:[{id:'ball',kind:'ball',elevation:0,points:[{x:0,y:.12,z:0}]},{id:'arrow',kind:'arrow',startBallId:'ball',points:[{x:0,y:.12,z:0},{x:3,y:.025,z:3}]}]},
  packet:{tool,disabled,active:true,token:'test-token',revision:7,elevationHandles:true,trajectoryHandles:true,grid:false,multiple:false,motionMode:'free',cameraView:'orbit',cameraReset:0,zoom:1},
  emit:(type,detail={},revision=7)=>commands.push({type,...structuredClone(detail),revision}),
  clearHover(){},hoverObject(){return null;},hitObject:event=>event.hit===false?null:objectId,
  pointerHit:event=>event.hit===false?null:{id:objectId,point:{x:0,y:.12,z:0}},
  groundPoint:event=>event.noGround?null:{x:event.clientX/1000,y:event.clientY/1000},
  guideHandleButton:()=>new DomNode(),vector:p=>new THREE.Vector3(p.x,p.y,p.z),
  stopCameraMotion:()=>{context.cameraMotion=null;context.cameraMotionTime=0;},
  invalidate(){},updateCamera(){},resize(){},applyView(){},setDraft:value=>{context.draft=value;},draft:null,
 };
 context=vm.createContext(state);vm.runInContext(castHandler+'\n'+heightHandlers+'\n'+trajectoryHandlers+'\n'+warningHandlers+'\n'+handlers,context,{filename:'renderer.mjs:gesture-handlers'});
 const dispatch=(type,id=1,x=100,y=200,extra={})=>{
  const {target=canvas,...fields}=extra,event=new Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerType:'touch',pointerId:id,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,detail:type==='click'?1:0,...fields});
  Object.defineProperty(event,'target',{value:target});
  let stopped=false;const stop=event.stopPropagation.bind(event);event.stopPropagation=()=>{stopped=true;stop();};
  document.dispatch(event,true);if(!stopped)target.dispatch(event);if(!stopped&&target!==document)document.dispatch(event);
  return event;
 };
 const sendFrame=(overrides={})=>{
  const data={...context.packet,channel:state.CHANNEL,version:state.VERSION,type:'frame',token:context.token,revision:context.revision,frame:structuredClone(context.frame),...overrides};
  const event=new Event('message');Object.assign(event,{data,source:state.parent,origin:state.location.origin});window.dispatch(event);return data;
 };
 const display=()=>vm.runInContext(displayExpression,context);
 const refreshWarnings=()=>{const displayed=display();context.updateDrawings(displayed.drawings);context.updateNetWarnings(displayed);return context.netWarnings.get('arrow');};
 const flushTimers=()=>{for(const [id,timer] of [...timers]){timers.delete(id);timer.callback();}};
 return {state:context,commands,canvas,document,window,dispatch,sendFrame,display,refreshWarnings,timers,flushTimers,createHeightHandle:()=>context.makeElevationHandle(),createTrajectoryHandle:kind=>context.makeTrajectoryHandle(kind),authorCommands:()=>commands.filter(c=>['move','draw','add-player','elevation','simulation-handle','trajectory-height','trajectory-point','area-vertex'].includes(c.type))};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('an area grip previews one vertex at floor height and commits exactly once',()=>{
 const f=fixture();
 const original=[{x:0,y:.03,z:0},{x:2,y:.03,z:0},{x:1,y:.03,z:2}];
 const area={id:'area',kind:'area',points:original};
 f.state.camera.position.set(0,20,0);f.state.camera.up.set(0,0,-1);f.state.camera.lookAt(0,0,0);f.state.camera.updateMatrixWorld();
 f.state.frame={...f.state.frame,selected:['area'],drawings:[area]};f.state.packet.areaHandles=true;
 const target=f.state.makeAreaHandle(0).button;
 f.dispatch('pointerdown',1,100,200,{target});
 f.dispatch('pointermove',1,130,240,{target});
 const displayed=f.display().drawings[0].points;
 assert.notDeepEqual(displayed[0],original[0]);assert.equal(displayed[0].y,original[0].y);
 assert.deepEqual(displayed.slice(1),original.slice(1));assert.equal(f.authorCommands().length,0);
 f.dispatch('pointerup',1,130,240,{target});
 f.dispatch('lostpointercapture',1,130,240,{target});
 assert.equal(f.authorCommands().length,1);
 const command=f.authorCommands()[0];
 assert.equal(command.type,'area-vertex');assert.equal(command.id,'area');assert.equal(command.vertex,0);
 near(command.point.x,geometry.worldToCourt(displayed[0]).x);near(command.point.y,geometry.worldToCourt(displayed[0]).y);
 assert.ok(f.state.pendingTrajectoryPreview);
 f.sendFrame({revision:8});
 assert.equal(f.state.pendingTrajectoryPreview,null);
});

test('actual single-touch handlers preview and commit one object movement',()=>{
 const f=fixture();f.dispatch('pointerdown');f.dispatch('pointermove',1,130,240);
 assert.ok(f.state.preview);assert.equal(f.authorCommands().length,0);
 f.dispatch('pointerup',1,130,240);
 assert.equal(f.authorCommands().length,1);assert.equal(f.authorCommands()[0].type,'move');
 near(f.authorCommands()[0].delta.x,.03);near(f.authorCommands()[0].delta.y,.04);
 assert.equal(f.state.gesture,null);
 f.sendFrame({revision:8,frame:structuredClone(f.display())});assert.equal(f.state.preview,null);
});

test('capture-phase second touch cancels object, animation and drawing edits before canvas handlers',()=>{
 for(const tool of ['select','animate','arrow','pen']){
  const f=fixture({tool});f.dispatch('pointerdown');f.dispatch('pointermove',1,130,240);
  assert.ok(f.state.gesture?.moved);assert.ok(f.state.preview||f.state.draft);
  const second=f.dispatch('pointerdown',2,250,250);
  assert.equal(second.defaultPrevented,true);assert.equal(f.state.gesture,null);assert.equal(f.state.preview,null);assert.equal(f.state.draft,null);
  assert.ok(f.state.touchCamera);assert.equal(f.state.touchContacts.suppressed,true);
  const before=f.state.distance;f.dispatch('pointermove',2,290,280);assert.notEqual(f.state.distance,before);
  f.dispatch('pointerup',1,130,240);f.dispatch('pointermove',2,310,290);f.dispatch('pointerup',2,310,290);
  assert.equal(f.authorCommands().length,0,tool+' must not commit its interrupted edit');
  assert.equal(f.state.touchContacts.points.size,0);assert.equal(f.state.gesture,null);
 }
});

test('a residual finger cannot resume its edit, but a fully new touch can',()=>{
 const f=fixture();f.dispatch('pointerdown');f.dispatch('pointermove',1,130,240);f.dispatch('pointerdown',2,250,250);
 f.dispatch('pointerup',2,250,250);f.dispatch('pointermove',1,180,300);f.dispatch('pointerup',1,180,300);
 assert.equal(f.authorCommands().length,0);
 f.dispatch('pointerdown',3,100,200);f.dispatch('pointermove',3,130,230);f.dispatch('pointerup',3,130,230);
 assert.equal(f.authorCommands().length,1);
});

test('cancel, lost capture and blur discard a preview without a release commit',()=>{
 for(const cancel of ['pointercancel','lostpointercapture','blur']){
  const f=fixture();f.dispatch('pointerdown');f.dispatch('pointermove',1,130,240);
  if(cancel==='blur')f.window.dispatch(new Event('blur'));else f.dispatch(cancel,1,130,240);
  f.dispatch('pointerup',1,130,240);assert.equal(f.authorCommands().length,0,cancel);assert.equal(f.state.gesture,null);
 }
});

test('two fingers cancel pending height and simulation handles before their target can commit',()=>{
 for(const pending of ['elevationDrag','handleDrag']){
  const f=fixture(),handle=new DomNode();f.dispatch('pointerdown',1,100,200,{target:handle});
  f.state[pending]={pointerId:1,moved:true,value:3};let released=0;
  handle.addEventListener('pointerup',()=>{if(f.state[pending])released++;});
  f.dispatch('pointerdown',2,250,250);assert.equal(f.state[pending],null);
  f.dispatch('pointerup',1,100,200,{target:handle});f.dispatch('pointerup',2,250,250);
  assert.equal(released,0);assert.equal(f.authorCommands().length,0);
 }
});

test('a residual synthesized label click after pinch is stopped, keyboard activation remains available',()=>{
 const f=fixture(),label=new DomNode();let selected=0;label.addEventListener('click',()=>selected++);
 f.dispatch('pointerdown');f.dispatch('pointerdown',2,250,250);f.dispatch('pointerup');f.dispatch('pointerup',2,250,250);
 const click=f.dispatch('click',2,250,250,{target:label,detail:1});assert.equal(click.defaultPrevented,true);assert.equal(selected,0);
 f.dispatch('click',0,0,0,{target:label,detail:0});assert.equal(selected,1);
});

test('orbit starts in the sky without a ground hit and remains available while editing is disabled',()=>{
 for(const disabled of [false,true]){
  const f=fixture({disabled}),before=f.state.azimuth;
  f.dispatch('pointerdown',1,100,20,{hit:disabled?true:false,noGround:true});
  assert.equal(f.state.gesture?.cameraDrag,true);
  f.dispatch('pointermove',1,160,40,{hit:false,noGround:true});f.dispatch('pointerup',1,160,40,{hit:false,noGround:true});
  assert.notEqual(f.state.azimuth,before);assert.equal(f.authorCommands().length,0);assert.equal(f.commands.filter(c=>c.type==='select').length,0);
 }
});

test('the final release coordinate is included in an already-moving object drag',()=>{
 const f=fixture();f.dispatch('pointerdown');f.dispatch('pointermove',1,120,220);f.dispatch('pointerup',1,145,250);
 const command=f.authorCommands()[0];assert.equal(f.authorCommands().length,1);
 near(command.delta.x,.045);near(command.delta.y,.05);
});

test('wheel cannot shift the camera plane during an object or authoring-handle drag',()=>{
 for(const pending of ['gesture','elevationDrag','handleDrag']){
  const f=fixture(),before=f.state.distance;
  if(pending==='gesture'){f.dispatch('pointerdown',1,100,200,{pointerType:'mouse'});f.dispatch('pointermove',1,120,220,{pointerType:'mouse'});}
  else f.state[pending]={pointerId:1,moved:true,value:3};
  const event=f.dispatch('wheel',0,120,220,{pointerType:'mouse',deltaY:160});
  assert.equal(event.defaultPrevented,true);assert.equal(f.state.distance,before,pending);
  assert.equal(f.authorCommands().length,0);
 }
 const idle=fixture(),before=idle.state.distance;idle.dispatch('wheel',0,100,200,{pointerType:'mouse',deltaY:160});
 assert.ok(idle.state.distance>before,'wheel stays available outside an edit');
});

function releaseMovedObject(f){f.dispatch('pointerdown');f.dispatch('pointermove',1,130,240);f.dispatch('pointerup',1,130,240);}
function objectPoint(frame,id){return frame.actors.find(a=>a.id===id)?.position||frame.drawings.find(d=>d.id===id)?.points[0];}

test('release keeps player and ball presentation stable through an old frame until canonical confirmation',()=>{
 for(const objectId of ['player','ball']){
  const f=fixture({objectId}),original=structuredClone(f.state.frame);releaseMovedObject(f);
  const displayed=structuredClone(f.display()),dropped=objectPoint(displayed,objectId);
  near(dropped.x,.27);near(dropped.z,.72);assert.ok(f.state.pendingMovePreview);assert.ok(f.state.preview);
  assert.deepEqual(f.state.frame,original,'optimistic handoff does not mutate the canonical frame');
  f.sendFrame({frame:original});assert.deepEqual(objectPoint(f.display(),objectId),dropped,'same-revision selection echo must not snap back');
  f.sendFrame({revision:8,frame:displayed});assert.equal(f.state.pendingMovePreview,null);assert.equal(f.state.preview,null);
  assert.deepEqual(objectPoint(f.display(),objectId),dropped,'confirmed delta must not apply a second time');
  if(objectId==='ball')assert.deepEqual(f.display().drawings.find(d=>d.id==='arrow').points[0],dropped,'the linked endpoint follows both handoff states');
  assert.equal(f.authorCommands().length,1);assert.equal(f.timers.size,0);
 }
});

test('an authoritative revision can reject a move and a silent host cannot leave a permanent phantom preview',()=>{
 for(const rejection of ['revision','timeout']){
  const f=fixture(),original=structuredClone(f.state.frame);releaseMovedObject(f);assert.ok(f.state.pendingMovePreview);
  if(rejection==='revision')f.sendFrame({revision:8,frame:original});
  else{assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,1200);f.flushTimers();}
  assert.equal(f.state.pendingMovePreview,null);assert.equal(f.state.preview,null);assert.deepEqual(objectPoint(f.display(),'ball'),objectPoint(original,'ball'));
  assert.equal(f.authorCommands().length,1,'reject/timeout must not re-emit the edit');assert.equal(f.timers.size,0);
 }
});

test('context changes, locking, hiding and cancellation clear only the obsolete handoff',()=>{
 const changes=[
  f=>({token:'new-context-token'}),f=>({tool:'arrow'}),f=>({active:false}),f=>({disabled:true}),
  f=>({frame:{...structuredClone(f.state.frame),stepId:'other-step'}}),
  f=>({frame:{...structuredClone(f.state.frame),drawings:f.state.frame.drawings.filter(d=>d.id!=='ball')}}),
  f=>({frame:{...structuredClone(f.state.frame),drawings:f.state.frame.drawings.map(d=>d.id==='ball'?{...d,locked:true}:d)}}),
  f=>({frame:{...structuredClone(f.state.frame),hide:['drawings']}}),
 ];
 for(const change of changes){
  const f=fixture();releaseMovedObject(f);f.sendFrame(change(f));assert.equal(f.state.pendingMovePreview,null);assert.equal(f.state.preview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);
 }
 const blurred=fixture();releaseMovedObject(blurred);blurred.window.dispatch(new Event('blur'));
 assert.equal(blurred.state.pendingMovePreview,null);assert.equal(blurred.state.preview,null);assert.equal(blurred.timers.size,0);assert.equal(blurred.authorCommands().length,1);
 const cancelled=fixture();cancelled.dispatch('pointerdown');cancelled.dispatch('pointermove',1,130,240);cancelled.dispatch('pointercancel',1,130,240);
 assert.equal(cancelled.state.pendingMovePreview,null);assert.equal(cancelled.timers.size,0);assert.equal(cancelled.authorCommands().length,0);
});

function heightFixture(objectId='ball'){
 const f=fixture({objectId});f.state.frame.selected=[objectId];f.handle=f.createHeightHandle();return f;
}
function releaseRaisedObject(f){
 f.dispatch('pointerdown',1,100,200,{target:f.handle});f.dispatch('pointermove',1,100,100,{target:f.handle});f.dispatch('pointerup',1,100,50,{target:f.handle});
}

test('real height-handle release preserves Y through an old frame and transfers it once to the confirmed frame',()=>{
 for(const objectId of ['player','ball']){
  const f=heightFixture(objectId),original=structuredClone(f.state.frame),baseY=objectPoint(original,objectId).y;
  releaseRaisedObject(f);assert.equal(f.state.elevationDrag,null);assert.ok(f.state.pendingElevationPreview);
  assert.equal(f.authorCommands().length,1);assert.equal(f.authorCommands()[0].type,'elevation');near(f.authorCommands()[0].value,1.5);
  const shown=structuredClone(f.display()),dropped=objectPoint(shown,objectId);near(dropped.y,baseY+1.5);near(dropped.x,0);near(dropped.z,0);
  f.sendFrame({frame:original});assert.deepEqual(objectPoint(f.display(),objectId),dropped,'an old selection echo must not lower the object');
  const confirmed=structuredClone(shown),object=confirmed.actors.find(a=>a.id===objectId)||confirmed.drawings.find(d=>d.id===objectId);object.elevation=1.5;
  f.sendFrame({revision:8,frame:confirmed});assert.equal(f.state.pendingElevationPreview,null);assert.equal(f.state.elevationDrag,null);
  assert.deepEqual(objectPoint(f.display(),objectId),dropped,'confirmed Y must not receive a second height offset');
  if(objectId==='ball')assert.deepEqual(f.display().drawings.find(d=>d.id==='arrow').points[0],dropped);
  assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);
 }
});

test('height rejection and bounded timeout restore canonical Y without another command',()=>{
 for(const rejection of ['revision','timeout']){
  const f=heightFixture(),original=structuredClone(f.state.frame);releaseRaisedObject(f);
  assert.ok(f.state.pendingElevationPreview);assert.equal(f.timers.size,1);
  if(rejection==='revision')f.sendFrame({revision:8,frame:original});
  else{assert.equal([...f.timers.values()][0].delay,1200);f.flushTimers();}
  assert.equal(f.state.pendingElevationPreview,null);assert.equal(f.timers.size,0);
  assert.deepEqual(objectPoint(f.display(),'ball'),objectPoint(original,'ball'));assert.equal(f.authorCommands().length,1);
 }
});

test('height handoff is discarded when its selection, camera, context or editability changes',()=>{
 const changes=[
  f=>({frame:{...structuredClone(f.state.frame),selected:[]}}),f=>({cameraReset:1}),f=>({zoom:2}),
  f=>({token:'new-token'}),f=>({tool:'arrow'}),f=>({disabled:true}),f=>({active:false}),
  f=>({frame:{...structuredClone(f.state.frame),stepId:'new-step'}}),
  f=>({frame:{...structuredClone(f.state.frame),hide:['drawings']}}),
  f=>({frame:{...structuredClone(f.state.frame),drawings:f.state.frame.drawings.map(d=>d.id==='ball'?{...d,locked:true}:d)}}),
 ];
 for(const change of changes){
  const f=heightFixture();releaseRaisedObject(f);f.sendFrame(change(f));
  assert.equal(f.state.pendingElevationPreview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);
 }
 const f=heightFixture();releaseRaisedObject(f);f.window.dispatch(new Event('blur'));
 assert.equal(f.state.pendingElevationPreview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);
});

test('real height-handle cancellation and second-touch takeover never create a pending commit',()=>{
 for(const cancellation of ['pointercancel','lostpointercapture','blur','pinch']){
  const f=heightFixture();f.dispatch('pointerdown',1,100,200,{target:f.handle});f.dispatch('pointermove',1,100,100,{target:f.handle});
  assert.equal(f.state.elevationDrag?.moved,true);
  if(cancellation==='pinch')f.dispatch('pointerdown',2,250,250);
  else if(cancellation==='blur')f.window.dispatch(new Event('blur'));
  else f.dispatch(cancellation,1,100,100,{target:f.handle});
  f.dispatch('pointerup',1,100,50,{target:f.handle});if(cancellation==='pinch')f.dispatch('pointerup',2,250,250);
  assert.equal(f.state.elevationDrag,null);assert.equal(f.state.pendingElevationPreview,null);assert.equal(f.timers.size,0);
  assert.equal(f.authorCommands().length,0,cancellation);near(objectPoint(f.display(),'ball').y,.12);
 }
});

function trajectoryFixture(handle='middle',{kind='arrow',linked=false,editable=true}={}){
 const f=fixture({objectId:'arrow'}),profile={start:linked?.12:.025,middle:1,end:.025};
 const drawing={id:'arrow',kind,color:'#19c87b',...(kind==='curve'?{curveMode:'through-point'}:{}),
  ...(linked?{startBallId:'ball'}:{}),trajectoryHeights:profile,
  points:kind==='curve'?[{x:0,y:profile.start,z:0},{x:1,y:1,z:-1},{x:3,y:.025,z:3}]:[{x:0,y:profile.start,z:0},{x:3,y:.025,z:3}],
  trajectoryHandles:['start','middle','end'].map(key=>({kind:key,value:profile[key],min:linked&&key==='start'?.12:0,max:8.12,editable:key===handle?editable:true})),
 };
 f.state.frame.drawings=[f.state.frame.drawings[0],drawing];f.state.frame.selected=['arrow'];
 f.handle=f.createTrajectoryHandle(handle);return f;
}
const selectedDrawing=f=>f.display().drawings.find(d=>d.id==='arrow');

test('each trajectory handle changes only authored Y and survives release until the canonical frame arrives',()=>{
 for(const kind of ['arrow','curve'])for(const handle of ['start','middle','end']){
  const f=trajectoryFixture(handle,{kind}),original=structuredClone(f.state.frame),before=original.drawings.find(d=>d.id==='arrow');
  releaseRaisedObject(f);assert.equal(f.state.trajectoryDrag,null);assert.ok(f.state.pendingTrajectoryPreview);
  const command=f.authorCommands()[0];assert.equal(f.authorCommands().length,1);assert.equal(command.type,'trajectory-point');assert.equal(command.id,'arrow');assert.equal(command.handle,handle);
  near(command.point.y,before.trajectoryHeights[handle]+1.5);
  const displayed=structuredClone(f.display()),drawing=displayed.drawings.find(d=>d.id==='arrow');
  assert.deepEqual(drawing.points.map(({x,z})=>({x,z})),before.points.map(({x,z})=>({x,z})));
  assert.deepEqual(f.state.frame,original);near(drawing.trajectoryHeights[handle],command.point.y);
  f.sendFrame({frame:original});assert.deepEqual(selectedDrawing(f),drawing,'same-revision echo must preserve the displayed path');
  f.sendFrame({revision:8,frame:displayed});assert.equal(f.state.pendingTrajectoryPreview,null);assert.deepEqual(selectedDrawing(f),drawing);
  assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);
 }
});

test('raising a linked start previews the ball and every linked start without moving X/Z or unrelated heights',()=>{
 const f=trajectoryFixture('start',{linked:true}),other=structuredClone(f.state.frame.drawings.find(d=>d.id==='arrow'));other.id='linked-other';f.state.frame.drawings.push(other);
 const original=structuredClone(f.state.frame);releaseRaisedObject(f);const shown=structuredClone(f.display()),ball=shown.drawings.find(d=>d.id==='ball');
 near(ball.points[0].y,1.62);near(ball.points[0].x,0);near(ball.points[0].z,0);
 for(const id of ['arrow','linked-other']){const drawing=shown.drawings.find(d=>d.id===id);assert.equal(drawing.startBallId,'ball');assert.deepEqual(drawing.points[0],ball.points[0]);near(drawing.trajectoryHeights.middle,1);near(drawing.trajectoryHeights.end,.025);}
 const command=f.authorCommands()[0];assert.equal(command.type,'trajectory-point');assert.equal(command.handle,'start');near(command.point.y,1.62);
 f.sendFrame({frame:original});near(objectPoint(f.display(),'ball').y,1.62);
 ball.elevation=1.5;for(const drawing of shown.drawings.filter(d=>d.startBallId==='ball'))drawing.trajectoryHandles[0].value=1.62;
 f.sendFrame({revision:8,frame:shown});assert.equal(f.state.pendingTrajectoryPreview,null);near(objectPoint(f.display(),'ball').y,1.62);assert.equal(f.authorCommands().length,1);
});

test('noneditable trajectory handles never start a gesture or issue a keyboard command',()=>{
 for(const linked of [false,true]){
  const f=trajectoryFixture('start',{linked,editable:false});releaseRaisedObject(f);
  for(const key of ['ArrowUp','ArrowRight'])f.dispatch('keydown',0,0,0,{target:f.handle,key});
  assert.equal(f.state.trajectoryDrag,null);assert.equal(f.state.pendingTrajectoryPreview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,0);
 }
});

test('trajectory cancellation, lost capture, blur and second-touch takeover discard previews without commits',()=>{
 for(const handle of ['start','middle','end'])for(const cancellation of ['pointercancel','lostpointercapture','blur','pinch']){
  const f=trajectoryFixture(handle,{linked:handle==='start'}),original=structuredClone(f.state.frame);
  f.dispatch('pointerdown',1,100,200,{target:f.handle});f.dispatch('pointermove',1,100,100,{target:f.handle});assert.ok(f.state.trajectoryDrag?.moved);
  if(cancellation==='pinch')f.dispatch('pointerdown',2,250,250);
  else if(cancellation==='blur')f.window.dispatch(new Event('blur'));else f.dispatch(cancellation,1,100,100,{target:f.handle});
  f.dispatch('pointerup',1,100,50,{target:f.handle});if(cancellation==='pinch')f.dispatch('pointerup',2,250,250);
  assert.equal(f.state.trajectoryDrag,null);assert.equal(f.state.pendingTrajectoryPreview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,0);assert.deepEqual(f.display(),original);
 }
});

test('trajectory handoff releases on rejected revisions, timeout and invalidated context',()=>{
 const changes=[f=>({revision:8}),f=>({token:'new-token'}),f=>({tool:'arrow'}),f=>({disabled:true}),f=>({active:false}),f=>({zoom:2}),
  f=>({frame:{...structuredClone(f.state.frame),selected:[]}}),f=>({frame:{...structuredClone(f.state.frame),stepId:'other-step'}}),
  f=>({frame:{...structuredClone(f.state.frame),drawings:f.state.frame.drawings.map(d=>d.id==='arrow'?{...d,locked:true}:d)}}),
 ];
 for(const change of changes){const f=trajectoryFixture();releaseRaisedObject(f);f.sendFrame(change(f));assert.equal(f.state.pendingTrajectoryPreview,null);assert.equal(f.timers.size,0);assert.equal(f.authorCommands().length,1);}
 const timeout=trajectoryFixture();releaseRaisedObject(timeout);assert.equal([...timeout.timers.values()][0].delay,1200);timeout.flushTimers();assert.equal(timeout.state.pendingTrajectoryPreview,null);assert.equal(timeout.timers.size,0);assert.equal(timeout.authorCommands().length,1);
});

test('trajectory keyboard steps use the same command contract and wheel cannot change an active handle plane',()=>{
 const f=trajectoryFixture('middle');f.dispatch('keydown',0,0,0,{target:f.handle,key:'ArrowUp'});
 assert.deepEqual(f.authorCommands()[0],{type:'trajectory-height',id:'arrow',handle:'middle',value:1.1,revision:7});
 f.dispatch('keydown',0,0,0,{target:f.handle,key:'ArrowDown',shiftKey:true});near(f.authorCommands()[1].value,.5);
 f.dispatch('keydown',0,0,0,{target:f.handle,key:'Home'});near(f.authorCommands()[2].value,0);
 const initial=trajectoryTools.trajectoryHandleTarget(f.state.frame,f.state.packet,'middle').point;
 f.dispatch('keydown',0,0,0,{target:f.handle,key:'ArrowRight'});const right=f.authorCommands()[3];assert.equal(right.type,'trajectory-point');near(right.point.x,initial.x+.1);near(right.point.y,initial.y);near(right.point.z,initial.z);
 f.dispatch('keydown',0,0,0,{target:f.handle,key:'ArrowLeft',shiftKey:true});near(f.authorCommands()[4].point.x,initial.x-.5);
 f.dispatch('pointerdown',1,100,200,{target:f.handle});f.dispatch('pointermove',1,100,100,{target:f.handle});const distance=f.state.distance;
 f.dispatch('wheel',0,100,100,{pointerType:'mouse',deltaY:160});assert.equal(f.state.distance,distance);
 f.dispatch('pointercancel',1,100,100,{target:f.handle});assert.equal(f.authorCommands().length,5);
});

function netWarningFixture(control='middle',kind='arrow'){
 const f=trajectoryFixture('middle',{linked:true,kind}),ball=f.state.frame.drawings[0],arrow=f.state.frame.drawings[1];
 f.state.frame.net=true;ball.elevation=1.5;ball.points=[{x:0,y:1.62,z:3}];arrow.points=[{...ball.points[0]},{x:0,y:.025,z:-5}];
 if(kind==='curve')arrow.points.splice(1,0,{x:1.5,y:1.82,z:-1});
 arrow.trajectoryHeights={start:1.62,middle:1.82,end:.025};for(const handle of arrow.trajectoryHandles)handle.value=arrow.trajectoryHeights[handle.kind];
 if(control==='ball'){f.state.frame.selected=['ball'];f.handle=f.createHeightHandle();}
 return f;
}

test('real drawing cache and warning DOM follow trajectory or linked-ball previews through release and confirmation',()=>{
 for(const kind of ['arrow','curve'])for(const control of ['middle','ball']){
  const f=netWarningFixture(control,kind),original=structuredClone(f.state.frame),first=f.refreshWarnings();
  assert.ok(first.contact);assert.equal(first.node.hidden,false);assert.equal(first.marker.parentNode,first.node);assert.equal(first.tether.parentNode,first.node);
  const shownNode=first.node,key=first.key;assert.equal(f.refreshWarnings(),first,'unchanged displayed geometry reuses the contact cache');
  f.dispatch('pointerdown',1,100,200,{target:f.handle});f.dispatch('pointermove',1,100,-500,{target:f.handle});
  const raised=f.refreshWarnings();assert.notEqual(raised.key,key);assert.equal(raised.contact,null);assert.equal(shownNode.parentNode,null);assert.equal(f.state.netWarningLayer.children.length,0);
  assert.deepEqual(f.state.frame,original);assert.equal(f.authorCommands().length,0);
  f.dispatch('pointerup',1,100,-500,{target:f.handle});const displayed=structuredClone(f.display());
  assert.equal(f.refreshWarnings().contact,null);f.sendFrame({frame:original});assert.equal(f.refreshWarnings().contact,null,'old frame must not flash the warning during handoff');
  f.sendFrame({revision:8,frame:displayed});assert.equal(f.refreshWarnings().contact,null);assert.equal(f.authorCommands().length,1);
  assert.equal(f.authorCommands()[0].type,control==='ball'?'elevation':'trajectory-point');
 }
});

test('warning labels, markers and tethers are cleaned up on hiding, removal and inactive context without author commands',()=>{
 for(const change of ['hidden','layer','removed','net','plain','inactive']){
  const f=netWarningFixture(),first=f.refreshWarnings(),node=first.node;assert.equal(f.state.netWarningLayer.children.length,1);
  if(change==='hidden')f.state.frame.drawings[1].hidden=true;
  else if(change==='layer')f.state.frame.hide=['drawings'];
  else if(change==='removed')f.state.frame.drawings.pop();
  else if(change==='net'){f.state.frame.net=false;f.state.net.visible=false;}
  else if(change==='plain')f.state.packet.plain=true;
  else f.sendFrame({active:false});
  if(change!=='inactive')f.refreshWarnings();
  assert.equal(f.state.netWarnings.size,0,change);assert.equal(f.state.netWarningLayer.children.length,0);assert.equal(node.parentNode,null);assert.equal(f.authorCommands().length,0);
 }
});

function perspectiveGrip(f,yaw=.6145,pitch=.6){
 f.state.innerWidth=379;f.state.innerHeight=819;
 const camera=new THREE.PerspectiveCamera(39,379/819,.1,200);camera.position.set(Math.sin(yaw)*Math.cos(pitch)*25,Math.sin(pitch)*25,Math.cos(yaw)*Math.cos(pitch)*25);camera.lookAt(0,1,0);camera.updateMatrixWorld();f.state.camera=camera;
 const kind=f.handle===f.state.elevationButton?'start':f.handleKind||'middle',target=trajectoryTools.trajectoryHandleTarget(f.state.frame,f.state.packet,kind),at=new THREE.Vector3(target.point.x,target.point.y,target.point.z).project(camera);
 // Deliberately displaced, as the accessible 44 px grip can be offset from its path.
 return {x:(at.x*.5+.5)*379+24,y:(-.5*at.y+.5)*819-12,target};
}

test('real perspective drags isolate horizontal and vertical axes at different mobile camera yaws and include release coordinates',()=>{
 for(const handle of ['start','middle','end'])for(const yaw of [0,.6145,Math.PI/2])for(const pointerType of ['mouse','touch'])for(const axis of ['horizontal','vertical']){
  const f=trajectoryFixture(handle);f.handleKind=handle;const start=perspectiveGrip(f,yaw),extra={target:f.handle,pointerType},dx=axis==='horizontal'?36:0,dy=axis==='vertical'?-36:0;
  f.dispatch('pointerdown',1,start.x,start.y,extra);near(f.state.trajectoryDrag.plane.normal.y,0);
  f.dispatch('pointermove',1,start.x+dx*2/3,start.y+dy*2/3,extra);const beforeRelease={...f.state.trajectoryDrag.destination};
  f.dispatch('pointerup',1,start.x+dx,start.y+dy,extra);assert.equal(f.authorCommands().length,1);
  const command=f.authorCommands()[0];assert.equal(command.type,'trajectory-point');assert.equal(command.handle,handle);
  if(axis==='horizontal'){near(command.point.y,start.target.value);assert.ok(Math.hypot(command.point.x-start.target.point.x,command.point.z-start.target.point.z)>.01);}
  else{near(command.point.x,start.target.point.x);near(command.point.z,start.target.point.z);assert.ok(command.point.y>start.target.value);}
  assert.ok(Math.hypot(command.point.x-beforeRelease.x,command.point.y-beforeRelease.y,command.point.z-beforeRelease.z)>.001,'pointerup must include the final sample');
 }
});

test('one diagonal linked-start command previews the ball and all linked starts and hands off once',()=>{
 const f=trajectoryFixture('start',{linked:true,kind:'curve'});f.handleKind='start';const other=structuredClone(f.state.frame.drawings[1]);other.id='linked-other';f.state.frame.drawings.push(other);
 const original=structuredClone(f.state.frame),start=perspectiveGrip(f),extra={target:f.handle,pointerType:'touch'};
 f.dispatch('pointerdown',1,start.x,start.y,extra);f.dispatch('pointermove',1,start.x+24,start.y-24,extra);f.dispatch('pointerup',1,start.x+36,start.y-36,extra);
 assert.equal(f.authorCommands().length,1);const command=f.authorCommands()[0],displayed=structuredClone(f.display()),ball=objectPoint(displayed,'ball');
 assert.equal(command.type,'trajectory-point');assert.equal(command.handle,'start');assert.deepEqual(ball,command.point);assert.ok(ball.y>original.drawings[0].points[0].y);assert.ok(Math.hypot(ball.x,ball.z)>.01);
 for(const drawing of displayed.drawings.filter(item=>item.startBallId==='ball')){assert.deepEqual(drawing.points[0],ball);near(drawing.trajectoryHeights.middle,1);near(drawing.trajectoryHeights.end,.025);}
 assert.deepEqual(f.state.frame,original);f.sendFrame({frame:original});assert.deepEqual(objectPoint(f.display(),'ball'),ball);
 displayed.drawings[0].elevation=ball.y-.12;f.sendFrame({revision:8,frame:displayed});assert.equal(f.state.pendingTrajectoryPreview,null);assert.deepEqual(objectPoint(f.display(),'ball'),ball);assert.equal(f.authorCommands().length,1);
});

test('a lateral-only edit preserves a legacy height profile instead of materializing one',()=>{
 for(const kind of ['arrow','curve'])for(const landscape of [false,true]){
  const f=trajectoryFixture('middle',{kind}),drawing=f.state.frame.drawings[1];delete drawing.trajectoryHeights;delete drawing.curveMode;
  drawing.points.forEach(point=>{point.y=.025;});drawing.trajectoryHandles.forEach(handle=>{handle.value=.025;});f.state.packet.landscape=landscape;
  const start=perspectiveGrip(f),extra={target:f.handle,pointerType:'touch'};f.dispatch('pointerdown',1,start.x,start.y,extra);f.dispatch('pointermove',1,start.x+24,start.y,extra);f.dispatch('pointerup',1,start.x+36,start.y,extra);
  assert.equal(f.authorCommands().length,1);near(f.authorCommands()[0].point.y,.025);assert.equal(selectedDrawing(f).trajectoryHeights,undefined);assert.equal(f.state.frame.drawings[1].trajectoryHeights,undefined);
 }
});

test('vertical camera directions and near-parallel rays cannot start or commit an invalid trajectory point',()=>{
 const overhead=trajectoryFixture();overhead.state.camera.getWorldDirection=out=>out.set(0,-1,0);overhead.dispatch('pointerdown',1,100,200,{target:overhead.handle});assert.equal(overhead.state.trajectoryDrag,null);assert.equal(overhead.authorCommands().length,0);
 const parallel=trajectoryFixture();parallel.dispatch('pointerdown',1,100,200,{target:parallel.handle});assert.ok(parallel.state.trajectoryDrag);
 const cast=parallel.state.cast;parallel.state.cast=event=>{cast(event);parallel.state.ray.ray.direction.set(0,1,0);};
 parallel.dispatch('pointermove',1,130,170,{target:parallel.handle});parallel.dispatch('pointerup',1,150,150,{target:parallel.handle});assert.equal(parallel.authorCommands().length,0);assert.equal(parallel.state.pendingTrajectoryPreview,null);
});
