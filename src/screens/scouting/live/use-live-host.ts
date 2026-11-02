import { useCallback, useEffect, useRef, useState } from 'react';
import { calibrateLiveClock, createLivePoint, parseLiveClockMessage, resolveLiveVideoTime, type LiveClockCalibration, type LiveClockMessage, type LivePoint } from '../../../core/scouting-live';
import { closeLiveRoom, createLiveRoom, getLiveServiceConfig, heartbeatLiveRoom, pollLiveSignals, sendLiveSignal, type LiveRoom, type LiveServiceConfig, type LiveSignal } from './live-api';
import { deleteLiveHostSession, loadLiveHostSessions, parseLiveHostSession, restoreLiveHostSession, saveLiveHostSession, type LiveHostScope, type LiveHostSession, type LiveCameraOperation as Operation } from './live-storage';

type Recording = { recordingId: string; startEpochMs: number; state: 'recording' | 'stopped' | 'error'; mimeType: string; durationMs?:number };
const uid = () => crypto.randomUUID();
const friendly = (failure:unknown) => failure instanceof Error ? failure.message : 'Não foi possível manter a conexão ao vivo.';

/** Private source pairing only. No official scouting or existing video document is loaded or written. */
export function useLiveHost(scope:LiveHostScope, className:string) {
    const [config,setConfig]=useState<LiveServiceConfig|null>(null), [room,setRoom]=useState<LiveRoom|null>(null), [error,setError]=useState('');
    const [connection,setConnection]=useState<'idle'|'waiting'|'connecting'|'connected'|'disconnected'|'closed'>('idle');
    const [stream,setStream]=useState<MediaStream|null>(null), [session,setSession]=useState<LiveHostSession|null>(null), [history,setHistory]=useState<LiveHostSession[]>([]);
    const [recording,setRecording]=useState<Recording|null>(null), [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [pendingCopies,setPendingCopies]=useState(0), [tick,setTick]=useState(0);
    const [deleted,setDeleted]=useState<LiveHostSession|null>(null);
    const alive=useRef(true), epoch=useRef(0), peer=useRef<RTCPeerConnection|null>(null), channel=useRef<RTCDataChannel|null>(null), video=useRef<HTMLVideoElement|null>(null);
    const currentRoom=useRef<LiveRoom|null>(null), currentSession=useRef<LiveHostSession|null>(null), currentRecording=useRef<Recording|null>(null), writing=useRef(false);
    const clock=useRef<LiveClockMessage|null>(null), calibration=useRef<LiveClockCalibration|null>(null), frame=useRef<{hostEpochMs:number;captureHostEpochMs?:number}>({hostEpochMs:0});
    const playoutDelay=useRef<number|undefined>(undefined), pending=useRef(new Map<string,Operation>()), pings=useRef(new Map<string,number>());
    const cancel=useRef<AbortController|null>(null), generation=useRef(0), frameHandle=useRef<number|null>(null), sessionReady=useRef(false);
    const scopeIdentity=JSON.stringify([scope.userId,scope.org,scope.classId]);
    const historyRef=useRef<LiveHostSession[]>([]);
    const trash=useRef<LiveHostSession[]>([]);
    const historyLoaded=useRef<Promise<boolean>>(Promise.resolve(false));
    const mutations=useRef<Promise<void>>(Promise.resolve());
    const publishSession=(next:LiveHostSession)=>{
        currentSession.current=next;setSession(next);pending.current.clear();
        for(const operation of next.delivery?.pending??[])pending.current.set(operation.kind==='point'?operation.point.id:operation.id,operation);
        setPendingCopies(pending.current.size);
        setHistory(old=>{const values=[next,...old.filter(s=>s.id!==next.id)].slice(0,30);historyRef.current=values;return values;});
    };
    const updateSession=(recipe:(current:LiveHostSession|null)=>LiveHostSession|null)=>{
        const token=epoch.current;
        const saved=mutations.current.catch(()=>undefined).then(async()=>{
            if(!alive.current||epoch.current!==token)return;
            const proposed=recipe(currentSession.current);if(!proposed)return;
            const next=parseLiveHostSession(proposed,scope);
            await saveLiveHostSession(next,scope);
            if(alive.current&&epoch.current===token)publishSession(next);
        });
        mutations.current=saved;return saved;
    };
    const send=(operation:unknown)=>{
        const dc=channel.current;if(dc?.readyState!=='open'||dc.bufferedAmount>=256*1024)return false;
        try{dc.send(JSON.stringify(operation));return true;}catch{return false;}
    };
    const sendPending=()=>{
        const owner=currentSession.current, source=currentRecording.current;
        if(!owner||!source||source.recordingId!==owner.recordingId)return;
        for(const operation of pending.current.values()){
            const recordingId=operation.kind==='point'?operation.point.recordingId:operation.recordingId;
            if(recordingId===source.recordingId&&!send(operation))break;
        }
        setPendingCopies(pending.current.size);
    };
    const refreshConfig=useCallback(async()=>{const controller=new AbortController();try{const result=await getLiveServiceConfig(controller.signal);if(alive.current){setConfig(result);setError('');}}catch(failure){if(alive.current)setError(friendly(failure));}},[]);

    useEffect(()=>{
        alive.current=true;const token=++epoch.current;
        void refreshConfig();
        historyLoaded.current=loadLiveHostSessions(scope,true).then(values=>{if(alive.current&&epoch.current===token){historyRef.current=values.filter(item=>!item.deletedAt);trash.current=values.filter(item=>item.deletedAt).sort((a,b)=>b.deletedAt!.localeCompare(a.deletedAt!));setHistory(historyRef.current);setDeleted(trash.current[0]??null);return true;}return false;}).catch(failure=>{if(alive.current&&epoch.current===token)setError(friendly(failure));return false;});
        const ticker=setInterval(()=>setTick(value=>value+1),500);
        return()=>{alive.current=false;epoch.current++;clearInterval(ticker);cancel.current?.abort();channel.current?.close();peer.current?.close();if(video.current&&frameHandle.current!==null)video.current.cancelVideoFrameCallback?.(frameHandle.current);};
        // The component is keyed by this identity; stale async reads never cross it.
    },[scopeIdentity,refreshConfig]);

    const onRecording=async(value:unknown)=>{
        const raw=value as Recording;
        if(!raw||typeof raw.recordingId!=='string'||!raw.recordingId||raw.recordingId.length>128||!Number.isFinite(raw.startEpochMs)||!['recording','stopped','error'].includes(raw.state)||typeof raw.mimeType!=='string')return;
        const token=epoch.current;
        if(!await historyLoaded.current||!alive.current||epoch.current!==token)return;
        if(trash.current.some(item=>item.recordingId===raw.recordingId)){
            clock.current=null;sessionReady.current=false;currentRecording.current=null;setRecording(null);
            setError('Os registros desta gravação estão na lixeira. Restaure-os antes de reconectar.');return;
        }
        const existing=historyRef.current.find(item=>item.recordingId===raw.recordingId);
        const previous=currentRecording.current?.recordingId===raw.recordingId?currentRecording.current:null;
        const state=raw.state==='recording'&&(existing?.ended||previous&&previous.state!=='recording')?existing?.recordingState??previous?.state??'stopped':raw.state;
        const durationMs=Number.isFinite(raw.durationMs)&&raw.durationMs!>=0&&raw.durationMs!<=86400000?raw.durationMs:existing?.durationMs??(clock.current?.recordingId===raw.recordingId?clock.current.timeMs:undefined)??previous?.durationMs;
        const next:Recording={recordingId:raw.recordingId,startEpochMs:raw.startEpochMs,state,mimeType:raw.mimeType.slice(0,120),...(durationMs!==undefined?{durationMs}:{})};
        currentRecording.current=next;setRecording(next);
        const terminal=next.state!=='recording';
        if(terminal){clock.current=null;sessionReady.current=false;}
        const finalMetadata=terminal?{ended:true,recordingState:next.state as 'stopped'|'error',...(durationMs!==undefined?{durationMs}:{})}:{};
        if(currentSession.current?.recordingId!==next.recordingId){
            sessionReady.current=false;
            const at=new Date().toISOString();
            const initial:LiveHostSession=existing?{...existing,...finalMetadata}:{version:1,id:uid(),scope:{...scope},recordingId:next.recordingId,createdAt:at,updatedAt:at,setNumber:1,className,points:[],gaps:[],mimeType:next.mimeType,ended:false,...finalMetadata,delivery:{pending:[],acknowledged:[]}};
            try{await updateSession(()=>initial);if(alive.current&&currentRecording.current?.recordingId===next.recordingId)sessionReady.current=true;}catch(failure){if(alive.current)setError(friendly(failure));}
        }else if(terminal){
            try{await updateSession(current=>current?.recordingId===next.recordingId?{...current,...finalMetadata,updatedAt:new Date().toISOString()}:null);}catch(failure){if(alive.current)setError(friendly(failure));}
        }
        if(alive.current&&currentRecording.current?.recordingId===next.recordingId)sendPending();
        if(next.state==='error')setError('O celular informou falha na gravação. Confira o armazenamento no aparelho.');
    };
    const handleMessage=(event:MessageEvent)=>{
        if(typeof event.data!=='string'||event.data.length>16384)return;
        let value:Record<string,unknown>;try{value=JSON.parse(event.data);}catch{return;}
        if(value.kind==='recording'){void onRecording(value);return;}
        if(value.kind==='clock'){
            try{const parsed=parseLiveClockMessage(value);if(currentRecording.current?.recordingId===parsed.recordingId&&currentRecording.current.state==='recording')clock.current=parsed;}catch{/* Ignore invalid or foreign clocks. */}return;
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
    const bindChannel=(dc:RTCDataChannel)=>{
        channel.current=dc;dc.onmessage=event=>{if(alive.current&&channel.current===dc)handleMessage(event);};
        dc.onopen=()=>{if(channel.current!==dc)return;setConnection('connected');sendPending();};
        dc.onclose=()=>{if(channel.current===dc)setConnection('disconnected');};
    };
    const attachVideo=useCallback((node:HTMLVideoElement|null)=>{
        if(video.current&&frameHandle.current!==null)video.current.cancelVideoFrameCallback?.(frameHandle.current);
        video.current=node;frameHandle.current=null;
        if(!node)return;
        const draw=(_now:number,metadata:VideoFrameCallbackMetadata)=>{
            const extra=metadata as VideoFrameCallbackMetadata&{captureTime?:number};
            frame.current={hostEpochMs:Date.now(),...(Number.isFinite(extra.captureTime)?{captureHostEpochMs:performance.timeOrigin+extra.captureTime!}:{})};
            if(video.current===node)frameHandle.current=node.requestVideoFrameCallback(draw);
        };
        if(node.requestVideoFrameCallback)frameHandle.current=node.requestVideoFrameCallback(draw);
    },[]);
    useEffect(()=>{
        const node=video.current;if(!node)return;node.srcObject=stream;
        if(stream)void node.play().catch(()=>{if(alive.current)setError('Clique no vídeo para iniciar a prévia.');});
        const time=()=>{if(!node.requestVideoFrameCallback)frame.current={hostEpochMs:Date.now()};};
        node.addEventListener('timeupdate',time);return()=>{node.removeEventListener('timeupdate',time);node.srcObject=null;};
    },[stream]);

    const start=async()=>{
        if(busy||writing.current||currentRoom.current)return;
        setBusy(true);setError('');const abort=new AbortController();cancel.current?.abort();cancel.current=abort;
        try{
            const created=await createLiveRoom(abort.signal);if(!alive.current){return;}
            generation.current=0;clock.current=null;calibration.current=null;frame.current={hostEpochMs:0};sessionReady.current=false;
            currentSession.current=null;currentRecording.current=null;pending.current.clear();setPendingCopies(0);setSession(null);setRecording(null);setStream(null);
            currentRoom.current=created;setRoom(created);setConnection('waiting');let cursor=0;
            const queued=new Map<number,(RTCIceCandidateInit|null)[]>();
            const installOffer=async(signal:LiveSignal)=>{
                if(!signal.sdp||signal.generation<=generation.current)return;
                generation.current=signal.generation;channel.current?.close();peer.current?.close();clock.current=null;calibration.current=null;frame.current={hostEpochMs:0};currentRecording.current=null;setRecording(null);
                const pc=new RTCPeerConnection({iceServers:[]});peer.current=pc;setConnection('connecting');
                pc.ondatachannel=event=>{if(peer.current===pc)bindChannel(event.channel);};
                pc.ontrack=event=>{if(peer.current===pc)setStream(event.streams[0]??new MediaStream([event.track]));};
                pc.onconnectionstatechange=()=>{if(peer.current!==pc)return;if(pc.connectionState==='failed'||pc.connectionState==='disconnected'||pc.connectionState==='closed')setConnection('disconnected');};
                pc.onicecandidate=event=>{if(peer.current!==pc)return;void sendLiveSignal(created,{type:'ice',candidate:event.candidate?.toJSON()??null,generation:signal.generation},abort.signal).catch(failure=>{if(alive.current&&!abort.signal.aborted)setError(friendly(failure));});};
                await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
                for(const candidate of queued.get(signal.generation)??[])if(candidate)await pc.addIceCandidate(candidate);queued.delete(signal.generation);
                const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
                await sendLiveSignal(created,{type:'answer',sdp:answer.sdp!,generation:signal.generation},abort.signal);
            };
            const poll=async()=>{
                if(abort.signal.aborted||!alive.current)return;
                try{
                    const batch=await pollLiveSignals(created,cursor,abort.signal);cursor=batch.cursor;
                    for(const signal of batch.signals){if(signal.type==='offer')await installOffer(signal);else if(signal.type==='ice'){
                        if(signal.generation===generation.current&&peer.current?.remoteDescription){if(signal.candidate)await peer.current.addIceCandidate(signal.candidate);}
                        else if(signal.generation>generation.current){const items=queued.get(signal.generation)??[];if(items.length<128){items.push(signal.candidate??null);queued.set(signal.generation,items);}}
                    }}
                }catch(failure){if(!abort.signal.aborted&&alive.current){setError(friendly(failure));setConnection('disconnected');}}
                if(!abort.signal.aborted&&alive.current)setTimeout(()=>{void poll();},700);
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
        }catch(failure){if(alive.current&&!abort.signal.aborted)setError(friendly(failure));}
        finally{if(alive.current)setBusy(false);}
    };
    const resolveStamp=()=>clock.current&&currentRecording.current?.state==='recording'&&!currentSession.current?.ended&&connection==='connected'&&sessionReady.current?resolveLiveVideoTime({clock:clock.current,calibration:calibration.current,hostNowEpochMs:Date.now(),lastFrameHostEpochMs:frame.current.hostEpochMs,captureHostEpochMs:frame.current.captureHostEpochMs,playoutDelayMs:playoutDelay.current}):null;
    const stamp=resolveStamp();
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
    const disconnect=async()=>{
        const current=currentRoom.current;if(!current)return true;
        const controller=new AbortController();setBusy(true);
        try{await closeLiveRoom(current,controller.signal);cancel.current?.abort();channel.current?.close();peer.current?.close();currentRoom.current=null;setRoom(null);setConnection('closed');setStream(null);return true;}
        catch(failure){setError(friendly(failure));return false;}finally{setBusy(false);}
    };
    const canDeleteSession=(candidate:LiveHostSession)=>!!candidate.ended&&!candidate.deletedAt&&!candidate.delivery?.pending.length&&!writing.current&&!busy
        &&!(currentRoom.current&&(currentSession.current?.id===candidate.id||currentRecording.current?.recordingId===candidate.recordingId));
    const deleteSaved=async(sessionId:string,recordingId:string)=>{
        const target=historyRef.current.find(item=>item.id===sessionId&&item.recordingId===recordingId);
        if(!target||!canDeleteSession(target)){setError('Encerre a conexão e aguarde as cópias pendentes antes de excluir.');return false;}
        writing.current=true;setSaving(true);setError('');const token=epoch.current;
        try{
            await mutations.current.catch(()=>undefined);
            const removed=await deleteLiveHostSession(scope,sessionId,recordingId);
            if(!alive.current||epoch.current!==token)return false;
            historyRef.current=historyRef.current.filter(item=>item.id!==sessionId);setHistory(historyRef.current);trash.current=[removed,...trash.current.filter(item=>item.id!==removed.id)];setDeleted(removed);
            if(currentSession.current?.id===sessionId){currentSession.current=null;setSession(null);currentRecording.current=null;setRecording(null);pending.current.clear();setPendingCopies(0);}
            return true;
        }catch(failure){if(alive.current&&epoch.current===token)setError(friendly(failure));return false;}
        finally{writing.current=false;if(alive.current&&epoch.current===token)setSaving(false);}
    };
    const restoreDeleted=async()=>{
        if(!deleted||writing.current||busy)return false;
        writing.current=true;setSaving(true);setError('');const token=epoch.current;
        try{const restored=await restoreLiveHostSession(scope,deleted.id,deleted.recordingId);if(!alive.current||epoch.current!==token)return false;historyRef.current=[restored,...historyRef.current.filter(item=>item.id!==restored.id)];setHistory(historyRef.current);trash.current=trash.current.filter(item=>item.id!==restored.id);setDeleted(trash.current[0]??null);return true;}
        catch(failure){if(alive.current&&epoch.current===token)setError(friendly(failure));return false;}
        finally{writing.current=false;if(alive.current&&epoch.current===token)setSaving(false);}
    };
    void tick;
    return {config,room,error,connection,stream,session,history,recording,busy,saving,pendingCopies,stamp,deleted,attachVideo,refreshConfig,start,mark,undo,nextSet,disconnect,deleteSaved,restoreDeleted,canDeleteSession,canMark:!!stamp&&recording?.state==='recording'&&!saving&&!session?.ended};
}
