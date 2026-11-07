import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { loadLiveHostSession, type LiveHostScope } from './live-storage';
import { loadVideoBlob, loadVideoStatus } from './live-video-storage';
import { applyLiveScoutingEvent, loadLiveScoutingTimeline, timelineRecordings, type LiveScoutingTimeline } from './live-scouting-storage';
import { LiveReplayRecorder, loadLiveReplay, type LiveReplayState } from './live-replay';
import type { LiveHostBridgeApi, LiveHostSnapshot, LiveRecordingReference, LiveReplayMedia, LiveTimelineClip, ScoutingCaptureBridge } from './live-scouting-contract';

/** Workspace-owned connection between capture, the official collector and local replay material. */
export function useLiveScouting(scope:LiveHostScope,analysisSessionId:string,enabled:boolean){
    const stableScope=useMemo(()=>({userId:scope.userId,org:scope.org,classId:scope.classId}),[scope.userId,scope.org,scope.classId]);
    const scopeIdentity=JSON.stringify([scope.userId,scope.org,scope.classId]),renderScope=useRef(scopeIdentity);
    useLayoutEffect(()=>{renderScope.current=scopeIdentity;},[scopeIdentity]);
    const identity=JSON.stringify([scope.userId,scope.org,scope.classId,analysisSessionId]);
    const context=useRef({identity,alive:true});
    const host=useRef<LiveHostBridgeApi|null>(null),replay=useRef<LiveReplayRecorder|null>(null);
    const [snapshot,setSnapshot]=useState<LiveHostSnapshot|null>(null),[timeline,setTimeline]=useState<LiveScoutingTimeline|null>(null);
    const [replayState,setReplayState]=useState<LiveReplayState>({state:'waiting',message:'',revision:0});
    const [error,setError]=useState('');
    const [reload,setReload]=useState(0);
    const retryTimeline=useCallback(()=>setReload(value=>value+1),[]);
    useLayoutEffect(()=>{context.current={identity,alive:true};return()=>{context.current.alive=false;};},[identity]);
    useLayoutEffect(()=>{const prior=host.current?.getSnapshot().scope;if(prior&&(prior.userId!==stableScope.userId||prior.org!==stableScope.org||prior.classId!==stableScope.classId)){host.current=null;setSnapshot(null);}},[stableScope]);
    const isCurrent=useCallback((owner:{identity:string;alive:boolean})=>context.current===owner&&owner.alive,[]);
    useEffect(()=>{
        if(!enabled)return;
        const recorder=new LiveReplayRecorder(stableScope,()=>host.current,setReplayState);replay.current=recorder;
        const timer=setInterval(()=>recorder.tick(),500);recorder.tick();
        return()=>{clearInterval(timer);recorder.dispose();if(replay.current===recorder)replay.current=null;};
    },[stableScope,enabled]);
    useEffect(()=>{
        let alive=true;const owner=context.current;void Promise.resolve().then(()=>{if(alive&&isCurrent(owner)){setTimeline(null);setError('');}});
        if(enabled&&analysisSessionId)void loadLiveScoutingTimeline(stableScope,analysisSessionId).then(value=>{if(alive&&isCurrent(owner))setTimeline(value);}).catch(failure=>{if(alive&&isCurrent(owner))setError(failure instanceof Error?failure.message:'Não foi possível abrir os lances locais.');});
        return()=>{alive=false;};
    },[stableScope,analysisSessionId,enabled,identity,isCurrent,reload]);
    const onHostApi=useCallback((api:LiveHostBridgeApi|null)=>{if(renderScope.current!==scopeIdentity)return;const value=api?.getSnapshot();if(value&&(value.scope.userId!==stableScope.userId||value.scope.org!==stableScope.org||value.scope.classId!==stableScope.classId))return;host.current=api;setSnapshot(value??null);replay.current?.tick();},[stableScope,scopeIdentity]);
    const onHostSnapshot=useCallback((value:LiveHostSnapshot)=>{if(renderScope.current!==scopeIdentity||value.scope.userId!==stableScope.userId||value.scope.org!==stableScope.org||value.scope.classId!==stableScope.classId)return;setSnapshot(value);replay.current?.tick();},[stableScope,scopeIdentity]);
    const captureBridge=useMemo<ScoutingCaptureBridge>(()=>({
        captureStamp:()=>{
            if(!enabled||!context.current.alive||context.current.identity!==identity)return null;const stamp=host.current?.getCaptureStamp();
            return stamp&&stamp.scope.userId===stableScope.userId&&stamp.scope.org===stableScope.org&&stamp.scope.classId===stableScope.classId?stamp:null;
        },
        captureReference:()=>{
            if(!enabled||!context.current.alive||context.current.identity!==identity)return null;const value=host.current?.getSnapshot();
            return value&&!value.ended&&value.scope.userId===stableScope.userId&&value.scope.org===stableScope.org&&value.scope.classId===stableScope.classId&&value.hostSessionId&&value.recordingId
                ?{hostSessionId:value.hostSessionId,recordingId:value.recordingId}:null;
        },
        applied:async event=>{
            const owner=context.current;
            if(!enabled||!isCurrent(owner)||owner.identity!==identity||event.sessionId!==analysisSessionId)throw new Error('A análise mudou antes de sincronizar os lances.');
            const auth=getSessionIdentity();assertSessionIdentity(auth);if(auth.userId!==stableScope.userId)throw new Error('A conta mudou antes de sincronizar.');
            try{
                const value=await applyLiveScoutingEvent(stableScope,event);assertSessionIdentity(auth);
                if(isCurrent(owner)){setTimeline(value.timeline);setError('');replay.current?.flush();}
                return value.recoveredTiming?{recoveredTiming:value.recoveredTiming}:undefined;
            }catch(failure){if(isCurrent(owner))setError('O scouting foi salvo. Tente sincronizar os lances novamente.');throw failure;}
        },
    }),[enabled,isCurrent,identity,stableScope,analysisSessionId]);
    const recordings=useMemo(()=>{
        const values=timeline&&timeline.analysisSessionId===analysisSessionId?timelineRecordings(timeline):[];
        if(analysisSessionId&&snapshot?.scope.userId===stableScope.userId&&snapshot.scope.org===stableScope.org&&snapshot.scope.classId===stableScope.classId&&snapshot.hostSessionId&&snapshot.recordingId&&!snapshot.ended&&!values.some(value=>value.recordingId===snapshot.recordingId))values.unshift({analysisSessionId,hostSessionId:snapshot.hostSessionId,recordingId:snapshot.recordingId,clips:[],updatedAt:new Date().toISOString()});
        return values;
    },[timeline,analysisSessionId,snapshot,stableScope]);
    const loadMedia=useCallback(async(reference:LiveRecordingReference,clip?:LiveTimelineClip):Promise<LiveReplayMedia|null>=>{
        reference={hostSessionId:reference.hostSessionId,recordingId:reference.recordingId};
        const owner=context.current,auth=getSessionIdentity();assertSessionIdentity(auth);if(auth.userId!==stableScope.userId||owner.identity!==identity||!isCurrent(owner))return null;
        const manifest=await loadLiveHostSession(stableScope,reference.hostSessionId);
        if(!isCurrent(owner)||!manifest||manifest.deletedAt||manifest.recordingId!==reference.recordingId)return null;
        const status=await loadVideoStatus(stableScope,reference.hostSessionId,reference.recordingId);
        let result:LiveReplayMedia|null=null;
        if(manifest.ended&&manifest.recordingState==='stopped'&&status?.state==='ready'){
            const blob=await loadVideoBlob(stableScope,reference.hostSessionId,reference.recordingId);
            if(blob)result={blob,offsetMs:0,availableUntilMs:manifest.durationMs??7200000,original:true,uncertaintyMs:0};
        }else result=await loadLiveReplay(stableScope,reference,clip);
        assertSessionIdentity(auth);if(!isCurrent(owner))return null;
        const fresh=await loadLiveHostSession(stableScope,reference.hostSessionId);
        assertSessionIdentity(auth);
        return fresh&&!fresh.deletedAt&&fresh.recordingId===reference.recordingId&&isCurrent(owner)?result:null;
    },[stableScope,identity,isCurrent]);
    const synchronized=!!snapshot?.recordingId&&!snapshot.ended&&!snapshot.blockedReason&&snapshot.connection==='connected'&&snapshot.recordingState==='recording'&&replayState.state==='recording';
    const status=synchronized?'Gravação sincronizada · replay ao vivo':snapshot?.recordingState==='paused'&&!snapshot.ended?'Gravação pausada · continue na Câmera':snapshot?.recordingId&&!snapshot.ended?'Aguardando sincronização da câmera':recordings.length?'Lances vinculados à gravação':snapshot?.connection==='connected'?snapshot.cameraState==='off'?'Ligue a câmera para gravar lances com vídeo':'Câmera pronta · inicie a gravação':'Conecte a câmera para registrar lances com vídeo';
    return {captureBridge,onHostApi,onHostSnapshot,recordings,loadMedia,status,synchronized,error,replayState,snapshot,retryTimeline,
        loading:!!(enabled&&analysisSessionId&&(!timeline||timeline.analysisSessionId!==analysisSessionId)&&!error),
        revision:(timeline?.revision??0)+replayState.revision+(snapshot?.videoState==='ready'?1000000:0)};
}
