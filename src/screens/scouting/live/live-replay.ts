import { createLiveDatabaseConnection } from './live-idb-connection';
import { loadLiveHostSession, type LiveHostScope } from './live-storage';
import type { LiveHostBridgeApi, LiveRecordingReference, LiveReplayMedia, LiveTimelineClip } from './live-scouting-contract';
import { parseLiveCaptureStamp } from '../../../core/scouting-live';

type Segment=LiveRecordingReference&{key:string;scope:LiveHostScope;segmentId:string;mimeType:string;offsetMs:number;untilMs:number;uncertaintyMs:number;parts:number;bytes:number;stopped:boolean};
type Part={owner:string;index:number;blob:Blob};
const SEGMENTS='segments',PARTS='parts',LIMIT=4*1024*1024*1024;
const db=createLiveDatabaseConnection('goatleta-scouting-live-replay-v1',store=>{
    if(!store.objectStoreNames.contains(SEGMENTS))store.createObjectStore(SEGMENTS);
    if(!store.objectStoreNames.contains(PARTS)){const parts=store.createObjectStore(PARTS);parts.createIndex('owner','owner');}
});
const same=(a:LiveHostScope,b:LiveHostScope)=>a.userId===b.userId&&a.org===b.org&&a.classId===b.classId;
const sameRef=(a:LiveRecordingReference,b:LiveRecordingReference)=>a.hostSessionId===b.hostSessionId&&a.recordingId===b.recordingId;
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=300;
const validScope=(scope:LiveHostScope)=>!!scope&&[scope.userId,scope.org,scope.classId].every(id);
function validSegment(value:unknown,scope:LiveHostScope,reference:LiveRecordingReference):value is Segment{
    const v=value as Segment;
    if(!v||!validScope(v.scope)||!same(v.scope,scope)||!sameRef(v,reference)||typeof v.key!=='string')return false;
    let key:unknown;try{key=JSON.parse(v.key);}catch{return false;}
    return Array.isArray(key)&&key.length===6&&key.every(id)&&JSON.stringify(key.slice(0,5))===JSON.stringify([scope.userId,scope.org,scope.classId,reference.hostSessionId,reference.recordingId])
        &&typeof v.segmentId==='string'&&/^[-\w]{1,128}$/.test(v.segmentId)&&typeof v.stopped==='boolean'
        &&typeof v.mimeType==='string'&&v.mimeType.length<=200&&/^video\/(mp4|webm)(;|$)/.test(v.mimeType)&&Number.isFinite(v.offsetMs)&&v.offsetMs>=0&&Number.isFinite(v.untilMs)&&v.untilMs>=v.offsetMs&&v.untilMs<=86400000
        &&Number.isInteger(v.parts)&&v.parts>=0&&v.parts<=100000&&Number.isSafeInteger(v.bytes)&&v.bytes>=0&&v.bytes<=LIMIT
        &&(v.parts===0?v.bytes===0:v.bytes>0)
        &&Number.isFinite(v.uncertaintyMs)&&v.uncertaintyMs>=0&&v.uncertaintyMs<=60000;
}
async function transaction<T>(mode:IDBTransactionMode,operation:(tx:IDBTransaction,set:(result:T)=>void,fail:(error:unknown)=>void)=>void):Promise<T>{
    const tx=await db.transaction([SEGMENTS,PARTS],mode);
    return new Promise((resolve,reject)=>{
        let result:T,failure:unknown,done=false;
        const timer=setTimeout(()=>{failure=new Error('Tempo esgotado ao guardar o replay.');try{tx.abort();}catch{finish(failure);}},15000);
        const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
        const fail=(error:unknown)=>{failure=error;try{tx.abort();}catch{finish(error);}};
        tx.oncomplete=()=>finish();tx.onabort=()=>finish(failure??new Error('Não foi possível salvar o replay neste computador.'));tx.onerror=()=>{failure=tx.error;};
        try{operation(tx,value=>{result=value;},fail);}catch(error){fail(error);}
    });
}
const createSegment=(segment:Segment)=>transaction<void>('readwrite',(tx,set,fail)=>{const req=tx.objectStore(SEGMENTS).add(segment,segment.key);req.onerror=()=>fail(req.error);set(undefined);});
async function appendSegment(segment:Segment,blob:Blob,untilMs:number,stopped:boolean){
    return transaction<Segment>('readwrite',(tx,set,fail)=>{
        const store=tx.objectStore(SEGMENTS),read=store.get(segment.key);read.onerror=()=>fail(read.error);
        read.onsuccess=()=>{try{
            const prior=read.result as Segment;if(!validSegment(prior,segment.scope,segment)||prior.offsetMs!==segment.offsetMs||prior.stopped)throw new Error('O replay mudou durante a gravação.');
            if(!(blob instanceof Blob)||!Number.isFinite(untilMs)||untilMs<prior.offsetMs)throw new Error('Trecho de replay inválido.');
            const all=store.getAll();all.onerror=()=>fail(all.error);
            all.onsuccess=()=>{try{
                const related=(all.result as Segment[]).filter(value=>value?.scope&&same(value.scope,segment.scope)&&sameRef(value,segment));
                if(related.some(value=>!validSegment(value,segment.scope,segment)))throw new Error('O replay local está inválido.');
                if(related.reduce((sum,value)=>sum+value.bytes,0)+blob.size>LIMIT)throw new Error('O replay atingiu o limite local. O original continua no celular.');
                const next={...prior,untilMs:Math.max(prior.untilMs,untilMs),stopped,bytes:prior.bytes+blob.size,parts:prior.parts+(blob.size?1:0)};
                if(!validSegment(next,segment.scope,segment))throw new Error('O replay atingiu o limite local. O original continua no celular.');
                if(blob.size){const write=tx.objectStore(PARTS).add({owner:prior.key,index:prior.parts,blob} satisfies Part,JSON.stringify([prior.key,prior.parts]));write.onerror=()=>fail(write.error);}
                const write=store.put(next,next.key);write.onerror=()=>fail(write.error);set(next);
            }catch(error){fail(error);}};
        }catch(error){fail(error);}};
    });
}
/** Read only the scoped recording's locally generated support copy. Never a source for official stats. */
export async function loadLiveReplay(scope:LiveHostScope,reference:LiveRecordingReference,clip?:LiveTimelineClip):Promise<LiveReplayMedia|null>{
    if(!validScope(scope)||!reference||![reference.hostSessionId,reference.recordingId].every(id)||clip&&!sameRef(clip,reference))return null;
    scope={...scope};reference={...reference};clip=clip?{...clip}:undefined;
    const allowed=await loadLiveHostSession(scope,reference.hostSessionId);
    if(!allowed||!same(allowed.scope,scope)||allowed.deletedAt||allowed.recordingId!==reference.recordingId)return null;
    const result=await transaction<LiveReplayMedia|null>('readonly',(tx,set,fail)=>{
        const read=tx.objectStore(SEGMENTS).getAll();read.onerror=()=>fail(read.error);
        read.onsuccess=()=>{try{
            const values=(read.result as unknown[]).filter((v):v is Segment=>validSegment(v,scope,reference)&&v.bytes>0);
            const overlap=(v:Segment)=>clip?.startMs!=null&&clip.endMs!=null?Math.max(0,Math.min(v.untilMs,clip.endMs)-Math.max(v.offsetMs,clip.startMs)):v.untilMs-v.offsetMs;
            values.sort((a,b)=>overlap(b)-overlap(a)||b.untilMs-a.untilMs);const selected=values.find(v=>overlap(v)>0);
            if(!selected){set(null);return;}
            const chunks=tx.objectStore(PARTS).index('owner').getAll(selected.key);chunks.onerror=()=>fail(chunks.error);
            chunks.onsuccess=()=>{try{
                const parts=(chunks.result as Part[]).sort((a,b)=>a.index-b.index);
                if(parts.length!==selected.parts||parts.some((part,index)=>part.owner!==selected.key||part.index!==index||!(part.blob instanceof Blob))
                    ||parts.reduce((sum,part)=>sum+part.blob.size,0)!==selected.bytes)throw new Error('O replay local está incompleto.');
                set({blob:new Blob(parts.map(p=>p.blob),{type:selected.mimeType}),offsetMs:selected.offsetMs,availableUntilMs:selected.untilMs,original:false,uncertaintyMs:selected.uncertaintyMs});
            }catch(error){fail(error);}};
        }catch(error){fail(error);}};
    });
    const fresh=await loadLiveHostSession(scope,reference.hostSessionId);
    return fresh&&same(fresh.scope,scope)&&!fresh.deletedAt&&fresh.recordingId===reference.recordingId?result:null;
}

type Owner={recorder:MediaRecorder;segment:Segment|null;stream:MediaStream;token:string;startedMono:number;writes:Promise<void>;failed:boolean};
export type LiveReplayState={state:'waiting'|'recording'|'paused'|'error';message:string;revision:number};
/** A native recorder of the received RTC stream enables replay without stopping the phone's original. */
export class LiveReplayRecorder{
    private owner:Owner|null=null;
    private newest:Owner|null=null;
    private blocked:{token:string;stream:MediaStream}|null=null;
    private disposed=false;
    private revision=0;
    private lastState='';
    private status:{state:LiveReplayState['state'];message:string}={state:'waiting',message:'Replay aguardando sincronização.'};
    constructor(private scope:LiveHostScope,private api:()=>LiveHostBridgeApi|null,private onState:(state:LiveReplayState)=>void){
        if(!validScope(scope))throw new Error('Escopo do replay incompleto.');this.scope={...scope};
    }
    private publish(state:LiveReplayState['state'],message:string,changed=false){
        if(this.disposed)return;if(changed)this.revision++;
        const signature=JSON.stringify([state,message,this.revision]);if(signature===this.lastState)return;this.lastState=signature;this.status={state,message};this.onState({state,message,revision:this.revision});
    }
    private progress(){this.publish(this.status.state,this.status.message,true);}
    private capture(){
        try{
            const capture=this.api()?.getReplayCapture();if(!capture||!capture.stream||!capture.stamp)return null;
            const stamp=parseLiveCaptureStamp(capture.stamp),snapshot=capture.snapshot;
            if(!same(stamp.scope,this.scope)||!same(snapshot.scope,this.scope)||!sameRef(snapshot as LiveRecordingReference,stamp)||snapshot.segmentId!==stamp.segmentId
                ||snapshot.epoch!==stamp.epoch||snapshot.peerGeneration!==stamp.peerGeneration||snapshot.ended||snapshot.blockedReason||snapshot.connection!=='connected'||snapshot.recordingState!=='recording'
                ||['off','paused','finalizing','error'].includes(snapshot.cameraState??'')
                ||!Number.isFinite(capture.playoutDelayMs)||capture.playoutDelayMs<0||capture.playoutDelayMs>10000)return null;
            return {...capture,stamp};
        }catch{return null;}
    }
    tick(){
        if(this.disposed)return;const api=this.api(),capture=api?.getReplayCapture();
        const verified=this.capture(),stamp=verified?.stamp,stream=verified?.stream;
        if(!verified||!stamp||!stream){this.stop();this.publish(capture?.snapshot.recordingState==='paused'?'paused':'waiting',capture?.snapshot.recordingId?'Replay aguardando sincronização.':'Conecte e inicie a câmera para sincronizar.');return;}
        const token=JSON.stringify([stamp.hostSessionId,stamp.recordingId,stamp.segmentId,stamp.epoch,stamp.peerGeneration]);
        if(this.owner&&this.owner.token===token&&this.owner.stream===stream)return;
        this.stop();
        if(this.blocked?.token===token&&this.blocked.stream===stream)return;
        if(typeof MediaRecorder==='undefined'){this.publish('error','Este navegador não oferece replay durante a gravação. O original continua no celular.');return;}
        const mimeType=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
        if(!mimeType){this.publish('error','Formato de replay indisponível neste computador.');return;}
        try{
            const recorder=new MediaRecorder(stream,{mimeType}),owner:Owner={recorder,segment:null,stream,token,startedMono:0,writes:Promise.resolve(),failed:false};this.owner=owner;this.newest=owner;
            const fail=(failure:unknown)=>{owner.failed=true;if(this.owner===owner){this.owner=null;this.blocked={token,stream};this.publish('error',failure instanceof Error?failure.message:'Não foi possível guardar o replay neste computador.');}if(recorder.state!=='inactive')try{recorder.stop();}catch{}};
            recorder.onstart=()=>{
                const fresh=this.capture(),anchor=fresh?.stamp;
                if(this.owner!==owner||!anchor||fresh?.stream!==stream||JSON.stringify([anchor.hostSessionId,anchor.recordingId,anchor.segmentId,anchor.epoch,anchor.peerGeneration])!==token){if(this.owner===owner)this.owner=null;try{recorder.stop();}catch{}return;}
                owner.startedMono=performance.now();const delay=fresh!.playoutDelayMs;
                owner.segment={key:JSON.stringify([this.scope.userId,this.scope.org,this.scope.classId,anchor.hostSessionId,anchor.recordingId,crypto.randomUUID()]),scope:{...this.scope},hostSessionId:anchor.hostSessionId,recordingId:anchor.recordingId,segmentId:anchor.segmentId,mimeType:recorder.mimeType||mimeType,offsetMs:Math.max(0,anchor.timeMs-delay),untilMs:Math.max(0,anchor.timeMs-delay),uncertaintyMs:Math.min(60000,anchor.uncertaintyMs+delay+100),parts:0,bytes:0,stopped:false};
                if(!validSegment(owner.segment,this.scope,anchor)){fail(new Error('Não foi possível sincronizar o replay. O original continua no celular.'));return;}
                owner.writes=createSegment(owner.segment).catch(fail);this.publish('recording','Replay ao vivo ativo.');
            };
            recorder.ondataavailable=event=>{
                if(!owner.segment||owner.failed||!event.data.size)return;
                const segment=owner.segment,until=segment.offsetMs+Math.max(0,performance.now()-owner.startedMono);
                const blob=event.data;
                owner.writes=owner.writes.then(async()=>{if(owner.failed)return;owner.segment=await appendSegment(segment,blob,until,false);if(this.owner===owner)this.publish('recording','Replay ao vivo ativo.',true);else this.progress();}).catch(fail);
            };
            recorder.onstop=()=>{const current=this.owner===owner;if(current)this.owner=null;const segment=owner.segment;if(!segment||owner.failed)return;const until=segment.offsetMs+Math.max(0,performance.now()-owner.startedMono);owner.writes=owner.writes.then(async()=>{if(owner.failed)return;owner.segment=await appendSegment(segment,new Blob(),until,true);if(current&&this.owner===null&&this.newest===owner)this.publish('paused','Replay salvo neste computador.',true);else this.progress();}).catch(fail);};
            recorder.onerror=()=>fail(new Error('A gravação de apoio do replay foi interrompida. O original continua no celular.'));
            recorder.start(1000);
        }catch(failure){this.owner=null;this.blocked={token,stream};this.publish('error',failure instanceof Error?failure.message:'Replay indisponível.');}
    }
    flush(){try{if(this.owner?.recorder.state==='recording')this.owner.recorder.requestData();}catch{/* The last confirmed chunk remains available. */}}
    stop(){const owner=this.owner;this.owner=null;if(owner&&owner.recorder.state!=='inactive')try{owner.recorder.stop();}catch{}}
    dispose(){this.disposed=true;this.stop();}
}
