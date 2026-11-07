import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { CAMERA_REAR_PREFERENCE, CAMERA_VIDEO_PART_SIZE, CameraVideoSender, CameraChunkQueue, CameraRecordingStore, CameraStopCoordinator, CameraTransport, LIVE_CAMERA_DATABASE, activeCameraPoints, bootCamera, cameraCaptureConstraints, cameraDisplayName, cameraFacingMode, cameraRecordingDetail, chooseRecordingMime, deleteCameraRecording, parseCameraPair, preferredCameraDevice, presentCameraPreview, projectCameraPoint, readRearCameraPreference, releaseCameraOrientation, resetCameraZoom, resolveRearCameraPreference } from '../../public/scouting-live/camera.js';

const roomId='11111111-1111-4111-8111-111111111111',token='a'.repeat(64),recordingId='recording-one';
const point={id:'point-1',recordingId,timeMs:1200,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:50,clockMode:'estimated',createdAtHostEpochMs:10000};
function memoryIdb(){
  const stores=new Map(),state={failPut:false,failDeleteAt:0,deleteCount:0};
  const db={objectStoreNames:{contains:name=>stores.has(name)},close(){},createObjectStore(name){stores.set(name,new Map());return{createIndex(){}};},transaction(names){
    const copies=new Map(names.map(name=>[name,new Map(stores.get(name))]));let pending=0,aborted=false,completed=false;
    const tx={error:null,oncomplete:null,onabort:null,onerror:null,abort(){if(completed||aborted)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(name){
      const values=copies.get(name);
      const request=operation=>{const r={result:undefined,error:null,onsuccess:null,onerror:null};pending++;queueMicrotask(()=>{if(aborted)return;try{r.result=operation();r.onsuccess?.();}catch(error){r.error=tx.error=error;r.onerror?.();tx.onerror?.();tx.abort();}finally{pending--;queueMicrotask(()=>{if(!pending&&!aborted&&!completed){completed=true;for(const[name,map]of copies)stores.set(name,map);tx.oncomplete?.();}});}});return r;};
      return{get:key=>request(()=>values.get(Array.isArray(key)?JSON.stringify(key):key)),getAll:()=>request(()=>[...values.values()]),add:value=>request(()=>{if(state.failPut)throw new Error('QuotaExceededError');const key=name==='chunks'?JSON.stringify([value.recordingId,value.index]):value.id;if(values.has(key))throw new Error('ConstraintError');values.set(key,structuredClone(value));return key;}),put:value=>request(()=>{if(state.failPut)throw new Error('QuotaExceededError');const key=name==='chunks'?JSON.stringify([value.recordingId,value.index]):value.id;values.set(key,structuredClone(value));return key;}),delete:key=>request(()=>{if(++state.deleteCount===state.failDeleteAt)throw new Error('DeleteFailed');values.delete(Array.isArray(key)?JSON.stringify(key):key);}),index:()=>({getAll:key=>request(()=>[...values.values()].filter(v=>v.recordingId===key)),getAllKeys:key=>request(()=>[...values.values()].filter(v=>v.recordingId===key).map(v=>[v.recordingId,v.index]))})};
    }};return tx;
  }};
  const factory={open(name,version){assert.equal(name,LIVE_CAMERA_DATABASE);assert.equal(version,1);const r={result:db,onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null};queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
  return {factory,stores,state};
}
const metadata=()=>({id:recordingId,roomId,startEpochMs:1000,startedAt:'2026-11-01T12:00:00Z',mimeType:'video/webm',state:'recording',chunkCount:0,bytes:0,lastSavedTimeMs:0,events:[],connectionEvents:[]});

async function videoSenderFixture(blobs=[new Blob(['head']),new Blob([new Uint8Array(18000).fill(7)]),new Blob(['tail'])]) {
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory),messages=[],states=[];
  await store.create({...metadata(),state:'stopped'});for(let index=0;index<blobs.length;index++)await store.append(recordingId,index,blobs[index],index*1000);
  let online=true,timer,backpressure=false;
  const sender=new CameraVideoSender({store,roomId,crypto:webcrypto,connected:()=>online,send:message=>{if(backpressure)return false;messages.push(message);return true;},onState:state=>states.push(state),setTimer:fn=>(timer=fn,1),clearTimer:()=>{timer=null;}});
  return {sender,store,idb,messages,states,offline:()=>{online=false;sender.disconnected();},online:()=>{online=true;sender.resume();},timeout:()=>timer?.(),backpressure:value=>{backpressure=value;}};
}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}assert.ok(predicate(),'async video step completed');}

test('direct video copy streams original bytes across recorder chunks and waits for persisted acknowledgements',async()=>{
  const fixture=await videoSenderFixture(),{sender,messages,states}=fixture;await sender.enqueue(recordingId);
  const offer=messages[0];assert.equal(offer.kind,'video-offer');assert.equal(offer.bytes,18008);assert.equal(offer.partSize,CAMERA_VIDEO_PART_SIZE);
  assert.equal(messages.filter(message=>message.kind==='video-part').length,0);
  sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0});
  const copied=[];
  for(let index=0;index<offer.partCount;index++){
    await until(()=>messages.some(message=>message.kind==='video-part'&&message.index===index));
    const part=messages.find(message=>message.kind==='video-part'&&message.index===index),bytes=Buffer.from(part.data,'base64');copied.push(bytes);
    assert.ok(JSON.stringify(part).length<16384);assert.equal(part.sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.equal(messages.filter(message=>message.kind==='video-part').length,index+1);
    assert.equal(sender.handle({kind:'video-ack',transferId:'foreign',recordingId,index,nextPart:index+1}),false);
    sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index,nextPart:index+1});
  }
  await until(()=>messages.some(message=>message.kind==='video-complete'));
  assert.equal(states.some(state=>state.state==='ready'),false);assert.equal(sender.isTransferring(recordingId),true);
  sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId});
  assert.equal(states.at(-1).state,'ready');assert.equal(sender.isTransferring(recordingId),false);
  assert.deepEqual(Buffer.concat(copied),Buffer.concat([Buffer.from('head'),Buffer.alloc(18000,7),Buffer.from('tail')]));
  assert.equal((await fixture.store.get(recordingId)).state,'stopped');assert.equal((await fixture.store.downloadData(recordingId)).blob.size,18008);
});

test('reconnect resumes from notebook prefix and pauses old video copy during the next capture',async()=>{
  const {sender,messages,states,offline,online}=await videoSenderFixture();await sender.enqueue(recordingId);const offer=messages[0];
  sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0});await until(()=>messages.some(message=>message.kind==='video-part'));
  sender.setPaused(true);assert.equal(states.at(-1).state,'paused');assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:0,nextPart:1}),false);
  offline();online();assert.equal(messages.filter(message=>message.kind==='video-offer').length,1);
  sender.setPaused(false);assert.equal(messages.filter(message=>message.kind==='video-offer').length,2);
  sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:1});await until(()=>messages.some(message=>message.kind==='video-part'&&message.index===1));
  assert.equal(messages.filter(message=>message.kind==='video-part'&&message.index===0).length,1);
});

for(const resolutionOrder of [[0,1],[1,0]])test(`a stale chunk read cannot move the resumed sender cursor (${resolutionOrder.join(',')})`,async()=>{
  const blob=new Blob([new Uint8Array(CAMERA_VIDEO_PART_SIZE).fill(17),new Uint8Array(CAMERA_VIDEO_PART_SIZE).fill(34),new Uint8Array(CAMERA_VIDEO_PART_SIZE).fill(51)]);
  const fixture=await videoSenderFixture([blob]),{sender,store,messages,offline,online}=fixture,read=store.getChunk.bind(store),pending=[];
  store.getChunk=(id,index)=>pending.length<2?new Promise(resolve=>pending.push(()=>read(id,index).then(resolve))):read(id,index);
  await sender.enqueue(recordingId);const offer=messages[0],accept=()=>sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0});
  accept();offline();online();accept();assert.equal(pending.length,2);
  for(const index of resolutionOrder){pending[index]();await flush();}
  await until(()=>messages.some(message=>message.kind==='video-part'));
  const parts=messages.filter(message=>message.kind==='video-part');assert.equal(parts.length,1);assert.equal(parts[0].index,0);
  assert.deepEqual(Buffer.from(parts[0].data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,17));assert.equal(sender.active.cursor.absolute,CAMERA_VIDEO_PART_SIZE);
  assert.equal((await store.downloadData(recordingId)).blob.size,blob.size);
});

test('a disconnected paused copy keeps the phone source protected until saved confirmation',async()=>{
  const {sender,messages,offline,online}=await videoSenderFixture();await sender.enqueue(recordingId);const offer=messages[0];
  offline();assert.equal(sender.active.state,'paused');assert.equal(sender.isTransferring(recordingId),true);
  assert.equal(sender.isTransferring('other-recording'),false);
  online();sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:offer.partCount});
  assert.equal(sender.isTransferring(recordingId),false);
});

test('missing source chunks, non-final sources and foreign rooms never confirm a complete copy',async()=>{
  const {sender,messages,states,idb,store}=await videoSenderFixture();
  await store.create({...metadata(),id:'foreign',roomId:'other',state:'stopped',bytes:10,chunkCount:1});await sender.enqueue('foreign');assert.equal(messages.at(-1).kind,'video-unavailable');
  await store.create({...metadata(),id:'active'});await sender.enqueue('active');assert.equal(messages.at(-1).kind,'video-unavailable');
  assert.equal(messages.some(message=>message.kind==='video-offer'),false);
  idb.stores.get('chunks').delete(JSON.stringify([recordingId,1]));await sender.enqueue(recordingId);const offer=messages.find(message=>message.kind==='video-offer');
  sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0});await until(()=>states.at(-1)?.state==='error');
  assert.equal(messages.some(message=>message.kind==='video-complete'),false);assert.equal((await store.get(recordingId)).state,'stopped');
});

test('timeout and channel backpressure preserve the source and offer a resumable retry',async()=>{
  const {sender,messages,states,timeout,backpressure,store}=await videoSenderFixture();await sender.enqueue(recordingId);const offer=messages[0];
  timeout();assert.equal(states.at(-1).state,'error');assert.equal(sender.isTransferring(recordingId),false);
  backpressure(true);await sender.enqueue(recordingId,{force:true});assert.equal(states.at(-1).state,'error');
  backpressure(false);await sender.enqueue(recordingId,{force:true});assert.equal(messages.at(-1).kind,'video-offer');
  assert.notEqual(messages.at(-1).transferId,offer.transferId);assert.equal((await store.downloadData(recordingId)).blob.size,18008);
});

test('a notebook ready receipt after re-offer skips reupload, while premature receipts are ignored',async()=>{
  const {sender,messages,states}=await videoSenderFixture();await sender.enqueue(recordingId);const offer=messages[0];
  assert.equal(sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:0}),false);
  await sender.enqueue(recordingId,{force:true});assert.equal(messages.filter(message=>message.kind==='video-offer').length,1);
  sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:offer.partCount});
  assert.equal(states.at(-1).state,'ready');assert.equal(states.at(-1).percent,100);assert.equal(messages.some(message=>message.kind==='video-part'),false);
});

test('an older rejected copy cannot trap a later completed recording in the sending queue',async()=>{
  const {sender,messages,store}=await videoSenderFixture();const later='later-recording';
  await store.create({...metadata(),id:later,state:'stopped'});await store.append(later,0,new Blob(['later']),1000);
  await sender.enqueue(recordingId);const first=messages[0];await sender.enqueue(later);
  sender.handle({kind:'video-transfer-error',transferId:first.transferId,recordingId});
  await until(()=>messages.some(message=>message.kind==='video-offer'&&message.recordingId===later));
  const abort=messages.findIndex(message=>message.kind==='video-abort'),next=messages.findIndex(message=>message.kind==='video-offer'&&message.recordingId===later);
  assert.ok(abort>0&&abort<next);assert.equal(messages[abort].transferId,first.transferId);assert.equal(messages[abort].recordingId,recordingId);
  assert.equal((await store.get(recordingId)).state,'stopped');assert.equal((await store.get(later)).state,'stopped');
});

test('a sender-only timeout aborts the receiver before a newer offer, retaining abort under channel backpressure',async()=>{
  const {sender,messages,store,timeout,backpressure}=await videoSenderFixture();const later='later-recording';
  await store.create({...metadata(),id:later,state:'stopped'});await store.append(later,0,new Blob(['later']),1000);
  await sender.enqueue(recordingId);await sender.enqueue(later);backpressure(true);timeout();await flush();
  assert.equal(messages.some(message=>message.kind==='video-abort'),false);assert.equal(messages.some(message=>message.kind==='video-offer'&&message.recordingId===later),false);
  backpressure(false);sender.resume();await until(()=>messages.some(message=>message.kind==='video-offer'&&message.recordingId===later));
  const abort=messages.findIndex(message=>message.kind==='video-abort'),next=messages.findIndex(message=>message.kind==='video-offer'&&message.recordingId===later);
  assert.ok(abort>0&&abort<next);
});

const batchedAccept=(sender,offer,nextPart=0)=>sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId:offer.recordingId,nextPart,partsPerMessage:4,maxInFlight:8});
const batchMessages=messages=>messages.filter(message=>message.kind==='video-parts');
const indexedVideo=parts=>new Blob(Array.from({length:parts},(_,index)=>new Uint8Array(CAMERA_VIDEO_PART_SIZE).fill(index+1)),{type:'video/webm'});

test('negotiated video batches bound the uncommitted window to eight parts and accept only sent batch boundaries',async()=>{
  const {sender,messages}=await videoSenderFixture([indexedVideo(16)]);await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);
  await until(()=>batchMessages(messages).length===2);const batches=batchMessages(messages);
  assert.deepEqual(batches.map(message=>message.parts.map(part=>part.index)),[[0,1,2,3],[4,5,6,7]]);assert.equal(sender.active.nextPart,0);assert.equal(sender.active.sendPart,8);
  assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:11,nextPart:12}),false);
  assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:1,nextPart:2}),false);
  assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:3,nextPart:4}),true);
  await until(()=>batchMessages(messages).length===3);assert.equal(sender.active.sendPart-sender.active.nextPart,8);
  assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:3,nextPart:4}),false);
  sender.clearWait();
});

test('batched video copy keeps exact per-part hashes, wire bounds and original bytes until durable completion',async()=>{
  const blobs=[new Blob(['head-']),indexedVideo(14),new Blob(['-tail'])],fixture=await videoSenderFixture(blobs),{sender,messages,states}=fixture;
  await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);const copied=[];
  for(let first=0;first<offer.partCount;first+=4){
    await until(()=>batchMessages(messages).some(message=>message.parts[0].index===first));const batch=batchMessages(messages).find(message=>message.parts[0].index===first);
    assert.ok(JSON.stringify(batch).length<=48*1024);assert.ok(batch.parts.length>=1&&batch.parts.length<=4);assert.ok(sender.active.sendPart-sender.active.nextPart<=8);
    for(const part of batch.parts){const data=Buffer.from(part.data,'base64');copied.push(data);assert.equal(part.sha256,createHash('sha256').update(data).digest('hex'));}
    const last=batch.parts.at(-1).index;assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:last,nextPart:last+1}),true);
  }
  await until(()=>messages.some(message=>message.kind==='video-complete'));assert.equal(states.some(state=>state.state==='ready'),false);
  sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:offer.partCount});assert.equal(states.at(-1).state,'ready');
  assert.deepEqual(Buffer.concat(copied),Buffer.from(await new Blob(blobs).arrayBuffer()));assert.equal((await fixture.store.get(recordingId)).state,'stopped');
});

test('missing or invalid batch capabilities preserve the legacy one-part durable-ACK protocol',async()=>{
  for(const capability of [{},{partsPerMessage:4},{maxInFlight:8},{partsPerMessage:5,maxInFlight:8},{partsPerMessage:4,maxInFlight:9},{partsPerMessage:4,maxInFlight:3},{partsPerMessage:'4',maxInFlight:8}]){
    const {sender,messages}=await videoSenderFixture([indexedVideo(10)]);await sender.enqueue(recordingId);const offer=messages[0];
    sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0,...capability});await until(()=>messages.some(message=>message.kind==='video-part'));
    assert.equal(messages.filter(message=>message.kind==='video-part').length,1);assert.equal(batchMessages(messages).length,0);assert.equal(sender.active.sendPart,1);sender.clearWait();
  }
});

test('negotiated SCTP message size reduces batch size while keeping the eight-part flight bound',async()=>{
  const {sender,messages}=await videoSenderFixture([indexedVideo(10)]);sender.getMaxMessageSize=()=>16384;
  await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);await until(()=>batchMessages(messages).length===8);
  assert.ok(batchMessages(messages).every(message=>message.parts.length===1&&JSON.stringify(message).length<=16384));assert.equal(sender.active.sendPart,8);assert.equal(sender.active.nextPart,0);sender.clearWait();
});

test('a channel smaller than one encoded part preserves the original and reports a resumable failure',async()=>{
  const {sender,messages,states,store}=await videoSenderFixture([indexedVideo(4)]);sender.getMaxMessageSize=()=>1024;
  await sender.enqueue(recordingId);batchedAccept(sender,messages[0]);await until(()=>states.at(-1)?.state==='error');
  assert.equal(batchMessages(messages).length,0);assert.equal(messages.some(message=>message.kind==='video-complete'),false);assert.equal((await store.downloadData(recordingId)).blob.size,4*CAMERA_VIDEO_PART_SIZE);
});

test('a batched reconnect resumes any committed legacy prefix without replaying or skipping original bytes',async()=>{
  const {sender,messages,offline,online}=await videoSenderFixture([indexedVideo(16)]);await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);
  await until(()=>batchMessages(messages).length===2);offline();const before=messages.length;online();batchedAccept(sender,offer,3);
  await until(()=>batchMessages(messages.slice(before)).length===2);const resumed=batchMessages(messages.slice(before)).flatMap(message=>message.parts);
  assert.deepEqual(resumed.map(part=>part.index),[3,4,5,6,7,8,9,10]);for(const part of resumed)assert.deepEqual(Buffer.from(part.data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,part.index+1));
  assert.equal(sender.active.nextPart,3);assert.equal(sender.active.sendPart,11);sender.clearWait();
});

for(const order of [[0,1],[1,0]])test(`a retired batched read cannot advance the resumed window or cursor (${order.join(',')})`,async()=>{
  const {sender,store,messages,offline,online}=await videoSenderFixture([indexedVideo(12)]),read=store.getChunk.bind(store),pending=[];
  store.getChunk=(id,index)=>pending.length<2?new Promise(resolve=>pending.push(()=>read(id,index).then(resolve))):read(id,index);
  await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);offline();online();batchedAccept(sender,offer);assert.equal(pending.length,2);
  for(const index of order){pending[index]();await flush();}
  await until(()=>batchMessages(messages).length===2);const parts=batchMessages(messages).flatMap(message=>message.parts);
  assert.deepEqual(parts.map(part=>part.index),[0,1,2,3,4,5,6,7]);for(const part of parts)assert.deepEqual(Buffer.from(part.data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,part.index+1));
  assert.equal(sender.active.cursor.absolute,8*CAMERA_VIDEO_PART_SIZE);assert.equal(sender.active.nextPart,0);sender.clearWait();
});

test('batch backpressure preserves original bytes and resumes from the notebook durable prefix',async()=>{
  const {sender,messages,states,store}=await videoSenderFixture([indexedVideo(12)]),send=sender.send;let batches=0;
  sender.send=message=>message.kind==='video-parts'&&++batches===2?false:send(message);
  await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);await until(()=>states.at(-1)?.state==='error');
  assert.equal(messages.some(message=>message.kind==='video-abort'),true);assert.equal(messages.some(message=>message.kind==='video-complete'),false);
  sender.send=send;const before=messages.length;await sender.enqueue(recordingId,{force:true});batchedAccept(sender,messages.at(-1),4);await until(()=>batchMessages(messages.slice(before)).length===2);
  const parts=batchMessages(messages.slice(before)).flatMap(message=>message.parts);assert.deepEqual(parts.map(part=>part.index),[4,5,6,7,8,9,10,11]);for(const part of parts)assert.deepEqual(Buffer.from(part.data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,part.index+1));
  assert.equal((await store.downloadData(recordingId)).blob.size,12*CAMERA_VIDEO_PART_SIZE);sender.clearWait();
});

test('a later durable batch ACK can advance the committed prefix when an earlier ACK was not delivered',async()=>{
  const {sender,messages}=await videoSenderFixture([indexedVideo(16)]);await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);
  await until(()=>batchMessages(messages).length===2);assert.equal(sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:7,nextPart:8}),true);
  await until(()=>batchMessages(messages).length===4);assert.equal(sender.active.nextPart,8);assert.equal(sender.active.sendPart,16);assert.equal(sender.active.pending.length,2);sender.clearWait();
});

for(const batched of [false,true])test(`a failed ${batched?'batched':'legacy'} attempt cannot poison its retry with delayed replies`,async()=>{
  const {sender,messages}=await videoSenderFixture([indexedVideo(12)]);await sender.enqueue(recordingId);const first=messages[0];
  if(batched)batchedAccept(sender,first);else sender.handle({kind:'video-accept',transferId:first.transferId,recordingId,nextPart:0});
  await until(()=>messages.some(message=>message.kind===(batched?'video-parts':'video-part')));
  sender.handle({kind:'video-transfer-error',transferId:first.transferId,recordingId});await sender.enqueue(recordingId,{force:true});const retry=messages.at(-1);
  assert.equal(retry.kind,'video-offer');assert.notEqual(retry.transferId,first.transferId);
  for(const reply of [{kind:'video-transfer-error'},{kind:'video-ack',index:3,nextPart:4},{kind:'video-saved',nextPart:first.partCount}])assert.equal(sender.handle({...reply,transferId:first.transferId,recordingId}),false);
  assert.equal(sender.active.state,'offering');const before=messages.length,prefix=batched?4:1;
  if(batched)batchedAccept(sender,retry,prefix);else sender.handle({kind:'video-accept',transferId:retry.transferId,recordingId,nextPart:prefix});
  await until(()=>messages.slice(before).some(message=>message.kind===(batched?'video-parts':'video-part')));const message=messages.slice(before).find(message=>message.kind===(batched?'video-parts':'video-part')),part=batched?message.parts[0]:message;
  assert.equal(part.index,prefix);assert.deepEqual(Buffer.from(part.data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,prefix+1));sender.clearWait();
});

test('a reconnect to a legacy receiver discards negotiated batching and preserves its committed prefix',async()=>{
  const {sender,messages,offline,online}=await videoSenderFixture([indexedVideo(12)]);await sender.enqueue(recordingId);const offer=messages[0];batchedAccept(sender,offer);
  await until(()=>batchMessages(messages).length===2);offline();const before=messages.length;online();sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:4});
  await until(()=>messages.slice(before).some(message=>message.kind==='video-part'));const sent=messages.slice(before),part=sent.find(message=>message.kind==='video-part');
  assert.equal(batchMessages(sent).length,0);assert.equal(sent.filter(message=>message.kind==='video-part').length,1);assert.equal(part.index,4);assert.deepEqual(Buffer.from(part.data,'base64'),Buffer.alloc(CAMERA_VIDEO_PART_SIZE,5));
  assert.equal(sender.active.nextPart,4);assert.equal(sender.active.sendPart,5);sender.clearWait();
});

test('missing phone source explicitly reports unavailable without exposing another room or starting an offer',async()=>{
  const {sender,messages,store}=await videoSenderFixture();await sender.enqueue('missing',{force:true});
  assert.deepEqual(messages.at(-1),{kind:'video-unavailable',recordingId:'missing',error:'Vídeo não disponível neste celular para esta conexão.'});
  await store.create({...metadata(),id:'foreign',roomId:'private-other-room',state:'stopped',bytes:10,chunkCount:1});await sender.enqueue('foreign',{force:true});
  assert.equal(messages.at(-1).kind,'video-unavailable');assert.equal(JSON.stringify(messages).includes('private-other-room'),false);assert.equal(messages.some(message=>message.kind==='video-offer'),false);
});

test('rear main lens preference avoids known ultra-wide, telephoto and front labels without guessing unnamed optics',()=>{
  const devices=[{kind:'videoinput',deviceId:'ultra',label:'Back Ultra Wide Camera'},{kind:'videoinput',deviceId:'front',label:'Front Main Camera'},{kind:'videoinput',deviceId:'tele',label:'Back Telephoto Camera'},{kind:'videoinput',deviceId:'main',label:'Back Main Camera'}];
  assert.equal(preferredCameraDevice(devices,'ultra'),'main');
  assert.equal(preferredCameraDevice([{kind:'videoinput',deviceId:'unknown',label:''}],'current'),'current');
  assert.equal(preferredCameraDevice(devices.filter(device=>device.deviceId!=='main'),'ultra'),'ultra');
  assert.deepEqual(cameraCaptureConstraints('landscape','main').video.deviceId,{exact:'main'});
  assert.equal(cameraCaptureConstraints('landscape','main').video.facingMode,undefined);
});

test('generic camera numbers and rear labels never imply a main 1x lens',()=>{
  const devices=[{kind:'videoinput',deviceId:'camera0',label:'camera0, facing back'},{kind:'videoinput',deviceId:'camera1',label:'camera1, facing front'},{kind:'videoinput',deviceId:'camera2',label:'camera2, facing back'}];
  assert.equal(preferredCameraDevice(devices,'camera2'),'camera2');
  assert.equal(preferredCameraDevice([...devices].reverse(),'camera0'),'camera0');
  assert.equal(preferredCameraDevice([...devices,{kind:'videoinput',deviceId:'labelled',label:'Câmera traseira principal'}],'camera2'),'labelled');
});

test('camera display names describe supported lens labels without exposing browser names or guessing 1x from a number',()=>{
  assert.equal(cameraDisplayName('camera0, facing back'),'Traseira 1');
  assert.equal(cameraDisplayName('camera2, facing back',2),'Traseira 3');
  assert.equal(cameraDisplayName('camera1, facing front',1),'Frontal 2');
  assert.equal(cameraDisplayName('Back Main Camera'),'Traseira · principal');
  assert.equal(cameraDisplayName('Back Ultra Wide Camera'),'Traseira · ultra-angular');
  assert.equal(cameraDisplayName('',0),'Câmera 1');assert.equal(cameraDisplayName('',0,'environment'),'Traseira 1');
  assert.equal(cameraFacingMode('camera0'),'');assert.equal(cameraFacingMode('camera1, facing front'),'user');assert.equal(cameraFacingMode('camera0, facing back'),'environment');
  assert.equal(cameraFacingMode('Front Camera','environment'),'environment');
});

test('hardware zoom reset requests one only inside reported capabilities and tolerates unsupported constraints',async()=>{
  const calls=[];await resetCameraZoom({getCapabilities:()=>({zoom:{min:1,max:8}}),applyConstraints:async value=>calls.push(value)});
  assert.deepEqual(calls,[{advanced:[{zoom:1}]}]);
  await resetCameraZoom({getCapabilities:()=>({zoom:{min:2,max:8}}),applyConstraints:async()=>{throw new Error('must not request zoom');}});
  await resetCameraZoom({getCapabilities:()=>({zoom:{min:1,max:8}}),applyConstraints:async()=>{throw new Error('Unsupported');}});
  await resetCameraZoom({});
});

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
  const transport=new CameraTransport({roomId,token},{fetcher,Peer:class{constructor(){return peer;}},storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},clock:()=>({recordingId,startEpochMs:1000,timeMs:200,senderEpochMs:6200,pausedMs:5000,state:'recording',recording:true,segmentId:1}),onMessage:data=>received.push(data),onState:state=>states.push(state)});
  await transport.connect({getTracks:()=>[{}]});await new Promise(resolve=>setImmediate(resolve));
  peer.channel.onopen();peer.channel.onmessage({data:JSON.stringify({kind:'ping',id:'ping',sentEpochMs:123})});peer.channel.onmessage({data:JSON.stringify({kind:'point',point})});
  assert.equal(states.at(-1),'connected');peer.channel.onclose();assert.equal(states.at(-1),'offline');peer.channel.onerror();assert.equal(states.at(-1),'offline');
  transport.disconnect();
  const afterClose=states.length;peer.channel.onclose();assert.equal(states.length,afterClose);
  const offer=calls.findIndex(c=>c.body?.type==='offer'),ice=calls.findIndex(c=>c.body?.type==='ice');assert.ok(ice>offer);assert.equal(calls[ice].body.generation,1);assert.equal(peer.remoteDescription.sdp,'answer-sdp');
  assert.ok(calls.every(c=>!c.url.includes(token)&&c.headers['X-GoAtleta-Live-Token']===token));
  assert.equal(messages[0].kind,'recording');assert.equal(messages[1].kind,'pong');assert.equal(messages[1].timeMs,200);assert.equal(messages[1].cameraEpochMs,6200);assert.equal(received[0].point.id,point.id);
});

async function connectedTransportFixture(onState=()=>{}) {
  const states=[],messages=[],received=[],peers=[];let nextFailure;
  class Peer {
    constructor(){this.connectionState='connected';this.signalingState='stable';this.remoteDescription={type:'answer',sdp:'answer'};peers.push(this);}
    addTrack(){}
    createDataChannel(){this.channel={readyState:'open',bufferedAmount:0,send:value=>messages.push(JSON.parse(value)),close(){this.readyState='closed';}};return this.channel;}
    async createOffer(){return{type:'offer',sdp:'offer'};}
    async setLocalDescription(value){this.localDescription=value;}
    async addIceCandidate(){}
    close(){this.connectionState='closed';}
  }
  const transport=new CameraTransport({roomId,token},{Peer,storage:{getItem:()=>null,setItem(){}},onState:state=>{states.push(state);onState(state);},onMessage:value=>received.push(value),fetcher:async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null,kind=url.includes('/signals?')?'poll':url.endsWith('/heartbeat')?'heartbeat':body?.type==='ice'?'ice':'';
    if(nextFailure&&kind&&(!nextFailure.kind||nextFailure.kind===kind)){const {error}=nextFailure;nextFailure=null;if(error.status)return{ok:false,json:async()=>({error:'Conexão indisponível.'}),status:error.status};throw error;}
    const result=url.endsWith('/join')?{cameraClientId:'client',generation:0,cursor:0}:body?.type==='offer'?{generation:1}:url.includes('/signals?')?{cursor:0,signals:[]}:{};
    return{ok:true,json:async()=>result};
  }});
  const reconnect=async()=>{await transport.connect(null);await new Promise(resolve=>setImmediate(resolve));clearTimeout(transport.pollTimer);clearInterval(transport.heartbeatTimer);peers.at(-1).channel.onopen();};
  await reconnect();
  return {transport,states,messages,received,peers,reconnect,failNext:(error,kind)=>{nextFailure={error,kind};},poll:async()=>{await transport.poll();clearTimeout(transport.pollTimer);},ice:async()=>{peers.at(-1).onicecandidate({candidate:{toJSON:()=>({candidate:'candidate:local',sdpMid:'0',sdpMLineIndex:0})}});await transport.signalWrites;}};
}

async function negotiatingTransportFixture(){
  const states=[],peers=[],timers=new Map();let nextTimer=0;
  class Peer {
    constructor(){this.connectionState='connecting';this.signalingState='have-local-offer';peers.push(this);}
    createDataChannel(){return this.channel={readyState:'connecting',bufferedAmount:0,close(){this.readyState='closed';},send(){}};}
    async createOffer(){return{type:'offer',sdp:'offer'};}
    async setLocalDescription(value){this.localDescription=value;}
    close(){this.connectionState='closed';}
  }
  const transport=new CameraTransport({roomId,token},{Peer,storage:{getItem:()=>null,setItem(){}},onState:(state,message)=>states.push({state,message}),setTimer:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async(url,options)=>({ok:true,json:async()=>url.endsWith('/join')?{cameraClientId:'client',generation:0,cursor:0}:options.method==='POST'?{generation:peers.length}:{cursor:0,signals:[]}})});
  const connect=async()=>{await transport.connect(null);await flush();clearTimeout(transport.pollTimer);clearInterval(transport.heartbeatTimer);};
  await connect();
  return{transport,states,peers,timers,connect,deadline:()=>timers.get(transport.negotiationTimer),open:()=>{const peer=peers.at(-1);peer.connectionState='connected';peer.channel.readyState='open';peer.channel.onopen();}};
}

test('healthy HTTP signaling cannot leave an unopened paired RTC channel connecting forever',async()=>{
  const fixture=await negotiatingTransportFixture();
  try{
    const deadline=fixture.deadline();assert.equal(deadline.ms,20000);await fixture.transport.heartbeat();
    assert.equal(fixture.states.at(-1).state,'connecting');assert.equal(fixture.deadline(),deadline);
    deadline.fn();assert.equal(fixture.states.at(-1).state,'offline');assert.match(fixture.states.at(-1).message,/não foi estabelecida/);
    assert.equal(fixture.transport.stopped,true);assert.equal(fixture.transport.peer,null);assert.equal(fixture.peers[0].connectionState,'closed');assert.equal(fixture.peers[0].channel.readyState,'closed');
    await fixture.connect();assert.equal(fixture.peers.length,2);assert.equal(fixture.states.at(-1).state,'connecting');fixture.open();assert.equal(fixture.states.at(-1).state,'connected');
  }finally{fixture.transport.disconnect();}
});

test('opening the paired data channel cancels its negotiation deadline without interrupting copy',async()=>{
  const fixture=await negotiatingTransportFixture();
  try{
    const deadline=fixture.deadline();fixture.open();assert.equal(fixture.transport.negotiationTimer,null);assert.equal(fixture.timers.size,0);
    deadline.fn();assert.equal(fixture.states.at(-1).state,'connected');assert.equal(fixture.transport.peer,fixture.peers[0]);assert.equal(fixture.transport.stopped,false);
  }finally{fixture.transport.disconnect();}
});

test('retired negotiation deadlines cannot close replacement peers and disconnect cancels the current deadline',async()=>{
  const fixture=await negotiatingTransportFixture();
  try{
    const retired=fixture.deadline();await fixture.connect();const current=fixture.transport.peer,currentTimer=fixture.transport.negotiationTimer;
    retired.fn();assert.equal(fixture.transport.peer,current);assert.equal(fixture.transport.negotiationTimer,currentTimer);assert.equal(fixture.timers.size,1);
    const deadline=fixture.deadline();fixture.transport.disconnect();assert.equal(fixture.timers.size,0);const stateCount=fixture.states.length;deadline.fn();assert.equal(fixture.states.length,stateCount);
  }finally{fixture.transport.disconnect();}
});

test('a transient signaling poll failure cannot pause a healthy original-video copy or require a new QR',async()=>{
  let sender,connection='idle';
  const fixture=await connectedTransportFixture(state=>{connection=state;if(state==='connected')sender?.resume();else if(state==='offline'||state==='connecting')sender?.disconnected();});
  const blob=new Blob(['future-video-original'],{type:'video/webm'});
  sender=new CameraVideoSender({roomId,crypto:webcrypto,store:{get:async()=>({...metadata(),state:'stopped',bytes:blob.size,chunkCount:1,mimeType:blob.type}),getChunk:async()=>({recordingId,index:0,blob})},connected:()=>connection==='connected',send:value=>fixture.transport.send(value)});
  try{
    await sender.enqueue(recordingId);const offer=fixture.messages.find(value=>value.kind==='video-offer');
    sender.handle({kind:'video-accept',transferId:offer.transferId,recordingId,nextPart:0});await until(()=>fixture.messages.some(value=>value.kind==='video-part'));
    fixture.failNext(new TypeError('Transient local signaling failure'));await fixture.poll();
    assert.equal(connection,'connected');assert.equal(sender.active.state,'sending');assert.notEqual(sender.timer,null);
    await fixture.poll();
    sender.handle({kind:'video-ack',transferId:offer.transferId,recordingId,index:0,nextPart:1});await until(()=>fixture.messages.some(value=>value.kind==='video-complete'));
    sender.handle({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:1});assert.equal(sender.saved.has(recordingId),true);
    assert.equal(fixture.peers.length,1);assert.equal(fixture.messages.filter(value=>value.kind==='video-offer').length,1);
  }finally{sender.clearWait();fixture.transport.disconnect();}
});

test('heartbeat and ICE signaling recover without republishing an already healthy connection',async()=>{
  const fixture=await connectedTransportFixture();
  try{
    const connectedCount=fixture.states.filter(value=>value==='connected').length;
    fixture.failNext(new TypeError('Temporary heartbeat failure'),'heartbeat');await fixture.transport.heartbeat();await fixture.transport.heartbeat();
    fixture.failNext(new TypeError('Temporary ICE failure'),'ice');await fixture.ice();await fixture.ice();
    await fixture.poll();await fixture.poll();
    assert.equal(fixture.states.at(-1),'connected');assert.equal(fixture.states.filter(value=>value==='connected').length,connectedCount);assert.equal(fixture.states.includes('offline'),false);
  }finally{fixture.transport.disconnect();}
});

test('signaling success restores an interrupted state once only when the current RTC peer and data channel are healthy',async()=>{
  const fixture=await connectedTransportFixture();
  try{
    const peer=fixture.peers[0],connectedCount=fixture.states.filter(value=>value==='connected').length;
    peer.connectionState='connecting';fixture.failNext(new TypeError('Temporary failure'));await fixture.poll();assert.equal(fixture.states.at(-1),'offline');
    await fixture.poll();assert.equal(fixture.states.at(-1),'offline');
    peer.connectionState='connected';await fixture.poll();assert.equal(fixture.states.at(-1),'connected');
    await fixture.poll();await fixture.transport.heartbeat();assert.equal(fixture.states.filter(value=>value==='connected').length,connectedCount+1);
    peer.channel.readyState='closed';peer.channel.onclose();assert.equal(fixture.states.at(-1),'offline');
    await fixture.poll();await fixture.transport.heartbeat();peer.channel.onopen();assert.equal(fixture.states.at(-1),'offline');
  }finally{fixture.transport.disconnect();}
});

test('authorization failures and expired rooms remain terminal for poll, heartbeat and ICE even while RTC is open',async()=>{
  for(const kind of ['poll','heartbeat','ice'])for(const status of [401,403,404,410]){
    const fixture=await connectedTransportFixture();
    try{
      fixture.failNext({status},kind);if(kind==='poll')await fixture.poll();else if(kind==='heartbeat')await fixture.transport.heartbeat();else await fixture.ice();
      assert.equal(fixture.transport.stopped,true,`${kind}/${status}`);assert.equal(fixture.transport.channel,null);assert.equal(fixture.peers[0].channel.readyState,'closed');assert.equal(fixture.states.at(-1),'offline');
    }finally{fixture.transport.disconnect();}
  }
});

test('retired data channels and delayed signaling failures cannot change or deliver commands to a replacement peer',async()=>{
  const fixture=await connectedTransportFixture();let rejectHeartbeat;
  const fetcher=fixture.transport.fetcher;
  fixture.transport.fetcher=(url,options)=>url.endsWith('/heartbeat')?new Promise((_resolve,reject)=>{rejectHeartbeat=reject;}):fetcher(url,options);
  const prior=fixture.peers[0],pending=fixture.transport.heartbeat();
  try{
    await fixture.reconnect();const current=fixture.transport.peer,count=fixture.states.length;
    prior.channel.readyState='open';prior.channel.onmessage({data:JSON.stringify({kind:'stop-recording',recordingId})});prior.channel.onopen();prior.channel.onclose();prior.channel.onerror();prior.onconnectionstatechange();
    const failure=new Error('Old room expired');failure.status=410;rejectHeartbeat(failure);await pending;
    assert.equal(fixture.transport.peer,current);assert.equal(fixture.transport.stopped,false);assert.equal(fixture.states.length,count);assert.deepEqual(fixture.received,[]);
    current.channel.onmessage({data:JSON.stringify({kind:'stop-recording',recordingId})});assert.deepEqual(fixture.received,[{kind:'stop-recording',recordingId}]);
  }finally{fixture.transport.disconnect();}
});

test('recording MIME selection is capability based and can fail without a false supported format',()=>{
  assert.equal(chooseRecordingMime({isTypeSupported:()=>true}),'video/webm;codecs=vp8,opus');
  assert.equal(chooseRecordingMime({isTypeSupported:type=>type==='video/webm'}),'video/webm');
  const checked=[];assert.equal(chooseRecordingMime({isTypeSupported:type=>(checked.push(type),type==='video/mp4')}),'video/mp4');
  assert.deepEqual(checked,['video/webm;codecs=vp8,opus','video/webm','video/mp4']);
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

for(const path of ['/join','/signals'])test(`a stalled ${path} request times out in Portuguese and aborts the fetch`,async()=>{
  let timeout,signal,delay,cleared=0;
  const transport=new CameraTransport({roomId,token},{fetcher:(_url,options)=>{signal=options.signal;return new Promise(()=>{});},setTimer:(fn,ms)=>{timeout=fn;delay=ms;return 1;},clearTimer:()=>{cleared++;}});
  const request=path==='/join'?transport.connect(null):transport.api(path,{method:'POST',body:{}}),rejected=assert.rejects(request,error=>error.name==='TimeoutError'&&/demorou.*reconectar/.test(error.message));
  assert.equal(delay,10000);assert.equal(signal.aborted,false);timeout();await rejected;
  assert.equal(signal.aborted,true);assert.equal(transport.apiRequests.size,0);assert.equal(cleared,1);transport.disconnect();
});

test('the signaling deadline also bounds a response body and disconnect cancels outstanding requests',async()=>{
  let timeout,signal;
  const transport=new CameraTransport({roomId,token},{fetcher:async(_url,options)=>{signal=options.signal;return{ok:true,json:()=>new Promise(()=>{})};},setTimer:fn=>(timeout=fn,1),clearTimer:()=>{}});
  const first=transport.api('/heartbeat'),timed=assert.rejects(first,error=>error.name==='TimeoutError');await flush();timeout();await timed;assert.equal(signal.aborted,true);
  const second=transport.api('/signals'),canceled=assert.rejects(second,error=>error.name==='AbortError'&&error.message==='Conexão cancelada.');transport.disconnect();await canceled;assert.equal(signal.aborted,true);assert.equal(transport.apiRequests.size,0);
});

test('capture preferences keep primary sensor axes and release orientation locks without entering fullscreen',()=>{
  assert.deepEqual([cameraCaptureConstraints().video.width.ideal,cameraCaptureConstraints().video.height.ideal],[1920,1080]);
  assert.deepEqual([cameraCaptureConstraints('portrait').video.width.ideal,cameraCaptureConstraints('portrait').video.height.ideal],[1920,1080]);
  assert.deepEqual(cameraCaptureConstraints().video.frameRate,{min:59.94,ideal:60,max:60});
  assert.deepEqual(cameraCaptureConstraints('portrait','rear-main').video.deviceId,{exact:'rear-main'});
  assert.equal(cameraCaptureConstraints().audio,true);
  assert.throws(()=>cameraCaptureConstraints('diagonal'));
  const calls=[],window={document:{fullscreenElement:null},screen:{orientation:{unlock(){calls.push('unlock');},lock(){throw new Error('Must not lock');}}}};
  releaseCameraOrientation(window);assert.deepEqual(calls,['unlock']);assert.equal(window.document.fullscreenElement,null);
  assert.doesNotThrow(()=>releaseCameraOrientation({screen:{orientation:{unlock(){throw new Error('Unsupported');}}}}));
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

function cameraFixture({enumerateDevices,localStorage,pairing=true}={}){
  const nodes=new Map(),listeners=new Map(),requests=[],messages=[],tracks=[],instances=[];let now=500,sequence=0;
  const timers=new Map();let timerSequence=0;
  class Node{
    constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.listeners=new Map();this.pauseCalls=0;}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(name,value){this[name]=value;}focus(){this.focusCalls=(this.focusCalls??0)+1;}click(){this.onclick?.();}
    querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
    addEventListener(name,listener){const set=this.listeners.get(name)??new Set();set.add(listener);this.listeners.set(name,set);}async play(){if(this.srcObject){const frame=this.srcObject.previewDimensions??this.srcObject.getVideoTracks()[0].getSettings();this.videoWidth=frame.width;this.videoHeight=frame.height;}}pause(){this.pauseCalls++;}
  }
  const document={fullscreenElement:null,hidden:false,getElementById:id=>{if(!nodes.has(id)){const node=new Node(id==='preview'?'video':id==='recordings-panel'?'dialog':'div');if(id==='recordings-panel'){node.open=false;node.showModalCalls=0;node.showModal=()=>{node.open=true;node.showModalCalls++;};node.close=()=>{node.open=false;for(const callback of node.listeners.get('close')??[])callback();};}nodes.set(id,node);}return nodes.get(id);},createElement:tag=>new Node(tag),addEventListener(name,fn){listeners.set(name,fn);}};
  const stream={getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(track=>track.kind==='video')};
  for(const kind of ['video','audio']){const track=new EventTarget();track.kind=kind;track.stopped=false;track.stop=()=>{track.stopped=true;track.dispatchEvent(new Event('ended'));};track.getSettings=()=>({width:1920,height:1080,frameRate:30});tracks.push(track);}
  class Recorder extends EventTarget{
    static isTypeSupported(type){return type==='video/webm';}
    constructor(source){super();this.source=source;this.state='inactive';this.mimeType='video/webm';this.stopCalls=0;instances.push(this);}
    start(){this.state='recording';queueMicrotask(()=>this.onstart?.());}
    pause(){this.state='paused';queueMicrotask(()=>this.onpause?.());}
    resume(){this.state='recording';queueMicrotask(()=>this.onresume?.());}
    stop(){this.stopCalls++;this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['last-chunk'])});this.dispatchEvent(new Event('stop'));});}
  }
  const session=new Map(),local=new Map();
  const window={document,isSecureContext:true,location:{hash:pairing?`#room=${roomId}&token=${token}`:'',pathname:'/camera'},history:{replaceState(){}},sessionStorage:{setItem:(key,value)=>session.set(key,value),getItem:key=>session.get(key)??null},localStorage:localStorage??{setItem:(key,value)=>local.set(key,value),getItem:key=>local.get(key)??null},crypto:{randomUUID:()=>sequence++?`${recordingId}-${sequence}`:recordingId},performance:{now:()=>now},navigator:{mediaDevices:{...(enumerateDevices?{enumerateDevices}:{}),getUserMedia:async constraints=>{requests.push(constraints);return stream;}}},MediaRecorder:Recorder,RTCPeerConnection:class{},screen:{orientation:{lock:async()=>{},addEventListener(name,fn){listeners.set(`orientation:${name}`,fn);}}},addEventListener(name,fn){listeners.set(name,fn);},setInterval:()=>1,setTimeout:(callback,delay)=>{const id=++timerSequence;if(delay===250||delay===500)queueMicrotask(callback);else timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),URL:{},confirm:()=>false};
  document.getElementById('camera-app').requestFullscreen=async()=>{document.fullscreenElement=document.getElementById('camera-app');};
  const idb=memoryIdb(),store=new CameraRecordingStore(idb.factory),connections=[];let transportOptions,disconnects=0;
  const app=bootCamera(document,window,{store,transportFactory:(_pair,options)=>{transportOptions=options;return{connect:async source=>{connections.push(source);options.onState('connected');},disconnect(){disconnects++;},send:message=>messages.push(message)};}});
  return {app,nodes,window,store,idb,requests,messages,tracks,instances,connections,timers,runTimer:delay=>{const entry=[...timers].find(([,value])=>value.delay===delay);assert.ok(entry,`timer ${delay} exists`);timers.delete(entry[0]);entry[1].callback();},dispatch:(name,event)=>listeners.get(name)?.(event),disconnects:()=>disconnects,advance:ms=>{now+=ms;},receive:message=>transportOptions.onMessage(message),clock:()=>transportOptions.clock(),connection:(state,message)=>transportOptions.onState(state,message)};
}

function lensStream(deviceId,label){
  let zoom=.6;
  const track=new EventTarget();track.kind='video';track.label=label;track.readyState='live';track.stopped=false;
  track.getSettings=()=>({deviceId,width:1920,height:1080,frameRate:29.97,zoom});
  track.getCapabilities=()=>({zoom:{min:1,max:8}});track.applyConstraints=async constraints=>{zoom=constraints.advanced[0].zoom;};
  track.stop=()=>{track.stopped=true;track.readyState='ended';track.dispatchEvent(new Event('ended'));};
  return {getTracks:()=>[track],getVideoTracks:()=>[track],track};
}
function installLensDevices(fixture,devices=[{kind:'videoinput',deviceId:'ultra',label:'Back Ultra Wide Camera'},{kind:'videoinput',deviceId:'main',label:'Back Main Camera'}]){
  const streams=[],unavailable=new Set(),redirect=new Map(),facingOverrides=new Map();
  fixture.window.navigator.mediaDevices.enumerateDevices=async()=>devices;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{
    fixture.requests.push(constraints);const requested=constraints.video.deviceId?.exact??devices[0]?.deviceId;
    if(streams.some(source=>source.track.readyState==='live')||unavailable.has(requested))throw Object.assign(new Error('Camera busy'),{name:'NotReadableError'});
    const id=redirect.get(requested)??requested,next=lensStream(id,devices.find(device=>device.deviceId===id)?.label),settings=next.track.getSettings;
    next.track.getSettings=()=>({...settings(),facingMode:facingOverrides.get(id)||devices.find(device=>device.deviceId===id)?.facingMode});streams.push(next);return next;
  };
  return {streams,devices,unavailable,redirect,facingOverrides};
}

for(const frameRate of [29.97,59.94])test(`camera requests 60 fps and reports the configured ${frameRate} fps with the selected rear source`,async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture),request=fixture.window.navigator.mediaDevices.getUserMedia;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{const source=await request(constraints),settings=source.track.getSettings;source.track.getSettings=()=>({...settings(),frameRate});return source;};
  await flush();await fixture.nodes.get('prepare').onclick();
  assert.equal(fixture.requests.length,2);assert.equal(fixture.requests[1].video.deviceId.exact,'main');
  assert.equal(lens.streams[0].track.stopped,true);assert.equal(lens.streams[1].track.stopped,false);
  assert.equal(fixture.nodes.get('camera-source').value,'main');assert.equal(fixture.nodes.get('camera-source').disabled,false);
  assert.equal(fixture.requests[1].video.frameRate.ideal,60);
  assert.match(fixture.nodes.get('capture-info').textContent,new RegExp(`Traseira · principal.*1920 × 1080.*${Math.round(frameRate)} fps configurados.*zoom 1.0`));
  const capture=fixture.messages.findLast(message=>message.kind==='camera-status').capture;
  assert.equal(capture.label,'Back Main Camera');assert.equal(capture.width,1920);assert.equal(capture.deviceId,undefined);assert.equal(capture.frameRate,frameRate);
  await fixture.nodes.get('start').onclick();await flush();
  assert.equal(fixture.nodes.get('camera-source').disabled,true);
  const meta=await fixture.store.get(recordingId);assert.equal(meta.cameraLabel,'Back Main Camera');assert.equal(meta.cameraZoom,1);assert.equal(meta.frameRate,frameRate);
  await fixture.nodes.get('stop').onclick();await flush();
});

test('single-camera hardware switches preview only after releasing tracks and reacquires the prior device on failure',async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture);await flush();await fixture.nodes.get('prepare').onclick();
  fixture.nodes.get('camera-source').value='ultra';await fixture.nodes.get('camera-source').onchange();await flush();
  assert.equal(fixture.nodes.get('camera-source').value,'ultra');assert.equal(fixture.requests.at(-1).video.deviceId.exact,'ultra');
  const current=fixture.nodes.get('preview').srcObject;assert.equal(current.track.label,'Back Ultra Wide Camera');
  lens.unavailable.add('main');
  fixture.nodes.get('camera-source').value='main';await fixture.nodes.get('camera-source').onchange();await flush();
  const restored=fixture.nodes.get('preview').srcObject;
  assert.notEqual(restored,current);assert.equal(current.track.stopped,true);assert.equal(restored.track.readyState,'live');assert.equal(fixture.nodes.get('camera-source').value,'ultra');
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'ultra');assert.match(fixture.nodes.get('error').textContent,/câmera anterior foi reaberta/);
  assert.equal(fixture.disconnects(),0);assert.equal(fixture.nodes.get('camera-app').dataset.connection,'connected');
  await fixture.nodes.get('start').onclick();await flush();const requests=fixture.requests.length;
  fixture.nodes.get('camera-source').value='main';await fixture.nodes.get('camera-source').onchange();assert.equal(fixture.requests.length,requests);assert.equal(fixture.nodes.get('camera-source').value,'ultra');assert.equal(restored.track.stopped,false);
  await fixture.nodes.get('pause').onclick();await flush();fixture.nodes.get('camera-source').value='main';await fixture.nodes.get('camera-source').onchange();assert.equal(fixture.requests.length,requests);assert.equal(restored.track.stopped,false);
  await fixture.nodes.get('stop').onclick();await flush();
});

test('unavailable automatic main lens reopens the actual original camera instead of reusing ended tracks',async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture);await flush();lens.unavailable.add('main');
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'preview');
  assert.equal(fixture.requests.length,5);assert.equal(fixture.requests.at(-1).video.deviceId.exact,'ultra');
  assert.equal(lens.streams[0].track.stopped,true);assert.notEqual(fixture.nodes.get('preview').srcObject,lens.streams[0]);
  assert.equal(fixture.nodes.get('preview').srcObject.track.readyState,'live');assert.equal(fixture.nodes.get('camera-source').value,'ultra');
  assert.match(fixture.nodes.get('error').textContent,/preferida não abriu.*outra câmera/);
});

test('failed target and rollback leave the camera honestly off while keeping the paired control connection',async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture);await flush();await fixture.nodes.get('prepare').onclick();
  const old=fixture.nodes.get('preview').srcObject;lens.unavailable.add('main');lens.unavailable.add('ultra');
  fixture.nodes.get('camera-source').value='ultra';await fixture.nodes.get('camera-source').onchange();await flush();
  assert.equal(old.track.stopped,true);assert.equal(fixture.nodes.get('preview').srcObject,null);assert.equal(fixture.app.getState().phase,'idle');
  assert.equal(fixture.nodes.get('camera-app').dataset.cameraActive,'false');assert.equal(fixture.nodes.get('start').disabled,true);assert.equal(fixture.nodes.get('prepare').disabled,false);
  assert.match(fixture.nodes.get('error').textContent,/câmera está desligada/);assert.doesNotMatch(fixture.nodes.get('error').textContent,/mantida|reaberta/);
  assert.equal(fixture.disconnects(),0);assert.equal(fixture.nodes.get('camera-app').dataset.connection,'connected');assert.equal(fixture.clock().recordingId,undefined);
  assert.equal(fixture.messages.findLast(message=>message.kind==='camera-status').state,'off');
});

test('a different actual device cannot masquerade as a successful manual lens selection',async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture);await flush();await fixture.nodes.get('prepare').onclick();
  const old=fixture.nodes.get('preview').srcObject;lens.redirect.set('ultra','main');
  fixture.nodes.get('camera-source').value='ultra';await fixture.nodes.get('camera-source').onchange();await flush();
  assert.equal(old.track.stopped,true);assert.equal(lens.streams.at(-2).track.stopped,true);
  assert.equal(fixture.nodes.get('preview').srcObject.track.getSettings().deviceId,'main');assert.equal(fixture.nodes.get('camera-source').value,'main');
  assert.match(fixture.nodes.get('error').textContent,/Não foi possível trocar a lente.*anterior foi reaberta/);
});

test('quality constraint fallback retains the exact selected lens rather than silently choosing a different camera',async()=>{
  const fixture=cameraFixture();await flush();
  fixture.window.navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'ultra',label:'camera2, facing back'},{kind:'videoinput',deviceId:'main',label:'camera0, facing back'}];
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{fixture.requests.push(constraints);if(constraints.video.width&&constraints.video.deviceId)throw Object.assign(new Error('Unsupported size'),{name:'OverconstrainedError'});return lensStream(constraints.video.deviceId?.exact??'ultra','camera, facing back');};
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'preview');
  fixture.nodes.get('camera-source').value='main';await fixture.nodes.get('camera-source').onchange();
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'main');assert.equal(fixture.requests.at(-1).audio,false);
  assert.equal(fixture.nodes.get('preview').srcObject.track.getSettings().deviceId,'main');
});

test('preparing does not record; stop commits its last chunk, turns camera off and offers another game in the same room',async()=>{
  const fixture=cameraFixture();await flush();const {nodes,app,store,messages,tracks}=fixture;
  assert.equal(nodes.get('start').disabled,true);assert.equal(nodes.get('prepare').disabled,false);
  await nodes.get('prepare').onclick();assert.equal(fixture.instances.length,0);assert.equal(fixture.clock().recordingId,undefined);assert.equal(fixture.requests[0].video.aspectRatio.ideal,16/9);
  assert.equal(nodes.get('start').disabled,false);assert.equal(app.getState().phase,'preview');
  fixture.advance(5000);await nodes.get('start').onclick();await flush();assert.equal(app.getState().phase,'recording');assert.equal(fixture.clock().timeMs,0);assert.equal(nodes.get('switch-camera').disabled,true);
  fixture.advance(2100);const stopping=nodes.get('stop').onclick();assert.equal(app.getState().phase,'stopping');assert.equal(nodes.get('stop').textContent,'Finalizando…');
  await stopping;await flush();assert.equal(app.getState().phase,'stopped');assert.equal(nodes.get('preview').srcObject,null);assert.ok(tracks.every(track=>track.stopped));
  assert.equal(nodes.get('start').disabled,true);assert.equal(nodes.get('prepare').disabled,false);assert.match(nodes.get('recording-status').textContent,/encerrada/i);
  assert.equal(nodes.get('preview-placeholder').children.map(node=>node.textContent).join(' '),'Câmera desligada');
  assert.equal(nodes.get('new-recording').className,'center-action primary');assert.equal(nodes.get('prepare').className,'center-action');assert.equal(nodes.get('show-recordings').className,'icon-control');assert.equal(nodes.get('notice').hidden,true);
  const data=await store.downloadData(recordingId);assert.equal(await data.blob.text(),'last-chunk');assert.equal(data.manifest.durationMs,2100);assert.equal(data.manifest.orientationPreference,'landscape');assert.equal(data.manifest.captureOrientation,'landscape');
  const terminal=messages.findLast(message=>message.kind==='recording');assert.equal(terminal.state,'stopped');assert.equal(terminal.durationMs,2100);
  assert.equal(messages.findLast(message=>message.kind==='video-offer').recordingId,recordingId);
  assert.equal(app.getVideoSender().isTransferring(recordingId),true);
  nodes.get('show-recordings').onclick();await flush();
  assert.equal(nodes.get('recordings').querySelectorAll('button').find(button=>button.textContent==='Excluir do celular').disabled,true);
});

test('initial camera options are available before capture and a transient cold start retries exact source with audio preserved',async()=>{
  const fixture=cameraFixture({enumerateDevices:async()=>[{kind:'videoinput',deviceId:'chosen',label:'camera0, facing back'}]});await flush();
  assert.equal(fixture.requests.length,0);assert.equal(fixture.nodes.get('camera-source').disabled,false);
  assert.equal(fixture.nodes.get('camera-source').children[1].value,'chosen');
  fixture.nodes.get('camera-source').value='chosen';await fixture.nodes.get('camera-source').onchange();
  const delays=[];fixture.window.setTimeout=(callback,delay)=>{if(delay===250||delay===500){delays.push(delay);queueMicrotask(callback);}return 1;};
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{fixture.requests.push(constraints);if(fixture.requests.length<3)throw Object.assign(new Error('could not start video source'),{name:fixture.requests.length===1?'NotReadableError':'AbortError'});return lensStream('chosen','camera0, facing back');};
  await fixture.nodes.get('prepare').onclick();
  assert.deepEqual(delays,[250,500]);assert.equal(fixture.requests.length,3);assert.ok(fixture.requests.every(request=>request.audio===true&&request.video.deviceId.exact==='chosen'));
  assert.equal(fixture.requests[0].video.width.ideal,1920);assert.equal(fixture.requests[2].video.width,undefined);
  assert.equal(fixture.app.getState().phase,'preview');assert.equal(fixture.nodes.get('preview').srcObject.track.readyState,'live');
  assert.equal(fixture.nodes.get('camera-app').dataset.captureAttempts,'3');
});

test('persistent cold camera failures are bounded and friendly while permission denial never retries',async()=>{
  const fixture=cameraFixture();await flush();let delays=0;
  fixture.window.setTimeout=callback=>{delays++;queueMicrotask(callback);return 1;};
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{fixture.requests.push(constraints);throw Object.assign(new Error('could not start video source'),{name:'TrackStartError'});};
  await fixture.nodes.get('prepare').onclick();
  assert.equal(fixture.requests.length,3);assert.equal(delays,2);assert.ok(fixture.requests.every(request=>request.audio===true&&request.video.facingMode.ideal==='environment'));
  assert.equal(fixture.app.getState().phase,'idle');assert.equal(fixture.nodes.get('preview').srcObject,null);
  assert.match(fixture.nodes.get('error').textContent,/Feche outras abas ou apps/);assert.doesNotMatch(fixture.nodes.get('error').textContent,/could not start/i);
  assert.equal(fixture.nodes.get('camera-app').dataset.captureError,'TrackStartError');assert.equal(fixture.nodes.get('camera-app').dataset.captureAttempts,'3');
  fixture.requests.length=0;delays=0;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{fixture.requests.push(constraints);throw Object.assign(new Error('Permission denied'),{name:'NotAllowedError'});};
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.requests.length,1);assert.equal(delays,0);assert.match(fixture.nodes.get('error').textContent,/Permita o acesso/);
});

test('an in-flight prepare blocks duplicate acquisitions and stops a stream arriving after the camera tab is hidden',async()=>{
  const fixture=cameraFixture();await flush();let resolveCapture;
  fixture.window.navigator.mediaDevices.getUserMedia=constraints=>{fixture.requests.push(constraints);return new Promise(resolve=>{resolveCapture=resolve;});};
  const preparing=fixture.nodes.get('prepare').onclick();await flush();
  assert.equal(fixture.app.getState().phase,'preparing');assert.equal(await fixture.nodes.get('prepare').onclick(),false);assert.equal(fixture.requests.length,1);
  fixture.window.document.hidden=true;const source=lensStream('rear','Back Camera');resolveCapture(source);await preparing;
  assert.equal(source.track.stopped,true);assert.equal(fixture.app.getState().phase,'idle');assert.equal(fixture.nodes.get('start').disabled,true);
  assert.equal(fixture.nodes.get('preview').srcObject,null);assert.equal(fixture.app.getTransport(),undefined);
  assert.match(fixture.nodes.get('error').textContent,/Volte a esta aba/);
});

test('host starts only a prepared camera in the same room and cannot restart a used recording',async()=>{
  const fixture=cameraFixture();await flush();
  assert.equal(fixture.instances.length,0);
  await fixture.nodes.get('prepare').onclick();
  fixture.receive({kind:'start-recording',roomId:'other'});assert.equal(fixture.instances.length,0);
  fixture.receive({kind:'start-recording',roomId});fixture.receive({kind:'start-recording',roomId});
  assert.equal(fixture.app.getState().phase,'starting');
  assert.equal(fixture.messages.some(message=>message.kind==='recording'),false);
  await flush();assert.equal(fixture.app.getState().phase,'recording');assert.equal(fixture.instances.length,1);
  assert.ok(fixture.messages.some(message=>message.kind==='recording'&&message.state==='recording'));
  await fixture.nodes.get('stop').onclick();await flush();
  fixture.receive({kind:'start-recording',roomId});await flush();assert.equal(fixture.instances.length,1);
});

for(const [name,reason,block] of [
  ['hidden camera tab','camera-hidden',fixture=>{fixture.window.document.hidden=true;}],
  ['muted video track','source-unavailable',(_fixture,_preview,_source,track)=>{track.muted=true;}],
  ['ended video track','source-unavailable',(_fixture,_preview,_source,track)=>{track.readyState='ended';}],
  ['disabled video track','source-unavailable',(_fixture,_preview,_source,track)=>{track.enabled=false;}],
  ['missing video track','source-unavailable',(_fixture,_preview,source)=>{source.getVideoTracks=()=>[];}],
  ['inactive stream','source-unavailable',(_fixture,_preview,source)=>{source.active=false;}],
  ['replaced preview source','source-unavailable',(_fixture,preview)=>{preview.srcObject={};}],
  ['preview without decoded dimensions','source-unavailable',(_fixture,preview)=>{preview.videoWidth=0;preview.videoHeight=0;}],
  ['preview without current media data','source-unavailable',(_fixture,preview)=>{preview.readyState=1;}],
  ['paused preview','source-unavailable',(_fixture,preview)=>{preview.paused=true;}],
])test(`remote start rejects ${name} before creating or confirming a recording`,async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();
  const preview=fixture.nodes.get('preview'),source=preview.srcObject,track=source.getVideoTracks()[0];block(fixture,preview,source,track);
  fixture.receive({kind:'start-recording',roomId});await flush();
  assert.equal(fixture.instances.length,0);assert.equal((await fixture.store.list()).length,0);assert.equal(fixture.app.getState().phase,'preview');
  assert.ok(fixture.messages.some(message=>message.kind==='recording-start-error'&&message.roomId===roomId&&message.reason===reason));
  assert.equal(fixture.messages.some(message=>message.kind==='recording'&&message.state==='recording'),false);assert.equal(fixture.nodes.get('error').hidden,false);
});

test('a current live source starts without examining image brightness and can retry after returning visible',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();const preview=fixture.nodes.get('preview'),track=preview.srcObject.getVideoTracks()[0];
  preview.readyState=2;preview.paused=false;track.readyState='live';track.muted=false;track.enabled=true;
  fixture.window.document.hidden=true;await fixture.nodes.get('start').onclick();await flush();assert.equal(fixture.instances.length,0);
  fixture.window.document.hidden=false;await fixture.nodes.get('start').onclick();await flush();
  assert.equal(fixture.instances.length,1);assert.equal(fixture.instances[0].state,'recording');assert.equal(fixture.app.getState().phase,'recording');assert.equal(fixture.nodes.get('error').hidden,true);
});

test('a source hidden during initial persistence cannot start and preserves previously saved footage',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();const previousId='previous-original';
  await fixture.store.create({...metadata(),id:previousId,roomId:'previous-room',state:'stopped'});await fixture.store.append(previousId,0,new Blob(['preserved-original']),1200);
  const create=fixture.store.create.bind(fixture.store);fixture.store.create=async value=>{await create(value);fixture.window.document.hidden=true;};
  await fixture.nodes.get('start').onclick();await flush();
  assert.equal(fixture.instances.length,1);assert.equal(fixture.instances[0].state,'inactive');assert.equal(fixture.app.getState().phase,'error');
  assert.equal(fixture.messages.some(message=>message.kind==='recording'&&message.state==='recording'),false);
  assert.ok(fixture.messages.some(message=>message.kind==='recording-start-error'&&message.reason==='camera-hidden'));
  assert.equal(await(await fixture.store.downloadData(previousId)).blob.text(),'preserved-original');assert.equal((await fixture.store.get(recordingId)).state,'error');
});

test('failed remote start reports failure without confirming a recording',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();
  fixture.window.MediaRecorder.isTypeSupported=()=>false;
  fixture.receive({kind:'start-recording',roomId});await flush();
  assert.equal(fixture.app.getState().phase,'error');
  assert.ok(fixture.messages.some(message=>message.kind==='recording-start-error'&&message.roomId===roomId));
  assert.equal(fixture.messages.some(message=>message.kind==='recording'&&message.state==='recording'),false);
});

test('host stop accepts only the active recording and waits for final chunk commit',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.receive({kind:'stop-recording',recordingId:'other'});assert.equal(fixture.app.getState().phase,'recording');
  fixture.advance(1200);fixture.receive({kind:'stop-recording',recordingId});
  assert.equal(fixture.app.getState().phase,'stopping');
  fixture.receive({kind:'stop-recording',recordingId});await flush();
  assert.equal(fixture.instances[0].stopCalls,1);
  assert.equal(fixture.app.getState().phase,'stopped');
  const saved=await fixture.store.downloadData(recordingId);assert.equal(await saved.blob.text(),'last-chunk');
  assert.equal(fixture.messages.findLast(message=>message.kind==='recording').state,'stopped');
});

test('pause and resume keep one video and exclude every paused interval from duration and points',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.advance(2000);fixture.receive({kind:'pause-recording',recordingId:'other'});assert.equal(fixture.app.getState().phase,'recording');
  fixture.receive({kind:'pause-recording',recordingId});assert.equal(fixture.app.getState().phase,'recording');
  assert.equal(fixture.nodes.get('pause').disabled,true);await flush();assert.equal(fixture.app.getState().phase,'paused');
  fixture.advance(5000);assert.equal(fixture.clock().timeMs,2000);assert.equal(fixture.clock().recording,false);assert.equal(fixture.clock().pausedMs,5000);
  assert.equal(fixture.messages.findLast(message=>message.kind==='recording').state,'paused');
  fixture.receive({kind:'resume-recording',recordingId});await flush();fixture.advance(1000);
  assert.equal(fixture.clock().timeMs,3000);assert.equal(fixture.clock().pausedMs,5000);assert.equal(fixture.clock().recording,true);
  fixture.receive({kind:'point',point:{...point,timeMs:2900}});await flush();
  await fixture.nodes.get('pause').onclick();await flush();fixture.advance(7000);await fixture.nodes.get('stop').onclick();await flush();
  const saved=await fixture.store.downloadData(recordingId);assert.equal(saved.manifest.durationMs,3000);assert.equal(saved.manifest.points[0].timeMs,2900);
  assert.equal(fixture.instances.length,1);assert.equal(fixture.instances[0].stopCalls,1);
  assert.equal(fixture.app.getState().phase,'stopped');assert.ok(fixture.tracks.every(track=>track.stopped));
});

test('new recording reuses pairing only after host approval and preserves both independent videos',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.advance(1000);await fixture.nodes.get('stop').onclick();await flush();
  fixture.nodes.get('new-recording').onclick();
  assert.deepEqual(fixture.messages.findLast(message=>message.kind==='new-recording-request'),{kind:'new-recording-request',roomId,recordingId});
  assert.equal(fixture.app.getState().phase,'stopped');
  fixture.receive({kind:'new-recording-blocked',roomId});assert.equal(fixture.nodes.get('new-recording').disabled,false);
  fixture.receive({kind:'new-recording',roomId:'other',recordingId});assert.equal(fixture.app.getState().phase,'stopped');
  fixture.receive({kind:'new-recording',roomId,recordingId});await flush();
  assert.equal(fixture.app.getState().phase,'preview');assert.equal(fixture.clock().recordingId,undefined);
  assert.equal(fixture.messages.findLast(message=>message.kind==='camera-status').recordingId,undefined);
  await fixture.nodes.get('start').onclick();await flush();fixture.advance(2000);await fixture.nodes.get('stop').onclick();await flush();
  const list=await fixture.store.list();assert.equal(list.length,2);assert.ok(list.every(item=>item.roomId===roomId));assert.notEqual(list[0].id,list[1].id);
  assert.equal((await fixture.store.downloadData(recordingId)).manifest.durationMs,1000);
  assert.equal(list.find(item=>item.id!==recordingId).durationMs,2000);
});

test('camera power preserves the room and refuses to turn off an active or paused capture',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();
  fixture.receive({kind:'camera-off',roomId:'other'});assert.equal(fixture.app.getState().phase,'preview');
  fixture.receive({kind:'camera-off',roomId});await flush();assert.equal(fixture.app.getState().phase,'idle');
  assert.equal(fixture.messages.findLast(message=>message.kind==='camera-status').state,'off');
  fixture.receive({kind:'camera-on',roomId});await flush();assert.equal(fixture.app.getState().phase,'preview');assert.equal(fixture.requests.length,2);
  await fixture.nodes.get('start').onclick();await flush();fixture.receive({kind:'camera-off',roomId});await flush();assert.equal(fixture.app.getState().phase,'recording');
  await fixture.nodes.get('pause').onclick();await flush();fixture.receive({kind:'camera-off',roomId});await flush();assert.equal(fixture.app.getState().phase,'paused');
  fixture.window.document.hidden=true;fixture.receive({kind:'resume-recording',recordingId});await flush();assert.equal(fixture.app.getState().phase,'paused');
  fixture.window.document.hidden=false;await fixture.nodes.get('stop').onclick();await flush();
  fixture.receive({kind:'camera-on',roomId});await flush();assert.equal(fixture.app.getState().phase,'stopped');assert.equal(fixture.clock().recordingId,recordingId);
});

test('denied camera-on preserves the paired control channel and saved recording and reports explicit failure',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.advance(800);await fixture.nodes.get('stop').onclick();await flush();
  const before=await fixture.store.downloadData(recordingId);
  fixture.window.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('Permission denied'),{name:'NotAllowedError'});};
  fixture.receive({kind:'camera-on',roomId});await flush();
  assert.equal(fixture.disconnects(),0);assert.equal(fixture.nodes.get('camera-app').dataset.connection,'connected');
  assert.equal(fixture.app.getState().phase,'stopped');assert.equal(fixture.clock().recordingId,recordingId);
  assert.deepEqual(fixture.messages.findLast(message=>message.kind==='camera-control-error'),{kind:'camera-control-error',roomId,command:'camera-on'});
  assert.deepEqual((await fixture.store.downloadData(recordingId)).manifest,before.manifest);
  assert.equal(await (await fixture.store.downloadData(recordingId)).blob.text(),await before.blob.text());
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
  assert.equal(fixture.nodes.get('recover-camera').hidden,false);assert.equal(fixture.nodes.get('recover-camera').textContent,'Tentar finalizar');
  fixture.receive({kind:'new-recording',roomId,recordingId});fixture.receive({kind:'camera-on',roomId});await flush();assert.equal(fixture.app.getState().phase,'finalization-error');
  assert.equal((await fixture.store.get(recordingId)).state,'recording');assert.equal((await fixture.store.get(recordingId)).chunkCount,0);
  assert.equal(fixture.nodes.get('recordings').querySelectorAll('button').find(button=>button.textContent==='Excluir do celular').disabled,true);
  fixture.idb.state.failPut=false;await fixture.nodes.get('recover-camera').onclick();await flush();
  assert.equal(fixture.instances[0].stopCalls,1);assert.equal(fixture.app.getState().phase,'error');
  const recovered=await fixture.store.downloadData(recordingId);assert.equal(await recovered.blob.text(),'last-chunk');assert.equal(recovered.manifest.chunkCount,1);assert.equal(recovered.manifest.state,'error');
  assert.ok(fixture.tracks.every(track=>track.stopped));
});

test('reloading a completed room restores its terminal metadata and requires host approval for another timeline',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});
  await fixture.nodes.get('prepare').onclick();await flush();
  assert.equal(fixture.requests.length,1);assert.equal(fixture.instances.length,0);assert.equal(fixture.app.getState().phase,'stopped');
  await fixture.nodes.get('start').onclick();assert.equal(fixture.instances.length,0);assert.equal((await fixture.store.list()).length,1);
});

test('a restored stopped recording can reconnect data without enabling the camera or creating another recording',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped',durationMs:28000});await fixture.store.append(recordingId,0,new Blob(['original']),28000);
  fixture.nodes.get('show-recordings').onclick();await flush();fixture.nodes.get('close-recordings').onclick();
  assert.equal(fixture.app.getState().phase,'stopped');assert.equal(fixture.nodes.get('reconnect').hidden,false);assert.equal(fixture.nodes.get('new-recording').hidden,true);assert.equal(fixture.requests.length,0);
  await fixture.nodes.get('reconnect').onclick();await flush();
  assert.equal(fixture.connections.at(-1),null);assert.equal(fixture.requests.length,0);assert.equal(fixture.instances.length,0);assert.equal(fixture.app.getState().recordingId,recordingId);assert.ok(fixture.messages.some(message=>message.kind==='video-offer'&&message.recordingId===recordingId));
});

test('without pairing, the camera explains the QR step instead of displaying a dead primary action',async()=>{
  const fixture=cameraFixture({pairing:false});await flush();
  assert.equal(fixture.nodes.get('prepare').hidden,true);assert.equal(fixture.nodes.get('start').hidden,true);assert.equal(fixture.nodes.get('settings').hidden,true);assert.equal(fixture.nodes.get('guides').hidden,true);
  assert.equal(fixture.nodes.get('preview-placeholder').hidden,false);assert.equal(fixture.nodes.get('preview-placeholder').children[0].textContent,'Leia o QR do notebook');assert.equal(fixture.nodes.get('error').hidden,true);assert.equal(fixture.requests.length,0);
  fixture.nodes.get('show-recordings').onclick();await flush();assert.equal(fixture.nodes.get('recordings-panel').open,true);
});

test('camera-off settings hide empty technical fields but keep lens choice when the browser lists devices',async()=>{
  const fixture=cameraFixture({enumerateDevices:async()=>[{kind:'videoinput',deviceId:'main',label:'Back Main Camera'}]});await flush();
  assert.equal(fixture.nodes.get('camera-source-field').hidden,false);assert.equal(fixture.nodes.get('use-camera-default').hidden,true);assert.equal(fixture.nodes.get('saved-info').hidden,true);assert.equal(fixture.nodes.get('capture-info').hidden,true);assert.equal(fixture.nodes.get('orientation-hint').hidden,true);
  fixture.nodes.get('settings').onclick();assert.equal(fixture.nodes.get('camera-source').focusCalls,1);
  fixture.dispatch('keydown',{key:'Escape',preventDefault(){}});assert.equal(fixture.nodes.get('settings-menu').hidden,true);assert.equal(fixture.nodes.get('settings').focusCalls,1);
});

test('library errors and export progress remain visible inside the native dialog',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});await fixture.store.append(recordingId,0,new Blob(['original']),1000);
  fixture.nodes.get('show-recordings').onclick();await flush();const panel=fixture.nodes.get('recordings-panel');assert.equal(panel.tag,'dialog');assert.equal(panel.open,true);assert.equal(fixture.nodes.get('close-recordings').focusCalls,1);
  let reject;fixture.store.downloadData=()=>new Promise((_resolve,fail)=>{reject=fail;});
  const button=fixture.nodes.get('recordings').querySelectorAll('button')[0],pending=button.onclick();
  assert.equal(fixture.nodes.get('recordings-status').hidden,false);assert.equal(fixture.nodes.get('recordings-status').textContent,'Preparando vídeo…');assert.equal(fixture.nodes.get('notice').hidden,true);
  reject(new Error('Há um trecho ausente nesta gravação.'));await pending;
  assert.equal(fixture.nodes.get('recordings-error').hidden,false);assert.match(fixture.nodes.get('recordings-error').textContent,/trecho ausente/);assert.equal(fixture.nodes.get('error').hidden,true);
  for(const callback of panel.listeners.get('cancel'))callback({preventDefault(){}});
  assert.equal(panel.open,false);assert.equal(panel.hidden,true);assert.equal(fixture.nodes.get('show-recordings').focusCalls,1);assert.equal(fixture.nodes.get('error').hidden,false);
});

test('library pagination exposes older metadata without loading video chunks or disturbing capture',async()=>{
  const fixture=cameraFixture();await flush();
  for(let index=0;index<23;index++)await fixture.store.create({...metadata(),id:`saved-${index}`,state:'stopped',startEpochMs:1000+index});
  let chunkReads=0;fixture.store.getChunk=async()=>{chunkReads++;throw new Error('No chunks should be read');};
  fixture.nodes.get('show-recordings').onclick();await flush();assert.equal(fixture.nodes.get('recordings').children.length,20);assert.equal(fixture.nodes.get('show-more-recordings').hidden,false);
  fixture.nodes.get('show-more-recordings').onclick();await flush();assert.equal(fixture.nodes.get('recordings').children.length,23);assert.equal(fixture.nodes.get('show-more-recordings').hidden,true);assert.equal(chunkReads,0);assert.equal(fixture.requests.length,0);
});

test('a failed phone deletion reports its error in the library and preserves the original',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});await fixture.store.append(recordingId,0,new Blob(['kept']),1000);
  fixture.nodes.get('show-recordings').onclick();await flush();fixture.window.confirm=()=>true;fixture.store.remove=async()=>{throw new Error('Não foi possível excluir esta gravação.');};
  const remove=fixture.nodes.get('recordings').querySelectorAll('button').find(button=>button.textContent==='Excluir do celular');await remove.onclick();
  assert.equal(fixture.nodes.get('recordings-error').hidden,false);assert.equal(fixture.nodes.get('error').hidden,true);assert.match(fixture.nodes.get('recordings-error').textContent,/excluir esta gravação/);assert.equal(await (await fixture.store.downloadData(recordingId)).blob.text(),'kept');
});

test('opening the library during capture keeps the recorder running and shows its live state',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.nodes.get('show-recordings').onclick();await flush();assert.equal(fixture.nodes.get('recordings-panel').open,true);assert.equal(fixture.nodes.get('recordings-live').hidden,false);assert.equal(fixture.nodes.get('recordings-live').textContent,'A câmera continua gravando');assert.equal(fixture.instances[0].state,'recording');assert.equal(fixture.instances[0].stopCalls,0);
  fixture.nodes.get('close-recordings').onclick();assert.equal(fixture.instances[0].state,'recording');
});

test('a failed start before onstart offers a safe retry without replacing saved footage',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();fixture.window.MediaRecorder.isTypeSupported=()=>false;await fixture.nodes.get('start').onclick();await flush();
  assert.equal(fixture.app.getState().phase,'error');assert.equal(fixture.nodes.get('recover-camera').hidden,false);assert.equal(fixture.nodes.get('recover-camera').textContent,'Tentar novamente');
  fixture.window.MediaRecorder.isTypeSupported=type=>type==='video/webm';await fixture.nodes.get('recover-camera').onclick();await flush();
  assert.equal(fixture.app.getState().phase,'preview');assert.equal(fixture.requests.length,2);assert.equal(fixture.instances.length,0);assert.equal((await fixture.store.list()).length,0);
});

test('a fatal recorder error directs partial footage to the library without restarting or deleting it',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  fixture.instances[0].ondataavailable({data:new Blob(['kept-'])});await flush();fixture.instances[0].onerror();await flush();
  assert.equal(fixture.app.getState().phase,'error');assert.equal(fixture.nodes.get('recover-camera').textContent,'Abrir gravações');await fixture.nodes.get('recover-camera').onclick();await flush();
  assert.equal(fixture.nodes.get('recordings-panel').open,true);assert.equal(fixture.requests.length,1);assert.equal(fixture.instances.length,1);assert.equal(await (await fixture.store.downloadData(recordingId)).blob.text(),'kept-last-chunk');
});

test('automatic reconnection backs off five times without reopening the camera or restarting capture',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  const recorder=fixture.instances[0],epoch=fixture.clock().startEpochMs;let attempts=0;
  fixture.app.getTransport().connect=async source=>{attempts++;assert.ok(source);throw new Error('Temporary network failure');};
  fixture.connection('offline');fixture.connection('offline');assert.equal(fixture.timers.size,1);
  for(const delay of [1000,2000,4000,8000,15000]){fixture.runTimer(delay);await flush();}
  assert.equal(attempts,5);assert.equal(fixture.timers.size,0);assert.equal(fixture.nodes.get('reconnect').hidden,false);
  assert.equal(fixture.requests.length,1);assert.equal(fixture.instances.length,1);assert.equal(recorder.state,'recording');assert.equal(recorder.stopCalls,0);assert.equal(fixture.clock().startEpochMs,epoch);
});

test('manual retry cannot overlap a pending automatic reconnection and visibility restores the same capture',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  let attempts=0,reject;fixture.app.getTransport().connect=()=>{attempts++;return new Promise((_resolve,fail)=>{reject=fail;});};
  fixture.connection('offline');fixture.runTimer(1000);fixture.nodes.get('reconnect').onclick();fixture.nodes.get('reconnect').onclick();
  assert.equal(attempts,1);assert.equal(fixture.nodes.get('reconnect').disabled,true);
  reject(new Error('Temporary network failure'));await flush();assert.equal(fixture.nodes.get('reconnect').disabled,false);
  fixture.window.document.hidden=true;fixture.dispatch('visibilitychange');assert.equal(fixture.timers.size,0);
  fixture.app.getTransport().connect=async()=>{attempts++;fixture.connection('connected');};
  fixture.window.document.hidden=false;fixture.dispatch('visibilitychange');await flush();
  assert.equal(attempts,2);assert.equal(fixture.instances.length,1);assert.equal(fixture.instances[0].stopCalls,0);assert.equal(fixture.nodes.get('camera-app').dataset.connection,'connected');
});

test('a manual connection timeout is visible and recovery clears only its own message',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();
  fixture.app.getTransport().connect=async()=>{throw Object.assign(new Error('A conexão com o notebook demorou para responder. Tente reconectar.'),{name:'TimeoutError'});};
  fixture.connection('offline');await fixture.nodes.get('reconnect').onclick();await flush();assert.equal(fixture.nodes.get('error').hidden,false);assert.match(fixture.nodes.get('error').textContent,/demorou para responder/);assert.equal(fixture.nodes.get('reconnect').disabled,false);
  fixture.app.getTransport().connect=async()=>fixture.connection('connected');await fixture.nodes.get('reconnect').onclick();await flush();assert.equal(fixture.nodes.get('error').hidden,true);
  fixture.window.MediaRecorder.isTypeSupported=()=>false;await fixture.nodes.get('start').onclick();await flush();const captureError=fixture.nodes.get('error').textContent;assert.match(captureError,/formato de gravação/);
  fixture.connection('connected');assert.equal(fixture.nodes.get('error').textContent,captureError);assert.equal(fixture.nodes.get('error').hidden,false);
});

test('after recording, automatic data-only reconnection resumes the original offer with no new camera request',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  await fixture.nodes.get('stop').onclick();await flush();const offer=fixture.messages.find(message=>message.kind==='video-offer');assert.ok(offer);
  fixture.connection('offline');fixture.runTimer(1000);await flush();
  assert.equal(fixture.connections.at(-1),null);assert.equal(fixture.requests.length,1);assert.equal(fixture.instances.length,1);assert.equal(fixture.instances[0].state,'inactive');
  const resumed=fixture.messages.filter(message=>message.kind==='video-offer');assert.equal(resumed.length,2);assert.equal(resumed[1].recordingId,offer.recordingId);assert.equal(resumed[1].transferId,offer.transferId);
  assert.equal((await fixture.store.downloadData(recordingId)).blob.size,offer.bytes);
});

test('expired or closed pairings stop automatic recovery without deleting the phone original',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();await fixture.nodes.get('stop').onclick();await flush();
  fixture.app.getTransport().connect=async()=>{throw Object.assign(new Error('Expired'),{status:410});};
  fixture.connection('offline');fixture.runTimer(1000);await flush();assert.equal(fixture.timers.size,0);
  fixture.window.document.hidden=true;fixture.dispatch('visibilitychange');fixture.window.document.hidden=false;fixture.dispatch('visibilitychange');await flush();assert.equal(fixture.timers.size,0);
  assert.equal((await fixture.store.get(recordingId)).state,'stopped');assert.equal((await fixture.store.downloadData(recordingId)).blob.size>0,true);
});

function fakeWakeLock(fixture){
  const locks=[];fixture.window.navigator.wakeLock={request:async kind=>{assert.equal(kind,'screen');const listeners=new Map(),lock={released:false,releaseCalls:0,addEventListener:(name,callback)=>listeners.set(name,callback),release:async()=>{lock.released=true;lock.releaseCalls++;listeners.get('release')?.();}};locks.push(lock);return lock;}};return locks;
}

test('preview holds screen wake lock, never loops while hidden, and releases when powered off without recording',async()=>{
  const fixture=cameraFixture(),locks=fakeWakeLock(fixture);await flush();assert.equal(locks.length,0);
  await fixture.nodes.get('prepare').onclick();await flush();assert.equal(locks.length,1);assert.equal(locks[0].releaseCalls,0);assert.equal(fixture.app.getState().phase,'preview');
  fixture.window.document.hidden=true;await locks[0].release();await flush();assert.equal(locks.length,1);
  fixture.dispatch('visibilitychange');await flush();assert.equal(locks.length,1);
  fixture.window.document.hidden=false;fixture.dispatch('visibilitychange');await flush();assert.equal(locks.length,2);assert.equal(locks[1].releaseCalls,0);
  await fixture.nodes.get('power').onclick();await flush();assert.equal(locks[1].releaseCalls,1);assert.equal(locks.length,2);assert.equal(fixture.instances.length,0);assert.equal((await fixture.store.list()).length,0);
});

test('screen wake lock stays held after stop until the notebook confirms the original is saved',async()=>{
  const fixture=cameraFixture(),locks=fakeWakeLock(fixture);await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();
  assert.equal(locks.length,1);await fixture.nodes.get('stop').onclick();await flush();
  const offer=fixture.messages.find(message=>message.kind==='video-offer');assert.ok(offer);assert.equal(locks[0].releaseCalls,0);assert.equal(fixture.tracks.every(track=>track.stopped),true);
  fixture.receive({kind:'video-saved',transferId:offer.transferId,recordingId,nextPart:offer.partCount});await flush();
  assert.equal(locks[0].releaseCalls,1);assert.equal(fixture.nodes.get('transfer-status').textContent,'Salvo no computador');assert.equal((await fixture.store.get(recordingId)).state,'stopped');
});

test('returning to a pending copy reacquires screen wake lock, while a transfer error releases it',async()=>{
  const fixture=cameraFixture(),locks=fakeWakeLock(fixture);await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();await fixture.nodes.get('stop').onclick();await flush();
  const offer=fixture.messages.find(message=>message.kind==='video-offer');assert.ok(offer);
  fixture.window.document.hidden=true;fixture.dispatch('visibilitychange');await flush();assert.equal(locks[0].releaseCalls,1);
  fixture.window.document.hidden=false;fixture.dispatch('visibilitychange');await flush();assert.equal(locks.length,2);assert.equal(locks[1].releaseCalls,0);
  fixture.receive({kind:'video-transfer-error',transferId:offer.transferId,recordingId});await flush();assert.equal(locks[1].releaseCalls,1);assert.equal((await fixture.store.get(recordingId)).state,'stopped');
});

test('exhausted automatic reconnection releases copy wake lock and retains a manual retry',async()=>{
  const fixture=cameraFixture(),locks=fakeWakeLock(fixture);await flush();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await flush();await fixture.nodes.get('stop').onclick();await flush();
  fixture.app.getTransport().connect=async()=>{throw new Error('Temporary network failure');};fixture.connection('offline');
  for(const delay of [1000,2000,4000,8000,15000]){fixture.runTimer(delay);await flush();}
  assert.equal(locks[0].releaseCalls,1);assert.equal(fixture.nodes.get('reconnect').hidden,false);assert.equal(fixture.nodes.get('reconnect').disabled,false);assert.equal(fixture.app.getVideoSender().active.state,'paused');
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

test('native physical rotation updates actual format and status on the same preview, RTC and recording source',async()=>{
  const fixture=cameraFixture();await flush();const order=[];
  fixture.window.screen.orientation.unlock=()=>order.push('unlock');fixture.window.screen.orientation.lock=()=>{throw new Error('Must not lock physical rotation');};
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{order.push('capture');fixture.requests.push(constraints);return Object.assign(lensStream('rear','Back Camera'),{previewDimensions:{width:1080,height:1920}});};
  await fixture.nodes.get('prepare').onclick();assert.deepEqual(order,['unlock','capture']);assert.equal(fixture.nodes.get('orientation-value').textContent,'Vertical');
  const preview=fixture.nodes.get('preview'),source=preview.srcObject,requests=fixture.requests.length,connections=fixture.connections.length;
  assert.equal(fixture.messages.findLast(message=>message.kind==='camera-status').capture.width,1080);
  await fixture.nodes.get('start').onclick();await flush();assert.equal(fixture.instances[0].source,source);assert.equal(fixture.connections[0],source);
  preview.videoWidth=1920;preview.videoHeight=1080;for(const callback of preview.listeners.get('resize'))callback();
  assert.equal(fixture.app.getState().format,'landscape');assert.equal(fixture.nodes.get('orientation-value').textContent,'Horizontal');assert.equal(fixture.messages.findLast(message=>message.kind==='camera-status').capture.width,1920);
  preview.videoWidth=1080;preview.videoHeight=1920;for(const callback of preview.listeners.get('resize'))callback();
  assert.equal(fixture.app.getState().format,'portrait');assert.equal(fixture.nodes.get('orientation-value').textContent,'Vertical');
  assert.equal(fixture.requests.length,requests);assert.equal(fixture.connections.length,connections);assert.equal(preview.srcObject,source);assert.equal(fixture.instances[0].state,'recording');
  assert.equal((await fixture.store.get(recordingId)).captureOrientation,'portrait');await fixture.nodes.get('stop').onclick();await flush();
});

const facingDevices=()=>[{kind:'videoinput',deviceId:'rear-id-zero',label:'camera0, facing back',facingMode:'environment'},{kind:'videoinput',deviceId:'front-id',label:'camera1, facing front',facingMode:'user'},{kind:'videoinput',deviceId:'other-rear',label:'Back Ultra Wide Camera',facingMode:'environment'}];

test('the default is explicitly confirmed from the current rear preview and trying another source does not replace it',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const fixture=cameraFixture({localStorage:storage}),lens=installLensDevices(fixture,facingDevices());await flush();await fixture.nodes.get('prepare').onclick();
  assert.equal(values.has(CAMERA_REAR_PREFERENCE),false);assert.equal(fixture.nodes.get('use-camera-default').disabled,false);assert.equal(fixture.nodes.get('use-camera-default').onclick(),true);
  const saved=values.get(CAMERA_REAR_PREFERENCE);assert.equal(JSON.parse(saved).deviceId,'rear-id-zero');assert.match(fixture.nodes.get('camera-source').children.find(option=>option.value==='rear-id-zero').textContent,/padrão/);
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'front-id');assert.equal(values.get(CAMERA_REAR_PREFERENCE),saved);assert.equal(fixture.nodes.get('use-camera-default').hidden,true);assert.equal(fixture.nodes.get('use-camera-default').onclick(),false);
  await fixture.nodes.get('switch-camera').onclick();fixture.nodes.get('camera-source').value='other-rear';await fixture.nodes.get('camera-source').onchange();assert.equal(fixture.nodes.get('camera-source').value,'other-rear');assert.equal(values.get(CAMERA_REAR_PREFERENCE),saved);
  await fixture.nodes.get('switch-camera').onclick();await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.equal(values.get(CAMERA_REAR_PREFERENCE),saved);
  fixture.nodes.get('camera-source').value='other-rear';await fixture.nodes.get('camera-source').onchange();
  await fixture.nodes.get('power').onclick();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.equal(lens.streams.at(-1).track.getSettings().deviceId,'rear-id-zero');
  const reloaded=cameraFixture({localStorage:storage});installLensDevices(reloaded,facingDevices());await flush();await reloaded.nodes.get('prepare').onclick();
  assert.equal(reloaded.requests.length,1);assert.equal(reloaded.requests[0].video.deviceId.exact,'rear-id-zero');assert.equal(reloaded.nodes.get('camera-source').value,'rear-id-zero');
});

test('an exact manual source remains selectable and can become the default when getSettings returns an empty device ID',async()=>{
  const fixture=cameraFixture();installLensDevices(fixture,facingDevices());await flush();const acquire=fixture.window.navigator.mediaDevices.getUserMedia;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{const source=await acquire(constraints),settings=source.track.getSettings;source.track.getSettings=()=>({...settings(),deviceId:''});return source;};
  await fixture.nodes.get('prepare').onclick();fixture.nodes.get('camera-source').value='rear-id-zero';await fixture.nodes.get('camera-source').onchange();
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'rear-id-zero');assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
  assert.equal(fixture.nodes.get('use-camera-default').onclick(),true);assert.equal(JSON.parse(fixture.window.localStorage.getItem(CAMERA_REAR_PREFERENCE)).deviceId,'rear-id-zero');
});

test('a post-permission default failure is disclosed and reopening retries the default over the last automatic fallback',async()=>{
  const devices=[{kind:'videoinput',deviceId:'wide-id',label:'camera2, facing back',facingMode:'environment'},...facingDevices().slice(0,2)],saved=JSON.stringify({version:1,deviceId:'rear-id-zero',label:'camera0, facing back'});
  const fixture=cameraFixture({localStorage:{getItem:()=>saved,setItem(){throw new Error('Do not overwrite');}}}),lens=installLensDevices(fixture,devices);await flush();let permission=false;
  fixture.window.navigator.mediaDevices.enumerateDevices=async()=>permission?devices:[];const acquire=fixture.window.navigator.mediaDevices.getUserMedia;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{const source=await acquire(constraints);permission=true;return source;};lens.unavailable.add('rear-id-zero');
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.nodes.get('camera-source').value,'wide-id');assert.match(fixture.nodes.get('error').textContent,/padrão não abriu.*outra câmera/);
  await fixture.nodes.get('power').onclick();lens.unavailable.delete('rear-id-zero');await fixture.nodes.get('prepare').onclick();
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'rear-id-zero');assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
});

test('a pending source choice while off wins for one preview without replacing the saved rear default',async()=>{
  const devices=[{kind:'videoinput',deviceId:'wide-id',label:'camera2, facing back',facingMode:'environment'},...facingDevices().slice(0,2)],saved=JSON.stringify({version:1,deviceId:'rear-id-zero',label:'camera0, facing back'});
  const fixture=cameraFixture({enumerateDevices:async()=>devices,localStorage:{getItem:()=>saved,setItem(){throw new Error('Do not overwrite');}}});installLensDevices(fixture,devices);await flush();
  fixture.nodes.get('camera-source').value='wide-id';await fixture.nodes.get('camera-source').onchange();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.nodes.get('camera-source').value,'wide-id');
  await fixture.nodes.get('power').onclick();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
  await fixture.nodes.get('power').onclick();fixture.nodes.get('camera-source').value='';await fixture.nodes.get('camera-source').onchange();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.requests.at(-1).video.deviceId,undefined);assert.equal(fixture.nodes.get('camera-source').value,'wide-id');
  await fixture.nodes.get('power').onclick();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
});

test('failed writes or readback cannot mark a new default and preserve the previous confirmed preference',async()=>{
  const saved=JSON.stringify({version:1,deviceId:'rear-id-zero',label:'camera0, facing back'}),values=new Map([[CAMERA_REAR_PREFERENCE,saved]]);let mode='normal',readback=false;
  const storage={getItem:key=>{if(readback){readback=false;throw new Error('Read blocked');}return values.get(key)??null;},setItem:(key,value)=>{if(mode==='quota')throw new Error('QuotaExceededError');if(mode==='noop')return;values.set(key,value);if(mode==='readback')readback=true;},removeItem:key=>values.delete(key)};
  const fixture=cameraFixture({localStorage:storage});installLensDevices(fixture,facingDevices());await flush();await fixture.nodes.get('prepare').onclick();fixture.nodes.get('camera-source').value='other-rear';await fixture.nodes.get('camera-source').onchange();
  for(const failure of ['noop','quota','readback']){mode=failure;readback=false;assert.equal(fixture.nodes.get('use-camera-default').onclick(),false);assert.equal(values.get(CAMERA_REAR_PREFERENCE),saved);assert.doesNotMatch(fixture.nodes.get('camera-source').children.find(option=>option.value==='other-rear').textContent,/padrão/);assert.match(fixture.nodes.get('error').textContent,/Não foi possível salvar/);}
  readback=false;storage.setItem=undefined;assert.equal(fixture.nodes.get('use-camera-default').onclick(),false);assert.equal(values.get(CAMERA_REAR_PREFERENCE),saved);
});

test('returning from the front uses the confirmed rear ID even when its enumerated label has no facing hint',async()=>{
  const devices=[{kind:'videoinput',deviceId:'front-id',label:'Front Camera',facingMode:'user'},{kind:'videoinput',deviceId:'opaque-rear',label:'',facingMode:'environment'},{kind:'videoinput',deviceId:'wide-id',label:'Back Ultra Wide Camera',facingMode:'environment'}],saved=JSON.stringify({version:1,deviceId:'opaque-rear',label:''});
  const fixture=cameraFixture({enumerateDevices:async()=>devices,localStorage:{getItem:()=>saved,setItem(){throw new Error('Do not overwrite');}}});installLensDevices(fixture,devices);await flush();
  fixture.nodes.get('camera-source').value='front-id';await fixture.nodes.get('camera-source').onchange();await fixture.nodes.get('prepare').onclick();
  assert.equal(fixture.nodes.get('camera-source').value,'front-id');await fixture.nodes.get('switch-camera').onclick();
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'opaque-rear');assert.equal(fixture.nodes.get('camera-source').value,'opaque-rear');assert.equal(fixture.nodes.get('preview').srcObject.track.getSettings().facingMode,'environment');
});

test('a stale rear preference equal to the actual front source cannot masquerade as an already successful flip',async()=>{
  const devices=[{kind:'videoinput',deviceId:'reused-id',label:'',facingMode:'user'}],saved=JSON.stringify({version:1,deviceId:'reused-id',label:'Old rear'});
  const fixture=cameraFixture({enumerateDevices:async()=>devices,localStorage:{getItem:()=>saved,setItem(){throw new Error('Do not overwrite');}}});installLensDevices(fixture,devices);await flush();
  fixture.nodes.get('camera-source').value='reused-id';await fixture.nodes.get('camera-source').onchange();await fixture.nodes.get('prepare').onclick();const source=fixture.nodes.get('preview').srcObject,requests=fixture.requests.length;
  assert.equal(await fixture.nodes.get('switch-camera').onclick(),false);assert.equal(fixture.requests.length,requests);assert.equal(fixture.nodes.get('preview').srcObject,source);assert.equal(source.track.stopped,false);
  assert.match(fixture.nodes.get('error').textContent,/traseira não identificada/);
});

test('rear preference recovery requires a unique matching rear label and tolerates invalid or blocked local storage',()=>{
  const preference={version:1,deviceId:'old-source',label:'Back Main Camera'},devices=[{kind:'videoinput',deviceId:'renewed-source',label:'Back Main Camera'},{kind:'videoinput',deviceId:'front',label:'Front Camera'}];
  assert.equal(resolveRearCameraPreference(devices,preference),'renewed-source');
  assert.equal(resolveRearCameraPreference([...devices,{kind:'videoinput',deviceId:'duplicate',label:'Back Main Camera'}],preference),'');
  assert.equal(resolveRearCameraPreference([{kind:'videoinput',deviceId:'old-source',label:'Front Camera'}],preference),'');
  assert.equal(readRearCameraPreference({getItem:()=>JSON.stringify(preference)}).deviceId,'old-source');
  assert.equal(readRearCameraPreference({getItem:()=>JSON.stringify({...preference,deviceId:'x'.repeat(513)})}),null);
  assert.equal(readRearCameraPreference({getItem(){throw new Error('Storage blocked');}}),null);
});

test('a stored source ID reused by an unidentified front camera cannot be accepted as the rear default',async()=>{
  const saved=JSON.stringify({version:1,deviceId:'front-id',label:'Back old camera'}),storage={getItem:()=>saved,setItem(){throw new Error('Must not overwrite');}};
  const fixture=cameraFixture({localStorage:storage});installLensDevices(fixture,[{kind:'videoinput',deviceId:'front-id',label:'',facingMode:'user'}]);await flush();
  assert.equal(await fixture.nodes.get('prepare').onclick(),false);assert.equal(fixture.app.getState().phase,'idle');assert.equal(fixture.nodes.get('preview').srcObject,null);
  assert.match(fixture.nodes.get('error').textContent,/não abriu a câmera solicitada/);
});

test('preview readiness waits for decoded frames from the new stream instead of trusting old dimensions',async()=>{
  const callbacks=[],source={},video={videoWidth:1920,videoHeight:1080,srcObject:{},play:async()=>{},requestVideoFrameCallback:callback=>(callbacks.push(callback),callbacks.length),cancelVideoFrameCallback(){}};
  let ready=false;const preview=presentCameraPreview(video,{document:{hidden:false},setTimeout:()=>1,clearTimeout(){}},source).then(value=>{ready=true;return value;});await flush();assert.equal(ready,false);
  video.videoWidth=1080;video.videoHeight=1920;callbacks.shift()();assert.equal(ready,false);callbacks.shift()();
  assert.deepEqual(await preview,{width:1080,height:1920});assert.equal(video.srcObject,source);
});

test('a preview that never produces media times out without saving a pending rear preference',async()=>{
  const fixture=cameraFixture();const lens=installLensDevices(fixture,facingDevices());await flush();fixture.nodes.get('camera-source').value='rear-id-zero';await fixture.nodes.get('camera-source').onchange();
  let timeout;fixture.window.setTimeout=(callback,delay)=>{if(delay===2500)timeout=callback;return 1;};fixture.nodes.get('preview').play=()=>new Promise(()=>{});
  const preparing=fixture.nodes.get('prepare').onclick();await flush();assert.equal(fixture.app.getState().phase,'preparing');assert.equal(fixture.window.localStorage.getItem(CAMERA_REAR_PREFERENCE),null);
  timeout();await preparing;assert.ok(lens.streams.every(source=>source.track.stopped));assert.equal(fixture.app.getState().phase,'idle');assert.equal(fixture.nodes.get('preview').srcObject,null);assert.equal(fixture.window.localStorage.getItem(CAMERA_REAR_PREFERENCE),null);
});

test('camera flip uses real opposite-facing IDs, restores the chosen rear source and never changes recording format',async()=>{
  const fixture=cameraFixture();installLensDevices(fixture,facingDevices());await flush();const acquire=fixture.window.navigator.mediaDevices.getUserMedia;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>Object.assign(await acquire(constraints),{previewDimensions:{width:1080,height:1920}});await fixture.nodes.get('prepare').onclick();
  assert.equal(fixture.window.document.fullscreenElement,null);
  assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.equal(fixture.nodes.get('switch-camera')['aria-label'],'Alternar para câmera frontal');
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'front-id');assert.equal(fixture.app.getState().format,'portrait');
  assert.equal(fixture.nodes.get('switch-camera')['aria-label'],'Alternar para câmera traseira');
  assert.equal(fixture.requests.at(-1).video.deviceId.exact,'front-id');assert.equal(fixture.requests.at(-1).video.aspectRatio.ideal,16/9);
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.equal(fixture.app.getState().format,'portrait');assert.equal(fixture.requests.at(-1).video.deviceId.exact,'rear-id-zero');
  const requests=fixture.requests.length;fixture.nodes.get('fullscreen').onclick();await flush();
  assert.equal(fixture.window.document.fullscreenElement,fixture.nodes.get('camera-app'));assert.equal(fixture.app.getState().format,'portrait');assert.equal(fixture.requests.length,requests);
  await fixture.nodes.get('start').onclick();await flush();assert.equal(fixture.nodes.get('switch-camera').disabled,true);
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.app.getState().format,'portrait');assert.equal(fixture.requests.length,requests);
  await fixture.nodes.get('pause').onclick();await flush();await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.requests.length,requests);
  await fixture.nodes.get('stop').onclick();await flush();
});

test('a missing or unidentifiable opposite face leaves the current camera intact and directs selection to settings',async()=>{
  const fixture=cameraFixture();installLensDevices(fixture,facingDevices().filter(device=>device.facingMode==='environment'));await flush();await fixture.nodes.get('prepare').onclick();
  const current=fixture.nodes.get('preview').srcObject,requests=fixture.requests.length;
  assert.equal(await fixture.nodes.get('switch-camera').onclick(),false);assert.equal(fixture.requests.length,requests);assert.equal(current.track.stopped,false);
  assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.match(fixture.nodes.get('error').textContent,/frontal não identificada.*configurações/);
  assert.equal(fixture.app.getState().format,'landscape');
});

test('opposite-facing validation rolls back without memorizing a source that reports the wrong face',async()=>{
  const fixture=cameraFixture(),lens=installLensDevices(fixture,facingDevices());await flush();await fixture.nodes.get('prepare').onclick();
  const old=fixture.nodes.get('preview').srcObject;lens.facingOverrides.set('front-id','environment');
  assert.equal(await fixture.nodes.get('switch-camera').onclick(),false);assert.equal(old.track.stopped,true);
  assert.equal(fixture.nodes.get('preview').srcObject.track.readyState,'live');assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
  assert.match(fixture.nodes.get('error').textContent,/Não foi possível alternar a câmera.*anterior foi reaberta/);assert.equal(fixture.app.getState().format,'landscape');
  lens.facingOverrides.delete('front-id');await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'front-id');
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');
});

test('an in-flight flip rejects another flip and remains available for a stopped recording preview',async()=>{
  const fixture=cameraFixture();installLensDevices(fixture,facingDevices());await flush();await fixture.nodes.get('prepare').onclick();
  const acquire=fixture.window.navigator.mediaDevices.getUserMedia;let release;const pending=new Promise(resolve=>{release=resolve;});let frontRequests=0;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.video.deviceId?.exact==='front-id'){frontRequests++;await pending;}return acquire(constraints);};
  const flipping=fixture.nodes.get('switch-camera').onclick();await flush();assert.equal(fixture.app.getState().phase,'preparing');
  assert.equal(await fixture.nodes.get('switch-camera').onclick(),false);assert.equal(frontRequests,1);release();await flipping;
  assert.equal(fixture.nodes.get('camera-source').value,'front-id');assert.equal(fixture.app.getState().format,'landscape');
  await fixture.nodes.get('start').onclick();await flush();fixture.advance(1000);await fixture.nodes.get('stop').onclick();await flush();const saved=await fixture.store.get(recordingId);
  await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'stopped');assert.equal(fixture.nodes.get('switch-camera').disabled,false);
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'rear-id-zero');assert.equal(fixture.app.getState().phase,'stopped');
  assert.deepEqual(await fixture.store.get(recordingId),saved);assert.equal(fixture.app.getState().recordingId,recordingId);
});

test('guides follow actual video dimensions through rotation and toggle during capture without changing its source',async()=>{
  const fixture=cameraFixture();await flush();await fixture.nodes.get('prepare').onclick();const preview=fixture.nodes.get('preview'),source=preview.srcObject;
  preview.videoWidth=1920;preview.videoHeight=1080;for(const callback of preview.listeners.get('loadedmetadata'))callback();
  assert.equal(fixture.nodes.get('frame-guides').hidden,false);assert.equal(fixture.nodes.get('guides')['aria-pressed'],'true');
  fixture.nodes.get('guides').onclick();assert.equal(fixture.nodes.get('frame-guides').hidden,true);assert.equal(fixture.nodes.get('guides')['aria-pressed'],'false');
  fixture.nodes.get('guides').onclick();assert.equal(fixture.nodes.get('frame-guides').hidden,false);assert.equal(fixture.nodes.get('guides')['aria-pressed'],'true');
  assert.equal(fixture.nodes.get('guide-frame').viewBox,'0 0 1920 1080');assert.equal(fixture.nodes.get('guide-frame').preserveAspectRatio,'xMidYMid meet');
  const requests=fixture.requests.length;await fixture.nodes.get('start').onclick();await flush();assert.equal(fixture.instances[0].source,source);
  preview.videoWidth=1080;preview.videoHeight=1920;for(const callback of preview.listeners.get('resize'))callback();
  assert.equal(fixture.nodes.get('guide-frame').viewBox,'0 0 1080 1920');assert.equal(fixture.app.getState().phase,'recording');
  await fixture.nodes.get('pause').onclick();await flush();fixture.nodes.get('guides').onclick();assert.equal(fixture.nodes.get('frame-guides').hidden,true);
  assert.equal(fixture.app.getState().phase,'paused');assert.equal(fixture.requests.length,requests);assert.equal(preview.srcObject,source);
  await fixture.nodes.get('stop').onclick();await flush();assert.equal(fixture.nodes.get('frame-guides').hidden,true);
});

test('restored terminal recording metadata stays frozen across camera flip and late orientation and preview events',async()=>{
  const fixture=cameraFixture();installLensDevices(fixture,facingDevices());await flush();
  const saved={...metadata(),state:'stopped',durationMs:9000,events:[{kind:'point',point}],connectionEvents:[{kind:'page-hidden',timeMs:1000,atEpochMs:2000}]};
  await fixture.store.create(saved);await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'stopped');
  await fixture.nodes.get('switch-camera').onclick();assert.equal(fixture.nodes.get('camera-source').value,'front-id');
  const preview=fixture.nodes.get('preview');preview.videoWidth=1080;preview.videoHeight=1920;
  for(const callback of preview.listeners.get('resize'))callback();fixture.dispatch('orientation:change');fixture.dispatch('visibilitychange');await flush();
  assert.deepEqual(await fixture.store.get(recordingId),saved);assert.equal(fixture.app.getState().recordingId,recordingId);
  assert.equal(fixture.instances.length,0);assert.equal(fixture.app.getState().format,'portrait');
});

test('deleting an old local recording does not authorize a new timeline without the host',async()=>{
  const fixture=cameraFixture();await flush();await fixture.store.create({...metadata(),state:'stopped'});
  fixture.nodes.get('show-recordings').onclick();await flush();await fixture.store.remove(recordingId);
  await fixture.nodes.get('prepare').onclick();await flush();
  await fixture.nodes.get('start').onclick();assert.equal(fixture.instances.length,0);assert.equal(fixture.app.getState().phase,'stopped');
});
