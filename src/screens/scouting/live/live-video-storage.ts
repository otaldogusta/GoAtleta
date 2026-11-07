import type { LiveHostScope } from './live-storage';
import { createLiveDatabaseConnection } from './live-idb-connection';

/** Local browser storage only. Neither the signaling companion nor Supabase receives media. */
export const LIVE_VIDEO_PART_SIZE = 8192;
export const LIVE_VIDEO_PARTS_PER_MESSAGE = 4;
export const LIVE_VIDEO_MAX_IN_FLIGHT_PARTS = 8;
export const LIVE_VIDEO_MAX_BYTES = 4 * 1024 * 1024 * 1024;
export type LiveVideoState = 'receiving'|'ready'|'error';
export type LiveVideoStatus = {sessionId:string;recordingId:string;state:LiveVideoState;receivedBytes:number;totalBytes:number;mimeType:string;nextPart:number;partCount:number;error?:string};
export type LiveVideoOffer = {mimeType:string;bytes:number;partSize:number;partCount:number};
export type LiveVideoPart = {index:number;data:ArrayBuffer;sha256:string};
type Manifest = LiveVideoStatus & {version:1;key:string;scope:LiveHostScope;partSize:number};
type Part = {key:string;owner:string;index:number;data:ArrayBuffer;sha256:string};
const DB='goatleta-scouting-live-videos-v1',MANIFESTS='videos',PARTS='parts';
const SHA=/^[a-f0-9]{64}$/;
const identity=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=300;
const scopeMatches=(a:LiveHostScope,b:LiveHostScope)=>a.userId===b.userId&&a.org===b.org&&a.classId===b.classId;
const friendly=(failure:unknown)=>failure&&typeof failure==='object'&&'name' in failure&&failure.name==='QuotaExceededError'
    ?new Error('Sem espaço neste computador para salvar o vídeo. Libere espaço e tente novamente.')
    :failure instanceof Error?failure:new Error('Não foi possível salvar o vídeo neste computador.');

export function liveVideoKey(scope:LiveHostScope,sessionId:string,recordingId:string){
    if(!scope||![scope.userId,scope.org,scope.classId,sessionId,recordingId].every(identity))throw new Error('Identidade do vídeo local inválida.');
    return JSON.stringify([scope.userId,scope.org,scope.classId,sessionId,recordingId]);
}
export function parseVideoOffer(value:LiveVideoOffer):LiveVideoOffer{
    if(!value||typeof value.mimeType!=='string'||value.mimeType.length>120||!/^video\/(mp4|webm)(?:;[\w=., -]+)?$/i.test(value.mimeType)
        ||!Number.isSafeInteger(value.bytes)||value.bytes<=0||value.bytes>LIVE_VIDEO_MAX_BYTES||value.partSize!==LIVE_VIDEO_PART_SIZE
        ||!Number.isSafeInteger(value.partCount)||value.partCount!==Math.ceil(value.bytes/LIVE_VIDEO_PART_SIZE))throw new Error('Metadados do vídeo inválidos.');
    return {mimeType:value.mimeType,bytes:value.bytes,partSize:value.partSize,partCount:value.partCount};
}
const status=(m:Manifest):LiveVideoStatus=>({sessionId:m.sessionId,recordingId:m.recordingId,state:m.state,receivedBytes:m.receivedBytes,totalBytes:m.totalBytes,mimeType:m.mimeType,nextPart:m.nextPart,partCount:m.partCount,...(m.error?{error:m.error}:{})});
function manifest(value:unknown,scope:LiveHostScope,key:string):Manifest{
    const m=value as Manifest;
    if(!m||m.version!==1||!m.scope||!scopeMatches(m.scope,scope)||m.key!==key||liveVideoKey(scope,m.sessionId,m.recordingId)!==key)throw new Error('Vídeo de outro usuário ou turma.');
    parseVideoOffer({mimeType:m.mimeType,bytes:m.totalBytes,partSize:m.partSize,partCount:m.partCount});
    if(!['receiving','ready','error'].includes(m.state)||!Number.isSafeInteger(m.nextPart)||m.nextPart<0||m.nextPart>m.partCount
        ||m.receivedBytes!==Math.min(m.nextPart*m.partSize,m.totalBytes)||m.state==='ready'&&m.nextPart!==m.partCount)throw new Error('Vídeo local incompleto ou inválido.');
    return m;
}
const videoConnection=createLiveDatabaseConnection(DB,db=>{
    if(!db.objectStoreNames.contains(MANIFESTS))db.createObjectStore(MANIFESTS);
    if(!db.objectStoreNames.contains(PARTS)){const parts=db.createObjectStore(PARTS);parts.createIndex('owner','owner');}
});
async function transaction<T>(mode:IDBTransactionMode,run:(tx:IDBTransaction,set:(value:T)=>void,fail:(error:unknown)=>void,touch:()=>void)=>void):Promise<T>{
    const tx=await videoConnection.transaction([MANIFESTS,PARTS],mode);
    return new Promise((resolve,reject)=>{
        let result:T,failure:Error|undefined,done=false;
        let timer:ReturnType<typeof setTimeout>;
        const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
        const fail=(error:unknown)=>{failure=friendly(error);try{tx.abort();}catch{finish(failure);}};
        const touch=()=>{if(done)return;clearTimeout(timer);timer=setTimeout(()=>fail(new Error('Tempo esgotado ao salvar o vídeo local.')),15000);};
        touch();
        tx.oncomplete=()=>finish();tx.onabort=()=>finish(failure??friendly(tx.error));tx.onerror=()=>{failure=friendly(tx.error);};
        try{run(tx,value=>{result=value;},fail,touch);}catch(error){fail(error);}
    });
}
function readManifest(tx:IDBTransaction,scope:LiveHostScope,key:string,found:(m:Manifest|null)=>void,fail:(e:unknown)=>void){
    const request=tx.objectStore(MANIFESTS).get(key);request.onerror=()=>fail(request.error);
    request.onsuccess=()=>{try{found(request.result===undefined?null:manifest(request.result,scope,key));}catch(error){fail(error);}};
}
function putManifest(tx:IDBTransaction,m:Manifest,set:(v:LiveVideoStatus)=>void,fail:(e:unknown)=>void){const req=tx.objectStore(MANIFESTS).put(m,m.key);req.onerror=()=>fail(req.error);set(status(m));}
export async function beginVideo(scope:LiveHostScope,sessionId:string,recordingId:string,value:LiveVideoOffer,guard:()=>boolean=()=>true):Promise<LiveVideoStatus>{
    const spec=parseVideoOffer(value),key=liveVideoKey(scope,sessionId,recordingId);
    return transaction('readwrite',(tx,set,fail)=>readManifest(tx,scope,key,existing=>{
        if(!guard())throw new Error('Transferência cancelada.');
        if(existing){
            if(existing.totalBytes!==spec.bytes||existing.mimeType!==spec.mimeType||existing.partSize!==spec.partSize||existing.partCount!==spec.partCount)throw new Error('Já existe outra cópia deste vídeo. Os dados anteriores foram preservados.');
            const {error:_,...clean}=existing;putManifest(tx,{...clean,state:existing.state==='ready'?'ready':'receiving'},set,fail);return;
        }
        putManifest(tx,{version:1,key,scope:{...scope},sessionId,recordingId,state:'receiving',receivedBytes:0,totalBytes:spec.bytes,mimeType:spec.mimeType,nextPart:0,partSize:spec.partSize,partCount:spec.partCount},set,fail);
    },fail));
}
export async function appendVideoPart(scope:LiveHostScope,sessionId:string,recordingId:string,index:number,data:ArrayBuffer,sha256:string,guard:()=>boolean=()=>true):Promise<LiveVideoStatus>{
    return appendVideoParts(scope,sessionId,recordingId,[{index,data,sha256}],guard);
}
/** One contiguous, verified transport batch commits atomically; the persisted part size stays compatible. */
export async function appendVideoParts(scope:LiveHostScope,sessionId:string,recordingId:string,value:readonly LiveVideoPart[],guard:()=>boolean=()=>true):Promise<LiveVideoStatus>{
    const key=liveVideoKey(scope,sessionId,recordingId);
    if(!Array.isArray(value)||!value.length||value.length>LIVE_VIDEO_PARTS_PER_MESSAGE)throw new Error('Lote de vídeo inválido.');
    const batch=value.map(({index,data,sha256})=>({index,data,sha256}));
    if(batch.some((part,index)=>!Number.isSafeInteger(part.index)||part.index<0||!(part.data instanceof ArrayBuffer)||!SHA.test(part.sha256)
        ||index>0&&part.index!==batch[index-1].index+1))throw new Error('Trecho de vídeo inválido.');
    return transaction('readwrite',(tx,set,fail)=>readManifest(tx,scope,key,m=>{
        if(!guard())throw new Error('Transferência cancelada.');
        if(!m||batch.some(part=>part.index>=m.partCount||part.data.byteLength!==Math.min(m.partSize,m.totalBytes-part.index*m.partSize)))throw new Error('Trecho incompleto ou de outra gravação.');
        if(batch[0].index>m.nextPart)throw new Error('Trecho fora de ordem. Retome a transferência.');
        const parts=tx.objectStore(PARTS),duplicates=batch.filter(part=>part.index<m.nextPart),fresh=batch.slice(duplicates.length);
        const append=()=>{
            if(!guard())throw new Error('Transferência cancelada.');
            if(!fresh.length){set(status(m));return;}
            if(m.state==='ready'||fresh[0].index!==m.nextPart)throw new Error('Trecho fora de ordem. Retome a transferência.');
            for(const part of fresh){const partKey=JSON.stringify([key,part.index]),request=parts.put({key:partKey,owner:key,...part} satisfies Part,partKey);request.onerror=()=>fail(request.error);}
            const nextPart=fresh[fresh.length-1].index+1,{error:_,...clean}=m;
            putManifest(tx,{...clean,state:'receiving',nextPart,receivedBytes:Math.min(nextPart*m.partSize,m.totalBytes)},set,fail);
        };
        if(!duplicates.length){append();return;}
        let remaining=duplicates.length;
        for(const part of duplicates){
            const partKey=JSON.stringify([key,part.index]),request=parts.get(partKey);request.onerror=()=>fail(request.error);
            request.onsuccess=()=>{try{
                const prior=request.result as Part|undefined;
                if(!prior||prior.key!==partKey||prior.owner!==key||prior.index!==part.index||prior.sha256!==part.sha256||!(prior.data instanceof ArrayBuffer)||prior.data.byteLength!==part.data.byteLength)throw new Error('Trecho repetido divergente. A cópia anterior foi preservada.');
                if(!--remaining)append();
            }catch(error){fail(error);}};
        }
    },fail));
}
export async function completeVideo(scope:LiveHostScope,sessionId:string,recordingId:string,guard:()=>boolean=()=>true):Promise<LiveVideoStatus>{
    const key=liveVideoKey(scope,sessionId,recordingId);
    return transaction('readwrite',(tx,set,fail)=>readManifest(tx,scope,key,m=>{
        if(!guard())throw new Error('Transferência cancelada.');
        if(!m||m.nextPart!==m.partCount||m.receivedBytes!==m.totalBytes)throw new Error('O vídeo ainda não chegou completo.');
        const count=tx.objectStore(PARTS).index('owner').count(key);count.onerror=()=>fail(count.error);count.onsuccess=()=>{if(!guard()){fail(new Error('Transferência cancelada.'));return;}if(count.result!==m.partCount){fail(new Error('Há trechos ausentes no vídeo.'));return;}const {error:_,...clean}=m;putManifest(tx,{...clean,state:'ready'},set,fail);};
    },fail));
}
export async function markVideoError(scope:LiveHostScope,sessionId:string,recordingId:string,error:string):Promise<LiveVideoStatus|null>{
    const key=liveVideoKey(scope,sessionId,recordingId);
    return transaction('readwrite',(tx,set,fail)=>readManifest(tx,scope,key,m=>{if(!m){set(null);return;}if(m.state==='ready'){set(status(m));return;}putManifest(tx,{...m,state:'error',error:error.slice(0,250)},set,fail);},fail));
}
export async function loadVideoStatus(scope:LiveHostScope,sessionId:string,recordingId:string):Promise<LiveVideoStatus|null>{
    const key=liveVideoKey(scope,sessionId,recordingId);return transaction('readonly',(tx,set,fail)=>readManifest(tx,scope,key,m=>set(m?status(m):null),fail));
}
export async function listVideoStatuses(scope:LiveHostScope):Promise<LiveVideoStatus[]>{
    liveVideoKey(scope,'validate','validate');return transaction('readonly',(tx,set,fail)=>{const req=tx.objectStore(MANIFESTS).getAll();req.onerror=()=>fail(req.error);req.onsuccess=()=>{try{set((req.result as Manifest[]).filter(m=>m.scope&&scopeMatches(m.scope,scope)).map(m=>status(manifest(m,scope,m.key))));}catch(error){fail(error);}};});
}
export async function loadVideoBlob(scope:LiveHostScope,sessionId:string,recordingId:string):Promise<Blob|null>{
    const key=liveVideoKey(scope,sessionId,recordingId);return transaction('readonly',(tx,set,fail,touch)=>readManifest(tx,scope,key,m=>{
        touch();
        if(!m||m.state!=='ready'){set(null);return;}
        const parts=tx.objectStore(PARTS),batches:Blob[]=[];
        let index=0,total=0,buffers:ArrayBuffer[]=[];
        const next=()=>{
            const partKey=JSON.stringify([key,index]),request=parts.get(partKey);request.onerror=()=>fail(request.error);
            request.onsuccess=()=>{
                try{
                    touch();
                    const part=request.result as Part|undefined;
                    if(!part||part.key!==partKey||part.owner!==key||part.index!==index||!SHA.test(part.sha256)||!(part.data instanceof ArrayBuffer)
                        ||part.data.byteLength!==Math.min(m.partSize,m.totalBytes-index*m.partSize))throw new Error('O vídeo local tem trechos ausentes ou inválidos.');
                    buffers.push(part.data);total+=part.data.byteLength;index++;
                    // Release each <=1 MiB batch of JS ArrayBuffers into Blob backing storage.
                    if(buffers.length===128||index===m.partCount){batches.push(new Blob(buffers));buffers=[];}
                    if(index<m.partCount){next();return;}
                    const blob=new Blob(batches,{type:m.mimeType});if(total!==m.totalBytes||blob.size!==m.totalBytes)throw new Error('A cópia do vídeo está incompleta.');set(blob);
                }catch(error){fail(error);}
            };
        };
        const count=parts.index('owner').count(key);count.onerror=()=>fail(count.error);count.onsuccess=()=>{touch();if(count.result!==m.partCount){fail(new Error('O vídeo local tem trechos ausentes ou inválidos.'));return;}next();};
    },fail));
}
export async function videoPartHash(data:ArrayBuffer):Promise<string>{
    if(!globalThis.crypto?.subtle)throw new Error('Este navegador não permite conferir a integridade do vídeo.');
    const hash=await globalThis.crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Explicit legacy file selection uses the same bounded persistence and confirmation gates. */
export async function importLocalVideo(scope:LiveHostScope,sessionId:string,recordingId:string,blob:Blob,guard:()=>boolean=()=>true):Promise<LiveVideoStatus>{
    const spec=parseVideoOffer({mimeType:blob.type,bytes:blob.size,partSize:LIVE_VIDEO_PART_SIZE,partCount:Math.ceil(blob.size/LIVE_VIDEO_PART_SIZE)});
    const current=await beginVideo(scope,sessionId,recordingId,spec,guard);if(current.state==='ready')return current;
    for(let start=0;start<spec.partCount;start+=LIVE_VIDEO_PARTS_PER_MESSAGE){
        if(!guard())throw new Error('Transferência cancelada.');
        const batch=await Promise.all(Array.from({length:Math.min(LIVE_VIDEO_PARTS_PER_MESSAGE,spec.partCount-start)},async(_,offset)=>{
            const index=start+offset,data=await blob.slice(index*spec.partSize,(index+1)*spec.partSize).arrayBuffer();return {index,data,sha256:await videoPartHash(data)};
        }));
        await appendVideoParts(scope,sessionId,recordingId,batch,guard);
    }
    return completeVideo(scope,sessionId,recordingId,guard);
}
