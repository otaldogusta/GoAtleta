// Camera-only page. It never receives the notebook capability or Supabase credentials.
export const LIVE_CAMERA_DATABASE = 'goatleta-scouting-live-camera-v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/i;
const CAMERA_SESSION = 'goatleta:live-camera-pair:v1';
const CAMERA_USED_SESSION = 'goatleta:live-camera-used:v1:';
const MAX_EVENTS = 4000;

export function parseCameraPair(fragment) {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const roomId = params.get('room'), token = params.get('token');
  if (!UUID.test(roomId ?? '') || !TOKEN.test(token ?? '') || [...params.keys()].some(key => !['room','token'].includes(key)) || params.getAll('room').length !== 1 || params.getAll('token').length !== 1) throw new Error('QR code inválido. Gere uma nova conexão no notebook.');
  return { roomId, token };
}

export function chooseRecordingMime(Recorder) {
  return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type => Recorder.isTypeSupported(type)) ?? '';
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

export function cameraCaptureConstraints(format='landscape') {
  if(!['landscape','portrait'].includes(format))throw new Error('Formato de câmera inválido.');
  return {video:{facingMode:{ideal:'environment'},width:{ideal:format==='landscape'?1920:1080},height:{ideal:format==='landscape'?1080:1920},aspectRatio:{ideal:format==='landscape'?16/9:9/16},frameRate:{ideal:30,max:30}},audio:true};
}

export async function requestCameraView(window,element,format) {
  if(!['landscape','portrait'].includes(format))throw new Error('Formato de câmera inválido.');
  let fullscreen=!!window.document.fullscreenElement,locked=false;
  try{if(!fullscreen&&element.requestFullscreen){await element.requestFullscreen();fullscreen=!!window.document.fullscreenElement;}}catch{}
  try{if(window.screen?.orientation?.lock){await window.screen.orientation.lock(format);locked=true;}}catch{}
  return {fullscreen,locked};
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

export class CameraTransport {
  constructor(pair,{onState=()=>{},onMessage=()=>{},clock=()=>({}),fetcher=(...args)=>globalThis.fetch(...args),Peer=globalThis.RTCPeerConnection,storage,iceServers=[]}={}) {
    try{storage??=globalThis.sessionStorage;}catch{}
    this.pair=pair;this.onState=onState;this.onMessage=onMessage;this.clock=clock;this.fetcher=fetcher;this.Peer=Peer;this.storage=storage;this.iceServers=iceServers;this.cursor=0;this.peer=null;this.channel=null;this.stopped=false;this.pollTimer=null;this.heartbeatTimer=null;this.clientId='';try{this.clientId=storage?.getItem(`goatleta:live-camera-client:${pair.roomId}`)??'';}catch{}this.ice=[];this.outboundIce=[];this.signalWrites=Promise.resolve();
  }
  async api(path,{method='GET',body}={}) {
    const headers={'Content-Type':'application/json','X-GoAtleta-Live':'1','X-GoAtleta-Live-Role':'camera','X-GoAtleta-Live-Token':this.pair.token,...(this.clientId?{'X-GoAtleta-Live-Client':this.clientId}:{})};
    const response=await this.fetcher(`/rooms/${this.pair.roomId}${path}`,{method,headers,credentials:'omit',cache:'no-store',...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const result=await response.json();
    if(!response.ok) {const error=new Error(result.error || 'Notebook indisponível. A gravação local continua.');error.status=response.status;throw error;}
    return result;
  }
  send(message) { if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(message)); }
  async connect(stream) {
    this.disconnect();this.stopped=false;this.onState('connecting');
    const joined=await this.api('/join',{method:'POST',body:{}});
    if(this.stopped)return;
    this.clientId=joined.cameraClientId;this.generation=joined.generation;this.cursor=joined.cursor??0;
    try{this.storage?.setItem(`goatleta:live-camera-client:${this.pair.roomId}`,this.clientId);}catch{}
    const peer=new this.Peer({iceServers:this.iceServers});this.peer=peer;this.offerUploaded=false;this.outboundIce=[];
    stream.getTracks().forEach(track=>peer.addTrack(track,stream));
    const channel=peer.createDataChannel('goatleta-live',{ordered:true});this.channel=channel;
    channel.onopen=()=>{if(this.peer!==peer)return;this.onState('connected');const c=this.clock();if(c.recordingId)this.send({kind:'recording',recordingId:c.recordingId,startEpochMs:c.startEpochMs,startedAtISO:c.startedAtISO,mimeType:c.mimeType,state:c.state,durationMs:c.durationMs,segmentId:c.segmentId});};
    channel.onclose=channel.onerror=()=>{if(this.peer===peer&&!this.stopped)this.onState('offline');};
    channel.onmessage=event=>{
      if(typeof event.data!=='string'||event.data.length>32768)return;
      try{const data=JSON.parse(event.data);if(data.kind==='ping'&&typeof data.id==='string'&&data.id.length<=128&&Number.isFinite(data.sentEpochMs)){const now=this.clock();if(now.recordingId)this.send({kind:'pong',id:data.id,sentEpochMs:data.sentEpochMs,cameraEpochMs:now.startEpochMs+now.timeMs,recordingId:now.recordingId,timeMs:now.timeMs});}else this.onMessage(data);}catch{}
    };
    const flushIce=()=>{if(!this.offerUploaded||this.peer!==peer||this.stopped)return;for(const candidate of this.outboundIce.splice(0)){const generation=this.generation;this.signalWrites=this.signalWrites.catch(()=>{}).then(()=>{if(this.peer===peer&&!this.stopped)return this.api('/signals',{method:'POST',body:{type:'ice',candidate,generation}});}).catch(()=>{if(this.peer===peer)this.onState('offline');});}};
    peer.onicecandidate=event=>{if(this.peer!==peer||this.stopped)return;this.outboundIce.push(event.candidate?.toJSON()??null);flushIce();};
    peer.onconnectionstatechange=()=>{if(this.peer!==peer)return;const state=peer.connectionState;if(state==='connected')this.onState('connected');else if(['failed','disconnected','closed'].includes(state))this.onState('offline');};
    await peer.setLocalDescription(await peer.createOffer());
    const offered=await this.api('/signals',{method:'POST',body:{type:'offer',sdp:peer.localDescription.sdp}});
    if(this.peer!==peer||this.stopped)return;
    this.generation=offered.generation;this.offerUploaded=true;flushIce();
    this.poll();
    this.heartbeatTimer=setInterval(()=>{void this.api('/heartbeat',{method:'POST',body:{}}).catch(()=>this.onState('offline'));},10000);
  }
  async poll() {
    if(this.stopped)return;
    const peer=this.peer;
    try{
      const result=await this.api(`/signals?after=${this.cursor}`);
      if(this.stopped||this.peer!==peer)return;
      this.cursor=result.cursor;
      for(const signal of result.signals){
        if(signal.from!=='host'||signal.generation!==this.generation)continue;
        if(signal.type==='answer'&&peer.signalingState==='have-local-offer'){await peer.setRemoteDescription({type:'answer',sdp:signal.sdp});for(const candidate of this.ice.splice(0))await peer.addIceCandidate(candidate);}
        else if(signal.type==='ice'){if(peer.remoteDescription)await peer.addIceCandidate(signal.candidate);else if(this.ice.length<128)this.ice.push(signal.candidate);}
      }
    }catch(error){if([401,403,404,410].includes(error.status)){this.disconnect();this.onState('offline','Conexão encerrada no notebook. A gravação local continua.');}else this.onState('offline',error.message);}
    if(!this.stopped&&this.peer===peer)this.pollTimer=setTimeout(()=>this.poll(),750);
  }
  disconnect(){this.stopped=true;clearTimeout(this.pollTimer);clearInterval(this.heartbeatTimer);this.channel?.close();this.peer?.close();this.channel=null;this.peer=null;this.ice=[];}
}

export function bootCamera(document,window,{store=new CameraRecordingStore(window.indexedDB),transportFactory=(pair,options)=>new CameraTransport(pair,options)}={}) {
  const $=id=>document.getElementById(id),navigator=window.navigator,performance=window.performance??globalThis.performance,crypto=window.crypto??globalThis.crypto;
  const ui=Object.fromEntries(['notice','error','preview','connection','prepare','start','stop','reconnect','elapsed','saved','recordings','camera-app','recording-status','preview-placeholder','landscape','portrait','settings','settings-menu','fullscreen','show-recordings','close-recordings','recordings-panel','orientation-hint','delete-confirm','delete-detail','delete-cancel','delete-accept'].map(id=>[id.replaceAll('-','_'),$(id)]));
  let pair,stream,recorder,stopper,chunks,transport,metadata,phase='idle',format='landscape',operation='',recordStarted=false,deleted=false;
  let startedMono=0,stoppedTime=null,writes=Promise.resolve(),fatal=false,cameraSuspended=false,wakeLock,segmentNumber=0,segmentId='segment-0';
  const captureBusy=()=>['preparing','starting','recording','stopping','finalization-error'].includes(phase);
  const ended=()=>['stopped','error'].includes(phase);
  const elapsed=()=>metadata&&recordStarted?stoppedTime??Math.max(0,performance.now()-startedMono):0;
  const fail=message=>{ui.error.textContent=message;ui.error.hidden=false;};
  const state=(value,text)=>{ui.recording_status.dataset.state=value;ui.recording_status.textContent=text;};
  const labelButton=(button,label)=>{button.setAttribute('aria-label',label);button.title=label;const text=button.querySelector?.('.sr-only');if(text)text.textContent=label;else button.textContent=label;};
  const settings=open=>{ui.settings_menu.hidden=!open;ui.settings.setAttribute('aria-expanded',String(open));if(open&&!ui.landscape.disabled)ui.landscape.focus();else ui.settings.focus();};
  ui.settings_menu.hidden=true;ui.camera_app.dataset.connection='idle';
  const clock=()=>({recordingId:recordStarted?metadata?.id:undefined,startEpochMs:metadata?.startEpochMs,startedAtISO:metadata?.startedAt,mimeType:metadata?.mimeType,state:fatal||phase==='finalization-error'?'error':phase==='stopping'?'recording':recorder?.state==='recording'?'recording':'stopped',timeMs:elapsed(),durationMs:elapsed(),senderEpochMs:(metadata?.startEpochMs??0)+elapsed(),recording:recordStarted&&!fatal&&!cameraSuspended&&phase==='recording'&&recorder?.state==='recording',segmentId});
  const terminal=()=>{const c=clock();try{transport?.send({kind:'recording',recordingId:c.recordingId,startEpochMs:c.startEpochMs,startedAtISO:c.startedAtISO,mimeType:c.mimeType,state:c.state,durationMs:c.durationMs,segmentId:c.segmentId});}catch{}};
  function syncControls(){
    const blocked=!!operation||captureBusy();
    ui.camera_app.dataset.phase=phase;
    ui.prepare.disabled=!pair||blocked||ended()||phase==='preview';ui.start.disabled=!pair||phase!=='preview'||!!operation;
    ui.prepare.hidden=!['idle','preparing'].includes(phase);ui.start.hidden=!['preview','starting'].includes(phase);ui.stop.hidden=!['recording','stopping','finalization-error'].includes(phase);
    ui.show_recordings.className=ended()?'icon-control primary':'icon-control';
    ui.landscape.disabled=blocked||ended();ui.portrait.disabled=blocked||ended();
    ui.stop.disabled=!!operation||!['recording','finalization-error'].includes(phase);
    labelButton(ui.stop,phase==='stopping'?'Finalizando…':phase==='finalization-error'?'Tentar finalizar':'Encerrar gravação');
    for(const button of ui.recordings.querySelectorAll('button'))button.disabled=blocked||button.dataset.unavailable==='true';
  }
  const connection=(value,message)=>{
    ui.camera_app.dataset.connection=value;
    ui.connection.textContent=({connecting:'Conectando…',connected:'Conectado ao notebook',offline:'Sem conexão com notebook'})[value]??'Não conectado';
    ui.connection.dataset.active=String(value==='connected');ui.reconnect.hidden=value!=='offline'||!stream;
    if(phase==='recording')ui.notice.textContent=message??'Gravando neste aparelho.';
    else if(phase==='preview')ui.notice.textContent=message?'Prévia pronta. Confira a conexão com o notebook.':'Prévia pronta · ainda não está gravando.';
  };
  const persistEvent=(kind,details={})=>{if(!metadata||!recordStarted||deleted)return;const id=metadata.id;writes=writes.catch(()=>{}).then(()=>store.update(id,meta=>({...meta,connectionEvents:[...meta.connectionEvents.slice(-499),{kind,timeMs:elapsed(),atEpochMs:Date.now(),...details}]}))).catch(()=>{});};
  function showPreviewOff(){ui.preview.pause();ui.preview.srcObject=null;ui.preview_placeholder.hidden=false;ui.preview_placeholder.replaceChildren();const title=document.createElement('strong');title.textContent='Câmera desligada';ui.preview_placeholder.append(title);}
  async function releaseCamera(){
    for(const track of stream?.getTracks()??[]){try{track.stop();}catch{}}
    stream=null;showPreviewOff();ui.reconnect.hidden=true;
    try{await wakeLock?.release();}catch{}wakeLock=null;
  }
  function orientationHint(locked=false){
    const settings=stream?.getVideoTracks()[0]?.getSettings?.()??{},width=settings.width??ui.preview.videoWidth,height=settings.height??ui.preview.videoHeight;
    ui.orientation_hint.textContent=`${format==='landscape'?'Horizontal':'Vertical'}${width&&height?` · prévia ${width} × ${height}`:''}${locked?'':` · gire o celular para enquadrar`}`;
  }
  async function view(){
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}return;}
    if(captureBusy()&&phase!=='preparing'){try{await ui.camera_app.requestFullscreen?.();}catch{}return;}
    const result=await requestCameraView(window,ui.camera_app,format);orientationHint(result.locked);
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
      if(!list.length){const small=document.createElement('small');small.textContent='Nenhuma gravação salva ainda.';ui.recordings.append(small);}
      for(const item of list.slice(0,20)){
        const row=document.createElement('div');row.className='saved-item';
        const title=document.createElement('p');title.textContent=new Date(item.startEpochMs).toLocaleString('pt-BR');
        const detail=document.createElement('small');detail.textContent=metadata?.id===item.id&&['stopping','finalization-error'].includes(phase)?'Finalização pendente · aguarde antes de salvar ou excluir':cameraRecordingDetail(item,metadata?.id===item.id&&['starting','recording'].includes(phase));
        const controls=document.createElement('div');controls.className='controls';
        for(const [label,manifestOnly] of [['Salvar vídeo',false],['Salvar marcações',true]]){
          const button=document.createElement('button');button.textContent=item.state==='recording'&&!manifestOnly?'Salvar trechos':label;button.dataset.unavailable=String(!item.chunkCount);
          button.onclick=async()=>{
            if(operation||captureBusy())return;operation='export';syncControls();
            try{const data=await store.downloadData(item.id);const blob=manifestOnly?new Blob([JSON.stringify(data.manifest,null,2)],{type:'application/json'}):data.blob;const url=window.URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`go-atleta-${item.id}${manifestOnly?'.json':item.mimeType.includes('mp4')?'.mp4':'.webm'}`;a.click();window.setTimeout(()=>window.URL.revokeObjectURL(url),60000);}catch(error){fail(error.message);}finally{operation='';syncControls();}
          };controls.append(button);
        }
        const remove=document.createElement('button');remove.textContent='Excluir do celular';remove.className='danger';remove.dataset.unavailable=String(!['stopped','error'].includes(item.state));
        remove.onclick=async()=>{
          if(operation||captureBusy())return;operation='delete';syncControls();
          try{const removed=await deleteCameraRecording(store,item.id,{canDelete:()=>!captureBusy(),confirm:confirmDelete});if(removed){if(metadata?.id===item.id)deleted=true;ui.notice.textContent='Gravação excluída deste aparelho.';await refresh();}}catch(error){fail(error.message);}finally{operation='';syncControls();}
        };controls.append(remove);row.append(title,detail,controls);ui.recordings.append(row);
      }
      syncControls();
    }catch(error){ui.recordings.textContent='Não foi possível abrir as gravações locais.';fail(error.message);}
  }
  function receive(data){
    if(!metadata||!recordStarted||deleted)return;
    if(fatal){transport?.send({kind:'storage-error',recordingId:metadata.id});return;}
    const id=metadata.id;
    if(data.kind==='point'){
      let point;try{point=projectCameraPoint(data.point,id,elapsed());}catch{return;}
      writes=writes.catch(()=>{}).then(()=>store.addPoint(id,point)).then(()=>transport?.send({kind:'point-ack',id:point.id,recordingId:id})).catch(()=>{transport?.send({kind:'storage-error',recordingId:id});fail('Não foi possível salvar uma marcação neste aparelho. Confira o notebook.');});
    }else if(data.kind==='undo-point'&&data.recordingId===id&&typeof data.id==='string'&&data.id.length<=128){writes=writes.catch(()=>{}).then(()=>store.undoPoint(id,data.id)).then(()=>transport?.send({kind:'undo-point-ack',id:data.id,recordingId:id})).catch(()=>{transport?.send({kind:'storage-error',recordingId:id});fail('Não foi possível salvar a correção da marcação neste aparelho.');});}
  }
  async function reconnect(){
    if(!stream||!pair)return;
    ui.reconnect.disabled=true;segmentNumber++;segmentId=`segment-${segmentNumber}`;persistEvent('connection-attempt',{segmentId});
    try{transport??=transportFactory(pair,{onState:connection,onMessage:receive,clock});await transport.connect(stream);}catch(error){connection('offline');if(phase==='recording')ui.notice.textContent='A gravação local continua. Tente reconectar ao notebook.';if(error.status===404||error.status===410)fail('Conexão encerrada. Salve a gravação e gere um novo QR code para o próximo jogo.');}
    finally{ui.reconnect.disabled=false;}
  }
  async function prepare(){
    if(captureBusy()||ended()||operation||!pair)return;
    phase='preparing';syncControls();ui.error.hidden=true;state('idle','Preparando câmera');
    try{
      if(!window.isSecureContext)throw new Error('A câmera precisa de uma conexão HTTPS válida. Confira o endereço seguro no notebook.');
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder||!window.RTCPeerConnection)throw new Error('Este navegador não oferece câmera, gravação e transmissão compatíveis. Use uma versão atual do Chrome no Android.');
      let used;try{used=window.sessionStorage.getItem?.(CAMERA_USED_SESSION+pair.roomId);}catch{}
      if(used||(await store.list()).some(item=>item.roomId===pair.roomId))throw new Error('Esta conexão já tem uma gravação. Gere outro QR code no notebook para gravar novamente.');
      const viewing=requestCameraView(window,ui.camera_app,format);
      transport?.disconnect();for(const track of stream?.getTracks()??[])track.stop();stream=null;
      try{stream=await navigator.mediaDevices.getUserMedia(cameraCaptureConstraints(format));}
      catch(error){if(error.name==='OverconstrainedError'||error.name==='NotFoundError')stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});else throw error;}
      ui.preview.srcObject=stream;await ui.preview.play();ui.preview_placeholder.hidden=true;
      phase='preview';state('idle','Prévia · sem gravar');ui.notice.textContent='Enquadre a quadra. Toque em Gravar quando estiver pronto.';orientationHint((await viewing).locked);
      await reconnect();
    }catch(error){await releaseCamera();phase='idle';state('idle','Sem gravar');fail(error.name==='NotAllowedError'?'Permita o acesso à câmera e ao microfone para preparar.':error.message);}
    finally{syncControls();}
  }
  ui.prepare.onclick=prepare;
  ui.start.onclick=async()=>{
    if(phase!=='preview'||operation||!stream)return;
    phase='starting';syncControls();ui.error.hidden=true;state('idle','Iniciando gravação');
    try{
      const mimeType=chooseRecordingMime(window.MediaRecorder);if(!mimeType)throw new Error('Este navegador não oferece um formato de gravação compatível.');
      recorder=new window.MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000,audioBitsPerSecond:128000});
      const settings=stream.getVideoTracks()[0]?.getSettings?.()??{},width=settings.width??ui.preview.videoWidth??null,height=settings.height??ui.preview.videoHeight??null;
      metadata={id:crypto.randomUUID(),roomId:pair.roomId,startEpochMs:Date.now(),startedAt:new Date().toISOString(),mimeType:recorder.mimeType||mimeType,width,height,frameRate:settings.frameRate??null,orientationPreference:format,captureOrientation:width&&height?(width>=height?'landscape':'portrait'):null,state:'recording',chunkCount:0,bytes:0,lastSavedTimeMs:0,events:[],connectionEvents:[]};
      await store.create(metadata);recordStarted=false;deleted=false;stoppedTime=null;fatal=false;cameraSuspended=false;ui.saved.textContent='0 MB';
      try{window.sessionStorage.setItem(CAMERA_USED_SESSION+pair.roomId,metadata.id);}catch{}
      chunks=new CameraChunkQueue(store,metadata.id,saved=>{ui.saved.textContent=`${(saved.bytes/1048576).toFixed(1)} MB`;});
      stopper=new CameraStopCoordinator(recorder,{
        onStopping:()=>{stoppedTime??=Math.max(0,performance.now()-startedMono);phase='stopping';state('stopping','Finalizando');ui.notice.textContent='Parando e salvando o último trecho…';syncControls();},
        drain:async()=>{await writes.catch(()=>{});await chunks.flush();},
        commit:()=>store.update(metadata.id,meta=>({...meta,startEpochMs:metadata.startEpochMs,startedAt:metadata.startedAt,state:fatal?'error':'stopped',endedAt:new Date().toISOString(),durationMs:elapsed()})),
        onComplete:saved=>{metadata=saved;phase=fatal?'error':'stopped';state(fatal?'error':'stopped',fatal?'Gravação incompleta':'Gravação encerrada');terminal();ui.notice.textContent=fatal?'Gravação incompleta. Salve os trechos disponíveis.':'Gravação encerrada. Abra Gravações para salvar o vídeo e as marcações.';syncControls();void refresh();},
        onFailure:()=>{phase='finalization-error';state('error','Finalização pendente');fail('Não foi possível finalizar os dados da gravação. Mantenha esta tela aberta e tente finalizar novamente; os trechos salvos foram preservados.');ui.notice.textContent='A captura parou. A finalização ainda não foi confirmada.';terminal();syncControls();},
        release:releaseCamera,
      });
      recorder.onstart=()=>{
        startedMono=performance.now();metadata.startEpochMs=Date.now();metadata.startedAt=new Date(metadata.startEpochMs).toISOString();recordStarted=true;phase='recording';state('recording','Gravando');ui.notice.textContent='Gravando neste aparelho.';syncControls();
        writes=writes.catch(()=>{}).then(()=>store.update(metadata.id,meta=>({...meta,startEpochMs:metadata.startEpochMs,startedAt:metadata.startedAt}))).catch(()=>{fatal=true;fail('Não foi possível salvar o início da gravação neste aparelho.');void stopper.stop();});
        terminal();
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
      recorder.onpause=()=>{fatal=true;persistEvent('recorder-paused');fail('O navegador pausou a gravação. Salve os trechos disponíveis antes de iniciar outra gravação.');void stopper.stop();};
      for(const track of stream.getVideoTracks()){
        track.addEventListener('mute',()=>{if(stopper.started)return;cameraSuspended=true;persistEvent('camera-muted');ui.notice.textContent='A câmera foi pausada pelo aparelho. Volte a esta tela para continuar.';});
        track.addEventListener('unmute',()=>{if(stopper.started)return;cameraSuspended=false;segmentNumber++;segmentId=`segment-${segmentNumber}`;persistEvent('camera-resumed',{segmentId});ui.notice.textContent='Gravando neste aparelho.';});
        track.addEventListener('ended',()=>{if(stopper.started)return;fatal=true;void stopper.stop();});
      }
      recorder.start(2000);
      void navigator.storage?.persist?.().catch(()=>{});try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
      await refresh();
    }catch(error){fatal=true;if(recorder?.state!=='inactive'&&stopper)await stopper.stop();else{if(metadata)try{await store.update(metadata.id,meta=>({...meta,state:'error'}));}catch{}await releaseCamera();phase='error';state('error','Gravação não iniciada');}syncControls();fail(error.message);}
  };
  ui.stop.onclick=async()=>{if(!stopper||!['recording','finalization-error'].includes(phase)||operation)return;if(phase==='finalization-error'){phase='stopping';state('stopping','Finalizando');syncControls();}ui.error.hidden=true;await stopper.stop();};
  ui.reconnect.onclick=()=>void reconnect();ui.fullscreen.onclick=()=>void view();ui.settings.onclick=()=>settings(ui.settings_menu.hidden);
  for(const value of ['landscape','portrait'])ui[value].onclick=async()=>{if(captureBusy()||ended()||operation||format===value)return;format=value;ui.camera_app.dataset.format=value;ui.landscape.setAttribute('aria-pressed',String(value==='landscape'));ui.portrait.setAttribute('aria-pressed',String(value==='portrait'));settings(false);orientationHint();if(phase==='preview'){phase='idle';await prepare();}};
  ui.show_recordings.onclick=()=>{settings(false);ui.recordings_panel.hidden=false;ui.show_recordings.setAttribute('aria-expanded','true');void refresh();ui.close_recordings.focus();};
  ui.close_recordings.onclick=()=>{ui.recordings_panel.hidden=true;ui.show_recordings.setAttribute('aria-expanded','false');ui.show_recordings.focus();};
  document.addEventListener('fullscreenchange',()=>{labelButton(ui.fullscreen,document.fullscreenElement?'Sair da tela cheia':'Tela cheia');});
  document.addEventListener('pointerdown',event=>{if(!ui.settings_menu.hidden&&!ui.settings_menu.contains(event.target)&&!ui.settings.contains(event.target))settings(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!ui.settings_menu.hidden){event.preventDefault();settings(false);}});
  const observeOrientation=()=>{orientationHint();if(recordStarted&&!stopper?.started){const settings=stream?.getVideoTracks()[0]?.getSettings?.()??{};persistEvent('orientation-change',{width:settings.width??ui.preview.videoWidth,height:settings.height??ui.preview.videoHeight,screenType:window.screen?.orientation?.type??null,screenAngle:window.screen?.orientation?.angle??null});}};
  window.screen?.orientation?.addEventListener?.('change',observeOrientation);ui.preview.addEventListener('resize',observeOrientation);
  document.addEventListener('visibilitychange',()=>{if(phase==='recording')persistEvent(document.hidden?'page-hidden':'page-visible');});
  window.addEventListener('beforeunload',event=>{if(['starting','recording','stopping','finalization-error'].includes(phase)||operation){event.preventDefault();event.returnValue='';}});
  window.setInterval(()=>{if(!metadata||!recordStarted||deleted)return;const ms=elapsed(),seconds=Math.floor(ms/1000);ui.elapsed.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;try{transport?.send({kind:'clock',...clock()});}catch{}},250);
  try{
    if(window.location.hash){pair=parseCameraPair(window.location.hash);window.history.replaceState(null,'',window.location.pathname);try{window.sessionStorage.setItem(CAMERA_SESSION,JSON.stringify(pair));}catch{}}
    else{const saved=window.sessionStorage.getItem(CAMERA_SESSION);if(saved){const value=JSON.parse(saved);pair=parseCameraPair(`#room=${value.roomId}&token=${value.token}`);}}
    if(!pair)throw new Error('Abra o QR code exibido no notebook para conectar a câmera.');
    if(!window.isSecureContext)throw new Error('A câmera precisa de uma conexão HTTPS válida. Confira o endereço seguro no notebook.');
    ui.notice.textContent='Prepare a câmera para enquadrar antes de gravar.';
  }catch(error){pair=null;fail(error.message);}
  syncControls();void refresh();
  return {store,getTransport:()=>transport,getRecorder:()=>recorder,getState:()=>({phase,format,operation,recordingId:metadata?.id}),stop:()=>stopper?.stop()};
}

if(typeof document!=='undefined'&&document.getElementById('preview'))bootCamera(document,window);
