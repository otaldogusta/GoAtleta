// Camera-only page. It never receives the notebook capability or Supabase credentials.
export const LIVE_CAMERA_DATABASE = 'goatleta-scouting-live-camera-v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/i;
const CAMERA_SESSION = 'goatleta:live-camera-pair:v1';
const CAMERA_USED_SESSION = 'goatleta:live-camera-used:v1:';
export const CAMERA_REAR_PREFERENCE = 'goatleta:live-camera-rear-preference:v1';
const MAX_EVENTS = 4000;

export function parseCameraPair(fragment) {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const roomId = params.get('room'), token = params.get('token');
  if (!UUID.test(roomId ?? '') || !TOKEN.test(token ?? '') || [...params.keys()].some(key => !['room','token'].includes(key)) || params.getAll('room').length !== 1 || params.getAll('token').length !== 1) throw new Error('QR code inválido. Gere uma nova conexão no notebook.');
  return { roomId, token };
}

export function chooseRecordingMime(Recorder) {
  // Prefer VP8/Opus when available; MP4 remains capability-based without
  // forcing an AVC profile/level that may not match the camera resolution.
  return ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type => Recorder.isTypeSupported(type)) ?? '';
}

// Capabilities are predictions, not proof of the frame rate in the saved file.
// A single deadline also bounds browsers that never settle encodingInfo().
async function cameraDeadline(task,timeoutMs,{setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  let timer;
  try{return await Promise.race([Promise.resolve().then(task).catch(()=>undefined),new Promise(resolve=>{timer=setTimer(()=>resolve(undefined),timeoutMs);})]);}
  finally{clearTimer(timer);}
}

export async function chooseRecordingProfile(Recorder,mediaCapabilities,{width=1920,height=1080,timeoutMs=1200,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  const fallback={mimeType:chooseRecordingMime(Recorder),videoBitsPerSecond:6000000,capabilityVerified:false};
  const mimeAccepted=new Set();
  const candidates=['avc1.64002A','avc1.4D402A','avc1.42E02A'].map(codec=>{
    try{if(Recorder.isTypeSupported(`video/mp4;codecs=${codec}`)){mimeAccepted.add(codec);return {codec,state:'timeout'};}return {codec,state:'mime-unsupported'};}
    catch{return {codec,state:'query-error'};}
  });
  const validDimensions=[width,height].every(value=>Number.isSafeInteger(value)&&value>0&&value<=16384),hasApi=typeof mediaCapabilities?.encodingInfo==='function';
  const complete=profile=>({...profile,codecSupport:JSON.stringify(candidates)});
  // Chromium can expose encodingInfo while its 'record' configuration is still
  // disabled. An accepted MIME permits a measured trial, never a hardware claim.
  const unknownProfile=()=>{
    const candidate=candidates.find(row=>mimeAccepted.has(row.codec)&&['query-error','timeout'].includes(row.state)&&!['supported','smooth','powerEfficient'].some(key=>row[key]===false));
    return candidate?{mimeType:`video/mp4;codecs=${candidate.codec}`,videoBitsPerSecond:12000000,capabilityVerified:false}:fallback;
  };
  if(!validDimensions){for(const candidate of candidates)if(candidate.state==='timeout')candidate.state='query-error';return complete(fallback);}
  if(!hasApi){for(const candidate of candidates)if(candidate.state==='timeout')candidate.state='query-error';return complete(unknownProfile());}
  const results=[];
  await cameraDeadline(()=>Promise.all(candidates.map(async(candidate,index)=>{
    if(candidate.state!=='timeout')return;
    const mimeType=`video/mp4;codecs=${candidate.codec}`;
    try{const info=await mediaCapabilities.encodingInfo({type:'record',video:{contentType:mimeType,width,height,bitrate:12000000,framerate:60}});
      candidate.state=['supported','smooth','powerEfficient'].every(key=>typeof info?.[key]==='boolean')?'queried':'query-error';
      for(const key of ['supported','smooth','powerEfficient'])if(typeof info?.[key]==='boolean')candidate[key]=info[key];
      if(info?.supported===true&&info.smooth===true&&info.powerEfficient===true)results[index]={mimeType,videoBitsPerSecond:12000000,capabilityVerified:true,smooth:true,powerEfficient:true};
    }catch{candidate.state='query-error';}
  })),timeoutMs,{setTimer,clearTimer});
  return complete(results.find(Boolean)??unknownProfile());
}

/** Limit only the RTC encoder; the original camera track remains full quality. */
export async function configureCameraPreview(peer,{timeoutMs=1200,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  const senders=peer?.getSenders?.()??[];
  return await cameraDeadline(()=>Promise.all(senders.filter(sender=>sender.track?.kind==='video').map(async sender=>{
    try{const settings=sender.track.getSettings?.()??{},parameters=sender.getParameters();
      if(!parameters.encodings?.length)return false;
      const longSide=Math.max(settings.width||0,settings.height||0);
      parameters.encodings=parameters.encodings.map(encoding=>({...encoding,scaleResolutionDownBy:Math.max(1,longSide/640),maxFramerate:60,maxBitrate:1200000}));
      await sender.setParameters(parameters);return true;
    }catch{return false;}
  })),timeoutMs,{setTimer,clearTimer})??[];
}

/** Select numerical quality evidence only; never forward the RTCStatsReport. */
export async function collectCameraQuality(peer,previous={},options={}) {
  if(typeof peer?.getStats!=='function')return {metrics:{},snapshot:{}};
  const report=await cameraDeadline(()=>peer.getStats(),options.timeoutMs??1000,options);
  const rows=[];report?.forEach?.(row=>rows.push(row));
  const source=rows.find(row=>row.type==='media-source'&&(row.kind==='video'||row.mediaType==='video'));
  const preview=rows.find(row=>row.type==='outbound-rtp'&&!row.isRemote&&(row.kind==='video'||row.mediaType==='video'));
  const metrics={},snapshot={};
  for(const[key,row,countKey,field]of [['source',source,'frames','sourceFps'],['preview',preview,'framesEncoded','previewFps']]){
    if(!row)continue;
    const old=previous[key],frames=row[countKey],timestamp=row.timestamp;
    let fps=row.framesPerSecond;
    if(old&&Number.isFinite(frames)&&frames>=old.frames&&Number.isFinite(timestamp)&&timestamp>old.timestamp)fps=(frames-old.frames)*1000/(timestamp-old.timestamp);
    if(Number.isFinite(fps)&&fps>=0&&fps<=240)metrics[field]=Math.round(fps*100)/100;
    if(Number.isFinite(frames)&&Number.isFinite(timestamp))snapshot[key]={frames,timestamp};
  }
  if(typeof preview?.encoderImplementation==='string'&&preview.encoderImplementation.length<=160&&!/[\x00-\x1f\x7f]/.test(preview.encoderImplementation))metrics.encoderImplementation=preview.encoderImplementation;
  return {metrics,snapshot};
}

/** Counts frames of the phone's existing local <video>, independently of RTC.
 * Playback quality includes dropped frames; callback metadata is a fallback
 * counting presented frames, not a sensor-rate or saved-file-rate guarantee. */
export class CameraPreviewSampler {
  constructor(video,{now=()=>performance.now()}={}){this.video=video;this.now=now;this.generation=0;this.frameCallback=null;this.clear();}
  qualityCount(){try{const frames=this.video.getVideoPlaybackQuality?.().totalVideoFrames;return Number.isSafeInteger(frames)&&frames>=0?frames:null;}catch{return null;}}
  clear(){this.generation++;if(this.frameCallback!==null)try{this.video.cancelVideoFrameCallback?.(this.frameCallback);}catch{}this.frameCallback=null;this.source=null;this.startedAt=null;this.qualityBaseline=null;this.presentedBaseline=null;this.presentedLatest=null;}
  reset(source){
    this.clear();if(!source||this.video.srcObject!==source)return;
    this.source=source;this.startedAt=this.now();this.qualityBaseline=this.qualityCount();
    const generation=this.generation;
    const next=()=>{
      if(typeof this.video.requestVideoFrameCallback!=='function')return;
      try{this.frameCallback=this.video.requestVideoFrameCallback((_time,metadata)=>{
        if(this.generation!==generation||this.source!==source||this.video.srcObject!==source)return;
        this.frameCallback=null;const frames=metadata?.presentedFrames,time=this.now();
        if(Number.isSafeInteger(frames)&&frames>=0&&Number.isFinite(time)){
          if(!this.presentedBaseline||frames<this.presentedBaseline.frames)this.presentedBaseline={frames,time};
          this.presentedLatest={frames,time};
        }
        next();
      });}catch{/* A missing callback API does not invalidate playback-quality counts. */}
    };
    next();
  }
  sample(source){
    if(!source||source!==this.source||this.video.srcObject!==source||this.video.paused===true)return null;
    const time=this.now(),elapsedMs=time-this.startedAt;if(!Number.isFinite(elapsedMs)||elapsedMs<2000)return null;
    if(elapsedMs>60000){this.reset(source);return null;}
    const count=this.qualityCount();
    if(count!==null&&this.qualityBaseline!==null&&count<this.qualityBaseline){this.reset(source);return null;}
    const frames=count!==null&&this.qualityBaseline!==null?count-this.qualityBaseline:null,metrics={};
    let qualityFrames,presentedFrames;
    if(frames>0){const fps=frames*1000/elapsedMs;if(fps>0&&fps<=240){metrics.localFps=Math.round(fps*100)/100;qualityFrames=frames;}}
    if(this.presentedBaseline&&this.presentedLatest&&time-this.presentedLatest.time<=1000){
      const presentedMs=time-this.presentedBaseline.time,presented=this.presentedLatest.frames-this.presentedBaseline.frames,fps=presented*1000/presentedMs;
      if(presentedMs>=2000&&presented>0&&fps>0&&fps<=240){metrics.localPresentedFps=Math.round(fps*100)/100;presentedFrames=presented;}
    }
    if(qualityFrames===undefined&&presentedFrames===undefined)return null;
    metrics.localSampleMs=Math.round(elapsedMs);
    return {metrics,method:qualityFrames!==undefined?presentedFrames!==undefined?'both':'playback-quality':'video-frame-callback',...(qualityFrames!==undefined?{qualityFrames}:{}),...(presentedFrames!==undefined?{presentedFrames}:{})};
  }
}

export function projectCameraPoint(value, recordingId, elapsedMs) {
  const p = value;
  if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 128 || p.recordingId !== recordingId || !Number.isFinite(p.timeMs) || p.timeMs < 0 || p.timeMs > elapsedMs + 5000
      || typeof p.won !== 'boolean' || !Number.isSafeInteger(p.setNumber) || p.setNumber < 1 || p.setNumber > 99
      || ![p.scoreUs,p.scoreThem].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2000)
      || !Number.isFinite(p.uncertaintyMs) || p.uncertaintyMs < 0 || p.uncertaintyMs > 30000 || !['frame','estimated'].includes(p.clockMode)
      || !Number.isFinite(p.createdAtHostEpochMs)) throw new Error('Marcação de vídeo inválida.');
  return { id:p.id,recordingId,timeMs:p.timeMs,won:p.won,setNumber:p.setNumber,scoreUs:p.scoreUs,scoreThem:p.scoreThem,uncertaintyMs:p.uncertaintyMs,clockMode:p.clockMode,createdAtHostEpochMs:p.createdAtHostEpochMs };
}

export function activeCameraPoints(events) {
  const undone = new Set(events.filter(event => event.kind === 'undo-point').map(event => event.id));
  return events.filter(event => event.kind === 'point' && !undone.has(event.point.id)).map(event => event.point);
}

export function cameraRecordingDetail(item,currentRecording) {
  if(currentRecording)return 'Gravação em andamento · acompanhe o contador acima';
  return `${(item.bytes/1048576).toFixed(1)} MB · ${item.chunkCount} trechos salvos · ${activeCameraPoints(item.events).length} pontos${item.state==='recording'?' · gravação interrompida ou em andamento':item.state==='error'?' · gravação incompleta':''}`;
}

export function preferredCameraDevice(devices,currentId='') {
  const cameras=devices.filter(device=>device.kind==='videoinput'&&typeof device.deviceId==='string'&&device.deviceId);
  const score=device=>{const label=String(device.label??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/front|frontal|facetime|selfie|\buser\b/.test(label))return -100;
    if(/ultra|telephoto|telefoto|teleobjetiva|\btele\b|0[.,][56]|super.?wide|grande.?angular/.test(label))return -50;
    const rear=/back|rear|traseir|environment/.test(label),main=/main|principal|standard|normal|\bwide\b/.test(label);
    return main?(rear?100:10):0;
  };
  const best=cameras.reduce((chosen,device)=>!chosen||score(device)>score(chosen)?device:chosen,null);
  return best&&score(best)>0?best.deviceId:currentId;
}

export function cameraFacingMode(label='',facingMode='') {
  if(facingMode==='user'||facingMode==='environment')return facingMode;
  const value=String(label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /front|frontal|facetime|selfie|\buser\b/.test(value)?'user':/back|rear|traseir|environment/.test(value)?'environment':'';
}

export function cameraDisplayName(label='',index=0,facingMode='') {
  const value=String(label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const face=cameraFacingMode(label,facingMode),front=face==='user',rear=face==='environment';
  const side=front?'Frontal':rear?'Traseira':'Câmera';
  if(!front&&/ultra|0[.,][56]|super.?wide|grande.?angular/.test(value))return `${side} · ultra-angular`;
  if(!front&&/telephoto|telefoto|teleobjetiva|\btele\b/.test(value))return `${side} · teleobjetiva`;
  if(!front&&/main|principal|standard|normal/.test(value))return `${side} · principal`;
  return `${side} ${index+1}`;
}

export async function resetCameraZoom(track) {
  const capability=track?.getCapabilities?.().zoom;
  if(!capability||!Number.isFinite(capability.min)||!Number.isFinite(capability.max)||capability.min>1||capability.max<1||typeof track.applyConstraints!=='function')return;
  try{await track.applyConstraints({advanced:[{zoom:1}]});}catch{/* Optical lens identity remains a camera selection, not a digital crop. */}
}

export function cameraCaptureConstraints(format='landscape',deviceId='') {
  if(!['landscape','portrait'].includes(format))throw new Error('Formato de câmera inválido.');
  // Constraints use the source's primary axes; screen orientation can transpose
  // delivered frames. Do not transpose these preferences a second time.
  return {video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080},aspectRatio:{ideal:16/9},frameRate:{min:59.94,ideal:60,max:60}},audio:true};
}

export function releaseCameraOrientation(window) {
  try{window.screen?.orientation?.unlock?.();}catch{/* Native rotation remains the browser's responsibility. */}
}

export function readRearCameraPreference(storage){
  try{const raw=storage?.getItem(CAMERA_REAR_PREFERENCE);if(!raw||raw.length>2048)return null;const value=JSON.parse(raw);
    return value?.version===1&&typeof value.deviceId==='string'&&value.deviceId.length>0&&value.deviceId.length<=512&&typeof value.label==='string'&&value.label.length<=120?{version:1,deviceId:value.deviceId,label:value.label}:null;
  }catch{return null;}
}

export function resolveRearCameraPreference(devices,preference){
  if(!preference)return '';
  const cameras=devices.filter(device=>device.kind==='videoinput'&&device.deviceId&&cameraFacingMode(device.label)!=='user');
  const exact=cameras.find(device=>device.deviceId===preference.deviceId);if(exact)return exact.deviceId;
  const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),label=normalize(preference.label);
  const matches=label?cameras.filter(device=>cameraFacingMode(device.label)==='environment'&&normalize(device.label)===label):[];
  return matches.length===1?matches[0].deviceId:'';
}

/** Confirm decoded frames from the exact stream before declaring a preview ready. */
export function presentCameraPreview(video,window,source,isCurrent=()=>true){
  const schedule=window.setTimeout?.bind(window)??setTimeout,cancel=window.clearTimeout?.bind(window)??(window.setTimeout?()=>{}:clearTimeout);
  return new Promise((resolve,reject)=>{
    let finished=false,timer,frameId,last='',stable=0;
    const finish=(error,value)=>{if(finished)return;finished=true;cancel(timer);if(frameId!==undefined)video.cancelVideoFrameCallback?.(frameId);if(error)reject(error);else resolve(value);};
    const inspect=()=>{
      if(finished)return;
      if(window.document?.hidden||!isCurrent()||video.srcObject!==source){finish(new Error('Volte a esta aba no celular e toque em Ligar câmera.'));return;}
      const width=video.videoWidth,height=video.videoHeight;
      if(width>0&&height>0){const key=`${width}x${height}`;stable=key===last?stable+1:1;last=key;if(!video.requestVideoFrameCallback||stable>=2){finish(null,{width,height});return;}}
      if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(inspect);
    };
    timer=schedule(()=>finish(new Error('A câmera não mostrou uma imagem. Tente ligar novamente.')),2500);
    video.srcObject=source;
    try{Promise.resolve(video.play()).then(()=>{if(!finished){if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(inspect);else inspect();}},error=>finish(error));}catch(error){finish(error);}
  });
}

/** Keep each Blob until its transaction commits. Failed heads retain their exact index for retry. */
export class CameraChunkQueue {
  constructor(store,id,onSaved=()=>{}){this.store=store;this.id=id;this.onSaved=onSaved;this.entries=[];this.nextIndex=0;this.task=null;}
  get pendingCount(){return this.entries.length;}
  enqueue(blob,timeMs){const entry={index:this.nextIndex++,blob,timeMs};this.entries.push(entry);return entry.index;}
  flush(){
    if(this.task)return this.task;
    const work=async()=>{while(this.entries.length){const entry=this.entries[0];const saved=await this.store.append(this.id,entry.index,entry.blob,entry.timeMs);this.entries.shift();this.onSaved(saved);}};
    this.task=work().finally(()=>{this.task=null;});return this.task;
  }
}

/** The final dataavailable precedes stop. Commit every queued write before announcing completion. */
export class CameraStopCoordinator {
  constructor(recorder,{drain,commit,onStopping=()=>{},onComplete=()=>{},onFailure=()=>{},release=()=>{}}) {
    this.recorder=recorder;this.drain=drain;this.commit=commit;this.onStopping=onStopping;this.onComplete=onComplete;this.onFailure=onFailure;this.release=release;
    this.started=false;this.finalized=false;this.task=null;
    this.stopped=new Promise(resolve=>{recorder.addEventListener('stop',()=>{this.begin();resolve();void this.finish();},{once:true});});
  }
  begin(){if(!this.started){this.started=true;this.onStopping();}}
  stop(){if(this.finalized)return Promise.resolve(true);this.begin();if(this.recorder.state!=='inactive')this.recorder.stop();return this.finish();}
  finish(){
    if(this.task)return this.task;if(this.finalized)return Promise.resolve(true);
    const work=async()=>{try{await this.stopped;await this.drain();const metadata=await this.commit();this.finalized=true;await this.onComplete(metadata);return true;}catch(error){try{await this.onFailure(error);}catch{}return false;}finally{try{await this.release();}catch{}}};
    this.task=work().finally(()=>{this.task=null;});return this.task;
  }
}

export async function deleteCameraRecording(store,id,{canDelete=()=>true,confirm=async()=>false}={}) {
  if(!canDelete())throw new Error('Encerre a gravação e aguarde a finalização ou exportação antes de excluir.');
  const item=await store.get(id);
  if(!item||!['stopped','error'].includes(item.state))throw new Error('Encerre esta gravação antes de excluir.');
  if(!await confirm(item))return false;
  if(!canDelete())throw new Error('A gravação está em uso. Nada foi excluído.');
  await store.remove(id);return true;
}

export class CameraRecordingStore {
  constructor(factory = globalThis.indexedDB) { this.factory=factory; this.database=null; this.opening=null; }
  async open() {
    if (this.database) return this.database;
    if (this.opening) return this.opening;
    if (!this.factory) throw new Error('Armazenamento local indisponível neste navegador.');
    this.opening = new Promise((resolve,reject) => {
      let settled=false;const timer=setTimeout(()=>{settled=true;reject(new Error('O armazenamento local demorou a responder.'));},10000);
      const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
      let request;try{request=this.factory.open(LIVE_CAMERA_DATABASE,1);}catch(error){fail(error);return;}
      request.onupgradeneeded=() => {
        if(settled){request.transaction?.abort();return;}
        const db=request.result;
        if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings',{keyPath:'id'});
        if (!db.objectStoreNames.contains('chunks')) { const store=db.createObjectStore('chunks',{keyPath:['recordingId','index']});store.createIndex('recordingId','recordingId'); }
      };
      request.onerror=() => fail(request.error ?? new Error('Não foi possível abrir as gravações locais.'));
      request.onblocked=() => fail(new Error('Feche outra aba da câmera para abrir as gravações.'));
      request.onsuccess=() => {if(settled){request.result.close();return;}settled=true;clearTimeout(timer);request.result.onversionchange=() => { request.result.close();this.database=null; };resolve(request.result);};
    });
    try{this.database=await this.opening;return this.database;}finally{this.opening=null;}
  }
  async transaction(stores,mode,operation) {
    const db=await this.open();
    return new Promise((resolve,reject) => {
      const tx=db.transaction(stores,mode);let result,settled=false;
      const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
      const timer=setTimeout(()=>{try{tx.abort();}catch{}fail(new Error('O armazenamento local demorou a salvar. Os trechos concluídos foram preservados.'));},15000);
      tx.oncomplete=() => {if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
      tx.onerror=tx.onabort=() => fail(tx.error ?? new Error('Não foi possível salvar a gravação neste aparelho.'));
      try { operation(tx,value => {result=value;}); } catch(error) { try{tx.abort();}catch{}fail(error); }
    });
  }
  async create(metadata) { return this.transaction(['recordings'],'readwrite',tx=>tx.objectStore('recordings').add(metadata)); }
  async list() { return this.transaction(['recordings'],'readonly',(tx,result)=>{const r=tx.objectStore('recordings').getAll();r.onsuccess=()=>result(r.result.sort((a,b)=>b.startEpochMs-a.startEpochMs));}); }
  async get(id) { return this.transaction(['recordings'],'readonly',(tx,result)=>{const r=tx.objectStore('recordings').get(id);r.onsuccess=()=>result(r.result);}); }
  async getChunk(id,index) { return this.transaction(['chunks'],'readonly',(tx,result)=>{const r=tx.objectStore('chunks').get([id,index]);r.onsuccess=()=>result(r.result);}); }
  async update(id,change) {
    return this.transaction(['recordings'],'readwrite',(tx,result)=>{
      const store=tx.objectStore('recordings'),r=store.get(id);
      r.onsuccess=()=>{if(!r.result){tx.abort();return;}try{const next=change(r.result);store.put(next);result(next);}catch{tx.abort();}};
    });
  }
  async append(id,index,blob,timeMs) {
    return this.transaction(['recordings','chunks'],'readwrite',(tx,result)=>{
      const store=tx.objectStore('recordings'),r=store.get(id);
      r.onsuccess=()=>{
        if(!r.result || r.result.chunkCount!==index){tx.abort();return;}
        tx.objectStore('chunks').add({recordingId:id,index,blob,timeMs});
        const next={...r.result,chunkCount:index+1,bytes:r.result.bytes+blob.size,lastSavedTimeMs:timeMs};
        store.put(next);result(next);
      };
    });
  }
  async addPoint(id,point) {
    return this.update(id,meta=>{
      const prior=meta.events.find(event=>event.kind==='point' && event.point.id===point.id);
      if(prior){if(JSON.stringify(prior.point)!==JSON.stringify(point))throw new Error('Marcação já salva com outros dados.');return meta;}
      if(meta.events.length>=MAX_EVENTS)throw new Error('Limite de marcações locais atingido.');
      return {...meta,events:[...meta.events,{kind:'point',point}]};
    });
  }
  async undoPoint(id,pointId) {
    return this.update(id,meta=>{
      if(!meta.events.some(event=>event.kind==='point'&&event.point.id===pointId) || meta.events.some(event=>event.kind==='undo-point'&&event.id===pointId))return meta;
      if(meta.events.length>=MAX_EVENTS)throw new Error('Limite de marcações locais atingido.');
      return {...meta,events:[...meta.events,{kind:'undo-point',id:pointId,atEpochMs:Date.now()}]};
    });
  }
  async downloadData(id) {
    const meta=await this.get(id);
    if(!meta)throw new Error('Gravação não encontrada neste aparelho.');
    const chunks=await this.transaction(['chunks'],'readonly',(tx,result)=>{const r=tx.objectStore('chunks').index('recordingId').getAll(id);r.onsuccess=()=>result(r.result.sort((a,b)=>a.index-b.index));});
    if(chunks.length!==meta.chunkCount || chunks.some((chunk,index)=>chunk.index!==index))throw new Error('Há um trecho ausente nesta gravação. Os trechos salvos foram preservados.');
    // Blob composition retains browser-managed Blob storage; no ArrayBuffer copy of the whole game.
    const blob=new Blob(chunks.map(chunk=>chunk.blob),{type:meta.mimeType});
    const manifest={version:1,kind:'goatleta-live-recording',...meta,points:activeCameraPoints(meta.events),chunks:chunks.map(({index,timeMs,blob})=>({index,timeMs,bytes:blob.size})),durationMs:meta.durationMs ?? meta.lastSavedTimeMs};
    return {blob,manifest};
  }
  async remove(id) {
    if(typeof id!=='string'||!id||id.length>128)throw new Error('Gravação inválida.');
    return this.transaction(['recordings','chunks'],'readwrite',(tx,result)=>{
      const recordings=tx.objectStore('recordings'),request=recordings.get(id);
      request.onsuccess=()=>{
        if(!request.result||!['stopped','error'].includes(request.result.state)){tx.abort();return;}
        const chunks=tx.objectStore('chunks'),keys=chunks.index('recordingId').getAllKeys(id);
        keys.onsuccess=()=>{for(const key of keys.result)chunks.delete(key);recordings.delete(id);result(true);};
      };
    });
  }
}

export const CAMERA_VIDEO_PART_SIZE=8192;
const MAX_VIDEO_MESSAGE_BYTES=48*1024;
const MAX_VIDEO_BYTES=4*1024*1024*1024;
const transferableVideo=meta=>meta&&meta.state==='stopped'&&Number.isSafeInteger(meta.bytes)&&meta.bytes>0&&meta.bytes<=MAX_VIDEO_BYTES
  &&Number.isSafeInteger(meta.chunkCount)&&meta.chunkCount>0&&meta.chunkCount<=1000000&&typeof meta.mimeType==='string'&&meta.mimeType.length<=120&&/^video\/(mp4|webm)(;|$)/i.test(meta.mimeType);
const base64Bytes=bytes=>{let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw);};

/** Opt-in bounded batches; legacy peers keep one 8 KiB part per durable ACK. */
export class CameraVideoSender {
  constructor({store,roomId,send,connected=()=>true,getMaxMessageSize=()=>0,crypto=globalThis.crypto,onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=20000}={}) {
    Object.assign(this,{store,roomId,send,connected,getMaxMessageSize,crypto,onState,setTimer,clearTimer,timeoutMs});
    this.queue=[];this.aborts=[];this.active=null;this.preparing=false;this.paused=false;this.connectedBefore=false;this.saved=new Set();this.failed=new Map();this.timer=null;
  }
  publish(state,message){const a=this.active;if(a)this.onState({state,recordingId:a.meta.id,percent:Math.floor(Math.min(a.meta.bytes,a.nextPart*CAMERA_VIDEO_PART_SIZE)/a.meta.bytes*100),message});}
  clearWait(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  wait(a){this.clearWait();this.timer=this.setTimer(()=>{if(this.active===a)this.fail('O computador não confirmou a cópia. Reconecte ou tente enviar novamente.');},this.timeoutMs);this.timer?.unref?.();}
  messageLimit(){let limit=MAX_VIDEO_MESSAGE_BYTES;try{const negotiated=this.getMaxMessageSize();if(Number.isFinite(negotiated)&&negotiated>0)limit=Math.min(limit,Math.floor(negotiated));}catch{}return limit;}
  sendMessage(message){if(!this.connected()||this.paused)return false;try{return this.send(message)!==false;}catch{return false;}}
  fail(message){this.clearWait();if(!this.active)return;const a=this.active,error=String(message||'A cópia não foi concluída.').slice(0,250);a.state='error';a.version++;
    this.aborts.push({kind:'video-abort',transferId:a.transferId,recordingId:a.meta.id,error});this.flushAborts();
    this.publish('error',error);this.failed.set(a.meta.id,a);this.active=null;void this.pump();
  }
  flushAborts(){while(this.aborts.length){if(!this.sendMessage(this.aborts[0]))return false;this.aborts.shift();}return true;}
  unavailable(id){const error='Vídeo não disponível neste celular para esta conexão.';this.sendMessage({kind:'video-unavailable',recordingId:id,error});this.onState({state:'error',recordingId:id,percent:0,message:error});}
  isTransferring(id){return this.active?.meta.id===id&&['offering','reading','sending','finishing','paused'].includes(this.active.state)||this.queue.includes(id);}
  setPaused(paused){if(this.paused===paused)return;this.paused=paused;if(paused&&this.active){this.clearWait();this.active.version++;this.active.state='paused';this.publish('paused','Envio pausado durante a captura.');}else if(!paused)this.resume();}
  disconnected(){this.connectedBefore=false;if(this.active){this.clearWait();this.active.version++;this.active.state='paused';this.publish('paused','Cópia aguardando reconexão ao computador.');}}
  async enqueue(id,{force=false}={}) {
    if(typeof id!=='string'||!id||id.length>128)return false;
    if(this.active?.meta.id===id){if(force&&this.active.state==='paused')this.resume(true);return true;}
    if(this.saved.has(id)&&!force)return true;
    if(this.failed.has(id)&&!force)return false;
    if(!this.queue.includes(id)&&this.queue.length<30)this.queue.push(id);
    await this.pump();return this.active?.meta.id===id||this.queue.includes(id)||this.saved.has(id);
  }
  async pump(){
    if(this.active||this.preparing||this.paused||!this.connected()||!this.queue.length||!this.flushAborts())return;
    this.preparing=true;const id=this.queue.shift();
    try{
      const meta=await this.store.get(id);
      if(!transferableVideo(meta)||meta.id!==id||meta.roomId!==this.roomId){this.failed.delete(id);this.unavailable(id);return;}
      const prior=this.failed.get(id);this.failed.delete(id);
      // The persisted prefix belongs to the recording, not an attempted transfer.
      // A failed attempt gets a fresh ID so its delayed replies cannot abort retry.
      this.active=prior&&prior.meta.bytes===meta.bytes&&prior.meta.mimeType===meta.mimeType&&prior.meta.chunkCount===meta.chunkCount?{...prior,meta,transferId:this.crypto.randomUUID(),state:'paused'}:{meta,transferId:this.crypto.randomUUID(),partCount:Math.ceil(meta.bytes/CAMERA_VIDEO_PART_SIZE),nextPart:0,state:'paused',version:0,cursor:{index:0,offset:0,absolute:0,chunk:null}};
      this.offer();
    }catch{this.unavailable(id);}
    finally{this.preparing=false;if(!this.active&&this.queue.length)void this.pump();}
  }
  offer(){const a=this.active;if(!a||this.paused||!this.connected())return;this.clearWait();a.version++;a.state='offering';a.pending=[];a.filling=null;a.sendPart=a.nextPart;a.partsPerMessage=1;a.maxInFlight=1;a.batched=false;
    if(!this.sendMessage({kind:'video-offer',transferId:a.transferId,recordingId:a.meta.id,mimeType:a.meta.mimeType,bytes:a.meta.bytes,partSize:CAMERA_VIDEO_PART_SIZE,partCount:a.partCount})){this.fail('Não foi possível enviar pela conexão local. Tente novamente.');return;}
    this.publish('offering','Preparando cópia no computador…');this.wait(a);
  }
  resume(force=false){
    if(this.paused||!this.connected())return;
    const becameConnected=!this.connectedBefore;this.connectedBefore=true;
    if(becameConnected)for(const id of this.failed.keys())if(!this.queue.includes(id)&&this.queue.length<30)this.queue.push(id);
    if(this.active&&(force||becameConnected||this.active.state==='paused'))this.offer();else if(!this.active)void this.pump();
  }
  async readPart(a,index,sourceCursor=a.cursor){
    const start=index*CAMERA_VIDEO_PART_SIZE,length=Math.min(CAMERA_VIDEO_PART_SIZE,a.meta.bytes-start),pieces=[];
    // An old async read can finish after a reconnect. Never mutate the active
    // cursor until the caller has checked ownership and this read's version.
    let remaining=length,cursor={...sourceCursor};
    if(cursor.absolute!==start)cursor={index:0,offset:0,absolute:0,chunk:null};
    while(cursor.absolute<start||remaining){
      if(cursor.index>=a.meta.chunkCount)throw new Error('Há um trecho ausente no vídeo. A cópia do celular foi preservada.');
      if(!cursor.chunk){cursor.chunk=await this.store.getChunk(a.meta.id,cursor.index);if(!cursor.chunk||cursor.chunk.recordingId!==a.meta.id||cursor.chunk.index!==cursor.index||!(cursor.chunk.blob instanceof Blob))throw new Error('Há um trecho ausente no vídeo. A cópia do celular foi preservada.');}
      const blob=cursor.chunk.blob,available=blob.size-cursor.offset;
      if(available<=0){cursor.index++;cursor.offset=0;cursor.chunk=null;continue;}
      if(cursor.absolute<start){const skip=Math.min(available,start-cursor.absolute);cursor.offset+=skip;cursor.absolute+=skip;continue;}
      const take=Math.min(available,remaining);pieces.push(blob.slice(cursor.offset,cursor.offset+take));cursor.offset+=take;cursor.absolute+=take;remaining-=take;
    }
    return {bytes:new Uint8Array(await new Blob(pieces).arrayBuffer()),cursor};
  }
  async verifyEnd(a,cursor=a.cursor){
    if(cursor.absolute!==a.meta.bytes)throw new Error('O tamanho do vídeo não foi confirmado.');
    if(cursor.chunk&&cursor.offset!==cursor.chunk.blob.size)throw new Error('O tamanho do vídeo não confere com os trechos salvos.');
    for(let index=cursor.chunk?cursor.index+1:cursor.index;index<a.meta.chunkCount;index++){const chunk=await this.store.getChunk(a.meta.id,index);if(!chunk||chunk.recordingId!==a.meta.id||chunk.index!==index||!(chunk.blob instanceof Blob)||chunk.blob.size)throw new Error('O tamanho do vídeo não confere com os trechos salvos.');}
  }
  async next(a){
    const version=a.version;
    if(this.active!==a||this.paused||a.filling===version||!['reading','sending'].includes(a.state))return;
    a.filling=version;
    const current=()=>this.active===a&&a.version===version&&!this.paused&&this.connected();
    try{
      while(current()&&a.sendPart<a.partCount&&a.sendPart-a.nextPart<a.maxInFlight){
        const parts=[],first=a.sendPart,available=Math.min(a.partsPerMessage,a.maxInFlight-(a.sendPart-a.nextPart),a.partCount-a.sendPart),limit=this.messageLimit();let cursor=a.cursor;
        const packet=parts=>a.batched?{kind:'video-parts',transferId:a.transferId,recordingId:a.meta.id,parts}:{kind:'video-part',transferId:a.transferId,recordingId:a.meta.id,...parts[0]};
        for(let count=0;count<available;count++){
          const index=first+count,length=Math.min(CAMERA_VIDEO_PART_SIZE,a.meta.bytes-index*CAMERA_VIDEO_PART_SIZE),candidate={index,data:'',sha256:'0'.repeat(64)};
          // Base64 and these identifiers are ASCII: this is the exact wire size,
          // including the envelope, before allocating or reading another part.
          if(JSON.stringify(packet([...parts,candidate])).length+4*Math.ceil(length/3)>limit){if(!parts.length)throw new Error('A conexão não permite enviar um trecho deste vídeo. Reconecte e tente novamente.');break;}
          const read=await this.readPart(a,index,cursor);if(!current())return;
          if(!this.crypto?.subtle)throw new Error('Este navegador não permite verificar a cópia do vídeo.');
          const digest=await this.crypto.subtle.digest('SHA-256',read.bytes);if(!current())return;
          const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
          parts.push({index,data:base64Bytes(read.bytes),sha256});cursor=read.cursor;
        }
        if(!current())return;
        const message=packet(parts),last=parts.at(-1).index;
        if(JSON.stringify(message).length>this.messageLimit())throw new Error('O limite da conexão mudou. Reconecte e tente enviar novamente.');
        a.cursor=cursor;a.sendPart=last+1;a.pending.push({first,last});a.state='sending';
        if(!this.sendMessage(message)){this.fail('Conexão local indisponível. Tente enviar novamente.');return;}
        this.publish('sending','Enviando ao computador');this.wait(a);
      }
      if(current()&&a.nextPart===a.partCount&&!a.pending.length){
        // Resume after a notebook ACK can skip all bytes; verify the original layout before declaring completion.
        const cursor=a.cursor.absolute===a.meta.bytes?a.cursor:(await this.readPart(a,a.partCount-1)).cursor;
        await this.verifyEnd(a,cursor);if(!current())return;
        a.cursor=cursor;
        a.state='finishing';if(!this.sendMessage({kind:'video-complete',transferId:a.transferId,recordingId:a.meta.id})){this.fail('Conexão interrompida antes da confirmação da cópia.');return;}this.publish('finishing','Confirmando vídeo no computador…');this.wait(a);return;
      }
    }catch(error){if(this.active===a&&a.version===version)this.fail(error.message||'Não foi possível copiar o vídeo.');}
    finally{if(a.filling===version)a.filling=null;}
  }
  handle(message){
    const a=this.active;
    if(!a||!message||message.transferId!==a.transferId||message.recordingId!==a.meta.id)return false;
    if(message.kind==='video-accept'&&a.state==='offering'&&Number.isSafeInteger(message.nextPart)&&message.nextPart>=0&&message.nextPart<=a.partCount){
      const batch=message.partsPerMessage,window=message.maxInFlight;
      a.batched=Number.isSafeInteger(batch)&&batch>=1&&batch<=4&&Number.isSafeInteger(window)&&window>=batch&&window<=8;
      a.partsPerMessage=a.batched?batch:1;a.maxInFlight=a.batched?window:1;a.nextPart=message.nextPart;a.sendPart=message.nextPart;a.pending=[];a.state='reading';this.wait(a);void this.next(a);return true;
    }
    if(message.kind==='video-ack'&&a.state==='sending'&&Number.isSafeInteger(message.nextPart)&&message.nextPart>a.nextPart&&message.nextPart<=a.sendPart&&message.index===message.nextPart-1&&a.pending.some(part=>part.last===message.index)){
      a.pending=a.pending.filter(part=>part.last>=message.nextPart);a.nextPart=message.nextPart;this.publish('sending','Enviando ao computador');this.wait(a);void this.next(a);return true;
    }
    if(message.kind==='video-saved'&&(a.state==='finishing'&&a.nextPart===a.partCount||a.state==='offering'&&message.nextPart===a.partCount)){this.clearWait();a.version++;a.nextPart=a.partCount;a.state='ready';this.saved.add(a.meta.id);this.publish('ready','Salvo no computador');this.active=null;void this.pump();return true;}
    if(message.kind==='video-transfer-error'){this.fail('A cópia não foi concluída no computador. O vídeo do celular foi preservado.');return true;}
    return false;
  }
}

export class CameraTransport {
  constructor(pair,{onState=()=>{},onMessage=()=>{},clock=()=>({}),fetcher=(...args)=>globalThis.fetch(...args),Peer=globalThis.RTCPeerConnection,storage,iceServers=[],requestTimeoutMs=10000,negotiationTimeoutMs=20000,setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=timer=>globalThis.clearTimeout(timer)}={}) {
    try{storage??=globalThis.sessionStorage;}catch{}
    this.pair=pair;this.onState=onState;this.onMessage=onMessage;this.clock=clock;this.fetcher=fetcher;this.Peer=Peer;this.storage=storage;this.iceServers=iceServers;this.requestTimeoutMs=requestTimeoutMs;this.negotiationTimeoutMs=negotiationTimeoutMs;this.setTimer=setTimer;this.clearTimer=clearTimer;this.apiRequests=new Set();this.cursor=0;this.peer=null;this.channel=null;this.stopped=false;this.reportedOffline=false;this.pollTimer=null;this.heartbeatTimer=null;this.negotiationTimer=null;this.clientId='';try{this.clientId=storage?.getItem(`goatleta:live-camera-client:${pair.roomId}`)??'';}catch{}this.ice=[];this.outboundIce=[];this.signalWrites=Promise.resolve();
  }
  async api(path,{method='GET',body}={}) {
    const headers={'Content-Type':'application/json','X-GoAtleta-Live':'1','X-GoAtleta-Live-Role':'camera','X-GoAtleta-Live-Token':this.pair.token,...(this.clientId?{'X-GoAtleta-Live-Client':this.clientId}:{})};
    const controller=new AbortController();let timedOut=false,rejectAbort;
    const canceled=new Promise((_resolve,reject)=>{rejectAbort=reject;});
    const abort=()=>{const error=new Error(timedOut?'A conexão com o notebook demorou para responder. Tente reconectar.':'Conexão cancelada.');error.name=timedOut?'TimeoutError':'AbortError';rejectAbort(error);};
    controller.signal.addEventListener('abort',abort,{once:true});this.apiRequests.add(controller);
    const timer=this.setTimer(()=>{timedOut=true;controller.abort();},this.requestTimeoutMs);
    try{
      const response=await Promise.race([this.fetcher(`/rooms/${this.pair.roomId}${path}`,{method,headers,signal:controller.signal,credentials:'omit',cache:'no-store',...(body!==undefined?{body:JSON.stringify(body)}:{})}),canceled]);
      const result=await Promise.race([response.json(),canceled]);
      if(!response.ok) {const error=new Error(result.error || 'Notebook indisponível. A gravação local continua.');error.status=response.status;throw error;}
      return result;
    }finally{this.clearTimer(timer);controller.signal.removeEventListener('abort',abort);this.apiRequests.delete(controller);}
  }
  send(message) { if(this.channel?.readyState!=='open'||this.channel.bufferedAmount>=256*1024)return false;this.channel.send(JSON.stringify(message));return true; }
  clearNegotiation(){if(this.negotiationTimer!==null)this.clearTimer(this.negotiationTimer);this.negotiationTimer=null;}
  watchNegotiation(peer,channel){
    this.clearNegotiation();
    if(channel.readyState==='open'&&!['failed','disconnected','closed'].includes(peer.connectionState))return;
    // Healthy HTTP signaling does not prove the paired RTC channel ever opened.
    // Return to offline so the existing bounded reconnect loop can try again.
    this.negotiationTimer=this.setTimer(()=>{
      if(this.stopped||this.peer!==peer||this.channel!==channel)return;
      this.negotiationTimer=null;
      if(channel.readyState==='open'&&!['failed','disconnected','closed'].includes(peer.connectionState))return;
      this.disconnect();this.reportedOffline=true;this.onState('offline','A conexão com o notebook não foi estabelecida. Tente reconectar.');
    },this.negotiationTimeoutMs);
  }
  signalingResult(peer,channel,error) {
    if(this.stopped||this.peer!==peer||this.channel!==channel)return;
    if(error&&[401,403,404,410].includes(error.status)){this.disconnect();this.onState('offline','Conexão encerrada no notebook. A gravação local continua.');return;}
    // Signaling HTTP can fail briefly while the paired data channel keeps copying.
    // Only a genuine transition republishes connected, avoiding repeated history scans.
    if(peer?.connectionState==='connected'&&channel?.readyState==='open'){
      this.clearNegotiation();
      if(this.reportedOffline){this.reportedOffline=false;this.onState('connected');}
    }else if(error){this.reportedOffline=true;this.onState('offline',error.message);}
  }
  async heartbeat(peer=this.peer,channel=this.channel) {
    if(this.stopped||this.peer!==peer||this.channel!==channel)return;
    try{await this.api('/heartbeat',{method:'POST',body:{}});this.signalingResult(peer,channel);}
    catch(error){this.signalingResult(peer,channel,error);}
  }
  async connect(stream) {
    this.disconnect();this.stopped=false;this.reportedOffline=false;this.onState('connecting');
    const joined=await this.api('/join',{method:'POST',body:{}});
    if(this.stopped)return;
    this.clientId=joined.cameraClientId;this.generation=joined.generation;this.cursor=joined.cursor??0;
    try{this.storage?.setItem(`goatleta:live-camera-client:${this.pair.roomId}`,this.clientId);}catch{}
    const peer=new this.Peer({iceServers:this.iceServers});this.peer=peer;this.offerUploaded=false;this.outboundIce=[];
    (stream?.getTracks()??[]).forEach(track=>peer.addTrack(track,stream));
    const channel=peer.createDataChannel('goatleta-live',{ordered:true});this.channel=channel;
    channel.onopen=()=>{if(this.stopped||this.peer!==peer||this.channel!==channel||channel.readyState!=='open'||['failed','disconnected','closed'].includes(peer.connectionState))return;this.clearNegotiation();this.reportedOffline=false;this.onState('connected');const c=this.clock();if(c.recordingId)this.send({kind:'recording',recordingId:c.recordingId,startEpochMs:c.startEpochMs,startedAtISO:c.startedAtISO,mimeType:c.mimeType,state:c.state,durationMs:c.durationMs,segmentId:c.segmentId});};
    channel.onclose=channel.onerror=()=>{if(this.peer===peer&&this.channel===channel&&!this.stopped){this.reportedOffline=true;this.onState('offline');}};
    channel.onmessage=event=>{
      if(this.stopped||this.peer!==peer||this.channel!==channel||channel.readyState!=='open')return;
      if(typeof event.data!=='string'||event.data.length>32768)return;
      try{const data=JSON.parse(event.data);if(data.kind==='ping'&&typeof data.id==='string'&&data.id.length<=128&&Number.isFinite(data.sentEpochMs)){const now=this.clock();if(now.recordingId)this.send({kind:'pong',id:data.id,sentEpochMs:data.sentEpochMs,cameraEpochMs:now.senderEpochMs??Date.now(),recordingId:now.recordingId,timeMs:now.timeMs});}else this.onMessage(data);}catch{}
    };
    const flushIce=()=>{if(!this.offerUploaded||this.peer!==peer||this.stopped)return;for(const candidate of this.outboundIce.splice(0)){const generation=this.generation;this.signalWrites=this.signalWrites.catch(()=>{}).then(async()=>{if(this.peer===peer&&this.channel===channel&&!this.stopped){await this.api('/signals',{method:'POST',body:{type:'ice',candidate,generation}});this.signalingResult(peer,channel);}}).catch(error=>this.signalingResult(peer,channel,error));}};
    peer.onicecandidate=event=>{if(this.peer!==peer||this.stopped)return;this.outboundIce.push(event.candidate?.toJSON()??null);flushIce();};
    peer.onconnectionstatechange=()=>{if(this.stopped||this.peer!==peer||this.channel!==channel)return;const state=peer.connectionState;if(state==='connected'&&channel.readyState==='open'){this.clearNegotiation();this.reportedOffline=false;this.onState('connected');}else if(['failed','disconnected','closed'].includes(state)){this.reportedOffline=true;this.onState('offline');}};
    await peer.setLocalDescription(await peer.createOffer());
    if(this.peer!==peer||this.stopped)return;
    await configureCameraPreview(peer,{setTimer:this.setTimer,clearTimer:this.clearTimer});
    if(this.peer!==peer||this.stopped)return;
    const offered=await this.api('/signals',{method:'POST',body:{type:'offer',sdp:peer.localDescription.sdp}});
    if(this.peer!==peer||this.stopped)return;
    this.generation=offered.generation;this.offerUploaded=true;flushIce();
    this.watchNegotiation(peer,channel);
    this.poll();
    this.heartbeatTimer=setInterval(()=>{void this.heartbeat(peer,channel);},10000);
  }
  async poll() {
    if(this.stopped)return;
    const peer=this.peer,channel=this.channel;
    try{
      const result=await this.api(`/signals?after=${this.cursor}`);
      if(this.stopped||this.peer!==peer)return;
      this.cursor=result.cursor;
      for(const signal of result.signals){
        if(signal.from!=='host'||signal.generation!==this.generation)continue;
        if(signal.type==='answer'&&peer.signalingState==='have-local-offer'){await peer.setRemoteDescription({type:'answer',sdp:signal.sdp});for(const candidate of this.ice.splice(0))await peer.addIceCandidate(candidate);}
        else if(signal.type==='ice'){if(peer.remoteDescription)await peer.addIceCandidate(signal.candidate);else if(this.ice.length<128)this.ice.push(signal.candidate);}
      }
      this.signalingResult(peer,channel);
    }catch(error){this.signalingResult(peer,channel,error);}
    if(!this.stopped&&this.peer===peer&&this.channel===channel)this.pollTimer=setTimeout(()=>this.poll(),750);
  }
  disconnect(){this.stopped=true;this.clearNegotiation();clearTimeout(this.pollTimer);clearInterval(this.heartbeatTimer);for(const controller of this.apiRequests)controller.abort();this.channel?.close();this.peer?.close();this.channel=null;this.peer=null;this.ice=[];}
}

export function bootCamera(document,window,{store=new CameraRecordingStore(window.indexedDB),transportFactory=(pair,options)=>new CameraTransport(pair,options)}={}) {
  const $=id=>document.getElementById(id),navigator=window.navigator,performance=window.performance??globalThis.performance,crypto=window.crypto??globalThis.crypto;
  const ui=Object.fromEntries(['notice','error','preview','frame-guides','guide-frame','guide-grid','guide-center','guides','switch-camera','connection','prepare','start','stop','pause','power','new-recording','reconnect','recover-camera','elapsed','saved','recordings','camera-app','recording-status','preview-placeholder','orientation-value','camera-source','use-camera-default','capture-info','transfer-row','transfer-status','transfer-retry','settings','settings-menu','fullscreen','show-recordings','close-recordings','recordings-panel','recordings-error','recordings-status','recordings-live','show-more-recordings','orientation-info','camera-source-field','saved-info','orientation-hint','delete-confirm','delete-detail','delete-cancel','delete-accept'].map(id=>[id.replaceAll('-','_'),$(id)]));
  let pair,stream,recorder,stopper,chunks,transport,metadata,phase='idle',format='landscape',operation='',recordStarted=false,deleted=false;
  let startedMono=0,stoppedTime=null,writes=Promise.resolve(),fatal=false,cameraSuspended=false,wakeLock,segmentNumber=0,segmentId='segment-0';
  let pausedMono=null,pausedTotal=0,activeSinceEpochMs=0,pauseOperation='',newRequested=false,nextAuthorized=false;
  let selectedDeviceId='',cameraDevices=[],videoSender,lastTransferId='',guidesEnabled=true,lastGuideFrame='';
  let reconnectTimer=null,reconnectAttempts=0,reconnecting=false,reconnectBlocked=false,wakeRequest=null,preparingVideoCopy=false;
  let recordingLimit=20,lastError='',lastNotice='',reconnectError='';
  let recordingProfile=null,qualityPeer=null,qualitySnapshot={},qualityTimer=null;
  const previewSampler=new CameraPreviewSampler(ui.preview,{now:()=>performance.now()});
  const reconnectDelays=[1000,2000,4000,8000,15000];
  const lastFacingDevice={environment:'',user:''};
  let rearPreference=null,manualChoice=null;try{rearPreference=readRearCameraPreference(window.localStorage);}catch{}
  const captureBusy=()=>['preparing','starting','recording','paused','stopping','finalization-error'].includes(phase);
  const copyPending=()=>preparingVideoCopy||videoSender?.preparing||!!videoSender?.queue.length||!!videoSender?.active&&['offering','reading','sending','finishing','paused'].includes(videoSender.active.state);
  const needsWakeLock=()=>!!stream?.getVideoTracks().some(track=>track.readyState!=='ended')||recordStarted&&captureBusy()||copyPending()&&(!reconnectBlocked&&reconnectAttempts<reconnectDelays.length||ui.camera_app.dataset.connection==='connected');
  async function syncWakeLock(){
    if(needsWakeLock()&&!document.hidden){
      if(wakeLock&&!wakeLock.released||wakeRequest)return;
      wakeRequest=(async()=>{try{const lock=await navigator.wakeLock?.request('screen');if(!lock)return;if(needsWakeLock()&&!document.hidden){wakeLock=lock;lock.addEventListener?.('release',()=>{if(wakeLock===lock)wakeLock=null;});}else await lock.release();}catch{}finally{wakeRequest=null;}})();
    }else if(wakeLock){const lock=wakeLock;wakeLock=null;try{await lock.release();}catch{}}
  }
  const clearReconnect=()=>{if(reconnectTimer!==null){if(window.clearTimeout)window.clearTimeout(reconnectTimer);else clearTimeout(reconnectTimer);}reconnectTimer=null;};
  function scheduleReconnect(){
    if(!pair||reconnectBlocked||document.hidden||reconnecting||reconnectTimer!==null||ui.camera_app.dataset.connection!=='offline'||!stream&&!metadata)return;
    if(reconnectAttempts>=reconnectDelays.length){void syncWakeLock();return;}
    reconnectTimer=window.setTimeout(()=>{reconnectTimer=null;reconnectAttempts++;void reconnect({automatic:true});},reconnectDelays[reconnectAttempts]);
  }
  const ended=()=>['stopped','error'].includes(phase);
  const elapsed=()=>metadata&&recordStarted?stoppedTime??Math.max(0,(pausedMono??performance.now())-startedMono-pausedTotal):0;
  const pausedMs=()=>pausedTotal+(pausedMono===null?0:Math.max(0,performance.now()-pausedMono));
  function renderFeedback(){
    const library=!ui.recordings_panel.hidden;
    ui.notice.textContent=lastNotice;ui.recordings_status.textContent=lastNotice;ui.notice.hidden=!lastNotice||library;ui.recordings_status.hidden=!lastNotice||!library;
    ui.error.textContent=lastError;ui.recordings_error.textContent=lastError;ui.error.hidden=!lastError||library;ui.recordings_error.hidden=!lastError||!library;
  }
  const notice=(message='')=>{lastNotice=message;renderFeedback();};
  const clearError=()=>{lastError='';renderFeedback();};
  const fail=message=>{lastNotice='';lastError=String(message);renderFeedback();};
  const state=(value,text)=>{ui.recording_status.dataset.state=value;ui.recording_status.textContent=text;};
  const labelButton=(button,label)=>{button.setAttribute('aria-label',label);button.title=label;const text=button.querySelector?.('.sr-only,[data-button-label]');if(text)text.textContent=label;else button.textContent=label;};
  const settings=(open,restoreFocus=false)=>{ui.settings_menu.hidden=!open;ui.settings.setAttribute('aria-expanded',String(open));if(open){if(!ui.camera_source.disabled&&!ui.camera_source_field.hidden)ui.camera_source.focus();else ui.fullscreen.focus();}else if(restoreFocus)ui.settings.focus();};
  ui.settings_menu.hidden=true;ui.recordings_panel.hidden=true;ui.camera_app.dataset.connection='idle';
  function recordings(open){
    if(open){settings(false);recordingLimit=20;ui.recordings_panel.hidden=false;if(!ui.recordings_panel.open)ui.recordings_panel.showModal?.();ui.show_recordings.setAttribute('aria-expanded','true');renderFeedback();void refresh();ui.close_recordings.focus();}
    else{ui.recordings_panel.hidden=true;if(ui.recordings_panel.open)ui.recordings_panel.close?.();ui.show_recordings.setAttribute('aria-expanded','false');lastNotice='';renderFeedback();ui.show_recordings.focus();}
  }
  const canRetryEmptyCapture=()=>phase==='error'&&!recordStarted&&(!recorder||recorder.state==='inactive')&&!chunks?.pendingCount&&!chunks?.task&&!operation;
  const clock=()=>({recordingId:recordStarted?metadata?.id:undefined,startEpochMs:metadata?.startEpochMs,startedAtISO:metadata?.startedAt,mimeType:metadata?.mimeType,state:fatal||phase==='finalization-error'?'error':phase==='paused'?'paused':phase==='stopping'?'recording':recorder?.state==='recording'?'recording':'stopped',timeMs:elapsed(),durationMs:elapsed(),senderEpochMs:Date.now(),pausedMs:pausedMs(),activeSinceEpochMs,recording:recordStarted&&!fatal&&!cameraSuspended&&phase==='recording'&&recorder?.state==='recording',segmentId});
  const terminal=()=>{const c=clock();try{transport?.send({kind:'recording',recordingId:c.recordingId,startEpochMs:c.startEpochMs,startedAtISO:c.startedAtISO,mimeType:c.mimeType,state:c.state,durationMs:c.durationMs,segmentId:c.segmentId});}catch{}};
  const captureInfo=()=>{const track=stream?.getVideoTracks?.()[0],settings=track?.getSettings?.()??{},width=ui.preview.videoWidth||settings.width,height=ui.preview.videoHeight||settings.height;return {label:String(track?.label||cameraDevices.find(device=>device.deviceId===settings.deviceId)?.label||'Câmera selecionada').slice(0,120),...(Number.isFinite(width)?{width}:{}),...(Number.isFinite(height)?{height}:{}),...(Number.isFinite(settings.frameRate)?{frameRate:settings.frameRate}:{}),...(Number.isFinite(settings.zoom)?{zoom:settings.zoom}:{})};};
  const publishStatus=()=>{if(pair)try{transport?.send({kind:'camera-status',roomId:pair.roomId,state:phase==='stopping'?'finalizing':phase==='recording'?'recording':phase==='paused'?'paused':phase==='error'||phase==='finalization-error'?'error':stream?'preview':'off',...(recordStarted&&metadata?{recordingId:metadata.id}:{}),...(stream?{capture:captureInfo()}:{}),controlsVersion:2});}catch{}};
  const clearQualityTimer=()=>{if(qualityTimer!==null)(window.clearTimeout?.bind(window)??clearTimeout)(qualityTimer);qualityTimer=null;};
  function scheduleQuality(diagnosticPhase){
    clearQualityTimer();
    if(typeof transport?.peer?.getStats!=='function'||document.hidden||!stream)return;
    const sourceStream=stream,sourceRecorder=recorder;
    qualityTimer=window.setTimeout(()=>{qualityTimer=null;if(stream===sourceStream&&!document.hidden&&phase===diagnosticPhase&&(diagnosticPhase!=='recording'||recorder===sourceRecorder))void publishQuality(diagnosticPhase);},3000);
  }
  async function publishQuality(diagnosticPhase){
    const peer=transport?.peer,sourceStream=stream,source=captureInfo();
    if(!pair||!sourceStream||ui.camera_app.dataset.connection!=='connected'||typeof peer?.getStats!=='function')return;
    const evidence=await collectCameraQuality(peer,qualityPeer===peer?qualitySnapshot:{},{setTimer:(fn,ms)=>window.setTimeout(fn,ms),clearTimer:timer=>window.clearTimeout?.(timer)});
    if(transport?.peer!==peer||stream!==sourceStream||ui.camera_app.dataset.connection!=='connected'||diagnosticPhase==='recording'&&phase!=='recording')return;
    qualityPeer=peer;qualitySnapshot=evidence.snapshot;
    // Local total/presented frame rates remain independent of RTC sourceFps
    // and previewFps. A compositor cap must never inflate either measurement.
    const local=!document.hidden?previewSampler.sample(sourceStream):null;
    transport.send({kind:'camera-diagnostics',roomId:pair.roomId,phase:diagnosticPhase,...evidence.metrics,...(local?.metrics??{}),...(source.width?{width:source.width}:{}),...(source.height?{height:source.height}:{}),requestedFps:60,...(recordingProfile?{mimeType:metadata?.mimeType||recordingProfile.mimeType,codecSupport:recordingProfile.codecSupport,...(recordingProfile.capabilityVerified?{smooth:recordingProfile.smooth,powerEfficient:recordingProfile.powerEfficient}:{})}:{})});
  }
  const controlError=command=>transport?.send({kind:'camera-control-error',roomId:pair.roomId,command});
  function captureFacing(source,requestedId=''){
    const track=source?.getVideoTracks?.()[0],settings=track?.getSettings?.()??{};
    const id=settings.deviceId||requestedId||(source===stream?selectedDeviceId:'');
    return cameraFacingMode(track?.label,settings.facingMode)||cameraFacingMode(cameraDevices.find(device=>device.deviceId===id)?.label)||Object.keys(lastFacingDevice).find(face=>id&&lastFacingDevice[face]===id)||'';
  }
  function updateGuides(){
    const width=ui.preview.videoWidth,height=ui.preview.videoHeight;
    ui.guides.setAttribute('aria-pressed',String(guidesEnabled));ui.guides.disabled=!stream;
    ui.frame_guides.hidden=!guidesEnabled||!stream||!(width>0&&height>0);
    if(ui.frame_guides.hidden)return;
    const frame=`0 0 ${width} ${height}`;if(frame===lastGuideFrame)return;lastGuideFrame=frame;
    ui.guide_frame.setAttribute('viewBox',frame);ui.guide_frame.setAttribute('preserveAspectRatio','xMidYMid meet');
    ui.guide_grid.setAttribute('d',`M${width/3} 0V${height}M${width*2/3} 0V${height}M0 ${height/3}H${width}M0 ${height*2/3}H${width}`);
    ui.guide_center.setAttribute('d',`M${width*.2} ${height/2}H${width*.8}M${width/2} ${height*.46}V${height*.54}`);
  }
  function syncControls(){
    const blocked=!!operation||captureBusy();
    videoSender?.setPaused(captureBusy());
    ui.camera_app.dataset.phase=phase;
    ui.camera_app.dataset.cameraActive=String(!!stream);
    ui.camera_app.dataset.paired=String(!!pair);
    ui.prepare.disabled=!pair||blocked||reconnecting||!!stream||phase==='error';ui.start.disabled=!pair||phase!=='preview'||!!operation;
    ui.prepare.hidden=!pair||!!stream||!['idle','preparing','stopped'].includes(phase);ui.prepare.className=phase==='stopped'?'center-action':'center-action primary';labelButton(ui.prepare,phase==='preparing'?'Preparando…':'Ligar câmera');ui.start.hidden=!pair||!['preview','starting'].includes(phase);ui.stop.hidden=!['recording','paused','stopping'].includes(phase);
    ui.pause.hidden=!['recording','paused'].includes(phase);ui.pause.disabled=!!operation||!!pauseOperation||!['recording','paused'].includes(phase);labelButton(ui.pause,phase==='paused'?'Continuar gravação':'Pausar gravação');ui.pause.querySelector?.('svg path')?.setAttribute('d',phase==='paused'?'m8 5 11 7-11 7Z':'M6 5h4v14H6zM14 5h4v14h-4z');
    ui.power.hidden=!stream;ui.power.disabled=blocked||!!operation;labelButton(ui.power,'Desligar câmera');
    ui.new_recording.className='center-action primary';ui.new_recording.hidden=!pair||phase!=='stopped'||ui.camera_app.dataset.connection!=='connected';ui.new_recording.disabled=!!operation||newRequested||ui.camera_app.dataset.connection!=='connected';
    labelButton(ui.new_recording,newRequested?'Preparando…':'Nova gravação');
    ui.reconnect.hidden=!pair||['connected','connecting'].includes(ui.camera_app.dataset.connection)||!stream&&!metadata;ui.reconnect.disabled=reconnecting;
    ui.recover_camera.hidden=!['error','finalization-error'].includes(phase);ui.recover_camera.disabled=!!operation||phase==='error'&&reconnecting;
    labelButton(ui.recover_camera,phase==='finalization-error'?'Tentar finalizar':canRetryEmptyCapture()?'Tentar novamente':'Abrir gravações');
    if(!pair){ui.preview_placeholder.hidden=false;ui.preview_placeholder.replaceChildren();const title=document.createElement('strong');title.textContent='Leia o QR do notebook';ui.preview_placeholder.append(title);ui.connection.textContent='Aguardando QR';}
    ui.transfer_retry.disabled=captureBusy()||ui.camera_app.dataset.connection!=='connected';
    ui.show_recordings.className='icon-control';ui.guides.hidden=!pair;ui.switch_camera.hidden=!pair;ui.settings.hidden=!pair;
    const face=captureFacing(stream);ui.switch_camera.disabled=blocked||!stream||phase==='error';labelButton(ui.switch_camera,face?`Alternar para câmera ${face==='environment'?'frontal':'traseira'}`:'Alternar câmera');
    const isDefault=!!selectedDeviceId&&selectedDeviceId===resolveRearCameraPreference(cameraDevices,rearPreference);
    ui.use_camera_default.hidden=!pair||!stream||face==='user';ui.use_camera_default.disabled=blocked||!canSaveRearDefault()||isDefault;
    labelButton(ui.use_camera_default,isDefault?'Câmera padrão':'Usar como padrão');
    ui.camera_source.disabled=blocked||cameraDevices.length<1;
    ui.camera_source_field.hidden=!pair||cameraDevices.length<1;ui.orientation_info.hidden=!stream;ui.orientation_hint.hidden=!stream;ui.capture_info.hidden=!stream;
    ui.saved_info.hidden=!recordStarted||!ui.saved.textContent||!Number.parseFloat(ui.saved.textContent);
    ui.recordings_live.hidden=!captureBusy();ui.recordings_live.textContent=phase==='paused'?'Gravação pausada':phase==='recording'?'A câmera continua gravando':phase==='stopping'||phase==='finalization-error'?'Finalizando gravação':'Preparando câmera';
    ui.show_more_recordings.disabled=!!operation;
    ui.stop.disabled=!!operation||!['recording','paused','finalization-error'].includes(phase);
    labelButton(ui.stop,phase==='stopping'?'Finalizando…':phase==='finalization-error'?'Tentar finalizar':'Encerrar gravação');
    for(const button of ui.recordings.querySelectorAll('button'))button.disabled=!!(blocked||button.dataset.unavailable==='true'||button.dataset.deleteRecording&&videoSender?.isTransferring(button.dataset.deleteRecording));
    updateGuides();publishStatus();void syncWakeLock();
  }
  const connection=(value,message='')=>{
    if(value==='connected'){reconnectAttempts=0;reconnectBlocked=false;clearReconnect();if(lastError&&lastError===reconnectError)clearError();reconnectError='';}
    else if(value==='offline'&&message==='Conexão encerrada no notebook. A gravação local continua.'){reconnectBlocked=true;clearReconnect();}
    ui.camera_app.dataset.connection=value;
    ui.connection.textContent=({connecting:'Conectando…',connected:'Conectado',offline:'Sem conexão'})[value]??'Não conectado';
    ui.connection.dataset.active=String(value==='connected');ui.reconnect.hidden=value!=='offline'||!stream&&!metadata;
    if(value==='connected'){videoSender?.resume();void queueSavedVideos();if(stream&&!document.hidden){previewSampler.reset(stream);if(['preview','recording','paused'].includes(phase))scheduleQuality(phase);}void publishQuality(phase==='recording'?'recording':phase==='paused'?'paused':'preview');}else if(value==='offline'||value==='connecting'){clearQualityTimer();videoSender?.disconnected();}
    notice(value==='offline'&&phase==='recording'?'A gravação continua no celular.':'');
    publishStatus();syncControls();if(value==='offline')scheduleReconnect();
  };
  async function queueSavedVideos(){
    if(!videoSender||!pair)return;
    try{for(const saved of (await store.list()).filter(item=>item.roomId===pair.roomId&&transferableVideo(item)).slice(0,30))void videoSender.enqueue(saved.id);}catch{/* Phone originals remain available when local storage cannot be read. */}
  }
  const persistEvent=(kind,details={})=>{if(!metadata||!recordStarted||deleted||['stopped','error'].includes(metadata.state))return;const id=metadata.id;writes=writes.catch(()=>{}).then(()=>store.update(id,meta=>['stopped','error'].includes(meta.state)?meta:{...meta,connectionEvents:[...meta.connectionEvents.slice(-499),{kind,timeMs:elapsed(),atEpochMs:Date.now(),...details}]})).catch(()=>{});};
  function showPreviewOff(){ui.preview.pause();ui.preview.srcObject=null;ui.preview_placeholder.hidden=false;ui.preview_placeholder.replaceChildren();const title=document.createElement('strong');title.textContent='Câmera desligada';ui.preview_placeholder.append(title);orientationHint();}
  async function releaseCamera(){
    clearQualityTimer();previewSampler.clear();
    for(const track of stream?.getTracks()??[]){try{track.stop();}catch{}}
    stream=null;showPreviewOff();ui.reconnect.hidden=ui.camera_app.dataset.connection!=='offline';
    syncControls();
  }
  function orientationHint(){
    const settings=stream?.getVideoTracks()[0]?.getSettings?.()??{};
    const source=captureInfo(),index=Math.max(0,cameraDevices.findIndex(device=>device.deviceId===settings.deviceId));
    const actual=source.width&&source.height?(source.width>=source.height?'landscape':'portrait'):'',actualLabel=actual==='landscape'?'Horizontal':'Vertical';
    if(stream&&actual){format=actual;ui.camera_app.dataset.format=actual;}
    ui.orientation_value.textContent=stream&&actual?actualLabel:'Câmera desligada';ui.orientation_hint.textContent='Gire o celular para mudar o enquadramento.';
    ui.capture_info.textContent=stream?`${cameraDisplayName(source.label,index,settings.facingMode)}${source.width&&source.height?` · ${source.width} × ${source.height}`:''}${source.frameRate?` · ${Math.round(source.frameRate)} fps configurados`:''}${source.zoom!==undefined?` · zoom ${source.zoom.toFixed(1)}×`:''}`:'Detalhes disponíveis ao ligar a câmera.';
    updateGuides();
  }
  async function view(){
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}return;}
    try{await ui.camera_app.requestFullscreen?.();}catch{fail('Tela cheia indisponível neste navegador.');}
  }
  function confirmDelete(item){
    const message=`${new Date(item.startEpochMs).toLocaleString('pt-BR')} · ${(item.bytes/1048576).toFixed(1)} MB · ${item.chunkCount} trechos`;
    if(!ui.delete_confirm.showModal)return Promise.resolve(window.confirm(`${message}\nExcluir o vídeo e as marcações apenas deste aparelho?`));
    ui.delete_detail.textContent=message;ui.delete_confirm.returnValue='cancel';
    return new Promise(resolve=>{
      ui.delete_confirm.addEventListener('close',()=>resolve(ui.delete_confirm.returnValue==='delete'),{once:true});
      ui.delete_cancel.onclick=()=>ui.delete_confirm.close('cancel');ui.delete_accept.onclick=()=>ui.delete_confirm.close('delete');
      ui.delete_confirm.showModal();ui.delete_cancel.focus();
    });
  }
  async function refresh(){
    try{
      const list=await store.list();ui.recordings.replaceChildren();
      const used=list.find(item=>item.roomId===pair?.roomId);if(used&&pair)try{window.sessionStorage.setItem(CAMERA_USED_SESSION+pair.roomId,used.id);}catch{}
      if(!metadata&&phase==='idle'&&used?.state==='stopped'){metadata=used;recordStarted=true;stoppedTime=used.durationMs??used.lastSavedTimeMs??0;phase='stopped';state('stopped','Encerrada');ui.saved.textContent=`${(used.bytes/1048576).toFixed(1)} MB`;showPreviewOff();}
      if(!list.length){const small=document.createElement('small');small.textContent='Nenhuma gravação salva ainda.';ui.recordings.append(small);}
      for(const item of list.slice(0,recordingLimit)){
        const row=document.createElement('div');row.className='saved-item';
        const title=document.createElement('p');title.textContent=new Date(item.startEpochMs).toLocaleString('pt-BR');
        const detail=document.createElement('small');detail.textContent=metadata?.id===item.id&&['stopping','finalization-error'].includes(phase)?'Finalização pendente · aguarde antes de salvar ou excluir':cameraRecordingDetail(item,metadata?.id===item.id&&['starting','recording','paused'].includes(phase));
        const controls=document.createElement('div');controls.className='controls';
        for(const [label,manifestOnly] of [['Salvar vídeo',false],['Salvar marcações',true]]){
          const button=document.createElement('button');button.textContent=item.state==='recording'&&!manifestOnly?'Salvar trechos':label;button.dataset.unavailable=String(!item.chunkCount);
          button.onclick=async()=>{
            if(operation||captureBusy())return;operation='export';clearError();notice(manifestOnly?'Preparando marcações…':'Preparando vídeo…');syncControls();
            try{const data=await store.downloadData(item.id);const blob=manifestOnly?new Blob([JSON.stringify(data.manifest,null,2)],{type:'application/json'}):data.blob;const url=window.URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`go-atleta-${item.id}${manifestOnly?'.json':item.mimeType.includes('mp4')?'.mp4':'.webm'}`;a.click();notice('Arquivo preparado.');window.setTimeout(()=>window.URL.revokeObjectURL(url),60000);}catch(error){fail(error.message);}finally{operation='';syncControls();}
          };controls.append(button);
        }
        const remove=document.createElement('button');remove.textContent='Excluir do celular';remove.className='danger';remove.dataset.unavailable=String(!['stopped','error'].includes(item.state));remove.dataset.deleteRecording=item.id;
        remove.onclick=async()=>{
          if(operation||captureBusy()||videoSender?.isTransferring(item.id))return;operation='delete';clearError();syncControls();
          try{const removed=await deleteCameraRecording(store,item.id,{canDelete:()=>!captureBusy()&&!videoSender?.isTransferring(item.id),confirm:confirmDelete});if(removed){if(metadata?.id===item.id)deleted=true;notice('Gravação excluída do celular.');await refresh();}}catch(error){fail(error.message);}finally{operation='';syncControls();}
        };controls.append(remove);row.append(title,detail,controls);ui.recordings.append(row);
      }
      ui.show_more_recordings.hidden=list.length<=recordingLimit;syncControls();
    }catch(error){ui.recordings.textContent='Não foi possível abrir as gravações locais.';fail(error.message);}
  }
  function receive(data){
    if(data.kind==='video-request'&&typeof data.recordingId==='string'){void videoSender?.enqueue(data.recordingId,{force:true});return;}
    if(typeof data.kind==='string'&&data.kind.startsWith('video-')){videoSender?.handle(data);return;}
    if(data.roomId===pair?.roomId){
      if(data.kind==='new-recording-blocked'){newRequested=false;notice('Aguarde salvar as marcações no computador.');syncControls();return;}
      if(data.kind==='camera-on'){void prepare().then(ok=>{if(!ok)controlError(data.kind);});return;}
      if(data.kind==='camera-off'){void powerOff().then(ok=>{if(!ok)controlError(data.kind);});return;}
      if(data.kind==='new-recording'){if(data.recordingId===metadata?.id)void prepareNext().then(ok=>{if(!ok)controlError(data.kind);});return;}
    }
    if(data.kind==='start-recording'){
      if(data.roomId===pair?.roomId&&phase==='preview'&&!operation&&stream)void ui.start.onclick();
      return;
    }
    if(!metadata||!recordStarted||deleted)return;
    if((data.kind==='pause-recording'||data.kind==='resume-recording')&&data.recordingId===metadata.id){void setPaused(data.kind==='pause-recording');return;}
    if(data.kind==='stop-recording'){
      if(data.recordingId===metadata.id&&['recording','paused','finalization-error'].includes(phase))void ui.stop.onclick();
      return;
    }
    if(fatal){transport?.send({kind:'storage-error',recordingId:metadata.id});return;}
    const id=metadata.id;
    if(data.kind==='point'){
      let point;try{point=projectCameraPoint(data.point,id,elapsed());}catch{return;}
      writes=writes.catch(()=>{}).then(()=>store.addPoint(id,point)).then(()=>transport?.send({kind:'point-ack',id:point.id,recordingId:id})).catch(()=>{transport?.send({kind:'storage-error',recordingId:id});fail('Não foi possível salvar uma marcação neste aparelho. Confira o notebook.');});
    }else if(data.kind==='undo-point'&&data.recordingId===id&&typeof data.id==='string'&&data.id.length<=128){writes=writes.catch(()=>{}).then(()=>store.undoPoint(id,data.id)).then(()=>transport?.send({kind:'undo-point-ack',id:data.id,recordingId:id})).catch(()=>{transport?.send({kind:'storage-error',recordingId:id});fail('Não foi possível salvar a correção da marcação neste aparelho.');});}
  }
  async function reconnect({automatic=false}={}){
    if(!pair||reconnecting||automatic&&reconnectBlocked)return;
    if(!automatic){reconnectAttempts=0;reconnectBlocked=false;}
    clearReconnect();reconnecting=true;
    ui.reconnect.disabled=true;segmentNumber++;segmentId=`segment-${segmentNumber}`;if(!ended())persistEvent('connection-attempt',{segmentId});
    try{transport??=transportFactory(pair,{onState:connection,onMessage:receive,clock});await transport.connect(stream??null);}catch(error){
      if([401,403,404,410].includes(error.status))reconnectBlocked=true;connection('offline');
      if(phase==='recording')notice('A gravação continua no celular.');
      if(error.status===404||error.status===410){reconnectError='Conexão encerrada. Salve a gravação e gere um novo QR code para o próximo jogo.';fail(reconnectError);}
      else if(!automatic||reconnectAttempts>=reconnectDelays.length){reconnectError=error.name==='TimeoutError'?error.message:'Não foi possível reconectar ao notebook. Confira o Wi-Fi e tente novamente.';fail(reconnectError);}
    }
    finally{reconnecting=false;ui.reconnect.disabled=false;syncControls();scheduleReconnect();}
  }
  async function listCameras(){
    try{cameraDevices=(await navigator.mediaDevices.enumerateDevices?.()??[]).filter(device=>device.kind==='videoinput'&&typeof device.deviceId==='string'&&device.deviceId);}catch{cameraDevices=[];}
    renderCameraOptions();
  }
  function renderCameraOptions(){
    const preferred=resolveRearCameraPreference(cameraDevices,rearPreference);
    const automatic=document.createElement('option');automatic.value='';automatic.textContent='Automática · traseira';
    ui.camera_source.replaceChildren(automatic,...cameraDevices.map((device,index)=>{const option=document.createElement('option');option.value=device.deviceId;option.textContent=`${cameraDisplayName(device.label,index)}${preferred===device.deviceId?' · padrão':''}`;return option;}));
    ui.camera_source.value=selectedDeviceId;
  }
  function canSaveRearDefault(){return !!stream&&ui.preview.srcObject===stream&&ui.preview.videoWidth>0&&ui.preview.videoHeight>0&&captureFacing(stream)==='environment'&&selectedDeviceId.length>0&&selectedDeviceId.length<=512&&stream.getVideoTracks().some(track=>track.readyState!=='ended');}
  function saveRearDefault(){
    if(captureBusy()||operation||!canSaveRearDefault())return false;
    let storage,previousRaw,wrote=false;
    try{
      storage=window.localStorage;if(typeof storage?.setItem!=='function'||typeof storage.getItem!=='function')throw new Error('Storage unavailable');
      previousRaw=storage.getItem(CAMERA_REAR_PREFERENCE);const track=stream.getVideoTracks()[0],next={version:1,deviceId:selectedDeviceId,label:String(track.label||cameraDevices.find(device=>device.deviceId===selectedDeviceId)?.label||'').slice(0,120)};
      storage.setItem(CAMERA_REAR_PREFERENCE,JSON.stringify(next));wrote=true;const saved=readRearCameraPreference(storage);
      if(!saved||saved.deviceId!==next.deviceId||saved.label!==next.label)throw new Error('Preference was not confirmed');
      rearPreference=saved;clearError();notice();renderCameraOptions();syncControls();return true;
    }catch{
      if(wrote)try{if(previousRaw===null)storage.removeItem?.(CAMERA_REAR_PREFERENCE);else storage.setItem(CAMERA_REAR_PREFERENCE,previousRaw);}catch{}
      fail('Não foi possível salvar a câmera padrão. Tente novamente.');syncControls();return false;
    }
  }
  function stopCapture(source){for(const track of source?.getTracks()??[])try{track.stop();}catch{}}
  function requireCameraForeground(){if(document.hidden||phase!=='preparing')throw Object.assign(new Error('Volte a esta aba no celular e toque em Ligar câmera.'),{name:'InvalidStateError'});}
  function cameraSourceFailure(error,attempts){
    const messages={NotReadableError:'Não foi possível abrir a câmera. Feche outras abas ou apps que usam a câmera e tente Ligar câmera novamente. Você também pode escolher outra câmera nas configurações.',AbortError:'A câmera não conseguiu iniciar. Feche outras abas ou apps que usam a câmera e tente novamente.',TrackStartError:'A câmera não conseguiu iniciar. Feche outras abas ou apps que usam a câmera e tente novamente.',NotAllowedError:'Permita o acesso à câmera e ao microfone para preparar.',NotFoundError:'A câmera selecionada não está disponível. Escolha outra câmera nas configurações.',OverconstrainedError:'Não foi possível abrir esta câmera com as opções disponíveis. Escolha outra câmera nas configurações.',InvalidStateError:'Volte a esta aba no celular e toque em Ligar câmera.'};
    const name=Object.hasOwn(messages,error?.name)?error.name:'CameraError';
    ui.camera_app.dataset.captureError=name;ui.camera_app.dataset.captureAttempts=String(attempts);
    return Object.assign(new Error(messages[name]??'Não foi possível abrir a câmera. Feche outras abas ou apps que usam a câmera e tente novamente.'),{name});
  }
  async function requestCapture(deviceId){
    let acquired,legacyFallback=false,calls=0;
    const simpleVideo={...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),frameRate:{min:59.94,ideal:60,max:60}};
    ui.camera_app.dataset.captureError='';ui.camera_app.dataset.captureAttempts='0';
    for(let attempt=0;attempt<3;attempt++){
      try{
        requireCameraForeground();calls++;
        acquired=await navigator.mediaDevices.getUserMedia(legacyFallback?{video:simpleVideo,audio:false}:attempt===2?{video:simpleVideo,audio:true}:cameraCaptureConstraints(format,deviceId));
      }catch(failure){
        let error=failure;
        if(!legacyFallback&&['OverconstrainedError','NotFoundError'].includes(error.name)){
          legacyFallback=true;
          try{requireCameraForeground();calls++;acquired=await navigator.mediaDevices.getUserMedia({video:simpleVideo,audio:false});}catch(fallbackError){error=fallbackError;}
        }
        if(!acquired){
          if(attempt<2&&['NotReadableError','AbortError','TrackStartError'].includes(error.name)){await new Promise(resolve=>window.setTimeout(resolve,attempt===0?250:500));continue;}
          throw cameraSourceFailure(error,calls);
        }
      }
      try{requireCameraForeground();}catch(error){stopCapture(acquired);throw cameraSourceFailure(error,calls);}
      ui.camera_app.dataset.captureAttempts=String(calls);break;
    }
    const track=acquired.getVideoTracks?.().find(item=>item.readyState!=='ended');
    if(!track){stopCapture(acquired);throw new Error('A câmera não forneceu uma imagem ativa. Tente ligar novamente.');}
    const actualId=track.getSettings?.().deviceId;
    if(deviceId&&actualId&&actualId!==deviceId){stopCapture(acquired);throw new Error('O navegador não abriu a câmera selecionada. Tente outra opção.');}
    return acquired;
  }
  async function showCapture(acquired,deviceId){
    requireCameraForeground();
    await resetCameraZoom(acquired.getVideoTracks()[0]);
    requireCameraForeground();
    await presentCameraPreview(ui.preview,window,acquired,()=>phase==='preparing');ui.preview_placeholder.hidden=true;
    requireCameraForeground();
    stream=acquired;selectedDeviceId=stream.getVideoTracks()[0]?.getSettings?.().deviceId||deviceId||'';ui.camera_source.value=selectedDeviceId;
    previewSampler.reset(stream);
    const face=captureFacing(stream);if(face&&selectedDeviceId)lastFacingDevice[face]=selectedDeviceId;
  }
  async function prepare(deviceId,replace=false,expectedFace=''){
    if(stream&&!captureBusy()&&!replace)return true;
    if(captureBusy()||phase==='error'||operation||reconnecting||!pair)return false;
    const explicit=typeof deviceId==='string'||manualChoice!==null;
    deviceId=typeof deviceId==='string'?deviceId:manualChoice??'';
    if(replace&&stream&&deviceId&&deviceId===stream.getVideoTracks?.()[0]?.getSettings?.().deviceId){ui.camera_source.value=deviceId;return true;}
    let previousPhase=phase;const previousStream=stream,previousDeviceId=stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId||selectedDeviceId;let acquired,previousReleased=false,preferenceWarning='';
    phase='preparing';syncControls();clearError();state('idle','Preparando câmera');
    try{
      if(!window.isSecureContext)throw new Error('A câmera precisa de uma conexão HTTPS válida. Confira o endereço seguro no notebook.');
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder||!window.RTCPeerConnection)throw new Error('Este navegador não oferece câmera, gravação e transmissão compatíveis. Use uma versão atual do Chrome no Android.');
      let used;try{used=window.sessionStorage.getItem?.(CAMERA_USED_SESSION+pair.roomId);}catch{}
      const prior=(await store.list()).filter(item=>item.roomId===pair.roomId),stored=prior.find(item=>item.state!=='stopped');
      if(!nextAuthorized&&!metadata&&prior[0]?.state==='stopped'){metadata=prior[0];recordStarted=true;stoppedTime=metadata.durationMs??metadata.lastSavedTimeMs??0;previousPhase='stopped';}
      if(stored||used&&!metadata&&!nextAuthorized)throw new Error('Esta conexão tem uma gravação pendente. Confira e salve os trechos antes de iniciar outra.');
      await listCameras();
      if(!explicit){deviceId=resolveRearCameraPreference(cameraDevices,rearPreference);if(deviceId)expectedFace='environment';else if(!rearPreference)deviceId=selectedDeviceId;}
      releaseCameraOrientation(window);requireCameraForeground();
      // Some phones expose one camera at a time. Keep the paired data channel,
      // but release physical tracks before opening another device.
      if(previousStream){stopCapture(previousStream);previousReleased=true;stream=null;showPreviewOff();}
      acquired=await requestCapture(deviceId);await listCameras();
      const currentId=acquired.getVideoTracks?.()[0]?.getSettings?.().deviceId||deviceId;
      const storedRear=resolveRearCameraPreference(cameraDevices,rearPreference),preferred=explicit?(deviceId||currentId):(deviceId||storedRear||preferredCameraDevice(cameraDevices,currentId));
      if(!explicit&&rearPreference&&!storedRear)preferenceWarning='A câmera padrão não está disponível. A prévia usa outra câmera.';
      if(!explicit&&!deviceId&&storedRear)expectedFace='environment';
      if(preferred&&preferred!==currentId){
        stopCapture(acquired);acquired=null;
        try{acquired=await requestCapture(preferred);deviceId=preferred;}
        catch(error){if(!currentId)throw error;acquired=await requestCapture(currentId);deviceId=currentId;preferenceWarning=storedRear===preferred?'A câmera padrão não abriu. A prévia usa outra câmera; tente ligar novamente.':'A câmera preferida não abriu. A prévia usa outra câmera.';}
      }
      if(expectedFace&&captureFacing(acquired,deviceId)!==expectedFace)throw new Error('O navegador não abriu a câmera solicitada.');
      await showCapture(acquired,deviceId);
      phase=previousPhase==='stopped'?'stopped':'preview';state(phase==='stopped'?'stopped':'idle',phase==='stopped'?'Encerrada':'Pronta');notice();orientationHint();
      if(explicit)manualChoice=null;
      await reconnect();
      if(preferenceWarning)fail(preferenceWarning);
    }catch(error){
      if(acquired&&acquired!==previousStream)stopCapture(acquired);
      stream=previousReleased?null:previousStream;selectedDeviceId=previousDeviceId;
      if(previousReleased&&previousDeviceId){
        try{acquired=await requestCapture(previousDeviceId);await showCapture(acquired,previousDeviceId);}catch{stopCapture(acquired);stream=null;}
      }
      ui.camera_source.value=selectedDeviceId;phase=previousPhase==='stopped'?'stopped':stream?'preview':'idle';
      if(stream){ui.preview.srcObject=stream;void ui.preview.play().catch(()=>{});ui.preview_placeholder.hidden=true;orientationHint();if(previousReleased)await reconnect();}else await releaseCamera();
      state(phase==='stopped'?'stopped':'idle',phase==='stopped'?'Encerrada':stream?'Pronta':'Sem gravar');
      const action=expectedFace?'alternar a câmera':'trocar a lente';
      const message=replace?stream?`Não foi possível ${action}. ${previousReleased?'A câmera anterior foi reaberta.':'A câmera atual foi mantida.'}`:`Não foi possível ${action}. A câmera está desligada; tente ligá-la novamente.`:error.name==='NotAllowedError'?'Permita o acesso à câmera e ao microfone para preparar.':error.message;
      fail(message);return false;
    }
    finally{syncControls();}
    return !!stream;
  }
  async function powerOff(){if(captureBusy()||operation)return false;if(!stream)return true;phase=phase==='stopped'?'stopped':'idle';await releaseCamera();notice();syncControls();return true;}
  async function prepareNext(){
    if(phase!=='stopped'||operation||!metadata||metadata.state!=='stopped'||!stopper?.finalized&&stoppedTime===null)return false;
    operation='new';syncControls();
    try{
      recordingProfile=null;
      await writes;nextAuthorized=true;metadata=null;recorder=null;stopper=null;chunks=null;recordStarted=false;deleted=false;stoppedTime=null;fatal=false;cameraSuspended=false;pausedMono=null;pausedTotal=0;pauseOperation='';newRequested=false;segmentNumber=0;segmentId='segment-0';ui.elapsed.textContent='00:00';ui.saved.textContent='0 MB';clearError();
      phase=stream?'preview':'idle';state('idle',stream?'Pronta':'Sem gravar');notice();
      operation='';if(!stream)return await prepare();syncControls();return true;
    }catch(error){fail(error.message);return false;}finally{operation='';syncControls();}
  }
  async function setPaused(paused){
    if(operation||pauseOperation||!recorder||paused&&phase!=='recording'||!paused&&phase!=='paused')return;
    if(!paused&&(cameraSuspended||document.hidden)){fail('Volte à câmera ativa antes de continuar a gravação.');controlError('resume-recording');return;}
    if(typeof recorder.pause!=='function'||typeof recorder.resume!=='function'){fail('Este navegador não permite pausar a gravação.');controlError(paused?'pause-recording':'resume-recording');return;}
    pauseOperation=paused?'pause':'resume';syncControls();
    try{if(paused)recorder.pause();else recorder.resume();}catch(error){pauseOperation='';syncControls();fail(error.message);controlError(paused?'pause-recording':'resume-recording');}
  }
  ui.prepare.onclick=()=>prepare();
  ui.camera_source.onchange=async()=>{const next=ui.camera_source.value;if(captureBusy()||operation){ui.camera_source.value=selectedDeviceId;return;}if(!cameraDevices.some(device=>device.deviceId===next)&&next!==''){ui.camera_source.value=selectedDeviceId;return;}if(stream){manualChoice=null;await prepare(next,true);}else{manualChoice=next;selectedDeviceId=next;}syncControls();};
  ui.use_camera_default.onclick=saveRearDefault;
  ui.power.onclick=powerOff;
  ui.new_recording.onclick=()=>{if(phase!=='stopped'||operation||newRequested||!metadata||ui.camera_app.dataset.connection!=='connected')return;newRequested=true;transport?.send({kind:'new-recording-request',roomId:pair.roomId,recordingId:metadata.id});notice();window.setTimeout(()=>{if(newRequested){newRequested=false;notice('Confira a conexão no computador e tente novamente.');syncControls();}},15000);syncControls();};
  ui.pause.onclick=()=>setPaused(phase!=='paused');
  function captureStartError(){
    if(document.hidden)return Object.assign(new Error('Volte a esta aba no celular antes de iniciar a gravação.'),{reason:'camera-hidden'});
    const track=stream?.getVideoTracks()[0],preview=ui.preview;
    if(!track||track.readyState==='ended'||track.muted===true||track.enabled===false||stream.active===false||preview.srcObject!==stream||!(preview.videoWidth>0&&preview.videoHeight>0)||typeof preview.readyState==='number'&&preview.readyState<2||preview.paused===true)
      return Object.assign(new Error('A câmera ainda não está pronta. Ligue-a novamente no celular antes de gravar.'),{reason:'source-unavailable'});
    return null;
  }
  const reportStartError=error=>{fail(error.message);transport?.send({kind:'recording-start-error',roomId:pair.roomId,...(['camera-hidden','source-unavailable'].includes(error.reason)?{reason:error.reason}:{})});};
  ui.start.onclick=async()=>{
    if(phase!=='preview'||operation||!stream)return;
    const unavailable=captureStartError();if(unavailable){reportStartError(unavailable);return false;}
    phase='starting';syncControls();clearError();state('idle','Iniciando gravação');
    try{
      const recordingStream=stream,dimensions=captureInfo();
      const profile=await chooseRecordingProfile(window.MediaRecorder,navigator.mediaCapabilities,{width:dimensions.width,height:dimensions.height});
      const profileUnavailable=captureStartError();if(profileUnavailable)throw profileUnavailable;
      if(stream!==recordingStream||phase!=='starting')throw Object.assign(new Error('A câmera mudou antes de iniciar. Tente gravar novamente.'),{reason:'source-unavailable'});
      const {mimeType,videoBitsPerSecond}=profile;if(!mimeType)throw new Error('Este navegador não oferece um formato de gravação compatível.');
      recordingProfile=profile;
      recorder=new window.MediaRecorder(recordingStream,{mimeType,videoBitsPerSecond,audioBitsPerSecond:128000});
      const settings=stream.getVideoTracks()[0]?.getSettings?.()??{},width=ui.preview.videoWidth||settings.width||null,height=ui.preview.videoHeight||settings.height||null;
      const source=captureInfo();
      metadata={id:crypto.randomUUID(),roomId:pair.roomId,startEpochMs:Date.now(),startedAt:new Date().toISOString(),mimeType:recorder.mimeType||mimeType,width,height,frameRate:settings.frameRate??null,cameraLabel:source.label,...(source.zoom!==undefined?{cameraZoom:source.zoom}:{}),orientationPreference:format,captureOrientation:width&&height?(width>=height?'landscape':'portrait'):null,state:'recording',chunkCount:0,bytes:0,lastSavedTimeMs:0,events:[],connectionEvents:[]};
      await store.create(metadata);nextAuthorized=false;recordStarted=false;deleted=false;stoppedTime=null;fatal=false;cameraSuspended=false;pausedMono=null;pausedTotal=0;pauseOperation='';ui.saved.textContent='0 MB';
      try{window.sessionStorage.setItem(CAMERA_USED_SESSION+pair.roomId,metadata.id);}catch{}
      chunks=new CameraChunkQueue(store,metadata.id,saved=>{ui.saved.textContent=`${(saved.bytes/1048576).toFixed(1)} MB`;});
      stopper=new CameraStopCoordinator(recorder,{
        onStopping:()=>{stoppedTime??=elapsed();if(pausedMono!==null){pausedTotal+=Math.max(0,performance.now()-pausedMono);pausedMono=null;}pauseOperation='';phase='stopping';state('stopping','Finalizando…');notice();syncControls();},
        drain:async()=>{await writes.catch(()=>{});await chunks.flush();},
        commit:()=>store.update(metadata.id,meta=>({...meta,startEpochMs:metadata.startEpochMs,startedAt:metadata.startedAt,state:fatal?'error':'stopped',endedAt:new Date().toISOString(),durationMs:elapsed()})),
        onComplete:saved=>{metadata=saved;},
        onFailure:()=>{phase='finalization-error';state('error','Finalização pendente');fail('Não foi possível finalizar a gravação. Mantenha esta tela aberta e tente finalizar novamente.');terminal();syncControls();},
        release:async()=>{preparingVideoCopy=stopper.finalized&&!fatal;await publishQuality('stopped');await releaseCamera();if(stopper.finalized){phase=fatal?'error':'stopped';state(fatal?'error':'stopped',fatal?'Gravação incompleta':'Encerrada');terminal();notice();showPreviewOff();syncControls();if(!fatal)void Promise.resolve(videoSender?.enqueue(metadata.id)).finally(()=>{preparingVideoCopy=false;void syncWakeLock();});void refresh();}},
      });
      recorder.onstart=()=>{
        startedMono=performance.now();metadata.startEpochMs=Date.now();activeSinceEpochMs=metadata.startEpochMs;metadata.startedAt=new Date(metadata.startEpochMs).toISOString();recordStarted=true;phase='recording';state('recording','Gravando');notice();syncControls();
        writes=writes.catch(()=>{}).then(()=>store.update(metadata.id,meta=>({...meta,startEpochMs:metadata.startEpochMs,startedAt:metadata.startedAt}))).catch(()=>{fatal=true;fail('Não foi possível salvar o início da gravação neste aparelho.');void stopper.stop();});
        terminal();
        previewSampler.reset(stream);scheduleQuality('recording');
      };
      recorder.ondataavailable=event=>{
        if(!event.data?.size)return;
        chunks.enqueue(event.data,elapsed());
        writes=writes.catch(()=>{}).then(()=>chunks.flush());
        void writes.catch(()=>{fatal=true;fail('Não foi possível salvar um trecho. Mantenha esta tela aberta para tentar finalizar a gravação.');void stopper.stop();});
        // Stop before an unbounded backlog; reserve room for the recorder's final Blob.
        if(chunks.pendingCount>=7&&!stopper.started){fatal=true;fail('O aparelho está demorando a salvar. Finalizando sem descartar os trechos pendentes.');void stopper.stop();}
      };
      recorder.onerror=()=>{fatal=true;fail('A gravação foi interrompida pelo navegador. Salve os trechos disponíveis.');void stopper.stop();};
      recorder.onpause=()=>{if(stopper.started)return;pausedMono??=performance.now();pauseOperation='';phase='paused';state('paused','Pausada');persistEvent('recorder-paused');terminal();notice();syncControls();};
      recorder.onresume=()=>{if(stopper.started)return;if(pausedMono!==null)pausedTotal+=Math.max(0,performance.now()-pausedMono);pausedMono=null;activeSinceEpochMs=Date.now();pauseOperation='';phase='recording';segmentNumber++;segmentId=`segment-${segmentNumber}`;state('recording','Gravando');persistEvent('recorder-resumed',{segmentId});terminal();notice();syncControls();};
      const sourceStopper=stopper;
      for(const track of stream.getVideoTracks()){
        track.addEventListener('mute',()=>{if(sourceStopper!==stopper||sourceStopper.started)return;cameraSuspended=true;persistEvent('camera-muted');notice('Volte a esta tela para retomar a câmera.');});
        track.addEventListener('unmute',()=>{if(sourceStopper!==stopper||sourceStopper.started)return;cameraSuspended=false;segmentNumber++;segmentId=`segment-${segmentNumber}`;persistEvent('camera-resumed',{segmentId});notice();});
        track.addEventListener('ended',()=>{if(sourceStopper!==stopper||sourceStopper.started)return;fatal=true;void sourceStopper.stop();});
      }
      const unavailable=captureStartError();if(unavailable)throw unavailable;
      recorder.start(2000);
      void navigator.storage?.persist?.().catch(()=>{});void syncWakeLock();
      await refresh();
    }catch(error){fatal=true;if(recorder?.state!=='inactive'&&stopper)await stopper.stop();else{if(metadata)try{await store.update(metadata.id,meta=>({...meta,state:'error'}));}catch{}await releaseCamera();phase='error';state('error','Gravação não iniciada');}syncControls();reportStartError(error);}
  };
  ui.stop.onclick=async()=>{if(!stopper||!['recording','paused','finalization-error'].includes(phase)||operation)return;if(phase==='finalization-error'){phase='stopping';state('stopping','Finalizando');syncControls();}clearError();await stopper.stop();};
  ui.reconnect.onclick=()=>void reconnect();ui.fullscreen.onclick=()=>void view();ui.settings.onclick=()=>settings(ui.settings_menu.hidden);
  ui.switch_camera.onclick=async()=>{
    if(captureBusy()||operation||!stream||phase==='error')return false;
    const currentFace=captureFacing(stream),targetFace=currentFace==='environment'?'user':currentFace==='user'?'environment':'';
    if(!targetFace){fail('Escolha a câmera frontal ou traseira nas configurações.');return false;}
    const candidates=cameraDevices.filter(device=>device.deviceId!==selectedDeviceId&&(cameraFacingMode(device.label)===targetFace||!cameraFacingMode(device.label)&&lastFacingDevice[targetFace]===device.deviceId));
    const remembered=candidates.find(device=>device.deviceId===lastFacingDevice[targetFace]);
    const configuredRear=targetFace==='environment'?resolveRearCameraPreference(cameraDevices,rearPreference):'';
    const storedRear=configuredRear!==selectedDeviceId?configuredRear:'';
    const target=storedRear||remembered?.deviceId||(targetFace==='environment'?preferredCameraDevice(candidates,candidates[0]?.deviceId??''):candidates[0]?.deviceId);
    if(!target){fail(`Câmera ${targetFace==='user'?'frontal':'traseira'} não identificada. Escolha uma câmera nas configurações.`);return false;}
    const ok=await prepare(target,true,targetFace);
    if(ok&&targetFace==='environment'&&rearPreference&&!storedRear)fail('A câmera padrão não está disponível. A prévia usa outra câmera.');
    return ok;
  };
  ui.guides.onclick=()=>{guidesEnabled=!guidesEnabled;updateGuides();};
  ui.show_recordings.onclick=()=>recordings(true);
  ui.close_recordings.onclick=()=>recordings(false);
  ui.show_more_recordings.onclick=()=>{if(operation)return;recordingLimit+=20;void refresh();};
  ui.recordings_panel.addEventListener('cancel',event=>{event.preventDefault();recordings(false);});
  ui.recordings_panel.addEventListener('close',()=>{if(!ui.recordings_panel.hidden)recordings(false);});
  ui.recover_camera.onclick=async()=>{
    if(operation)return;
    if(phase==='finalization-error')return ui.stop.onclick();
    if(reconnecting)return;
    if(!canRetryEmptyCapture()){recordings(true);return;}
    operation='recover';syncControls();let retry=false;
    try{
      await writes.catch(()=>{});
      if(recordStarted||chunks?.pendingCount||chunks?.task||recorder&&recorder.state!=='inactive'){recordings(true);return;}
      await releaseCamera();metadata=null;recorder=null;stopper=null;chunks=null;writes=Promise.resolve();fatal=false;stoppedTime=null;phase='idle';clearError();state('idle','Sem gravar');retry=true;
    }finally{operation='';syncControls();}
    if(retry)await prepare();
  };
  document.addEventListener('fullscreenchange',()=>{labelButton(ui.fullscreen,document.fullscreenElement?'Sair da tela cheia':'Tela cheia');});
  document.addEventListener('pointerdown',event=>{if(!ui.settings_menu.hidden&&!ui.settings_menu.contains(event.target)&&!ui.settings.contains(event.target))settings(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!ui.settings_menu.hidden){event.preventDefault();settings(false,true);}});
  const observeOrientation=()=>{orientationHint();if(stream)publishStatus();if(recordStarted&&!stopper?.started){const settings=stream?.getVideoTracks()[0]?.getSettings?.()??{};persistEvent('orientation-change',{width:ui.preview.videoWidth||settings.width,height:ui.preview.videoHeight||settings.height,screenType:window.screen?.orientation?.type??null,screenAngle:window.screen?.orientation?.angle??null});}};
  window.screen?.orientation?.addEventListener?.('change',observeOrientation);ui.preview.addEventListener('resize',observeOrientation);ui.preview.addEventListener('loadedmetadata',()=>{lastGuideFrame='';updateGuides();});
  document.addEventListener('visibilitychange',()=>{if(phase==='recording')persistEvent(document.hidden?'page-hidden':'page-visible');void syncWakeLock();if(document.hidden){clearReconnect();clearQualityTimer();previewSampler.clear();}else{if(stream){previewSampler.reset(stream);if(ui.camera_app.dataset.connection==='connected'&&['preview','recording','paused'].includes(phase))scheduleQuality(phase);}if(ui.camera_app.dataset.connection==='offline'&&!reconnectBlocked){reconnectAttempts=0;void reconnect({automatic:true});}}});
  window.addEventListener('beforeunload',event=>{if(['starting','recording','paused','stopping','finalization-error'].includes(phase)||operation){event.preventDefault();event.returnValue='';}});
  window.setInterval(()=>{if(!metadata||!recordStarted||deleted)return;const ms=elapsed(),seconds=Math.floor(ms/1000);ui.elapsed.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;try{transport?.send({kind:'clock',...clock()});}catch{}},250);
  try{
    if(window.location.hash){pair=parseCameraPair(window.location.hash);window.history.replaceState(null,'',window.location.pathname);try{window.sessionStorage.setItem(CAMERA_SESSION,JSON.stringify(pair));}catch{}}
    else{const saved=window.sessionStorage.getItem(CAMERA_SESSION);if(saved){const value=JSON.parse(saved);pair=parseCameraPair(`#room=${value.roomId}&token=${value.token}`);}}
    if(!pair){notice();}
    else{
    if(!window.isSecureContext)throw new Error('A câmera precisa de uma conexão HTTPS válida. Confira o endereço seguro no notebook.');
    notice();
    }
  }catch(error){pair=null;fail(error.message);}
  if(pair)videoSender=new CameraVideoSender({store,roomId:pair.roomId,crypto,send:message=>transport?.send(message)??false,connected:()=>ui.camera_app.dataset.connection==='connected',getMaxMessageSize:()=>transport?.peer?.sctp?.maxMessageSize??0,setTimer:(fn,ms)=>window.setTimeout(fn,ms),clearTimer:timer=>window.clearTimeout?window.clearTimeout(timer):clearTimeout(timer),onState:progress=>{
    lastTransferId=progress.recordingId;ui.transfer_row.hidden=false;ui.transfer_status.hidden=false;
    ui.transfer_status.textContent=progress.state==='ready'?'Salvo no computador':progress.state==='sending'?`Enviando · ${progress.percent}%`:progress.state==='offering'?'Preparando cópia…':progress.state==='paused'?'Cópia pausada':progress.state==='error'?'Cópia pendente. Tente enviar novamente.':progress.message;
    ui.transfer_retry.hidden=progress.state!=='error';ui.transfer_retry.disabled=captureBusy()||ui.camera_app.dataset.connection!=='connected';syncControls();
  }});
  ui.transfer_row.hidden=true;ui.transfer_status.hidden=true;ui.transfer_retry.hidden=true;
  ui.transfer_retry.onclick=()=>{if(!captureBusy()&&lastTransferId)void videoSender?.enqueue(lastTransferId,{force:true});};
  syncControls();void refresh();void listCameras().then(syncControls);
  return {store,getTransport:()=>transport,getRecorder:()=>recorder,getVideoSender:()=>videoSender,getState:()=>({phase,format,operation,recordingId:metadata?.id}),stop:()=>stopper?.stop()};
}

if(typeof document!=='undefined'&&document.getElementById('preview'))bootCamera(document,window);
