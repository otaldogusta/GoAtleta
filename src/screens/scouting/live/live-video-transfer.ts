import type { LiveHostScope, LiveHostSession } from './live-storage';
import { appendVideoParts,beginVideo,completeVideo,markVideoError,parseVideoOffer,videoPartHash,LIVE_VIDEO_PARTS_PER_MESSAGE,LIVE_VIDEO_MAX_IN_FLIGHT_PARTS,type LiveVideoOffer,type LiveVideoPart,type LiveVideoStatus } from './live-video-storage';

type Session = Pick<LiveHostSession,'id'|'scope'|'recordingId'|'ended'|'deletedAt'|'recordingState'>;
type Offer = LiveVideoOffer & {kind:'video-offer';transferId:string;recordingId:string};
type Active = {offer:Offer;sessionId:string;progress?:LiveVideoStatus};
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
function parseOffer(value:Record<string,unknown>):Offer{
    if(!keys(value,['kind','transferId','recordingId','mimeType','bytes','partSize','partCount'])||!id(value.transferId)||!id(value.recordingId))throw new Error('Identidade da transferência inválida.');
    const spec=parseVideoOffer(value as unknown as LiveVideoOffer);return {...spec,kind:'video-offer',transferId:value.transferId,recordingId:value.recordingId};
}
function decodePart(value:Record<string,unknown>,nested=false):LiveVideoPart{
    if(!keys(value,nested?['index','data','sha256']:['kind','transferId','recordingId','index','data','sha256'])||!Number.isSafeInteger(value.index)||(value.index as number)<0||typeof value.data!=='string'||value.data.length>10924
        ||!value.data||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(value.data)||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))throw new Error('Trecho de vídeo inválido.');
    let raw:string;try{raw=atob(value.data);}catch{throw new Error('Trecho de vídeo inválido.');}
    if(!raw.length||raw.length>8192)throw new Error('Trecho de vídeo grande demais.');
    const bytes=new Uint8Array(raw.length);for(let index=0;index<raw.length;index++)bytes[index]=raw.charCodeAt(index);
    return {index:value.index as number,data:bytes.buffer,sha256:value.sha256};
}
function decodeParts(value:Record<string,unknown>):LiveVideoPart[]{
    if(value.kind==='video-part')return [decodePart(value)];
    if(!keys(value,['kind','transferId','recordingId','parts'])||!Array.isArray(value.parts)||!value.parts.length||value.parts.length>LIVE_VIDEO_PARTS_PER_MESSAGE)throw new Error('Lote de vídeo inválido.');
    const batch=value.parts.map(part=>{if(!object(part))throw new Error('Trecho de vídeo inválido.');return decodePart(part,true);});
    if(batch.some((part,index)=>index>0&&part.index!==batch[index-1].index+1))throw new Error('Trecho fora de ordem. Retome a transferência.');
    return batch;
}
/** Reliable, ordered RTC messages; each ACK follows its verified IndexedDB commit. */
export function createLiveVideoReceiver({scope,resolveSession,send,onProgress=()=>{}}:{
    scope:LiveHostScope;resolveSession:(recordingId:string)=>Promise<Session|null>;
    send:(message:Record<string,unknown>)=>void;onProgress?:(status:LiveVideoStatus)=>void;
}){
    let active:Active|null=null,disposed=false,queued=0,queuedParts=0,chain=Promise.resolve();
    const current=(owner:Active)=>!disposed&&active===owner;
    const authorize=async(recordingId:string,owner?:Active)=>{
        const session=await resolveSession(recordingId);
        if(disposed||owner&&!current(owner))throw new Error('Transferência cancelada.');
        if(!session||!session.ended||session.deletedAt||session.recordingState==='error'||session.recordingId!==recordingId||session.scope.userId!==scope.userId||session.scope.org!==scope.org||session.scope.classId!==scope.classId)throw new Error('Gravação não disponível nesta turma.');
        if(owner&&session.id!==owner.sessionId)throw new Error('A gravação mudou durante a transferência.');
        return session;
    };
    const respond=(owner:Active,kind:string,extra:Record<string,unknown>={})=>{if(current(owner))send({kind,transferId:owner.offer.transferId,recordingId:owner.offer.recordingId,...extra});};
    const process=async(value:Record<string,unknown>,release:()=>void)=>{
        const reply=(owner:Active,kind:string,extra:Record<string,unknown>={})=>{release();respond(owner,kind,extra);};
        let owner=active;
        if(value.kind==='video-abort'){
            // Aborts are one-way cleanup, never an error/response exchange with the sender.
            if(!owner||value.transferId!==owner.offer.transferId||value.recordingId!==owner.offer.recordingId
                ||!keys(value,['kind','transferId','recordingId','error'])||typeof value.error!=='string'||value.error.length>250)return;
            try{
                await authorize(owner.offer.recordingId,owner);
                const error=value.error||'Envio interrompido no celular. Tente novamente.';
                let progress=owner.progress??{sessionId:owner.sessionId,recordingId:owner.offer.recordingId,state:'error' as const,receivedBytes:0,totalBytes:owner.offer.bytes,mimeType:owner.offer.mimeType,nextPart:0,partCount:owner.offer.partCount};
                try{progress=await markVideoError(scope,owner.sessionId,owner.offer.recordingId,error)??progress;}catch{/* The committed prefix remains available even when quota blocks the error metadata. */}
                if(current(owner))onProgress(progress.state==='ready'?progress:{...progress,state:'error',error});
            }catch{/* Deleted or disposed recipients still release this old transfer without replying. */}
            if(active===owner)active=null;
            return;
        }
        try{
            if(value.kind==='video-offer'){
                const offer=parseOffer(value),session=await authorize(offer.recordingId);
                if(active&&active.offer.recordingId!==offer.recordingId)throw new Error('Aguarde o vídeo anterior terminar de chegar.');
                owner={offer,sessionId:session.id};active=owner;
                const progress=await beginVideo(scope,session.id,offer.recordingId,offer,()=>current(owner!));
                owner.progress=progress;
                await authorize(offer.recordingId,owner);onProgress(progress);
                reply(owner,'video-accept',{nextPart:progress.nextPart,partsPerMessage:LIVE_VIDEO_PARTS_PER_MESSAGE,maxInFlight:LIVE_VIDEO_MAX_IN_FLIGHT_PARTS});return;
            }
            if(!owner||value.transferId!==owner.offer.transferId||value.recordingId!==owner.offer.recordingId)throw new Error('Trecho de outra transferência.');
            await authorize(owner.offer.recordingId,owner);
            if(value.kind==='video-part'||value.kind==='video-parts'){
                const batch=decodeParts(value),hashes=await Promise.all(batch.map(part=>videoPartHash(part.data)));
                if(batch.some((part,index)=>hashes[index]!==part.sha256))throw new Error('A integridade de um trecho do vídeo não confere. Tente novamente.');
                await authorize(owner.offer.recordingId,owner);
                const progress=await appendVideoParts(scope,owner.sessionId,owner.offer.recordingId,batch,()=>current(owner!));
                owner.progress=progress;
                await authorize(owner.offer.recordingId,owner);onProgress(progress);
                reply(owner,'video-ack',{index:batch[batch.length-1].index,nextPart:progress.nextPart});return;
            }
            if(value.kind==='video-complete'){
                if(!keys(value,['kind','transferId','recordingId']))throw new Error('Confirmação de vídeo inválida.');
                const progress=await completeVideo(scope,owner.sessionId,owner.offer.recordingId,()=>current(owner!));
                owner.progress=progress;
                await authorize(owner.offer.recordingId,owner);onProgress(progress);reply(owner,'video-saved',{nextPart:progress.nextPart});active=null;return;
            }
            throw new Error('Mensagem de vídeo inválida.');
        }catch(failure){
            if(disposed)return;
            const error=failure instanceof Error?failure.message:'Não foi possível salvar o vídeo neste computador.';
            // Foreign or malformed messages never poison an unrelated active recording.
            if(owner&&active===owner&&value.transferId===owner.offer.transferId&&value.recordingId===owner.offer.recordingId){
                let progress=owner.progress??{sessionId:owner.sessionId,recordingId:owner.offer.recordingId,state:'error' as const,receivedBytes:0,totalBytes:owner.offer.bytes,mimeType:owner.offer.mimeType,nextPart:0,partCount:owner.offer.partCount};
                try{progress=await markVideoError(scope,owner.sessionId,owner.offer.recordingId,error)??progress;}catch{/* Preserve the last committed prefix even if quota is exhausted. */}
                if(current(owner))onProgress(progress.state==='ready'?progress:{...progress,state:'error',error});
                reply(owner,'video-transfer-error',{error});active=null;
            }else if(id(value.transferId)&&id(value.recordingId)){release();send({kind:'video-transfer-error',transferId:value.transferId,recordingId:value.recordingId,error});}
        }
    };
    return {
        handle(value:unknown):Promise<void>{
            if(disposed||!object(value)||typeof value.kind!=='string'||!value.kind.startsWith('video-'))return Promise.resolve();
            const count=value.kind==='video-part'?1:value.kind==='video-parts'&&Array.isArray(value.parts)?Math.max(1,Math.min(value.parts.length,LIVE_VIDEO_PARTS_PER_MESSAGE+1)):0;
            if(queued>=LIVE_VIDEO_MAX_IN_FLIGHT_PARTS+2||queuedParts+count>LIVE_VIDEO_MAX_IN_FLIGHT_PARTS){if(id(value.transferId)&&id(value.recordingId))send({kind:'video-transfer-error',transferId:value.transferId,recordingId:value.recordingId,error:'O envio está rápido demais. Aguarde a confirmação de cada trecho.'});return Promise.resolve();}
            queued++;queuedParts+=count;let released=false;
            const release=()=>{if(released)return;released=true;queued--;queuedParts-=count;};
            const next=chain.catch(()=>undefined).then(()=>disposed?undefined:process(value,release));chain=next.finally(release);return chain;
        },
        dispose(){disposed=true;active=null;},
    };
}
