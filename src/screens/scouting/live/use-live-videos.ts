import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { measureAsync } from '../../../observability/perf';
import type { LiveHostScope, LiveHostSession } from './live-storage';
import { createLiveVideoReceiver } from './live-video-transfer';
import { importLocalVideo, listVideoStatuses, loadVideoBlob, type LiveVideoStatus } from './live-video-storage';
import { createNativeOriginalReceiver, type NativeOriginalSession } from './native-live-original-receiver';
import { listNativeOriginalStatuses, loadNativeOriginalBlob, openNativeOriginal } from './native-live-original-storage';

type Options={resolveSession:(recordingId:string)=>Promise<LiveHostSession|null>;resolveNativeSession?:(recordingId:string)=>Promise<NativeOriginalSession|null>;send:(value:unknown)=>boolean};
const pausedCopy=(status:LiveVideoStatus):LiveVideoStatus=>status.state==='receiving'
    ?{...status,state:'error',error:'Cópia pausada. Reconecte o celular para continuar.'}:status;
const PROGRESS_INTERVAL_MS=250;
export function useLiveVideos(scope:LiveHostScope,options:Options){
    const stableScope=useMemo(()=>({userId:scope.userId,org:scope.org,classId:scope.classId}),[scope.userId,scope.org,scope.classId]);
    const callbacks=useRef(options),epoch=useRef(0),receiver=useRef<ReturnType<typeof createLiveVideoReceiver>|null>(null);
    const nativeReceiver=useRef<ReturnType<typeof createNativeOriginalReceiver>|null>(null);
    const nativeDrained=useRef<Promise<void>>(Promise.resolve());
    const [statuses,setStatuses]=useState<Record<string,LiveVideoStatus>>({});
    const latest=useRef<Record<string,LiveVideoStatus>>({});
    const publishedAt=useRef(0);
    const progressTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
    const persistenceRequested=useRef(false);
    const historyLoaded=useRef<Promise<void>>(Promise.resolve());
    const localImports=useRef(new Map<string,number>());
    const clearProgressTimer=useCallback(()=>{
        if(progressTimer.current!==undefined)clearTimeout(progressTimer.current);
        progressTimer.current=undefined;
    },[]);
    const stopNative=useCallback(()=>{
        const native=nativeReceiver.current;nativeReceiver.current=null;
        if(native)nativeDrained.current=Promise.all([nativeDrained.current,native.dispose()]).then(()=>undefined);
    },[]);
    useLayoutEffect(()=>{callbacks.current=options;});
    const publish=useCallback((status:LiveVideoStatus)=>{
        if(status.state==='receiving'&&!persistenceRequested.current&&typeof navigator!=='undefined'){
            persistenceRequested.current=true;try{void navigator.storage?.persist?.().catch(()=>undefined);}catch{/* Saving still uses the available local quota. */}
        }
        const previous=latest.current[status.sessionId];
        if(previous?.state==='ready'&&status.state!=='ready')return;
        latest.current={...latest.current,[status.sessionId]:status};
        const now=Date.now(),remaining=PROGRESS_INTERVAL_MS-(now-publishedAt.current);
        if(status.state==='receiving'&&previous?.state==='receiving'&&remaining>0){
            if(progressTimer.current===undefined){
                const token=epoch.current;
                progressTimer.current=setTimeout(()=>{
                    progressTimer.current=undefined;
                    if(epoch.current!==token)return;
                    publishedAt.current=Date.now();setStatuses(latest.current);
                },remaining);
            }
            return;
        }
        clearProgressTimer();publishedAt.current=now;setStatuses(latest.current);
    },[clearProgressTimer]);
    useEffect(()=>{
        const token=++epoch.current;latest.current={};localImports.current.clear();
        void Promise.resolve().then(()=>{if(epoch.current===token)setStatuses(latest.current);});
        historyLoaded.current=measureAsync('screen.scoutingLiveVideo.load.history',async()=>{
            const [legacy,native]=await Promise.all([listVideoStatuses(stableScope).catch(()=>[]),listNativeOriginalStatuses(stableScope).catch(()=>[])]);
            const values=new Map(legacy.map(value=>[value.sessionId,value]));
            for(const value of native)if(value.state==='ready'||values.get(value.sessionId)?.state!=='ready')values.set(value.sessionId,value);
            return [...values.values()];
        }).then(values=>{
            if(epoch.current!==token)return;
            latest.current={...Object.fromEntries(values.map(value=>[value.sessionId,pausedCopy(value)])),...latest.current};setStatuses(latest.current);
        }).catch(()=>undefined);
        return()=>{epoch.current=token+1;clearProgressTimer();receiver.current?.dispose();receiver.current=null;stopNative();};
        // The parent remounts on scope identity; no callback can cross the stored scope.
    },[stableScope,stopNative,clearProgressTimer]);
    const stopVideoChannel=useCallback(()=>{
        clearProgressTimer();
        const current=receiver.current;receiver.current=null;current?.dispose();
        stopNative();
        const paused=Object.fromEntries(Object.entries(latest.current).map(([id,status])=>[id,localImports.current.has(id)?status:pausedCopy(status)]));
        if(Object.keys(paused).some(id=>paused[id]!==latest.current[id])){latest.current=paused;setStatuses(paused);}
    },[stopNative,clearProgressTimer]);
    const bindVideoChannel=useCallback(()=>{
        stopVideoChannel();const token=epoch.current;
        const current=createLiveVideoReceiver({scope:stableScope,
            resolveSession:async(recordingId)=>epoch.current===token?callbacks.current.resolveSession(recordingId):null,
            send:message=>{if(epoch.current===token&&receiver.current===current)callbacks.current.send(message);},
            onProgress:status=>{if(epoch.current===token&&receiver.current===current)publish(status);},
        });receiver.current=current;
        const drain=nativeDrained.current;
        const native=createNativeOriginalReceiver({scope:stableScope,
            resolveSession:async(recordingId)=>epoch.current===token&&nativeReceiver.current===native?await callbacks.current.resolveNativeSession?.(recordingId)??null:null,
            send:message=>{if(epoch.current===token&&nativeReceiver.current===native)callbacks.current.send(message);},
            onProgress:status=>{if(epoch.current===token&&nativeReceiver.current===native)publish(status);},
            open:async(identity,ensure)=>{await drain;return openNativeOriginal(identity,ensure);},
        });nativeReceiver.current=native;
        // Scope values are fixed for this mounted identity.
    },[stableScope,publish,stopVideoChannel]);
    const receiveVideoMessage=useCallback((value:unknown)=>{
        const message=value as {kind?:unknown;recordingId?:unknown;error?:unknown};
        if(typeof message?.kind==='string'&&message.kind.startsWith('native-original-')){
            void nativeReceiver.current?.handle(value).catch(()=>undefined);return;
        }
        if(message?.kind==='video-unavailable'&&typeof message.recordingId==='string'&&message.recordingId.length<=128&&typeof message.error==='string'&&message.error.length<=256){
            const recordingId=message.recordingId,error=message.error,token=epoch.current,owner=receiver.current;
            if(!owner)return;
            void historyLoaded.current.then(()=>epoch.current===token&&receiver.current===owner?callbacks.current.resolveSession(recordingId):null).then(session=>{
                if(epoch.current!==token||receiver.current!==owner||!session||session.deletedAt||localImports.current.has(session.id)||latest.current[session.id]?.state==='ready')return;
                const prior=latest.current[session.id];
                publish({...prior,sessionId:session.id,recordingId,state:'error',receivedBytes:prior?.receivedBytes??0,totalBytes:prior?.totalBytes??0,mimeType:prior?.mimeType??session.mimeType,nextPart:prior?.nextPart??0,partCount:prior?.partCount??0,error});
            }).catch(()=>undefined);return;
        }
        void receiver.current?.handle(value).catch(()=>undefined);
    },[publish]);
    const requestVideo=useCallback((session:LiveHostSession)=>{
        if(!session.ended||session.deletedAt||session.recordingState==='error'||latest.current[session.id]?.state==='ready')return false;
        return callbacks.current.send({kind:'video-request',recordingId:session.recordingId});
    },[]);
    const requestNativeOriginal=useCallback((session:LiveHostSession)=>{
        if(session.deletedAt||session.recordingState==='error'||latest.current[session.id]?.state==='ready')return false;
        return callbacks.current.send({kind:'native-original-request',recordingId:session.recordingId});
    },[]);
    const loadSavedVideo=useCallback(async(session:LiveHostSession)=>{
        const token=epoch.current,current=await callbacks.current.resolveSession(session.recordingId);
        if(!current||current.id!==session.id||current.deletedAt)return null;
        const blob=await measureAsync('screen.scoutingLiveVideo.load.file',async()=>await loadNativeOriginalBlob(stableScope,session.id,session.recordingId)??await loadVideoBlob(stableScope,session.id,session.recordingId));
        const fresh=await callbacks.current.resolveSession(session.recordingId);
        return epoch.current===token&&fresh?.id===session.id&&!fresh.deletedAt?blob:null;
    },[stableScope]);
    const saveImportedVideo=useCallback(async(session:LiveHostSession,blob:Blob)=>{
        const token=epoch.current,current=await callbacks.current.resolveSession(session.recordingId);
        if(epoch.current!==token||!current||current.id!==session.id||current.deletedAt||!current.ended)return false;
        if(latest.current[session.id]?.state==='ready')return true;
        localImports.current.set(session.id,(localImports.current.get(session.id)??0)+1);
        publish({sessionId:session.id,recordingId:session.recordingId,state:'receiving',receivedBytes:0,totalBytes:blob.size,mimeType:blob.type,nextPart:0,partCount:Math.ceil(blob.size/8192)});
        try{
            let result:LiveVideoStatus;
            try{result=await measureAsync('screen.scoutingLiveVideo.load.import',()=>importLocalVideo(stableScope,session.id,session.recordingId,blob,()=>epoch.current===token));}
            catch(failure){if(epoch.current===token)publish({...latest.current[session.id],state:'error',error:failure instanceof Error?failure.message:'Não foi possível guardar o vídeo neste computador.'});throw failure;}
            const fresh=await callbacks.current.resolveSession(session.recordingId);
            if(epoch.current!==token||fresh?.id!==session.id||fresh.deletedAt)return false;
            publish(result);return true;
        }finally{
            if(epoch.current===token){const count=(localImports.current.get(session.id)??1)-1;if(count)localImports.current.set(session.id,count);else localImports.current.delete(session.id);}
        }
    },[stableScope,publish]);
    return {videoStatuses:statuses,bindVideoChannel,stopVideoChannel,receiveVideoMessage,requestVideo,requestNativeOriginal,loadSavedVideo,saveImportedVideo};
}
