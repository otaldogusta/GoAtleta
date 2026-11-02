import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraChunkQueue, CameraRecordingStore, CameraStopCoordinator, CameraTransport, LIVE_CAMERA_DATABASE, activeCameraPoints, bootCamera, cameraCaptureConstraints, cameraRecordingDetail, chooseRecordingMime, deleteCameraRecording, parseCameraPair, projectCameraPoint, requestCameraView } from '../../public/scouting-live/camera.js';

const roomId='11111111-1111-4111-8111-111111111111',token='a'.repeat(64),recordingId='recording-one';
const point={id:'point-1',recordingId,timeMs:1200,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:50,clockMode:'estimated',createdAtHostEpochMs:10000};
function memoryIdb(){
  const stores=new Map(),state={failPut:false,failDeleteAt:0,deleteCount:0};
  const db={objectStoreNames:{contains:name=>stores.has(name)},close(){},createObjectStore(name){stores.set(name,new Map());return{createIndex(){}};},transaction(names){
    const copies=new Map(names.map(name=>[name,new Map(stores.get(name))]));let pending=0,aborted=false,completed=false;
    const tx={error:null,oncomplete:null,onabort:null,onerror:null,abort(){if(completed||aborted)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(name){
      const values=copies.get(name);
      const request=operation=>{const r={result:undefined,error:null,onsuccess:null,onerror:null};pending++;queueMicrotask(()=>{if(aborted)return;try{r.result=operation();r.onsuccess?.();}catch(error){r.error=tx.error=error;r.onerror?.();tx.onerror?.();tx.abort();}finally{pending--;queueMicrotask(()=>{if(!pending&&!aborted&&!completed){completed=true;for(const[name,map]of copies)stores.set(name,map);tx.oncomplete?.();}});}});return r;};
      return{get:key=>request(()=>values.get(key)),getAll:()=>request(()=>[...values.values()]),add:value=>request(()=>{if(state.failPut)throw new Error('QuotaExceededError');const key=name==='chunks'?JSON.stringify([value.recordingId,value.index]):value.id;if(values.has(key))throw new Error('ConstraintError');values.set(key,structuredClone(value));return key;}),put:value=>request(()=>{if(state.failPut)throw new Error('QuotaExceededError');const key=name==='chunks'?JSON.stringify([value.recordingId,value.index]):value.id;values.set(key,structuredClone(value));return key;}),delete:key=>request(()=>{if(++state.deleteCount===state.failDeleteAt)throw new Error('DeleteFailed');values.delete(Array.isArray(key)?JSON.stringify(key):key);}),index:()=>({getAll:key=>request(()=>[...values.values()].filter(v=>v.recordingId===key)),getAllKeys:key=>request(()=>[...values.values()].filter(v=>v.recordingId===key).map(v=>[v.recordingId,v.index]))})};
    }};return tx;
  }};
  const factory={open(name,version){assert.equal(name,LIVE_CAMERA_DATABASE);assert.equal(version,1);const r={result:db,onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null};queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
  return {factory,stores,state};
}
const metadata=()=>({id:recordingId,roomId,startEpochMs:1000,startedAt:'2026-11-01T12:00:00Z',mimeType:'video/webm',state:'recording',chunkCount:0,bytes:0,lastSavedTimeMs:0,events:[],connectionEvents:[]});

test('pairing accepts only room and camera capability and rejects ambiguous or injected fragments',()=>{
  assert.deepEqual(parseCameraPair(`#room=${roomId}&token=${token}`),{roomId,token});
  for(const hash of ['',`#room=${roomId}&token=x`,`#room=${roomId}&token=${token}&token=${token}`,`#room=${roomId}&token=${token}&hostToken=private`,`#room=bad&token=${token}`])assert.throws(()=>parseCameraPair(hash));
});

test('phone point projection removes unrelated identity fields and refuses another recording or invalid timestamps',()=>{
  assert.deepEqual(projectCameraPoint({...point,studentId:'private',organizationId:'private',athleteName:'private'},recordingId,1500),point);
  for(const changed of [{...point,recordingId:'other'},{...point,timeMs:-1},{...point,timeMs:9000},{...point,clockMode:'magic'},{...point,uncertaintyMs:Infinity}])assert.throws(()=>projectCameraPoint(changed,recordingId,1500));
});

test('chunk commits, points and retractions recover from the dedicated database without rewriting old points',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);
  await store.create(metadata());
  await store.append(recordingId,0,new Blob(['first']),2000);
  await store.append(recordingId,1,new Blob(['second']),4000);
  await store.addPoint(recordingId,point);await store.addPoint(recordingId,point);
  await store.undoPoint(recordingId,point.id);await store.undoPoint(recordingId,point.id);
  const reopened=new CameraRecordingStore(idb.factory),saved=await reopened.downloadData(recordingId);
  assert.equal(await saved.blob.text(),'firstsecond');assert.equal(saved.manifest.chunkCount,2);assert.equal(saved.manifest.bytes,11);
  assert.equal(saved.manifest.events.length,2);assert.equal(saved.manifest.points.length,0);assert.equal(saved.manifest.events[0].point.id,point.id);
  assert.equal(activeCameraPoints([{kind:'point',point}]).length,1);
  await assert.rejects(store.addPoint(recordingId,{...point,won:false}));
  assert.equal((await store.get(recordingId)).events[0].point.won,true);
});

test('quota failure aborts both chunk and metadata while preserving all previously committed footage',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);await store.create(metadata());await store.append(recordingId,0,new Blob(['safe']),2000);
  idb.state.failPut=true;await assert.rejects(store.append(recordingId,1,new Blob(['lost']),4000),/QuotaExceeded/);idb.state.failPut=false;
  const saved=await store.downloadData(recordingId);assert.equal(await saved.blob.text(),'safe');assert.equal(saved.manifest.chunkCount,1);assert.equal(saved.manifest.durationMs,2000);
});

test('missing chunk is reported instead of claiming a complete downloadable game',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);await store.create(metadata());await store.append(recordingId,0,new Blob(['safe']),2000);
  idb.stores.get('chunks').clear();await assert.rejects(store.downloadData(recordingId),/trecho ausente/);
});

test('negotiation buffers ICE until the offer generation and sends capabilities only in headers',async()=>{
  const calls=[],messages=[],received=[],states=[],storage=new Map();
  const peer={connectionState:'new',signalingState:'stable',remoteDescription:null,localDescription:null,
    addTrack(){},createDataChannel(){this.channel={readyState:'open',send:value=>messages.push(JSON.parse(value)),close(){}};return this.channel;},async createOffer(){return{type:'offer',sdp:'offer-sdp'};},async setLocalDescription(desc){this.localDescription=desc;this.signalingState='have-local-offer';this.onicecandidate({candidate:{toJSON:()=>({candidate:'candidate:local',sdpMid:'0',sdpMLineIndex:0})}});},async setRemoteDescription(desc){this.remoteDescription=desc;this.signalingState='stable';},async addIceCandidate(){},close(){}};
  const fetcher=async(url,options)=>{const body=options.body?JSON.parse(options.body):null;calls.push({url,headers:options.headers,body});let result={};if(url.endsWith('/join'))result={cameraClientId:'client',generation:0,cursor:3};else if(body?.type==='offer')result={sequence:4,generation:1};else if(url.includes('/signals?'))result={cursor:6,signals:[{from:'host',generation:1,type:'answer',sdp:'answer-sdp',sequence:5}]};return{ok:true,json:async()=>result};};
  const transport=new CameraTransport({roomId,token},{fetcher,Peer:class{constructor(){return peer;}},storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},clock:()=>({recordingId,startEpochMs:1000,timeMs:200,state:'recording',recording:true,segmentId:1}),onMessage:data=>received.push(data),onState:state=>states.push(state)});
  await transport.connect({getTracks:()=>[{}]});await new Promise(resolve=>setImmediate(resolve));
  peer.channel.onopen();peer.channel.onmessage({data:JSON.stringify({kind:'ping',id:'ping',sentEpochMs:123})});peer.channel.onmessage({data:JSON.stringify({kind:'point',point})});
  assert.equal(states.at(-1),'connected');peer.channel.onclose();assert.equal(states.at(-1),'offline');peer.channel.onerror();assert.equal(states.at(-1),'offline');
  transport.disconnect();
  const afterClose=states.length;peer.channel.onclose();assert.equal(states.length,afterClose);
  const offer=calls.findIndex(c=>c.body?.type==='offer'),ice=calls.findIndex(c=>c.body?.type==='ice');assert.ok(ice>offer);assert.equal(calls[ice].body.generation,1);assert.equal(peer.remoteDescription.sdp,'answer-sdp');
  assert.ok(calls.every(c=>!c.url.includes(token)&&c.headers['X-GoAtleta-Live-Token']===token));
  assert.equal(messages[0].kind,'recording');assert.equal(messages[1].kind,'pong');assert.equal(messages[1].timeMs,200);assert.equal(received[0].point.id,point.id);
});

test('recording MIME selection is capability based and can fail without a false supported format',()=>{
  assert.equal(chooseRecordingMime({isTypeSupported:type=>type==='video/webm'}),'video/webm');
  assert.equal(chooseRecordingMime({isTypeSupported:()=>false}),'');
});

test('active recording summary uses the live counter instead of a stale startup storage snapshot',()=>{
  const active=cameraRecordingDetail(metadata(),true);
  assert.equal(active,'Gravação em andamento · acompanhe o contador acima');assert.doesNotMatch(active,/0 MB|interrompida/);
  assert.match(cameraRecordingDetail({...metadata(),state:'stopped',bytes:2097152,chunkCount:2},false),/^2\.0 MB · 2 trechos salvos/);
  assert.match(cameraRecordingDetail({...metadata(),state:'error'},false),/gravação incompleta/);
});

test('default browser fetch keeps the Window receiver instead of invoking it as a transport method',async()=>{
  const original=globalThis.fetch;let called=false;
  globalThis.fetch=function(url,options){assert.equal(this,globalThis);assert.equal(url,`/rooms/${roomId}/join`);assert.equal(options.headers['X-GoAtleta-Live-Token'],token);called=true;return Promise.resolve({ok:true,json:async()=>({cameraClientId:'camera-client'})});};
  try{const transport=new CameraTransport({roomId,token},{storage:{getItem:()=>null},Peer:class{}});assert.deepEqual(await transport.api('/join',{method:'POST',body:{}}),{cameraClientId:'camera-client'});assert.equal(called,true);}finally{globalThis.fetch=original;}
});

test('capture preferences request real dimensions and orientation lock is best effort after fullscreen',async()=>{
  assert.deepEqual([cameraCaptureConstraints().video.width.ideal,cameraCaptureConstraints().video.height.ideal],[1920,1080]);
  assert.deepEqual([cameraCaptureConstraints('portrait').video.width.ideal,cameraCaptureConstraints('portrait').video.height.ideal],[1080,1920]);
  assert.throws(()=>cameraCaptureConstraints('diagonal'));
  const calls=[],window={document:{fullscreenElement:null},screen:{orientation:{async lock(value){calls.push(value);}}}},element={async requestFullscreen(){calls.push('fullscreen');window.document.fullscreenElement=element;}};
  assert.deepEqual(await requestCameraView(window,element,'landscape'),{fullscreen:true,locked:true});assert.deepEqual(calls,['fullscreen','landscape']);
  window.document.fullscreenElement=null;window.screen.orientation.lock=async()=>{throw new Error('Unsupported');};element.requestFullscreen=async()=>{throw new Error('Denied');};
  assert.deepEqual(await requestCameraView(window,element,'portrait'),{fullscreen:false,locked:false});
});

class StopRecorder extends EventTarget{constructor(){super();this.state='recording';this.stopCalls=0;}stop(){this.state='inactive';this.stopCalls++;}finish(){this.dispatchEvent(new Event('stop'));}}
const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
test('stop waits for the final chunk transaction and emits terminal state before releasing capture',async()=>{
  const store=new CameraRecordingStore(memoryIdb().factory);await store.create(metadata());await store.append(recordingId,0,new Blob(['first']),2000);
  const recorder=new StopRecorder(),order=[];let resolveLast;const last=new Promise(resolve=>{resolveLast=resolve;});
  let writes=Promise.resolve();const stop=new CameraStopCoordinator(recorder,{onStopping:()=>order.push('stopping'),drain:()=>writes,commit:()=>store.update(recordingId,meta=>({...meta,state:'stopped',durationMs:2500})),onComplete:()=>order.push('terminal'),release:()=>order.push('release')});
  const pending=stop.stop();assert.equal(stop.stop(),pending);assert.equal(recorder.stopCalls,1);
  writes=last.then(()=>store.append(recordingId,1,new Blob(['last']),2500));recorder.finish();await flush();
  assert.deepEqual(order,['stopping']);assert.equal((await store.get(recordingId)).state,'recording');
  resolveLast();assert.equal(await pending,true);assert.deepEqual(order,['stopping','terminal','release']);
  const exported=await store.downloadData(recordingId);assert.equal(await exported.blob.text(),'firstlast');assert.equal(exported.manifest.chunkCount,2);assert.equal(exported.manifest.state,'stopped');
  await stop.stop();assert.equal(recorder.stopCalls,1);
});

test('failed final metadata commit preserves footage, never announces stopped, and can retry after onstop',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);await store.create(metadata());await store.append(recordingId,0,new Blob(['safe']),1000);
  const recorder=new StopRecorder();let announced=0,failures=0;
  const stop=new CameraStopCoordinator(recorder,{drain:async()=>{},commit:()=>store.update(recordingId,meta=>({...meta,state:'stopped'})),onComplete:()=>announced++,onFailure:()=>failures++});
  idb.state.failPut=true;const pending=stop.stop();recorder.finish();assert.equal(await pending,false);
  assert.equal(announced,0);assert.equal(failures,1);assert.equal(stop.finalized,false);assert.equal(await (await store.downloadData(recordingId)).blob.text(),'safe');
  await assert.rejects(store.remove(recordingId));idb.state.failPut=false;assert.equal(await stop.stop(),true);assert.equal(announced,1);assert.equal(recorder.stopCalls,1);
});

test('phone deletion requires confirmation, rejects active use, and atomically deletes only one exact recording',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory),otherId=`${recordingId}-other`;
  await store.create({...metadata(),state:'stopped'});await store.create({...metadata(),id:otherId,state:'stopped'});
  await store.append(recordingId,0,new Blob(['one']),1000);await store.append(recordingId,1,new Blob(['two']),2000);await store.append(otherId,0,new Blob(['other']),1000);
  let confirmed=0;
  assert.equal(await deleteCameraRecording(store,recordingId,{confirm:async()=>{confirmed++;return false;}}),false);assert.equal(confirmed,1);assert.equal(await (await store.downloadData(recordingId)).blob.text(),'onetwo');
  await assert.rejects(deleteCameraRecording(store,recordingId,{canDelete:()=>false,confirm:async()=>{throw new Error('Must not confirm');}}),/Encerre/);
  let allowed=true;await assert.rejects(deleteCameraRecording(store,recordingId,{canDelete:()=>allowed,confirm:async()=>{allowed=false;return true;}}),/em uso/);
  idb.state.failDeleteAt=2;await assert.rejects(deleteCameraRecording(store,recordingId,{confirm:async()=>true}),/DeleteFailed/);
  assert.equal(await (await store.downloadData(recordingId)).blob.text(),'onetwo');assert.equal(await (await store.downloadData(otherId)).blob.text(),'other');
  idb.state.failDeleteAt=0;assert.equal(await deleteCameraRecording(store,recordingId,{confirm:async item=>item.id===recordingId}),true);
  assert.equal(await store.get(recordingId),undefined);assert.equal(await (await store.downloadData(otherId)).blob.text(),'other');
});

function cameraFixture(){
  const nodes=new Map(),listeners=new Map(),requests=[],messages=[],tracks=[],instances=[];let now=500;
  class Node{
    constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.listeners=new Map();this.pauseCalls=0;}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(name,value){this[name]=value;}focus(){}click(){this.onclick?.();}
    querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
    addEventListener(name,listener){const set=this.listeners.get(name)??new Set();set.add(listener);this.listeners.set(name,set);}async play(){}pause(){this.pauseCalls++;}
  }
  const document={fullscreenElement:null,hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Node(id==='preview'?'video':'div'));return nodes.get(id);},createElement:tag=>new Node(tag),addEventListener(name,fn){listeners.set(name,fn);}};
  const stream={getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(track=>track.kind==='video')};
  for(const kind of ['video','audio']){const track=new EventTarget();track.kind=kind;track.stopped=false;track.stop=()=>{track.stopped=true;track.dispatchEvent(new Event('ended'));};track.getSettings=()=>({width:1920,height:1080,frameRate:30});tracks.push(track);}
  class Recorder extends EventTarget{
    static isTypeSupported(type){return type==='video/webm';}
    constructor(){super();this.state='inactive';this.mimeType='video/webm';this.stopCalls=0;instances.push(this);}
    start(){this.state='recording';queueMicrotask(()=>this.onstart?.());}
    stop(){this.stopCalls++;this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['last-chunk'])});this.dispatchEvent(new Event('stop'));});}
  }
  const session=new Map();
  const window={document,isSecureContext:true,location:{hash:`#room=${roomId}&token=${token}`,pathname:'/camera'},history:{replaceState(){}},sessionStorage:{setItem:(key,value)=>session.set(key,value),getItem:key=>session.get(key)??null},crypto:{randomUUID:()=>recordingId},performance:{now:()=>now},navigator:{mediaDevices:{getUserMedia:async constraints=>{requests.push(constraints);return stream;}}},MediaRecorder:Recorder,RTCPeerConnection:class{},screen:{orientation:{lock:async()=>{},addEventListener(){}}},addEventListener(name,fn){listeners.set(name,fn);},setInterval:()=>1,setTimeout:()=>1,URL:{},confirm:()=>false};
  document.getElementById('camera-app').requestFullscreen=async()=>{document.fullscreenElement=document.getElementById('camera-app');};
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);let transportOptions;
  const app=bootCamera(document,window,{store,transportFactory:(_pair,options)=>{transportOptions=options;return{connect:async()=>options.onState('connected'),disconnect(){},send:message=>messages.push(message)};}});
  return {app,nodes,window,store,idb,requests,messages,tracks,instances,advance:ms=>{now+=ms;},clock:()=>transportOptions.clock(),connection:(state,message)=>transportOptions.onState(state,message)};
}

test('preparing does not record; stop commits its last chunk, turns camera off and requires a new QR for another game',async()=>{
  const fixture=cameraFixture();await flush();const {nodes,app,store,messages,tracks}=fixture;
  assert.equal(nodes.get('start').disabled,true);assert.equal(nodes.get('prepare').disabled,false);
  await nodes.get('prepare').onclick();assert.equal(fixture.instances.length,0);assert.equal(fixture.clock().recordingId,undefined);assert.equal(fixture.requests[0].video.aspectRatio.ideal,16/9);
  assert.equal(nodes.get('start').disabled,false);assert.equal(app.getState().phase,'preview');
  fixture.advance(5000);await nodes.get('start').onclick();await flush();assert.equal(app.getState().phase,'recording');assert.equal(fixture.clock().timeMs,0);assert.equal(nodes.get('portrait').disabled,true);
  fixture.advance(2100);const stopping=nodes.get('stop').onclick();assert.equal(app.getState().phase,'stopping');assert.equal(nodes.get('stop').textContent,'Finalizando…');
  await stopping;await flush();assert.equal(app.getState().phase,'stopped');assert.equal(nodes.get('preview').srcObject,null);assert.ok(tracks.every(track=>track.stopped));
  assert.equal(nodes.get('start').disabled,true);assert.equal(nodes.get('prepare').disabled,true);assert.match(nodes.get('recording-status').textContent,/encerrada/);
  const data=await store.downloadData(recordingId);assert.equal(await data.blob.text(),'last-chunk');assert.equal(data.manifest.durationMs,2100);assert.equal(data.manifest.orientationPreference,'landscape');assert.equal(data.manifest.captureOrientation,'landscape');
  assert.equal(messages.at(-1).state,'stopped');assert.equal(messages.at(-1).durationMs,2100);
});

test('interrupted footage stays exportable after reload while unconfirmed active recordings cannot be deleted',async()=>{
  const fixture=cameraFixture();await flush();
  await fixture.store.create(metadata());await fixture.store.append(recordingId,0,new Blob(['recovered']),1000);
  fixture.nodes.get('show-recordings').onclick();await flush();
  const buttons=fixture.nodes.get('recordings').querySelectorAll('button');
  assert.equal(buttons.find(button=>button.textContent==='Salvar trechos').disabled,false);
  assert.equal(buttons.find(button=>button.textContent==='Excluir do celular').disabled,true);
  assert.equal(await (await fixture.store.downloadData(recordingId)).blob.text(),'recovered');
});

test('a failed chunk retains its Blob and index before the tail, even if another metadata write succeeds',async()=>{
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory);await store.create(metadata());
  const chunks=new CameraChunkQueue(store,recordingId);chunks.enqueue(new Blob(['first']),1000);await chunks.flush();
  chunks.enqueue(new Blob(['middle']),2000);idb.state.failPut=true;await assert.rejects(chunks.flush(),/Quota/);
  chunks.enqueue(new Blob(['tail']),2100);assert.equal(chunks.pendingCount,2);assert.equal(chunks.entries[0].index,1);
  idb.state.failPut=false;await store.update(recordingId,meta=>({...meta,connectionEvents:[{kind:'connection-ended'}]}));
  assert.equal(chunks.pendingCount,2);await chunks.flush();assert.equal(chunks.pendingCount,0);
  const data=await store.downloadData(recordingId);assert.equal(await data.blob.text(),'firstmiddletail');assert.deepEqual(data.manifest.chunks.map(chunk=>chunk.index),[0,1,2]);
});

test('phone final-chunk failure blocks completion and deletion until retry commits the same buffered Blob',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.advance(900);fixture.idb.state.failPut=true;await fixture.nodes.get('stop').onclick();await flush();
  assert.equal(fixture.app.getState().phase,'finalization-error');assert.equal(fixture.nodes.get('stop').textContent,'Tentar finalizar');
  assert.equal((await fixture.store.get(recordingId)).state,'recording');assert.equal((await fixture.store.get(recordingId)).chunkCount,0);
  assert.equal(fixture.nodes.get('recordings').querySelectorAll('button').find(button=>button.textContent==='Excluir do celular').disabled,true);
  fixture.idb.state.failPut=false;await fixture.nodes.get('stop').onclick();await flush();
  assert.equal(fixture.instances[0].stopCalls,1);assert.equal(fixture.app.getState().phase,'error');
  const recovered=await fixture.store.downloadData(recordingId);assert.equal(await recovered.blob.text(),'last-chunk');assert.equal(recovered.manifest.chunkCount,1);assert.equal(recovered.manifest.state,'error');
  assert.ok(fixture.tracks.every(track=>track.stopped));
});

test('reloading cannot start a new timeline in a room that already owns a local recording',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});
  await fixture.nodes.get('prepare').onclick();await flush();
  assert.equal(fixture.requests.length,0);assert.equal(fixture.instances.length,0);
  assert.match(fixture.nodes.get('error').textContent,/outro QR code/);assert.equal((await fixture.store.list()).length,1);
});

test('offline capture shows reconnect without restarting the local recorder or its timeline',async()=>{
  const fixture=cameraFixture();await flush();
  assert.equal(fixture.nodes.get('prepare').hidden,false);assert.equal(fixture.nodes.get('start').hidden,true);
  await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  const recorder=fixture.instances[0],epoch=fixture.clock().startEpochMs;
  fixture.advance(5000);fixture.connection('offline');
  assert.equal(fixture.nodes.get('prepare').hidden,true);assert.equal(fixture.nodes.get('reconnect').hidden,false);
  assert.equal(fixture.nodes.get('camera-app').dataset.connection,'offline');assert.equal(fixture.nodes.get('camera-app').dataset.phase,'recording');
  assert.equal(fixture.nodes.get('recording-status').textContent,'Gravando');
  fixture.nodes.get('reconnect').onclick();await flush();
  assert.equal(fixture.instances.length,1);assert.equal(recorder.state,'recording');assert.equal(recorder.stopCalls,0);
  assert.equal(fixture.clock().startEpochMs,epoch);assert.equal(fixture.clock().timeMs,5000);assert.equal(fixture.nodes.get('reconnect').hidden,true);
  await fixture.nodes.get('stop').onclick();await flush();
});

test('format options live in the settings menu and remain locked while recording',async()=>{
  const fixture=cameraFixture();await flush();
  assert.equal(fixture.nodes.get('settings-menu').hidden,true);fixture.nodes.get('settings').onclick();
  assert.equal(fixture.nodes.get('settings-menu').hidden,false);assert.equal(fixture.nodes.get('settings')['aria-expanded'],'true');
  await fixture.nodes.get('portrait').onclick();assert.equal(fixture.app.getState().format,'portrait');assert.equal(fixture.nodes.get('settings-menu').hidden,true);
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.requests[0].video.aspectRatio.ideal,9/16);
  await fixture.nodes.get('start').onclick();await flush();assert.equal(fixture.nodes.get('landscape').disabled,true);
  await fixture.nodes.get('landscape').onclick();assert.equal(fixture.app.getState().format,'portrait');
  await fixture.nodes.get('stop').onclick();await flush();
});

test('deleting an old local recording does not make its QR room reusable in the same browser session',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});
  fixture.nodes.get('show-recordings').onclick();await flush();await fixture.store.remove(recordingId);
  await fixture.nodes.get('prepare').onclick();await flush();
  assert.equal(fixture.requests.length,0);assert.match(fixture.nodes.get('error').textContent,/outro QR code/);
});
