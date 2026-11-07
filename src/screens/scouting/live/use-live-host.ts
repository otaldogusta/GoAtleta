import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { calibrateLiveClock, createLivePoint, parseLiveClockMessage, resolveLiveCaptureTime, resolveLiveVideoTime, type LiveCaptureStamp, type LiveClockCalibration, type LiveClockMessage, type LivePoint } from '../../../core/scouting-live';
import { closeLiveRoom, createLiveRoom, getLiveServiceConfig, heartbeatLiveRoom, pollLiveSignals, sendLiveSignal, type LiveRoom, type LiveServiceConfig, type LiveSignal } from './live-api';
import { deleteLiveHostSession, loadLiveHostSession, loadLiveHostSessions, parseLiveHostSession, restoreLiveHostSession, saveLiveHostSession, saveLiveHostThumbnail, type LiveHostScope, type LiveHostSession, type LiveCameraOperation as Operation } from './live-storage';
import { measureAsync } from '../../../observability/perf';
import { captureLiveThumbnail } from './live-thumbnail';
import { useLiveVideos } from './use-live-videos';
import { downloadVideoBlob } from '../video/video-media.web';
import { loadVideoBlob, loadVideoStatus } from './live-video-storage';
import type { LiveHostBridgeApi, LiveHostSnapshot, LiveRecordingReference } from './live-scouting-contract';

type Recording = { recordingId: string; startEpochMs: number; state: 'recording' | 'paused' | 'stopped' | 'error'; mimeType: string; durationMs?:number };
type CameraState = 'off'|'preview'|'recording'|'paused'|'finalizing'|'error';
type CameraControl = 'pause-recording'|'resume-recording'|'camera-on'|'camera-off'|'new-recording';
export type LiveCaptureInfo = {label:string;width?:number;height?:number;frameRate?:number;zoom?:number};
export function parseLiveCaptureInfo(value:unknown):LiveCaptureInfo|null {
    if(!value||typeof value!=='object')return null;
    const v=value as Record<string,unknown>;
    if(typeof v.label!=='string'||v.label.length>120)return null;
    const bounded=(input:unknown,min:number,max:number)=>typeof input==='number'&&Number.isFinite(input)&&input>=min&&input<=max;
    if(v.width!==undefined&&!bounded(v.width,1,16384)||v.height!==undefined&&!bounded(v.height,1,16384)
        ||v.frameRate!==undefined&&!bounded(v.frameRate,1,240)||v.zoom!==undefined&&!bounded(v.zoom,0,100))return null;
    return {label:v.label,...(v.width!==undefined?{width:v.width as number}:{}),...(v.height!==undefined?{height:v.height as number}:{}),...(v.frameRate!==undefined?{frameRate:v.frameRate as number}:{}),...(v.zoom!==undefined?{zoom:v.zoom as number}:{})};
}
const uid = () => crypto.randomUUID();
const friendly = (failure:unknown) => failure instanceof Error ? failure.message : 'Não foi possível manter a conexão ao vivo.';
const PREVIEW_PLAYBACK_WARNING='Clique no vídeo para iniciar a prévia.';

export function parseLiveHostDataMessage(raw:unknown):Record<string,unknown>|null {
    if(typeof raw!=='string'||raw.length>48*1024)return null;
    let bytes=raw.length;
    if(/[^\x00-\x7f]/.test(raw)){
        bytes=0;for(const character of raw){const code=character.codePointAt(0)!;bytes+=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;if(bytes>48*1024)return null;}
    }
    let value:unknown;try{value=JSON.parse(raw);}catch{return null;}
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const message=value as Record<string,unknown>;
    return bytes<=16384||message.kind==='video-parts'?message:null;
}

/** Local quality measurements only; never log pairing capabilities or arbitrary payloads. */
export function parseLiveCameraDiagnostics(value:Record<string,unknown>):Record<string,string|number|boolean>|null {
    if(!['preview','recording','paused','stopped'].includes(String(value.phase)))return null;
    const result:Record<string,string|number|boolean>={phase:String(value.phase)};
    for(const key of ['sourceFps','previewFps','localFps','localPresentedFps','localSampleMs','requestedFps','width','height']){
        const input=value[key],dimension=key==='width'||key==='height';
        if(input===undefined)continue;
        if(typeof input!=='number'||!Number.isFinite(input)||input<(dimension?1:0)||input>(dimension?16384:key==='localSampleMs'?7200000:240))return null;
        result[key]=input;
    }
    for(const key of ['powerEfficient','smooth'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')return null;result[key]=value[key] as boolean;}
    for(const key of ['mimeType','encoderImplementation'])if(value[key]!==undefined){if(typeof value[key]!=='string'||value[key].length>160||/[\u0000-\u001f\u007f]/.test(value[key]))return null;result[key]=value[key] as string;}
    if(value.codecSupport!==undefined){
        if(typeof value.codecSupport!=='string'||value.codecSupport.length>1200)return null;
        let candidates:unknown;try{candidates=JSON.parse(value.codecSupport);}catch{return null;}
        if(!Array.isArray(candidates)||candidates.length>3)return null;
        const reports:Record<string,string|boolean>[]=[];
        for(const candidate of candidates){
            if(!candidate||typeof candidate!=='object'||!['avc1.64002A','avc1.4D402A','avc1.42E02A'].includes(candidate.codec)||!['mime-unsupported','queried','query-error','timeout'].includes(candidate.state))return null;
            const report:Record<string,string|boolean>={codec:candidate.codec,state:candidate.state};
            for(const field of ['supported','smooth','powerEfficient'])if(candidate[field]!==undefined){if(typeof candidate[field]!=='boolean')return null;report[field]=candidate[field];}
            reports.push(report);
        }
        result.codecSupport=JSON.stringify(reports);
    }
    return result;
}

/** Private source pairing only. No official scouting or existing video document is loaded or written. */
export function useLiveHost(scope:LiveHostScope, className:string) {
    const [config,setConfig]=useState<LiveServiceConfig|null>(null), [room,setRoom]=useState<LiveRoom|null>(null), [error,setError]=useState('');
    const [checkingConfig,setCheckingConfig]=useState(false),[serviceCheck,setServiceCheck]=useState<string|null>(null);
    const configRequest=useRef<AbortController|null>(null);
    const [connection,setConnectionState]=useState<'idle'|'waiting'|'connecting'|'connected'|'disconnected'|'closed'>('idle');
    const connectionRef=useRef(connection);
    const setConnection=useCallback((value:typeof connection)=>{connectionRef.current=value;setConnectionState(value);},[]);
    const [stream,setStreamState]=useState<MediaStream|null>(null), [session,setSession]=useState<LiveHostSession|null>(null), [history,setHistory]=useState<LiveHostSession[]>([]);
    const streamRef=useRef<MediaStream|null>(null);
    const setStream=useCallback((value:MediaStream|null)=>{streamRef.current=value;setStreamState(value);},[]);
    const [recording,setRecording]=useState<Recording|null>(null), [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [pendingCopies,setPendingCopies]=useState(0);
    const [previewTiming,setPreviewTiming]=useState<Parameters<typeof resolveLiveVideoTime>[0]|null>(null);
    const [deleted,setDeleted]=useState<LiveHostSession|null>(null);
    const [stopPending,setStopPending]=useState(false);
    const stopRequest=useRef<{recordingId:string;at:number}|null>(null);
    const [startPending,setStartPending]=useState(false);
    const startRequest=useRef<{roomId:string;at:number}|null>(null);
    const [cameraState,setCameraState]=useState<CameraState|null>(null),[controlPending,setControlPending]=useState<CameraControl|null>(null);
    const [captureInfo,setCaptureInfo]=useState<LiveCaptureInfo|null>(null);
    const camera=useRef<{state:CameraState;version:number}|null>(null);
    const controlRequest=useRef<{kind:CameraControl;at:number;recordingId?:string}|null>(null),retired=useRef(new Set<string>());
    const closingRoom=useRef(false);
    const finishControl=()=>{controlRequest.current=null;setControlPending(null);};
    const alive=useRef(true), epoch=useRef(0), peer=useRef<RTCPeerConnection|null>(null), channel=useRef<RTCDataChannel|null>(null), video=useRef<HTMLVideoElement|null>(null);
    const currentRoom=useRef<LiveRoom|null>(null), currentSession=useRef<LiveHostSession|null>(null), currentRecording=useRef<Recording|null>(null), writing=useRef(false);
    const clock=useRef<LiveClockMessage|null>(null), calibration=useRef<LiveClockCalibration|null>(null), frame=useRef<{hostEpochMs:number;captureHostEpochMs?:number}>({hostEpochMs:0});
    const playoutDelay=useRef<number|undefined>(undefined), pending=useRef(new Map<string,Operation>()), pings=useRef(new Map<string,number>());
    const cancel=useRef<AbortController|null>(null), generation=useRef(0), frameHandle=useRef<number|null>(null), sessionReady=useRef(false);
    const transportStarter=useRef<((owner:LiveRoom,abort:AbortController,resume?:boolean)=>void)|null>(null),previewBinder=useRef<((node:HTMLVideoElement|null)=>void)|null>(null),videoCleanup=useRef<(()=>void)|null>(null),videoBindingEpoch=useRef(0);
    const scopeIdentity=JSON.stringify([scope.userId,scope.org,scope.classId]);
    const bridgeScope=useRef({...scope}),bridgeScopeIdentity=useRef(scopeIdentity),renderScopeIdentity=useRef(scopeIdentity);
    useLayoutEffect(()=>{renderScopeIdentity.current=scopeIdentity;},[scopeIdentity]);
    const clockOwner=useRef<{epoch:number;peerGeneration:number;channel:RTCDataChannel|null}|null>(null);
    const lastSegment=useRef<{recordingId:string;segmentId:string;peerGeneration:number}|null>(null);
    const historyRef=useRef<LiveHostSession[]>([]);
    const trash=useRef<LiveHostSession[]>([]);
    const deletingSessions=useRef(new Set<string>());
    const historyLoaded=useRef<Promise<boolean>>(Promise.resolve(false));
    const mutations=useRef<Promise<void>>(Promise.resolve());
    const thumbnailAttempts=useRef(new Set<string>());
    const thumbnailCapture=useRef<((node:HTMLVideoElement)=>void)|null>(null);
    const publishSession=useCallback((next:LiveHostSession)=>{
        currentSession.current=next;setSession(next);pending.current.clear();
        for(const operation of next.delivery?.pending??[])pending.current.set(operation.kind==='point'?operation.point.id:operation.id,operation);
        setPendingCopies(pending.current.size);
        setHistory(old=>{const values=[next,...old.filter(s=>s.id!==next.id)].slice(0,30);historyRef.current=values;return values;});
    },[]);
    const updateSession=(recipe:(current:LiveHostSession|null)=>LiveHostSession|null,stillCurrent?:()=>boolean)=>{
        const token=epoch.current;
        const saved=mutations.current.catch(()=>undefined).then(async()=>{
            if(!alive.current||epoch.current!==token)return;
            const proposed=recipe(currentSession.current);if(!proposed)return;
            const next=parseLiveHostSession(proposed,scope);
            await saveLiveHostSession(next,scope);
            if(alive.current&&epoch.current===token&&(!stillCurrent||stillCurrent()))publishSession(next);
        });
        mutations.current=saved;return saved;
    };
    const captureThumbnail=(node:HTMLVideoElement)=>{
        const current=currentSession.current,source=currentRecording.current;
        if(!sessionReady.current||!current||current.ended||current.thumbnailDataUrl||source?.state!=='recording'||source.recordingId!==current.recordingId||thumbnailAttempts.current.has(current.id)
            ||node.readyState<2||!Number.isFinite(node.videoWidth)||!Number.isFinite(node.videoHeight)||node.videoWidth<=0||node.videoHeight<=0)return;
        thumbnailAttempts.current.add(current.id);
        const image=captureLiveThumbnail(node);if(!image)return;
        const token=epoch.current,peerGeneration=generation.current,roomId=currentRoom.current?.roomId,owner=channel.current;
        const stillCurrent=()=>alive.current&&epoch.current===token&&generation.current===peerGeneration&&currentRoom.current?.roomId===roomId&&channel.current===owner&&currentSession.current?.id===current.id&&currentRecording.current?.recordingId===current.recordingId;
        void updateSession(latest=>stillCurrent()&&latest?.id===current.id&&!latest.thumbnailDataUrl?{...latest,thumbnailDataUrl:image}:null,stillCurrent).catch(()=>undefined);
    };
    useLayoutEffect(()=>{thumbnailCapture.current=captureThumbnail;});
    const send=(operation:unknown)=>{
        const dc=channel.current;if(dc?.readyState!=='open'||dc.bufferedAmount>=256*1024)return false;
        try{dc.send(JSON.stringify(operation));return true;}catch{return false;}
    };
    const videos=useLiveVideos(scope,{send,resolveSession:async(recordingId)=>{
        if(!await historyLoaded.current)return null;
        await mutations.current.catch(()=>undefined);
        const known=currentSession.current?.recordingId===recordingId?currentSession.current:historyRef.current.find(item=>item.recordingId===recordingId);
        if(!known||deletingSessions.current.has(known.id))return null;
        const stored=await loadLiveHostSession(scope,known.id);
        return stored?.recordingId===recordingId&&stored.ended&&!stored.deletedAt&&!deletingSessions.current.has(stored.id)?stored:null;
    }});
    const videoStatuses=useRef(videos.videoStatuses);
    useLayoutEffect(()=>{videoStatuses.current=videos.videoStatuses;});
    const sendPending=()=>{
        const owner=currentSession.current, source=currentRecording.current;
        if(!owner||!source||source.recordingId!==owner.recordingId)return;
        for(const operation of pending.current.values()){
            const recordingId=operation.kind==='point'?operation.point.recordingId:operation.recordingId;
            if(recordingId===source.recordingId&&!send(operation))break;
        }
        setPendingCopies(pending.current.size);
    };
    const refreshConfig=useCallback(async({reportResult=true}:{reportResult?:boolean}={})=>{
        if(!alive.current)return;
        configRequest.current?.abort();
        const controller=new AbortController(),token=epoch.current;
        configRequest.current=controller;setCheckingConfig(true);
        if(reportResult){setServiceCheck(null);setError('');}
        let timedOut=false,rejectAbort!:(failure:Error)=>void;
        const canceled=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
        const abort=()=>rejectAbort(new Error(timedOut?'O serviço local demorou para responder. Verifique novamente.':'Verificação cancelada.'));
        controller.signal.addEventListener('abort',abort,{once:true});
        const timeout=setTimeout(()=>{timedOut=true;controller.abort();},6000);
        const isCurrent=()=>alive.current&&epoch.current===token&&configRequest.current===controller;
        try{
            const result=await measureAsync('screen.scoutingLive.load.config',()=>Promise.race([getLiveServiceConfig(controller.signal),canceled]));
            if(isCurrent()&&!controller.signal.aborted){setConfig(result);if(reportResult)setServiceCheck(result.cameraReady?'Serviço disponível · câmera pronta.':'Serviço disponível · configure o HTTPS para conectar o celular.');}
        }catch(failure){if(reportResult&&isCurrent()&&(timedOut||!controller.signal.aborted))setError(friendly(failure));}
        finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);if(configRequest.current===controller){configRequest.current=null;if(alive.current&&epoch.current===token)setCheckingConfig(false);}}
    },[]);

    useEffect(()=>{
        alive.current=true;const token=++epoch.current;
        const [userId,org,classId]=JSON.parse(scopeIdentity) as [string,string,string];
        const retained=currentRoom.current,replaying=!!retained&&!!cancel.current?.signal.aborted&&!closingRoom.current&&bridgeScopeIdentity.current===scopeIdentity;
        // Discover local capabilities without reporting a failed user action.
        void Promise.resolve().then(()=>{if(alive.current&&epoch.current===token)return refreshConfig({reportResult:false});});
        historyLoaded.current=measureAsync('screen.scoutingLive.load.history',async()=>{
            if(replaying)await mutations.current.catch(()=>undefined);
            return loadLiveHostSessions({userId,org,classId},true);
        }).then(values=>{
            if(!alive.current||epoch.current!==token)return false;
            historyRef.current=values.filter(item=>!item.deletedAt);
            trash.current=values.filter(item=>item.deletedAt).sort((a,b)=>b.deletedAt!.localeCompare(a.deletedAt!));
            setHistory(historyRef.current);setDeleted(trash.current[0]??null);
            if(replaying){
                const current=currentSession.current;
                const stored=current?historyRef.current.find(item=>item.id===current.id&&item.recordingId===current.recordingId):undefined;
                if(stored)publishSession(stored);
            }
            return true;
        }).catch(failure=>{if(alive.current&&epoch.current===token)setError(friendly(failure));return false;});
        // Effect replay retains the pairing and durable recording, but its old transport was closed.
        if(retained&&replaying){
            const abort=new AbortController();cancel.current=abort;transportStarter.current?.(retained,abort,true);
        }else if(!retained&&cancel.current?.signal.aborted){setBusy(false);}
        previewBinder.current?.(video.current);
        // Snapshot the external clocks on the existing cadence; render stays pure.
        const ticker=setInterval(()=>{
            if(controlRequest.current&&Date.now()-controlRequest.current.at>=15000){finishControl();setError('O celular não confirmou o comando. Confira a tela do aparelho e a conexão.');}
            if(startRequest.current&&Date.now()-startRequest.current.at>=15000){startRequest.current=null;setStartPending(false);setError('O celular não confirmou o início. Confira a tela do celular e atualize-a antes de uma nova conexão.');}
            if(stopRequest.current&&Date.now()-stopRequest.current.at>=30000){stopRequest.current=null;setStopPending(false);setError('O celular não confirmou a finalização. Confira a tela do celular antes de fechar.');}
            setPreviewTiming(clock.current&&currentRecording.current?.state==='recording'&&!currentSession.current?.ended&&sessionReady.current?{clock:clock.current,calibration:calibration.current,hostNowEpochMs:Date.now(),lastFrameHostEpochMs:frame.current.hostEpochMs,captureHostEpochMs:frame.current.captureHostEpochMs,playoutDelayMs:playoutDelay.current}:null);
        },500);
        const releasePreview=()=>{videoBindingEpoch.current++;videoCleanup.current?.();videoCleanup.current=null;if(video.current&&frameHandle.current!==null)video.current.cancelVideoFrameCallback?.(frameHandle.current);frameHandle.current=null;};
        return()=>{alive.current=false;epoch.current=token+1;clearInterval(ticker);configRequest.current?.abort();cancel.current?.abort();channel.current?.close();peer.current?.close();releasePreview();};
        // The component is keyed by this identity; stale async reads never cross it.
    },[scopeIdentity,refreshConfig,publishSession]);

    const onRecording=async(value:unknown)=>{
        const raw=value as Recording;
        if(!raw||typeof raw.recordingId!=='string'||!raw.recordingId||raw.recordingId.length>128||!Number.isFinite(raw.startEpochMs)||!['recording','paused','stopped','error'].includes(raw.state)||typeof raw.mimeType!=='string'||retired.current.has(raw.recordingId))return;
        const token=epoch.current,owner=channel.current;
        if(!await historyLoaded.current||!alive.current||epoch.current!==token||owner!==channel.current||retired.current.has(raw.recordingId))return;
        if(trash.current.some(item=>item.recordingId===raw.recordingId)){
            clock.current=null;sessionReady.current=false;currentRecording.current=null;setRecording(null);
            setError('Os registros desta gravação estão na lixeira. Restaure-os antes de reconectar.');return;
        }
        const existing=historyRef.current.find(item=>item.recordingId===raw.recordingId);
        if(existing&&deletingSessions.current.has(existing.id))return;
        const active=currentSession.current;
        if(active&&active.recordingId!==raw.recordingId&&(!active.ended||pending.current.size||active.recordingState!=='stopped')){setError('Finalize a gravação atual e aguarde as cópias pendentes antes de começar outra.');return;}
        const previous=currentRecording.current?.recordingId===raw.recordingId?currentRecording.current:null;
        const state=(raw.state==='recording'||raw.state==='paused')&&(existing?.ended||previous&&(previous.state==='stopped'||previous.state==='error'))?existing?.recordingState??previous?.state??'stopped':raw.state;
        const durationMs=Number.isFinite(raw.durationMs)&&raw.durationMs!>=0&&raw.durationMs!<=86400000?raw.durationMs:existing?.durationMs??(clock.current?.recordingId===raw.recordingId?clock.current.timeMs:undefined)??previous?.durationMs;
        const next:Recording={recordingId:raw.recordingId,startEpochMs:raw.startEpochMs,state,mimeType:raw.mimeType.slice(0,120),...(durationMs!==undefined?{durationMs}:{})};
        currentRecording.current=next;setRecording(next);
        if(previous?.state!==next.state){clock.current=null;frame.current={hostEpochMs:0};setPreviewTiming(null);}
        startRequest.current=null;setStartPending(false);
        if(stopRequest.current&&(stopRequest.current.recordingId!==next.recordingId||next.state==='stopped'||next.state==='error')){stopRequest.current=null;setStopPending(false);}
        if(controlRequest.current?.recordingId===next.recordingId&&(controlRequest.current.kind==='pause-recording'&&next.state==='paused'||controlRequest.current.kind==='resume-recording'&&next.state==='recording'||next.state==='stopped'||next.state==='error'))finishControl();
        const terminal=next.state==='stopped'||next.state==='error';
        if(next.state!=='recording')clock.current=null;
        if(terminal)sessionReady.current=false;
        const finalMetadata=terminal?{ended:true,recordingState:next.state as 'stopped'|'error',...(durationMs!==undefined?{durationMs}:{})}:{};
        if(currentSession.current?.recordingId!==next.recordingId){
            sessionReady.current=false;
            const at=new Date().toISOString();
            const initial:LiveHostSession=existing?{...existing,...finalMetadata}:{version:1,id:uid(),scope:{...scope},recordingId:next.recordingId,createdAt:at,updatedAt:at,setNumber:1,className,points:[],gaps:[],mimeType:next.mimeType,ended:false,...finalMetadata,delivery:{pending:[],acknowledged:[]}};
            try{await updateSession(()=>owner===channel.current&&!retired.current.has(next.recordingId)?initial:null);if(alive.current&&currentRecording.current?.recordingId===next.recordingId)sessionReady.current=true;}catch(failure){if(alive.current)setError(friendly(failure));}
        }else if(terminal){
            try{await updateSession(current=>current?.recordingId===next.recordingId?{...current,...finalMetadata,updatedAt:new Date().toISOString()}:null);}catch(failure){if(alive.current)setError(friendly(failure));}
        }else sessionReady.current=true;
        if(alive.current&&currentRecording.current?.recordingId===next.recordingId)sendPending();
        if(alive.current&&next.state==='stopped'&&currentSession.current?.recordingId===next.recordingId&&currentSession.current.ended)videos.requestVideo(currentSession.current);
        if(next.state==='error')setError('O celular informou falha na gravação. Confira o armazenamento no aparelho.');
    };
    const cameraCommand=(kind:CameraControl)=>{
        const source=currentRecording.current,activeRoom=currentRoom.current;
        if(!activeRoom||closingRoom.current||channel.current?.readyState!=='open'||controlRequest.current||startRequest.current||stopRequest.current)return;
        if(camera.current?.version!==2){setError('Atualize a página do celular após salvar a gravação para usar os novos controles.');return;}
        const capture=source?.state==='recording'||source?.state==='paused';
        if(kind==='pause-recording'&&source?.state!=='recording'||kind==='resume-recording'&&source?.state!=='paused'||(kind==='camera-on'||kind==='camera-off')&&capture)return;
        if(!send({kind,roomId:activeRoom.roomId,...(source?{recordingId:source.recordingId}:{})})){setError('Sem conexão com o celular. Reconecte no aparelho para continuar.');return;}
        controlRequest.current={kind,at:Date.now(),recordingId:source?.recordingId};setControlPending(kind);setError('');
    };
    const newRecording=async()=>{
        const previous=currentSession.current;
        if(writing.current||!previous?.ended||previous.recordingState!=='stopped'||pending.current.size){send({kind:'new-recording-blocked',roomId:currentRoom.current?.roomId});return;}
        cameraCommand('new-recording');
    };
    const handleMessage=(event:MessageEvent)=>{
        const value=parseLiveHostDataMessage(event.data);if(!value)return;
        if(typeof value.kind==='string'&&value.kind.startsWith('video-')){videos.receiveVideoMessage(value);return;}
        if(value.kind==='camera-diagnostics'&&value.roomId===currentRoom.current?.roomId){const report=parseLiveCameraDiagnostics(value);if(report&&typeof __DEV__!=='undefined'&&__DEV__)console.info('[scouting-camera-quality]',JSON.stringify(report));return;}
        if(value.kind==='camera-control-error'&&value.roomId===currentRoom.current?.roomId&&value.command===controlRequest.current?.kind){finishControl();setError('O celular não concluiu o comando. Confira a tela do aparelho.');return;}
        if(value.kind==='new-recording-request'&&value.roomId===currentRoom.current?.roomId&&value.recordingId===currentSession.current?.recordingId){void newRecording();return;}
        if(value.kind==='camera-status'){
            if(value.roomId!==currentRoom.current?.roomId||value.controlsVersion!==2||!['off','preview','recording','paused','finalizing','error'].includes(String(value.state)))return;
            const state=value.state as CameraState;camera.current={state,version:2};setCameraState(state);
            setCaptureInfo(state==='off'?null:parseLiveCaptureInfo(value.capture));
            const request=controlRequest.current;
            if(request?.kind==='new-recording'&&(state==='preview'||state==='off')&&!value.recordingId){
                const previous=currentSession.current;
                if(previous&&previous.recordingId===request.recordingId&&previous.ended&&!pending.current.size){
                    retired.current.add(previous.recordingId);currentSession.current=null;setSession(null);currentRecording.current=null;setRecording(null);clock.current=null;setPreviewTiming(null);sessionReady.current=false;
                    finishControl();
                }
            }else if(request?.kind==='camera-on'&&state==='preview'||request?.kind==='camera-off'&&state==='off')finishControl();
            if(state==='off')setStream(null);
            return;
        }
        if(value.kind==='recording-start-error'&&startRequest.current&&value.roomId===startRequest.current.roomId){startRequest.current=null;setStartPending(false);setError(value.reason==='camera-hidden'?'Abra a aba da câmera no celular antes de iniciar.':value.reason==='source-unavailable'?'A câmera ainda não está pronta. Confira a imagem no celular.':'Não foi possível iniciar a gravação no celular. Confira a tela do aparelho.');return;}
        if(value.kind==='recording'){void onRecording(value);return;}
        if(value.kind==='clock'){
            try{const parsed=parseLiveClockMessage(value);if(currentRecording.current?.recordingId===parsed.recordingId){lastSegment.current={recordingId:parsed.recordingId,segmentId:parsed.segmentId,peerGeneration:generation.current};if(currentRecording.current.state==='recording'){clock.current=parsed;clockOwner.current={epoch:epoch.current,peerGeneration:generation.current,channel:channel.current};}else if(currentRecording.current.state==='paused'&&!parsed.recording){currentRecording.current={...currentRecording.current,durationMs:parsed.timeMs};setRecording(currentRecording.current);}}}catch{/* Ignore invalid or foreign clocks. */}return;
        }
        if(value.kind==='pong'&&typeof value.id==='string'){
            const sent=pings.current.get(value.id);pings.current.delete(value.id);
            if(sent===undefined||value.sentEpochMs!==sent||typeof value.cameraEpochMs!=='number')return;
            try{calibration.current=calibrateLiveClock(sent,Date.now(),value.cameraEpochMs);}catch{/* Unusable sample stays uncalibrated. */}return;
        }
        if((value.kind==='point-ack'||value.kind==='undo-point-ack')&&typeof value.id==='string'){
            const operation=pending.current.get(value.id), id=operation?.kind==='point'?operation.point.recordingId:operation?.recordingId;
            if(operation&&id===value.recordingId&&(value.kind==='point-ack')===(operation.kind==='point')){
                const markerId=value.id, kind=operation.kind;
                void updateSession(latest=>{
                    if(!latest||latest.recordingId!==id)return null;
                    const delivery=latest.delivery!;
                    const exists=delivery.pending.some(item=>item.kind===kind&&(item.kind==='point'?item.point.id:item.id)===markerId);
                    if(!exists)return null;
                    return {...latest,updatedAt:new Date().toISOString(),delivery:{pending:delivery.pending.filter(item=>(item.kind==='point'?item.point.id:item.id)!==markerId),acknowledged:[...delivery.acknowledged.filter(receipt=>receipt.kind!==kind||receipt.id!==markerId),{kind,id:markerId}]}};
                }).catch(failure=>{if(alive.current)setError(friendly(failure));});
            }return;
        }
        if(value.kind==='storage-error'&&currentRecording.current&&value.recordingId===currentRecording.current.recordingId){currentRecording.current={...currentRecording.current,state:'error'};setRecording(currentRecording.current);clock.current=null;setError('O celular não conseguiu salvar a gravação ou os pontos. A cópia do notebook foi preservada.');}
    };
    const bindChannel=(dc:RTCDataChannel,isCurrent:()=>boolean,onOpen:()=>boolean)=>{
        channel.current=dc;videos.bindVideoChannel();dc.onmessage=event=>{if(isCurrent()&&channel.current===dc)handleMessage(event);};
        dc.onopen=()=>{if(isCurrent()&&channel.current===dc&&onOpen())sendPending();};
        dc.onclose=()=>{if(isCurrent()&&channel.current===dc){videos.stopVideoChannel();setConnection('disconnected');setCaptureInfo(null);}};
    };
    const syncPreview=useCallback(()=>{
        const node=video.current,source=streamRef.current;if(!node||node.srcObject===source)return;
        const binding=videoBindingEpoch.current;
        node.srcObject=source;
        if(source)void node.play().catch(failure=>{
            if(!alive.current||video.current!==node||streamRef.current!==source||videoBindingEpoch.current!==binding||failure?.name==='AbortError'||node.paused===false)return;
            setError(current=>current&&current!==PREVIEW_PLAYBACK_WARNING?current:PREVIEW_PLAYBACK_WARNING);
        });
    },[]);
    const attachVideo=useCallback((node:HTMLVideoElement|null)=>{
        const binding=++videoBindingEpoch.current;
        videoCleanup.current?.();videoCleanup.current=null;
        if(video.current&&frameHandle.current!==null)video.current.cancelVideoFrameCallback?.(frameHandle.current);
        if(video.current&&video.current!==node)video.current.srcObject=null;
        video.current=node;frameHandle.current=null;
        if(!node)return;
        syncPreview();
        const time=()=>{if(video.current===node&&videoBindingEpoch.current===binding&&!node.requestVideoFrameCallback){frame.current={hostEpochMs:Date.now()};thumbnailCapture.current?.(node);}};
        const playing=()=>{if(video.current===node&&videoBindingEpoch.current===binding&&node.srcObject===streamRef.current)setError(current=>current===PREVIEW_PLAYBACK_WARNING?'':current);};
        node.addEventListener('timeupdate',time);node.addEventListener('playing',playing);
        videoCleanup.current=()=>{node.removeEventListener('timeupdate',time);node.removeEventListener('playing',playing);};
        const draw=(_now:number,metadata:VideoFrameCallbackMetadata)=>{
            if(video.current!==node||videoBindingEpoch.current!==binding)return;
            const extra=metadata as VideoFrameCallbackMetadata&{captureTime?:number};
            frame.current={hostEpochMs:Date.now(),...(Number.isFinite(extra.captureTime)?{captureHostEpochMs:performance.timeOrigin+extra.captureTime!}:{})};
            thumbnailCapture.current?.(node);
            if(video.current===node)frameHandle.current=node.requestVideoFrameCallback(draw);
        };
        if(node.requestVideoFrameCallback)frameHandle.current=node.requestVideoFrameCallback(draw);
    },[syncPreview]);
    useLayoutEffect(()=>{previewBinder.current=attachVideo;return()=>{previewBinder.current=null;};},[attachVideo]);
    useEffect(()=>{syncPreview();},[stream,syncPreview]);

    const attachRoomTransport=(created:LiveRoom,abort:AbortController,resume=false)=>{
        if(resume){
            videos.stopVideoChannel();channel.current=null;peer.current=null;generation.current=0;
            clock.current=null;clockOwner.current=null;lastSegment.current=null;calibration.current=null;frame.current={hostEpochMs:0};playoutDelay.current=undefined;pings.current.clear();sessionReady.current=false;
            setPreviewTiming(null);setStream(null);camera.current=null;setCameraState(null);setCaptureInfo(null);setBusy(false);
            setConnection(connectionRef.current==='waiting'?'waiting':'disconnected');
        }
        let cursor=0;
        let pollAuthorized=false,pollError:string|null=null;
        const isCurrentRoom=()=>alive.current&&!abort.signal.aborted&&cancel.current===abort&&currentRoom.current===created;
        const restoreConnection=(pc:RTCPeerConnection|null,dc:RTCDataChannel|null)=>{
            if(!isCurrentRoom()||closingRoom.current||!pollAuthorized||!pc||peer.current!==pc||pc.connectionState!=='connected'||!dc||channel.current!==dc||dc.readyState!=='open')return false;
            setConnection('connected');return true;
        };
        const queued=new Map<number,(RTCIceCandidateInit|null)[]>();
        const installOffer=async(signal:LiveSignal)=>{
            if(!isCurrentRoom()||!signal.sdp||signal.generation<=generation.current)return;
            generation.current=signal.generation;videos.stopVideoChannel();const previousChannel=channel.current;channel.current=null;previousChannel?.close();peer.current?.close();clock.current=null;calibration.current=null;clockOwner.current=null;frame.current={hostEpochMs:0};sessionReady.current=false;setCaptureInfo(null);
            const pc=new RTCPeerConnection({iceServers:[]});peer.current=pc;setConnection('connecting');
            const isCurrentPeer=()=>isCurrentRoom()&&peer.current===pc;
            pc.ondatachannel=event=>{if(isCurrentPeer())bindChannel(event.channel,isCurrentPeer,()=>restoreConnection(pc,event.channel));};
            pc.ontrack=event=>{if(isCurrentPeer())setStream(event.streams[0]??new MediaStream([event.track]));};
            pc.onconnectionstatechange=()=>{if(!isCurrentPeer())return;if(pc.connectionState==='connected')restoreConnection(pc,channel.current);else if(pc.connectionState==='failed'||pc.connectionState==='disconnected'||pc.connectionState==='closed'){setConnection('disconnected');setCaptureInfo(null);}};
            pc.onicecandidate=event=>{if(!isCurrentPeer())return;void sendLiveSignal(created,{type:'ice',candidate:event.candidate?.toJSON()??null,generation:signal.generation},abort.signal).catch(failure=>{if(isCurrentPeer())setError(friendly(failure));});};
            await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
            if(!isCurrentPeer())return;
            for(const candidate of queued.get(signal.generation)??[]){if(!isCurrentPeer())return;if(candidate)await pc.addIceCandidate(candidate);}queued.delete(signal.generation);
            const answer=await pc.createAnswer();if(!isCurrentPeer())return;await pc.setLocalDescription(answer);if(!isCurrentPeer())return;
            await sendLiveSignal(created,{type:'answer',sdp:answer.sdp!,generation:signal.generation},abort.signal);
        };
        const poll=async()=>{
            if(!isCurrentRoom())return;
            const pc=peer.current,dc=channel.current;
            try{
                const batch=await pollLiveSignals(created,cursor,abort.signal);if(!isCurrentRoom())return;
                cursor=batch.cursor;pollAuthorized=true;
                for(const signal of batch.signals){if(!isCurrentRoom())return;if(signal.type==='offer')await installOffer(signal);else if(signal.type==='ice'){
                    if(signal.generation===generation.current&&peer.current?.remoteDescription){if(signal.candidate)await peer.current.addIceCandidate(signal.candidate);}
                    else if(signal.generation>generation.current){const items=queued.get(signal.generation)??[];if(items.length<128){items.push(signal.candidate??null);queued.set(signal.generation,items);}}
                }}
                if(!isCurrentRoom())return;
                if(pollError){const previous=pollError;setError(current=>current===previous?'':current);pollError=null;}
                restoreConnection(pc,dc);
            }catch(failure){if(isCurrentRoom()){pollAuthorized=false;pollError=friendly(failure);setError(pollError);setConnection('disconnected');}}
            if(isCurrentRoom())setTimeout(()=>{void poll();},700);
        };
        void poll();
        const heart=setInterval(()=>{void heartbeatLiveRoom(created,abort.signal).catch(failure=>{if(!abort.signal.aborted&&alive.current)setError(friendly(failure));});},10000);
        const sync=setInterval(()=>{
            if(channel.current?.readyState==='open'){
                const id=uid(),sent=Date.now();pings.current.set(id,sent);for(const[key,at]of pings.current)if(sent-at>15000)pings.current.delete(key);send({kind:'ping',id,sentEpochMs:sent});sendPending();
            }
            const pc=peer.current;if(pc)void pc.getStats().then(stats=>{if(peer.current!==pc)return;stats.forEach(report=>{if(report.type==='inbound-rtp'&&report.kind==='video'&&report.jitterBufferEmittedCount>0)playoutDelay.current=report.jitterBufferDelay/report.jitterBufferEmittedCount*1000;});}).catch(()=>undefined);
        },3000);
        abort.signal.addEventListener('abort',()=>{clearInterval(heart);clearInterval(sync);},{once:true});
    };
    useLayoutEffect(()=>{transportStarter.current=attachRoomTransport;});

    const start=async()=>{
        if(busy||writing.current||currentRoom.current)return;
        setBusy(true);setError('');const abort=new AbortController();cancel.current?.abort();cancel.current=abort;
        try{
            const created=await createLiveRoom(abort.signal);if(!alive.current||abort.signal.aborted||cancel.current!==abort){return;}
            videos.stopVideoChannel();generation.current=0;clock.current=null;calibration.current=null;frame.current={hostEpochMs:0};sessionReady.current=false;
            retired.current.clear();camera.current=null;setCameraState(null);setCaptureInfo(null);finishControl();
            stopRequest.current=null;startRequest.current=null;setStopPending(false);setStartPending(false);
            currentSession.current=null;currentRecording.current=null;pending.current.clear();setPendingCopies(0);setSession(null);setRecording(null);setStream(null);
            currentRoom.current=created;setRoom(created);setConnection('waiting');attachRoomTransport(created,abort);
        }catch(failure){if(alive.current&&!abort.signal.aborted)setError(friendly(failure));}
        finally{if(alive.current&&cancel.current===abort)setBusy(false);}
    };
    const resolveStamp=()=>!controlRequest.current&&!stopRequest.current&&!['paused','finalizing','off','error'].includes(camera.current?.state??'')&&clock.current&&currentRecording.current?.state==='recording'&&!currentSession.current?.ended&&connection==='connected'&&sessionReady.current?resolveLiveVideoTime({clock:clock.current,calibration:calibration.current,hostNowEpochMs:Date.now(),lastFrameHostEpochMs:frame.current.hostEpochMs,captureHostEpochMs:frame.current.captureHostEpochMs,playoutDelayMs:playoutDelay.current}):null;
    const stamp=previewTiming&&connection==='connected'&&recording?.state==='recording'&&!session?.ended&&previewTiming.clock?.recordingId===recording.recordingId?resolveLiveVideoTime(previewTiming):null;
    const mark=async(won:boolean)=>{
        const current=currentSession.current, source=clock.current, pointStamp=resolveStamp();
        if(writing.current||!current||!source||!pointStamp||current.ended||currentRecording.current?.state!=='recording')return;
        writing.current=true;setSaving(true);setError('');
        try{
            let point:LivePoint|undefined;
            await updateSession(latest=>{
                if(!latest||latest.recordingId!==source.recordingId)return null;
                point=createLivePoint({id:uid(),clock:source,stamp:pointStamp,won,setNumber:latest.setNumber,points:latest.points,hostNowEpochMs:Date.now()});
                return {...latest,points:[...latest.points,point],updatedAt:new Date().toISOString(),delivery:{pending:[...latest.delivery!.pending,{kind:'point',point}],acknowledged:[...latest.delivery!.acknowledged]}};
            });
            if(!alive.current||!point)return;sendPending();
        }catch(failure){if(alive.current)setError(friendly(failure));}finally{writing.current=false;if(alive.current)setSaving(false);}
    };
    const undo=async()=>{
        const current=currentSession.current,last=current?.points.at(-1);if(writing.current||!current||current.ended||currentRecording.current&&currentRecording.current.state!=='recording'||!last)return;
        writing.current=true;setSaving(true);setError('');
        try{await updateSession(latest=>latest?.id===current.id?{...latest,points:latest.points.slice(0,-1),updatedAt:new Date().toISOString(),delivery:{pending:[...latest.delivery!.pending.filter(item=>(item.kind==='point'?item.point.id:item.id)!==last.id),{kind:'undo-point',id:last.id,recordingId:last.recordingId}],acknowledged:[...latest.delivery!.acknowledged]}}:null);if(alive.current)sendPending();}catch(failure){if(alive.current)setError(friendly(failure));}finally{writing.current=false;if(alive.current)setSaving(false);}
    };
    const nextSet=async()=>{
        const current=currentSession.current;if(writing.current||!current||current.ended||currentRecording.current&&currentRecording.current.state!=='recording'||current.setNumber>=99)return;
        writing.current=true;setSaving(true);try{await updateSession(latest=>latest?.id===current.id?{...latest,setNumber:latest.setNumber+1,updatedAt:new Date().toISOString()}:null);}catch(failure){if(alive.current)setError(friendly(failure));}finally{writing.current=false;if(alive.current)setSaving(false);}
    };
    const startRecording=()=>{
        const activeRoom=currentRoom.current;
        if(startRequest.current||controlRequest.current||!activeRoom||currentRecording.current||currentSession.current||connection!=='connected'||camera.current&&camera.current.state!=='preview')return;
        if(!send({kind:'start-recording',roomId:activeRoom.roomId})){setError('Sem conexão com o celular. Reconecte para iniciar a gravação.');return;}
        startRequest.current={roomId:activeRoom.roomId,at:Date.now()};setStartPending(true);setError('');
    };
    const stopRecording=()=>{
        const source=currentRecording.current;
        if(stopRequest.current||controlRequest.current||!source||!['recording','paused'].includes(source.state)||currentSession.current?.ended)return;
        if(!send({kind:'stop-recording',recordingId:source.recordingId})){setError('Sem conexão com o celular. Reconecte ou encerre a gravação no aparelho.');return;}
        stopRequest.current={recordingId:source.recordingId,at:Date.now()};setStopPending(true);setError('');
    };
    const disconnect=async()=>{
        const current=currentRoom.current;if(!current)return true;
        const controller=new AbortController();closingRoom.current=true;setBusy(true);
        try{await closeLiveRoom(current,controller.signal);videos.stopVideoChannel();cancel.current?.abort();channel.current?.close();peer.current?.close();currentRoom.current=null;setRoom(null);setConnection('closed');setStream(null);setCaptureInfo(null);return true;}
        catch(failure){setError(friendly(failure));return false;}finally{closingRoom.current=false;setBusy(false);}
    };
    const canNewRecording=!!session?.ended&&session.recordingState==='stopped'&&!pendingCopies&&!saving&&!busy&&!startPending&&!stopPending&&!controlPending&&connection==='connected';
    const isInactiveSession=(candidate:LiveHostSession)=>candidate.scope.userId===scope.userId&&candidate.scope.org===scope.org&&candidate.scope.classId===scope.classId
        &&!candidate.deletedAt&&!deletingSessions.current.has(candidate.id)&&videoStatuses.current[candidate.id]?.state!=='receiving'
        &&!(currentRoom.current&&(currentSession.current?.id===candidate.id||currentRecording.current?.recordingId===candidate.recordingId));
    const canDeleteSession=(candidate:LiveHostSession)=>!writing.current&&!busy&&isInactiveSession(candidate);
    const saveSavedThumbnail=async(sessionId:string,recordingId:string,thumbnailDataUrl:string)=>{
        const token=epoch.current;
        let saved=false;
        const operation=mutations.current.catch(()=>undefined).then(async()=>{
            if(!alive.current||epoch.current!==token)return;
            const next=await saveLiveHostThumbnail(scope,sessionId,recordingId,thumbnailDataUrl);
            if(!alive.current||epoch.current!==token)return;
            const current=currentSession.current;
            if(current?.id===sessionId&&current.recordingId===recordingId&&!current.deletedAt){currentSession.current={...current,thumbnailDataUrl:next.thumbnailDataUrl};setSession(currentSession.current);}
            setHistory(old=>{const items=old.map(item=>item.id===sessionId&&item.recordingId===recordingId&&!item.deletedAt?{...item,thumbnailDataUrl:next.thumbnailDataUrl}:item);historyRef.current=items;return items;});
            saved=true;
        });
        mutations.current=operation;
        try{await operation;return saved;}catch{return false;}
    };
    const deleteSaved=async(sessionId:string,recordingId:string)=>{
        const target=historyRef.current.find(item=>item.id===sessionId&&item.recordingId===recordingId);
        if(!target||!canDeleteSession(target)){setError('Aguarde a gravação ou o recebimento do vídeo antes de excluir.');return false;}
        writing.current=true;setSaving(true);setError('');const token=epoch.current;
        try{
            await mutations.current.catch(()=>undefined);
            const latest=historyRef.current.find(item=>item.id===sessionId&&item.recordingId===recordingId);
            if(!alive.current||epoch.current!==token)return false;
            if(!latest||!isInactiveSession(latest))throw new Error('Aguarde a gravação ou o recebimento do vídeo antes de excluir.');
            deletingSessions.current.add(sessionId);
            const removed=!latest.ended||latest.delivery?.pending.length
                ?await deleteLiveHostSession(scope,sessionId,recordingId,{allowAbandoned:true})
                :await deleteLiveHostSession(scope,sessionId,recordingId);
            if(!alive.current||epoch.current!==token)return false;
            historyRef.current=historyRef.current.filter(item=>item.id!==sessionId);setHistory(historyRef.current);trash.current=[removed,...trash.current.filter(item=>item.id!==removed.id)];setDeleted(removed);
            if(currentSession.current?.id===sessionId){currentSession.current=null;setSession(null);currentRecording.current=null;setRecording(null);pending.current.clear();setPendingCopies(0);}
            return true;
        }catch(failure){if(alive.current&&epoch.current===token)setError(friendly(failure));return false;}
        finally{deletingSessions.current.delete(sessionId);writing.current=false;if(alive.current&&epoch.current===token)setSaving(false);}
    };
    const restoreDeleted=async()=>{
        if(!deleted||writing.current||busy)return false;
        writing.current=true;setSaving(true);setError('');const token=epoch.current;
        try{const restored=await restoreLiveHostSession(scope,deleted.id,deleted.recordingId);if(!alive.current||epoch.current!==token)return false;historyRef.current=[restored,...historyRef.current.filter(item=>item.id!==restored.id)];setHistory(historyRef.current);trash.current=trash.current.filter(item=>item.id!==restored.id);setDeleted(trash.current[0]??null);return true;}
        catch(failure){if(alive.current&&epoch.current===token)setError(friendly(failure));return false;}
        finally{writing.current=false;if(alive.current&&epoch.current===token)setSaving(false);}
    };
    const requestSavedVideo=(target:LiveHostSession)=>{
        if(!videos.requestVideo(target))setError('Conecte o celular que tem esta gravação para receber o vídeo neste computador.');
    };
    const downloadSavedVideo=async(target:LiveHostSession)=>{
        try{
            const blob=await videos.loadSavedVideo(target);
            if(!blob){setError('O vídeo ainda não foi salvo neste computador. Conecte o celular para recebê-lo.');return;}
            downloadVideoBlob(blob,`go-atleta-${target.recordingId}.${blob.type.includes('mp4')?'mp4':'webm'}`);
        }catch(failure){if(alive.current)setError(friendly(failure));}
    };
    const persistImportedVideo=videos.saveImportedVideo;
    const saveImportedVideo=useCallback(async(target:LiveHostSession,blob:Blob)=>{
        try{return await persistImportedVideo(target,blob);}catch(failure){if(alive.current)setError(friendly(failure));return false;}
    },[persistImportedVideo]);
    const bridgeActive=useCallback(()=>alive.current&&renderScopeIdentity.current===bridgeScopeIdentity.current,[]);
    const captureBlockedReason=useCallback(()=>{
        if(!bridgeActive())return 'inactive';
        const current=currentSession.current,source=currentRecording.current;
        if(!current||!source||current.recordingId!==source.recordingId)return 'no-recording';
        if(current.deletedAt||deletingSessions.current.has(current.id))return 'deleted';
        if(current.scope.userId!==bridgeScope.current.userId||current.scope.org!==bridgeScope.current.org||current.scope.classId!==bridgeScope.current.classId)return 'scope-mismatch';
        if(current.ended)return 'ended';
        if(controlRequest.current||stopRequest.current||closingRoom.current)return 'pending-control';
        if(source.state==='paused'||camera.current?.state==='paused')return 'paused';
        if(source.state!=='recording')return source.state;
        if(['off','finalizing','error'].includes(camera.current?.state??''))return camera.current!.state;
        if(!currentRoom.current||cancel.current?.signal.aborted||connectionRef.current!=='connected'||peer.current?.connectionState!=='connected'||channel.current?.readyState!=='open')return 'disconnected';
        if(!sessionReady.current)return 'not-ready';
        const owner=clockOwner.current;
        if(!clock.current||clock.current.recordingId!==source.recordingId||owner?.epoch!==epoch.current||owner.peerGeneration!==generation.current||owner.channel!==channel.current)return 'stale-clock';
        return resolveLiveCaptureTime({clock:clock.current,calibration:calibration.current,hostNowEpochMs:Date.now()})?null:'stale-clock';
    },[bridgeActive]);
    const getCaptureStamp=useCallback(():LiveCaptureStamp|null=>{
        if(captureBlockedReason())return null;
        const current=currentSession.current!,source=clock.current!;
        const timing=resolveLiveCaptureTime({clock:source,calibration:calibration.current,hostNowEpochMs:Date.now()});
        return timing?{...timing,scope:{...bridgeScope.current},hostSessionId:current.id,recordingId:current.recordingId,segmentId:source.segmentId,epoch:epoch.current,peerGeneration:generation.current}:null;
    },[captureBlockedReason]);
    const getSnapshot=useCallback(():LiveHostSnapshot=>{
        const active=bridgeActive(),current=active?currentSession.current:null,source=active?currentRecording.current:null;
        const recordingId=source?.recordingId??current?.recordingId??null;
        const hostSessionId=current?.recordingId===recordingId?current.id:null;
        const segment=lastSegment.current;
        const videoStatus=hostSessionId?videoStatuses.current[hostSessionId]:undefined;
        const durationMs=source?.durationMs??current?.durationMs;
        return {scope:{...bridgeScope.current},epoch:epoch.current,peerGeneration:generation.current,hostSessionId,recordingId,
            segmentId:active&&segment?.recordingId===recordingId&&segment.peerGeneration===generation.current?segment.segmentId:null,
            recordingState:source?.state??current?.recordingState??null,cameraState:active?camera.current?.state??null:null,
            connection:active?connectionRef.current:'closed',blockedReason:captureBlockedReason(),ended:!!current?.ended,
            ...(durationMs!==undefined?{durationMs}:{}),videoState:videoStatus?.recordingId===recordingId?videoStatus.state:null};
    },[bridgeActive,captureBlockedReason]);
    const loadBridgeSavedVideo=useCallback(async(reference:LiveRecordingReference)=>{
        if(!bridgeActive()||!reference||![reference.hostSessionId,reference.recordingId].every(value=>typeof value==='string'&&value.length>0&&value.length<=300))return null;
        const {hostSessionId,recordingId}=reference,token=epoch.current,owner=bridgeScope.current;
        const stillCurrent=()=>bridgeActive()&&epoch.current===token&&!deletingSessions.current.has(hostSessionId);
        const matches=(value:LiveHostSession|null)=>!!value&&value.id===hostSessionId&&value.recordingId===recordingId&&value.ended&&!value.deletedAt;
        await mutations.current.catch(()=>undefined);if(!stillCurrent())return null;
        const saved=await loadLiveHostSession(owner,hostSessionId);if(!stillCurrent()||!matches(saved))return null;
        const status=await loadVideoStatus(owner,hostSessionId,recordingId);if(!stillCurrent()||status?.state!=='ready')return null;
        const blob=await measureAsync('screen.scoutingLiveVideo.load.bridge',()=>loadVideoBlob(owner,hostSessionId,recordingId));
        await mutations.current.catch(()=>undefined);if(!stillCurrent())return null;
        const fresh=await loadLiveHostSession(owner,hostSessionId);
        return stillCurrent()&&matches(fresh)?blob:null;
    },[bridgeActive]);
    const getReplayCapture=useCallback(()=>({stream:bridgeActive()?streamRef.current:null,stamp:getCaptureStamp(),snapshot:getSnapshot(),playoutDelayMs:Number.isFinite(playoutDelay.current)&&playoutDelay.current!>=0?playoutDelay.current!:0}),[bridgeActive,getCaptureStamp,getSnapshot]);
    const bridgeApi=useMemo<LiveHostBridgeApi>(()=>({getSnapshot,getCaptureStamp,loadSavedVideo:loadBridgeSavedVideo,getReplayCapture}),[getSnapshot,getCaptureStamp,loadBridgeSavedVideo,getReplayCapture]);
    return {bridgeApi,config,checkingConfig,serviceCheck,room,error,previewPlaybackBlocked:error===PREVIEW_PLAYBACK_WARNING,connection,stream,session,history,recording,busy,saving,pendingCopies,stamp,deleted,cameraState,captureInfo,controlPending,cameraCommand,canNewRecording,newRecording,startPending,startRecording,stopPending,stopRecording,attachVideo,refreshConfig,start,mark,undo,nextSet,disconnect,deleteSaved,restoreDeleted,canDeleteSession,saveSavedThumbnail,videoStatuses:videos.videoStatuses,loadSavedVideo:videos.loadSavedVideo,saveImportedVideo,downloadSavedVideo,requestSavedVideo,canMark:!!stamp&&recording?.state==='recording'&&!saving&&!controlPending&&!stopPending&&!['paused','finalizing','off','error'].includes(cameraState??'')&&!session?.ended};
}
