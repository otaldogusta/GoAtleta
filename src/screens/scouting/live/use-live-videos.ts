import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { measureAsync } from '../../../observability/perf';
import type { LiveHostScope, LiveHostSession } from './live-storage';
import { createLiveVideoReceiver } from './live-video-transfer';
import { importLocalVideo, listVideoStatuses, loadVideoBlob, type LiveVideoStatus } from './live-video-storage';

type Options={resolveSession:(recordingId:string)=>Promise<LiveHostSession|null>;send:(value:unknown)=>boolean};
const pausedCopy=(status:LiveVideoStatus):LiveVideoStatus=>status.state==='receiving'
    ?{...status,state:'error',error:'Cópia pausada. Reconecte o celular para continuar.'}:status;
export function useLiveVideos(scope:LiveHostScope,options:Options){
    const stableScope=useMemo(()=>({userId:scope.userId,org:scope.org,classId:scope.classId}),[scope.userId,scope.org,scope.classId]);
    const callbacks=useRef(options),epoch=useRef(0),receiver=useRef<ReturnType<typeof createLiveVideoReceiver>|null>(null);
    const [statuses,setStatuses]=useState<Record<string,LiveVideoStatus>>({});
    const latest=useRef<Record<string,LiveVideoStatus>>({});
    const publishedAt=useRef(0);
    const persistenceRequested=useRef(false);
    const historyLoaded=useRef<Promise<void>>(Promise.resolve());
    const localImports=useRef(new Map<string,number>());
    useLayoutEffect(()=>{callbacks.current=options;});
    const publish=useCallback((status:LiveVideoStatus)=>{
        if(status.state==='receiving'&&!persistenceRequested.current&&typeof navigator!=='undefined'){
            persistenceRequested.current=true;try{void navigator.storage?.persist?.().catch(()=>undefined);}catch{/* Saving still uses the available local quota. */}
        }
        const previous=latest.current[status.sessionId];latest.current={...latest.current,[status.sessionId]:status};
        const now=Date.now();if(status.state==='receiving'&&previous?.state==='receiving'&&now-publishedAt.current<250)return;
        publishedAt.current=now;setStatuses(latest.current);
    },[]);
    useEffect(()=>{
        const token=++epoch.current;latest.current={};localImports.current.clear();
        void Promise.resolve().then(()=>{if(epoch.current===token)setStatuses(latest.current);});
        historyLoaded.current=measureAsync('screen.scoutingLiveVideo.load.history',()=>listVideoStatuses(stableScope)).then(values=>{
            if(epoch.current!==token)return;
            latest.current={...Object.fromEntries(values.map(value=>[value.sessionId,pausedCopy(value)])),...latest.current};setStatuses(latest.current);
        }).catch(()=>undefined);
        return()=>{epoch.current=token+1;receiver.current?.dispose();receiver.current=null;};
        // The parent remounts on scope identity; no callback can cross the stored scope.
    },[stableScope]);
    const stopVideoChannel=useCallback(()=>{
        const current=receiver.current;receiver.current=null;current?.dispose();
        const paused=Object.fromEntries(Object.entries(latest.current).map(([id,status])=>[id,localImports.current.has(id)?status:pausedCopy(status)]));
        if(Object.keys(paused).some(id=>paused[id]!==latest.current[id])){latest.current=paused;setStatuses(paused);}
    },[]);
    const bindVideoChannel=useCallback(()=>{
        stopVideoChannel();const token=epoch.current;
        const current=createLiveVideoReceiver({scope:stableScope,
            resolveSession:async(recordingId)=>epoch.current===token?callbacks.current.resolveSession(recordingId):null,
            send:message=>{if(epoch.current===token&&receiver.current===current)callbacks.current.send(message);},
            onProgress:status=>{if(epoch.current===token&&receiver.current===current)publish(status);},
        });receiver.current=current;
        // Scope values are fixed for this mounted identity.
    },[stableScope,publish,stopVideoChannel]);
    const receiveVideoMessage=useCallback((value:unknown)=>{
        const message=value as {kind?:unknown;recordingId?:unknown;error?:unknown};
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
    const loadSavedVideo=useCallback(async(session:LiveHostSession)=>{
        const token=epoch.current,current=await callbacks.current.resolveSession(session.recordingId);
        if(!current||current.id!==session.id||current.deletedAt)return null;
        const blob=await measureAsync('screen.scoutingLiveVideo.load.file',()=>loadVideoBlob(stableScope,session.id,session.recordingId));
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
    return {videoStatuses:statuses,bindVideoChannel,stopVideoChannel,receiveVideoMessage,requestVideo,loadSavedVideo,saveImportedVideo};
}
