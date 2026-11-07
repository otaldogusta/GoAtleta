import {act,renderHook} from '@testing-library/react-native';
import {parseLiveCameraDiagnostics,parseLiveCaptureInfo,parseLiveHostDataMessage,useLiveHost} from '../live/use-live-host';
import * as thumbnail from '../live/live-thumbnail';
import {closeLiveRoom,createLiveRoom,getLiveServiceConfig,heartbeatLiveRoom,pollLiveSignals} from '../live/live-api';
import {deleteLiveHostSession,loadLiveHostSession,loadLiveHostSessions,restoreLiveHostSession,saveLiveHostSession,saveLiveHostThumbnail,parseLiveHostSession,type LiveHostSession} from '../live/live-storage';
import {loadVideoBlob,loadVideoStatus} from '../live/live-video-storage';
const mockVideos={videoStatuses:{},bindVideoChannel:jest.fn(),stopVideoChannel:jest.fn(),receiveVideoMessage:jest.fn(),requestVideo:jest.fn(),loadSavedVideo:jest.fn(async()=>null),saveImportedVideo:jest.fn(async()=>true)};

test('host transport extends only video batch envelopes and rejects non-object JSON',()=>{
    for(const raw of [null,new ArrayBuffer(1),'null','[]','false','{'])expect(parseLiveHostDataMessage(raw)).toBeNull();
    const batch={kind:'video-parts',data:'a'.repeat(32000)};
    expect(parseLiveHostDataMessage(JSON.stringify(batch))).toEqual(batch);
    expect(parseLiveHostDataMessage(JSON.stringify({...batch,kind:'clock'}))).toBeNull();
    expect(parseLiveHostDataMessage(JSON.stringify({...batch,data:'a'.repeat(48*1024)}))).toBeNull();
    expect(parseLiveHostDataMessage('{"kind":"video-part"}')).toEqual({kind:'video-part'});
    expect(parseLiveHostDataMessage(JSON.stringify({kind:'video-parts',padding:'漢'.repeat(18000)}))).toBeNull();
    expect(parseLiveHostDataMessage(JSON.stringify({kind:'video-parts',padding:'😀'.repeat(12500)}))).toBeNull();
    expect(parseLiveHostDataMessage(JSON.stringify({kind:'clock',padding:'漢'.repeat(6000)}))).toBeNull();
});

test('camera quality measurements whitelist bounded metrics and omit pairing capabilities',()=>{
    const input={phase:'recording',sourceFps:59.94,previewFps:30,requestedFps:60,width:1920,height:1080,mimeType:'video/mp4',smooth:true,powerEfficient:true,encoderImplementation:'hardware',roomId:'private-room',token:'private-capability'};
    const report=parseLiveCameraDiagnostics(input);
    expect(report).toEqual({phase:'recording',sourceFps:59.94,previewFps:30,requestedFps:60,width:1920,height:1080,mimeType:'video/mp4',smooth:true,powerEfficient:true,encoderImplementation:'hardware'});
    for(const delta of [{phase:'unknown'},{sourceFps:Infinity},{previewFps:241},{width:0},{mimeType:'x'.repeat(161)},{encoderImplementation:'bad\nline'},{smooth:'true'}])expect(parseLiveCameraDiagnostics({...input,...delta})).toBeNull();
    const candidates=[{codec:'avc1.64002A',state:'queried',supported:true,smooth:false,powerEfficient:false,token:'private-capability'}];
    expect(parseLiveCameraDiagnostics({...input,codecSupport:JSON.stringify(candidates)})?.codecSupport).toBe('[{"codec":"avc1.64002A","state":"queried","supported":true,"smooth":false,"powerEfficient":false}]');
    for(const codecSupport of ['invalid',JSON.stringify([{codec:'secret',state:'queried'}]),JSON.stringify([{codec:'avc1.64002A',state:'queried',supported:'yes'}])])expect(parseLiveCameraDiagnostics({...input,codecSupport})).toBeNull();
    expect(parseLiveCameraDiagnostics({...input,sourceFps:30,localFps:59.94,localPresentedFps:29.97,localSampleMs:3000})).toMatchObject({sourceFps:30,localFps:59.94,localPresentedFps:29.97,localSampleMs:3000});
    for(const delta of [{localFps:Infinity},{localPresentedFps:241},{localSampleMs:-1},{localSampleMs:7200001}])expect(parseLiveCameraDiagnostics({...input,...delta})).toBeNull();
});
jest.mock('../live/use-live-videos',()=>({useLiveVideos:()=>mockVideos}));
const mockSaved=new Map<string,LiveHostSession>();
const mockDeleted=new Map<string,LiveHostSession>();
jest.mock('../live/live-api',()=>({getLiveServiceConfig:jest.fn(async()=>({cameraReady:false,cameraOrigin:null,hostOrigin:'http://localhost:8081',roomTtlMs:7200000})),createLiveRoom:jest.fn(),pollLiveSignals:jest.fn(),sendLiveSignal:jest.fn(async()=>({})),heartbeatLiveRoom:jest.fn(async()=>({})),closeLiveRoom:jest.fn(async()=>({}))}));
jest.mock('../live/live-storage',()=>({...jest.requireActual('../live/live-storage'),loadLiveHostSession:jest.fn(),loadLiveHostSessions:jest.fn(async()=>[]),saveLiveHostSession:jest.fn(async()=>{}),saveLiveHostThumbnail:jest.fn(),deleteLiveHostSession:jest.fn(),restoreLiveHostSession:jest.fn()}));
jest.mock('../live/live-video-storage',()=>({...jest.requireActual('../live/live-video-storage'),loadVideoBlob:jest.fn(),loadVideoStatus:jest.fn()}));
const originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'), originalPeer=Object.getOwnPropertyDescriptor(globalThis,'RTCPeerConnection');
let mockSequence=0;
class Peer {
    static last:Peer;ondatachannel:any;ontrack:any;onconnectionstatechange:any;onicecandidate:any;
    remoteDescription:unknown=null;connectionState='connected';
    close=jest.fn();getStats=jest.fn(async()=>new Map());addIceCandidate=jest.fn(async()=>{});
    constructor(){Peer.last=this;}
    async setRemoteDescription(value:unknown){this.remoteDescription=value;}
    async createAnswer(){return{type:'answer',sdp:'answer'};}
    async setLocalDescription(){}
}
const room={roomId:'11111111-1111-4111-8111-111111111111',hostToken:'a'.repeat(64),cameraToken:'b'.repeat(64),cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=room&token=camera',expiresAt:99999999};
beforeEach(()=>{
    jest.useFakeTimers({now:2010000});jest.clearAllMocks();mockSequence=0;
    mockSaved.clear();mockDeleted.clear();mockVideos.videoStatuses={};
    (getLiveServiceConfig as jest.Mock).mockResolvedValue({cameraReady:false,cameraOrigin:null,hostOrigin:'http://localhost:8081',roomTtlMs:7200000});
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>`point-${++mockSequence}`}});
    Object.defineProperty(globalThis,'RTCPeerConnection',{configurable:true,value:Peer});
    (createLiveRoom as jest.Mock).mockResolvedValue(room);let once=false;
    (pollLiveSignals as jest.Mock).mockImplementation(async()=>once?{cursor:1,signals:[]}:(once=true,{cursor:1,signals:[{sequence:1,from:'camera',type:'offer',generation:1,sdp:'offer'}]}));
    (loadLiveHostSessions as jest.Mock).mockImplementation(async(_scope,includeDeleted)=>[...mockSaved.values(),...(includeDeleted?[...mockDeleted.values()]:[])]);
    (loadLiveHostSession as jest.Mock).mockImplementation(async(scope,id)=>{const value=mockSaved.get(id)??mockDeleted.get(id);return value?parseLiveHostSession(value,scope):null;});
    (loadVideoBlob as jest.Mock).mockResolvedValue(null);(loadVideoStatus as jest.Mock).mockResolvedValue(null);
    (saveLiveHostSession as jest.Mock).mockImplementation(async(value,scope)=>{const parsed=parseLiveHostSession(value,scope);mockSaved.set(parsed.id,parsed);});
    (saveLiveHostThumbnail as jest.Mock).mockImplementation(async(scope,id,recordingId,thumbnailDataUrl)=>{const value=mockSaved.get(id);if(!value||value.recordingId!==recordingId||!value.ended)throw new Error('Missing recording');const next=parseLiveHostSession({...value,thumbnailDataUrl},scope);mockSaved.set(id,next);return next;});
    (deleteLiveHostSession as jest.Mock).mockImplementation(async(scope,id,recordingId,options)=>{const value=mockSaved.get(id);if(!value||value.recordingId!==recordingId||(!value.ended||value.delivery?.pending.length)&&options?.allowAbandoned!==true)throw new Error('Protected recording');const removed=parseLiveHostSession({...value,deletedAt:new Date().toISOString()},scope);mockSaved.delete(id);mockDeleted.set(id,removed);return removed;});
    (restoreLiveHostSession as jest.Mock).mockImplementation(async(scope,id,recordingId)=>{const value=mockDeleted.get(id);if(!value||value.recordingId!==recordingId)throw new Error('Missing recording');const {deletedAt:_,...restored}=value;const clean=parseLiveHostSession(restored,scope);mockSaved.set(id,clean);mockDeleted.delete(id);return clean;});
});
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else Reflect.deleteProperty(globalThis,'crypto');if(originalPeer)Object.defineProperty(globalThis,'RTCPeerConnection',originalPeer);else Reflect.deleteProperty(globalThis,'RTCPeerConnection');});
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};

// Fast Refresh replays effects while retaining hook state/refs. Invalidate only
// the host lifecycle effect dependency to exercise that lifecycle without a test API.
function effectReplayFixture(){
    const react=jest.requireActual<typeof import('react')>('react'),registerEffect=react.useEffect;
    let version=0;
    jest.spyOn(react,'useEffect').mockImplementation((setup,deps)=>registerEffect(setup,deps&&typeof deps[0]==='string'&&typeof deps[1]==='function'?[...deps,version]:deps));
    return()=>{version++;};
}

test('effect replay restarts signaling for the same room while preserving a recording and its pending marker',async()=>{
    const replay=effectReplayFixture(),{view,dc,node}=await connected(),api=view.result.current.bridgeApi,oldPeer=Peer.last;
    await act(async()=>{await view.result.current.mark(true);});
    const sessionBefore=view.result.current.session,recordingBefore=view.result.current.recording,roomBefore=view.result.current.room,pending=view.result.current.pendingCopies;
    expect(pending).toBe(1);expect(api.getCaptureStamp()).not.toBeNull();
    (pollLiveSignals as jest.Mock).mockResolvedValue({cursor:1,signals:[]});
    const polls=(pollLiveSignals as jest.Mock).mock.calls.length;
    await act(async()=>{replay();view.rerender();await flush();});
    expect(oldPeer.close).toHaveBeenCalled();expect(dc.close).toHaveBeenCalled();expect((pollLiveSignals as jest.Mock).mock.calls.length).toBeGreaterThan(polls);
    expect(view.result.current.room).toBe(roomBefore);expect(view.result.current.session).toEqual(sessionBefore);expect(view.result.current.recording).toBe(recordingBefore);expect(view.result.current.pendingCopies).toBe(pending);
    expect(view.result.current.connection).toBe('disconnected');expect(view.result.current.stream).toBeNull();expect(api.getCaptureStamp()).toBeNull();expect(api.getReplayCapture().stream).toBeNull();
    const count=(createLiveRoom as jest.Mock).mock.calls.length;await act(async()=>{await view.result.current.start();});expect(createLiveRoom).toHaveBeenCalledTimes(count);
    act(()=>{oldPeer.onconnectionstatechange();dc.onopen();dc.onmessage({data:JSON.stringify({kind:'recording',recordingId:'stale',startEpochMs:1,state:'stopped',mimeType:'video/webm'})});});
    expect(view.result.current.recording?.recordingId).toBe(recordingBefore?.recordingId);expect(view.result.current.connection).toBe('disconnected');
    (pollLiveSignals as jest.Mock).mockResolvedValueOnce({cursor:2,signals:[{sequence:2,from:'camera',type:'offer',generation:2,sdp:'reconnect-offer'}]});
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});expect(Peer.last).not.toBe(oldPeer);
    const next={readyState:'open',bufferedAmount:0,send:jest.fn(),close:jest.fn(),onmessage:null as any,onopen:null as any,onclose:null as any};
    act(()=>{Peer.last.ondatachannel({channel:next});next.onopen();});
    const emit=(value:unknown)=>next.onmessage({data:JSON.stringify(value)});
    await act(async()=>{emit({kind:'recording',...recordingBefore});emit({kind:'camera-status',roomId:room.roomId,state:'recording',controlsVersion:2});await flush();});
    expect(view.result.current.connection).toBe('connected');expect(view.result.current.pendingCopies).toBe(1);expect(api.getCaptureStamp()).toBeNull();
    await act(async()=>{jest.advanceTimersByTime(3000);await flush();});
    const ping=next.send.mock.calls.map(([raw])=>JSON.parse(raw)).find(message=>message.kind==='ping');
    act(()=>{emit({kind:'pong',id:ping.id,sentEpochMs:ping.sentEpochMs,cameraEpochMs:Date.now()});emit({kind:'clock',recordingId:recordingBefore!.recordingId,segmentId:'reconnected-segment',startEpochMs:2000000,timeMs:Date.now()-2000000,senderEpochMs:Date.now(),recording:true});node.frame(0,{mediaTime:17});});
    expect(api.getCaptureStamp()?.recordingId).toBe(recordingBefore?.recordingId);expect(view.result.current.session?.points).toEqual(sessionBefore?.points);
    expect((heartbeatLiveRoom as jest.Mock).mock.calls.every(([owner])=>owner===roomBefore)).toBe(true);expect(closeLiveRoom).not.toHaveBeenCalled();view.unmount();
});

test('effect replay retains an ended receiving original and requests its same recording after a new handshake',async()=>{
    const replay=effectReplayFixture(),{view,emit}=await connected();
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:28000});await flush();});
    const saved=view.result.current.session!,partial=Object.freeze({state:'receiving',receivedBytes:390,totalBytes:1000});mockVideos.videoStatuses={[saved.id]:partial};
    (pollLiveSignals as jest.Mock).mockResolvedValue({cursor:1,signals:[]});mockVideos.requestVideo.mockClear();
    await act(async()=>{replay();view.rerender();await flush();});
    expect(view.result.current.session).toEqual(saved);expect(view.result.current.recording?.state).toBe('stopped');expect(view.result.current.videoStatuses[saved.id]).toBe(partial);
    (pollLiveSignals as jest.Mock).mockResolvedValueOnce({cursor:2,signals:[{sequence:2,from:'camera',type:'offer',generation:2,sdp:'copy-reconnect'}]});
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    const next={readyState:'open',bufferedAmount:0,send:jest.fn(),close:jest.fn(),onmessage:null as any,onopen:null as any,onclose:null as any};
    await act(async()=>{Peer.last.ondatachannel({channel:next});next.onopen();next.onmessage({data:JSON.stringify({kind:'recording',recordingId:saved.recordingId,startEpochMs:2000000,state:'stopped',mimeType:saved.mimeType,durationMs:28000})});await flush();});
    expect(mockVideos.requestVideo).toHaveBeenCalledWith(expect.objectContaining({id:saved.id,recordingId:saved.recordingId,durationMs:28000}));
    expect(view.result.current.videoStatuses[saved.id]).toBe(partial);expect(createLiveRoom).toHaveBeenCalledTimes(1);expect(deleteLiveHostSession).not.toHaveBeenCalled();view.unmount();
});

test('effect replay waits for an already started marker commit before restoring the same durable session',async()=>{
    const replay=effectReplayFixture(),{view}=await connected(),sessionId=view.result.current.session!.id;
    let commit!:()=>void;
    (saveLiveHostSession as jest.Mock).mockImplementationOnce((value,scope)=>new Promise<void>(resolve=>{commit=()=>{const stored=parseLiveHostSession(value,scope);mockSaved.set(stored.id,stored);resolve();};}));
    let pending!:Promise<void>;act(()=>{pending=view.result.current.mark(true);});await act(flush);expect(commit).toBeDefined();
    const reads=(loadLiveHostSessions as jest.Mock).mock.calls.length;(pollLiveSignals as jest.Mock).mockResolvedValue({cursor:1,signals:[]});
    await act(async()=>{replay();view.rerender();await flush();});expect(loadLiveHostSessions).toHaveBeenCalledTimes(reads);
    await act(async()=>{commit();await pending;await flush();});
    expect(view.result.current.session?.id).toBe(sessionId);expect(view.result.current.session?.points).toHaveLength(1);expect(view.result.current.pendingCopies).toBe(1);
    expect(view.result.current.session).toEqual(mockSaved.get(sessionId));expect(view.result.current.bridgeApi.getCaptureStamp()).toBeNull();expect(createLiveRoom).toHaveBeenCalledTimes(1);view.unmount();
});

test('replacing a preview DOM node reattaches the same stream and disposes old callbacks without restarting capture',async()=>{
    const {view,node}=await connected(),stream={id:'same-media-stream'};
    act(()=>Peer.last.ontrack({streams:[stream]}));expect(node.srcObject).toBe(stream);
    const oldFrame=node.frame!,oldRequests=node.requestVideoFrameCallback.mock.calls.length;
    const replacement={srcObject:null as unknown,play:jest.fn(async()=>{}),addEventListener:jest.fn(),removeEventListener:jest.fn(),requestVideoFrameCallback:jest.fn((_fn:any)=>1),cancelVideoFrameCallback:jest.fn()};
    act(()=>{view.result.current.attachVideo(null);view.result.current.attachVideo(replacement as unknown as HTMLVideoElement);});
    expect(replacement.srcObject).toBe(stream);expect(replacement.play).toHaveBeenCalledTimes(1);expect(node.srcObject).toBeNull();expect(node.removeEventListener).toHaveBeenCalledTimes(2);
    act(()=>oldFrame(0,{mediaTime:1000}));expect(node.requestVideoFrameCallback).toHaveBeenCalledTimes(oldRequests);expect(replacement.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
    view.unmount();expect(replacement.removeEventListener).toHaveBeenCalledTimes(2);expect(replacement.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);expect(closeLiveRoom).not.toHaveBeenCalled();
});

test('a real playing event clears only the preview warning and preserves a recording storage error',async()=>{
    const {view,node,emit}=await connected(),stream={id:'autoplay-source'};
    node.play.mockRejectedValueOnce(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}));
    await act(async()=>{Peer.last.ontrack({streams:[stream]});await flush();});
    expect(view.result.current.error).toBe('Clique no vídeo para iniciar a prévia.');expect(view.result.current.previewPlaybackBlocked).toBe(true);
    const playing=node.addEventListener.mock.calls.find(([name])=>name==='playing')?.[1];expect(playing).toEqual(expect.any(Function));
    act(()=>{Object.assign(node,{paused:false});playing();});expect(view.result.current.error).toBe('');expect(view.result.current.previewPlaybackBlocked).toBe(false);
    act(()=>emit({kind:'storage-error',recordingId:'recording-1'}));const critical=view.result.current.error;
    act(()=>playing());expect(view.result.current.error).toBe(critical);expect(critical).toContain('não conseguiu salvar');view.unmount();
});

test.each(['AbortError','NotAllowedError'])('a late %s from an earlier play attempt cannot mark a preview that is already playing',async(name)=>{
    const {view,node}=await connected(),stream={id:'playing-source'};let fail!:(reason:Error)=>void;
    node.play.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
    await act(async()=>{Peer.last.ontrack({streams:[stream]});await flush();});
    const playing=node.addEventListener.mock.calls.find(([kind])=>kind==='playing')?.[1];expect(playing).toEqual(expect.any(Function));
    act(()=>{Object.assign(node,{paused:false});playing();});
    await act(async()=>{fail(Object.assign(new Error('Earlier play rejected'),{name}));await flush();});
    expect(view.result.current.error).toBe('');expect(view.result.current.previewPlaybackBlocked).toBe(false);view.unmount();
});

test('a closed data channel pauses the video receiver while preserving the current pairing',async()=>{
    const {view,dc}=await connected(null),current=view.result.current.room;
    mockVideos.stopVideoChannel.mockClear();
    act(()=>{dc.readyState='closed';dc.onclose();});
    expect(mockVideos.stopVideoChannel).toHaveBeenCalledTimes(1);
    expect(view.result.current.connection).toBe('disconnected');expect(view.result.current.room).toBe(current);
    expect(closeLiveRoom).not.toHaveBeenCalled();expect(deleteLiveHostSession).not.toHaveBeenCalled();
    view.unmount();
});

test('a successful authorized poll restores a healthy current peer without reopening its data channel',async()=>{
    const {view,dc}=await connected(null),pc=Peer.last;
    expect(pc.connectionState).toBe('connected');expect(dc.readyState).toBe('open');
    (pollLiveSignals as jest.Mock).mockRejectedValueOnce(new Error('Temporary signaling failure'));
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    expect(view.result.current.connection).toBe('disconnected');expect(view.result.current.error).toBe('Temporary signaling failure');
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    expect(view.result.current.connection).toBe('connected');expect(view.result.current.error).toBe('');
    expect(view.result.current.room).toEqual(room);expect(dc.close).not.toHaveBeenCalled();expect(pc.close).not.toHaveBeenCalled();
    view.unmount();
});

test.each([['closed','connected'],['open','disconnected'],['open','connecting']])('an authorized poll cannot restore a %s channel with a %s peer',async(channelState,peerState)=>{
    const {view,dc}=await connected(null),pc=Peer.last;
    (pollLiveSignals as jest.Mock).mockRejectedValueOnce(new Error('Temporary signaling failure'));
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    dc.readyState=channelState;pc.connectionState=peerState;
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    expect(view.result.current.connection).toBe('disconnected');view.unmount();
});

test('only a current connected peer with an open channel and authorized polling restores its status',async()=>{
    const {view,dc}=await connected(null),pc=Peer.last;
    act(()=>{pc.connectionState='disconnected';pc.onconnectionstatechange();});expect(view.result.current.connection).toBe('disconnected');
    act(()=>{pc.connectionState='connected';pc.onconnectionstatechange();});expect(view.result.current.connection).toBe('connected');
    act(()=>{dc.readyState='closed';dc.onclose();pc.onconnectionstatechange();});expect(view.result.current.connection).toBe('disconnected');
    dc.readyState='open';
    (pollLiveSignals as jest.Mock).mockRejectedValueOnce(new Error('Room expired or unauthorized'));
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    act(()=>{pc.onconnectionstatechange();dc.onopen();});
    expect(view.result.current.connection).toBe('disconnected');expect(view.result.current.error).toBe('Room expired or unauthorized');
    view.unmount();
});

test('poll recovery preserves a newer recording storage error',async()=>{
    const {view,emit}=await connected();
    (pollLiveSignals as jest.Mock).mockRejectedValueOnce(new Error('Temporary signaling failure'));
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    act(()=>emit({kind:'storage-error',recordingId:'recording-1'}));
    const storageError=view.result.current.error;expect(storageError).toContain('não conseguiu salvar');
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    expect(view.result.current.connection).toBe('connected');expect(view.result.current.error).toBe(storageError);view.unmount();
});

test.each([false,true])('a late old-room poll and peer events cannot restore or install offers after close (new room: %s)',async(replaceRoom)=>{
    const {view,dc}=await connected(null),pc=Peer.last;
    let finish!:(value:unknown)=>void,signal!:AbortSignal;
    (pollLiveSignals as jest.Mock).mockImplementationOnce((_room,_cursor,currentSignal:AbortSignal)=>{signal=currentSignal;return new Promise(resolve=>{finish=resolve;});});
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    await act(async()=>{await view.result.current.disconnect();});expect(signal.aborted).toBe(true);
    const replacement={...room,roomId:'22222222-2222-4222-8222-222222222222'};
    if(replaceRoom){
        (createLiveRoom as jest.Mock).mockResolvedValueOnce(replacement);
        (pollLiveSignals as jest.Mock).mockResolvedValueOnce({cursor:1,signals:[{sequence:1,from:'camera',type:'offer',generation:1,sdp:'new-offer'}]});
        await act(async()=>{await view.result.current.start();await flush();});
    }
    const currentPeer=Peer.last;
    await act(async()=>{pc.onconnectionstatechange();dc.onopen();finish({cursor:2,signals:[{sequence:2,from:'camera',type:'offer',generation:2,sdp:'stale-offer'}]});await flush();});
    expect(Peer.last).toBe(currentPeer);
    expect(view.result.current.room).toEqual(replaceRoom?replacement:null);
    expect(view.result.current.connection).toBe(replaceRoom?'connecting':'closed');view.unmount();
});

test('an old peer cannot bind or reconnect a channel after the current room installs a newer offer',async()=>{
    const {view,dc}=await connected(null),oldPeer=Peer.last;
    (pollLiveSignals as jest.Mock).mockResolvedValueOnce({cursor:2,signals:[{sequence:2,from:'camera',type:'offer',generation:2,sdp:'replacement-offer'}]});
    await act(async()=>{jest.advanceTimersByTime(700);await flush();});
    expect(Peer.last).not.toBe(oldPeer);expect(view.result.current.connection).toBe('connecting');
    act(()=>{oldPeer.onconnectionstatechange();dc.onopen();oldPeer.ondatachannel({channel:dc});});
    expect(view.result.current.connection).toBe('connecting');view.unmount();
});
test('service verification distinguishes initial, checking, missing HTTPS and camera ready states',async()=>{
    let finish!:(value:unknown)=>void;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));
    expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.checkingConfig).toBe(false);
    await act(async()=>{await flush();});expect(view.result.current.checkingConfig).toBe(true);expect(view.result.current.serviceCheck).toBeNull();
    await act(async()=>{finish({cameraReady:false,cameraOrigin:null,hostOrigin:'http://localhost:8081',roomTtlMs:7200000});await flush();});
    expect(view.result.current.checkingConfig).toBe(false);expect(view.result.current.config?.cameraReady).toBe(false);expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.error).toBe('');
    await act(async()=>{await view.result.current.refreshConfig();});
    expect(view.result.current.serviceCheck).toContain('configure o HTTPS');
    (getLiveServiceConfig as jest.Mock).mockResolvedValueOnce({cameraReady:true,cameraOrigin:'https://192.168.0.1:8097',hostOrigin:'http://localhost:8081',roomTtlMs:7200000});
    await act(async()=>{await view.result.current.refreshConfig();});
    expect(view.result.current.serviceCheck).toBe('Serviço disponível · câmera pronta.');expect(view.result.current.checkingConfig).toBe(false);view.unmount();
});

test.each(['offline','timeout'])('an unavailable automatic probe stays neutral (%s)',async(reason)=>{
    let signal!:AbortSignal;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce((value:AbortSignal)=>{signal=value;return reason==='offline'?Promise.reject(new Error('Serviço desligado.')):new Promise(()=>{});});
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));
    await act(async()=>{await flush();if(reason==='timeout'){jest.advanceTimersByTime(6000);await flush();}});
    expect(view.result.current.error).toBe('');expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.config).toBeNull();expect(view.result.current.checkingConfig).toBe(false);
    expect(view.result.current.connection).toBe('idle');expect(createLiveRoom).not.toHaveBeenCalled();
    if(reason==='timeout')expect(signal.aborted).toBe(true);
    view.unmount();
});

test.each([false,true])('the automatic probe preserves a local history failure (probe succeeds: %s)',async(succeeds)=>{
    let finish!:(value:unknown)=>void,fail!:(reason:Error)=>void;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce(()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;}));
    (loadLiveHostSessions as jest.Mock).mockRejectedValueOnce(new Error('Falha ao ler as gravações locais.'));
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));
    await act(async()=>{await flush();});expect(view.result.current.error).toBe('Falha ao ler as gravações locais.');
    await act(async()=>{if(succeeds)finish({cameraReady:false});else fail(new Error('Serviço desligado.'));await flush();});
    expect(view.result.current.error).toBe('Falha ao ler as gravações locais.');expect(view.result.current.serviceCheck).toBeNull();view.unmount();
});

test('explicit verification supersedes the automatic probe and keeps its failure after a late probe response',async()=>{
    let finish!:(value:unknown)=>void,signal!:AbortSignal;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce((value:AbortSignal)=>{signal=value;return new Promise(resolve=>{finish=resolve;});});
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));await act(async()=>{await flush();});
    (getLiveServiceConfig as jest.Mock).mockRejectedValueOnce(new Error('Serviço desligado.'));
    await act(async()=>{await view.result.current.refreshConfig();finish({cameraReady:true});await flush();});
    expect(signal.aborted).toBe(true);expect(view.result.current.error).toBe('Serviço desligado.');expect(view.result.current.config).toBeNull();expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.checkingConfig).toBe(false);view.unmount();
});

test('a failed explicit connection remains visible after the automatic probe finishes',async()=>{
    let fail!:(reason:Error)=>void;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));await act(async()=>{await flush();});
    (createLiveRoom as jest.Mock).mockRejectedValueOnce(new Error('Não foi possível conectar a câmera.'));
    await act(async()=>{await view.result.current.start();fail(new Error('Serviço desligado.'));await flush();});
    expect(view.result.current.error).toBe('Não foi possível conectar a câmera.');expect(view.result.current.room).toBeNull();expect(view.result.current.busy).toBe(false);view.unmount();
});

test('failed and timed out checks have one error and no stale success',async()=>{
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));await act(async()=>{await flush();});
    (getLiveServiceConfig as jest.Mock).mockRejectedValueOnce(new Error('Serviço desligado.'));
    await act(async()=>{await view.result.current.refreshConfig();});
    expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.error).toBe('Serviço desligado.');expect(view.result.current.checkingConfig).toBe(false);
    let signal!:AbortSignal;(getLiveServiceConfig as jest.Mock).mockImplementationOnce((value:AbortSignal)=>{signal=value;return new Promise(()=>{});});
    let request!:Promise<void>;act(()=>{request=view.result.current.refreshConfig();});
    expect(view.result.current.checkingConfig).toBe(true);expect(view.result.current.error).toBe('');
    await act(async()=>{jest.advanceTimersByTime(6000);await request;});
    expect(signal.aborted).toBe(true);expect(view.result.current.error).toContain('demorou');expect(view.result.current.serviceCheck).toBeNull();expect(view.result.current.checkingConfig).toBe(false);view.unmount();
});

test('concurrent service checks cancel superseded work and unmount aborts a pending check',async()=>{
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));await act(async()=>{await flush();});
    let finish!:(value:unknown)=>void,oldSignal!:AbortSignal;
    (getLiveServiceConfig as jest.Mock).mockImplementationOnce((signal:AbortSignal)=>{oldSignal=signal;return new Promise(resolve=>{finish=resolve;});});
    let old!:Promise<void>;act(()=>{old=view.result.current.refreshConfig();});
    (getLiveServiceConfig as jest.Mock).mockResolvedValueOnce({cameraReady:true,cameraOrigin:'https://192.168.0.1:8097',hostOrigin:'http://localhost:8081',roomTtlMs:7200000});
    await act(async()=>{await view.result.current.refreshConfig();await old;finish({cameraReady:false});await flush();});
    expect(oldSignal.aborted).toBe(true);expect(view.result.current.serviceCheck).toContain('câmera pronta');expect(view.result.current.error).toBe('');
    const schedule=jest.spyOn(globalThis,'setTimeout'),clear=jest.spyOn(globalThis,'clearTimeout');
    let pendingSignal!:AbortSignal;(getLiveServiceConfig as jest.Mock).mockImplementationOnce((signal:AbortSignal)=>{pendingSignal=signal;return new Promise(()=>{});});
    let pending!:Promise<void>;act(()=>{pending=view.result.current.refreshConfig();});view.unmount();await pending;
    const timeoutIndex=schedule.mock.calls.findIndex(([,delay])=>delay===6000);
    expect(pendingSignal.aborted).toBe(true);expect(timeoutIndex).toBeGreaterThanOrEqual(0);expect(clear).toHaveBeenCalledWith(schedule.mock.results[timeoutIndex].value);
});

async function connected(recordingId:string|null='recording-1'){
    let once=false;(pollLiveSignals as jest.Mock).mockImplementation(async()=>once?{cursor:1,signals:[]}:(once=true,{cursor:1,signals:[{sequence:1,from:'camera',type:'offer',generation:1,sdp:'offer'}]}));
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));
    await act(async()=>{await flush();await view.result.current.start();await flush();});
    const dc={readyState:'open',bufferedAmount:0,send:jest.fn(),close:jest.fn(),onmessage:null as any,onopen:null as any,onclose:null as any};
    const node={srcObject:null as unknown,play:jest.fn(async()=>{}),addEventListener:jest.fn(),removeEventListener:jest.fn(),requestVideoFrameCallback:jest.fn((fn:any)=>{node.frame=fn;return 1;}),cancelVideoFrameCallback:jest.fn(),frame:null as any};
    act(()=>{view.result.current.attachVideo(node as unknown as HTMLVideoElement);Peer.last.ondatachannel({channel:dc});dc.onopen();});
    const emit=(value:unknown)=>dc.onmessage({data:JSON.stringify(value)});
    act(()=>emit({kind:'camera-status',roomId:room.roomId,state:'preview',controlsVersion:2}));
    if(recordingId)await act(async()=>{emit({kind:'recording',recordingId,startEpochMs:2000000,state:'recording',mimeType:'video/webm'});await flush();});
    await act(async()=>{jest.advanceTimersByTime(3000);await flush();});
    const ping=dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).find(message=>message.kind==='ping');
    act(()=>{emit({kind:'pong',id:ping.id,sentEpochMs:ping.sentEpochMs,cameraEpochMs:Date.now(),recordingId});emit({kind:'clock',recordingId,segmentId:'segment-1',startEpochMs:2000000,timeMs:Date.now()-2000000,senderEpochMs:Date.now(),recording:true});node.frame(0,{mediaTime:13});jest.advanceTimersByTime(500);});
    return{view,dc,emit,node};
}

test('the retained bridge captures fresh fractional camera time after preview frames stop',async()=>{
    const {view,emit}=await connected(),api=view.result.current.bridgeApi,initial=api.getCaptureStamp()!;
    expect(initial).toMatchObject({scope:{userId:'user',org:'org',classId:'class'},hostSessionId:view.result.current.session!.id,recordingId:'recording-1',segmentId:'segment-1',mode:'estimated',peerGeneration:1});
    await act(async()=>{jest.advanceTimersByTime(2100);await flush();emit({kind:'clock',recordingId:'recording-1',segmentId:'segment-1',startEpochMs:2000000,timeMs:Date.now()-2000000+0.375,senderEpochMs:Date.now(),recording:true});});
    expect(view.result.current.bridgeApi).toBe(api);expect(view.result.current.canMark).toBe(false);
    expect(api.getCaptureStamp()?.timeMs).toBe(Date.now()-2000000+0.375);
    expect(api.getSnapshot()).toMatchObject({hostSessionId:initial.hostSessionId,recordingId:'recording-1',blockedReason:null,connection:'connected'});
    act(()=>jest.advanceTimersByTime(3001));expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot().blockedReason).toBe('stale-clock');view.unmount();
});

test('capture bridge blocks commands, pause, resume gaps, disconnected peers and terminal sessions immediately',async()=>{
    const {view,emit,dc}=await connected(),api=view.result.current.bridgeApi;
    act(()=>{view.result.current.cameraCommand('pause-recording');expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot().blockedReason).toBe('pending-control');});
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'paused',mimeType:'video/webm',durationMs:13500});await flush();});
    expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot()).toMatchObject({recordingState:'paused',blockedReason:'paused',segmentId:'segment-1'});
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'recording',mimeType:'video/webm'});await flush();});
    expect(api.getCaptureStamp()).toBeNull();
    act(()=>emit({kind:'clock',recordingId:'recording-1',segmentId:'segment-2',startEpochMs:2000000,timeMs:Date.now()-2000000,activeSinceEpochMs:Date.now(),senderEpochMs:Date.now(),recording:true}));
    expect(api.getCaptureStamp()?.segmentId).toBe('segment-2');
    act(()=>{dc.readyState='closed';dc.onclose();expect(api.getCaptureStamp()).toBeNull();});
    expect(api.getSnapshot().blockedReason).toBe('disconnected');
    dc.readyState='open';act(()=>dc.onopen());
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:13500.625});await flush();});
    expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot()).toMatchObject({ended:true,durationMs:13500.625,blockedReason:'ended'});view.unmount();
    expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot()).toMatchObject({hostSessionId:null,recordingId:null,connection:'closed',blockedReason:'inactive'});
});

test('the bridge exposes the current received stream without placing media in its snapshot',async()=>{
    const {view,emit}=await connected(),api=view.result.current.bridgeApi,stream={} as MediaStream;
    Peer.last.getStats.mockResolvedValue(new Map([['video',{type:'inbound-rtp',kind:'video',jitterBufferDelay:2,jitterBufferEmittedCount:4}]]));
    await act(async()=>{Peer.last.ontrack({streams:[stream]});jest.advanceTimersByTime(3000);await flush();emit({kind:'clock',recordingId:'recording-1',segmentId:'segment-1',startEpochMs:2000000,timeMs:Date.now()-2000000,senderEpochMs:Date.now(),recording:true});});
    expect(api.getReplayCapture()).toMatchObject({stream,stamp:{recordingId:'recording-1'},playoutDelayMs:500});
    expect(api.getSnapshot()).not.toHaveProperty('stream');expect(api.getSnapshot()).not.toHaveProperty('hostToken');
    view.unmount();expect(api.getReplayCapture().stream).toBeNull();
});

test('the historical media loader reads only an ended ready tuple from its own scope',async()=>{
    const {view}=await connected(),api=view.result.current.bridgeApi,current=view.result.current.session!;
    const historical={...current,id:'historical-host',recordingId:'historical-recording',ended:true,recordingState:'stopped' as const};mockSaved.set(historical.id,historical);
    const reference={hostSessionId:historical.id,recordingId:historical.recordingId},blob=new Blob(['video'],{type:'video/mp4'});
    (loadVideoStatus as jest.Mock).mockResolvedValue({state:'ready'});(loadVideoBlob as jest.Mock).mockResolvedValue(blob);
    expect(await api.loadSavedVideo(reference)).toBe(blob);
    expect(loadVideoBlob).toHaveBeenCalledWith(current.scope,historical.id,historical.recordingId);
    expect(await api.loadSavedVideo({...reference,recordingId:'wrong'})).toBeNull();
    expect(await api.loadSavedVideo({hostSessionId:current.id,recordingId:current.recordingId})).toBeNull();
    (loadVideoStatus as jest.Mock).mockResolvedValue({state:'receiving'});expect(await api.loadSavedVideo(reference)).toBeNull();
    mockSaved.set(historical.id,{...historical,deletedAt:new Date().toISOString()});expect(await api.loadSavedVideo(reference)).toBeNull();view.unmount();
});

test.each(['deleted','unmounted'])('late original media is discarded after its owner is %s',async(change)=>{
    const {view}=await connected(),api=view.result.current.bridgeApi,current=view.result.current.session!;
    const historical={...current,id:'historical-host',recordingId:'historical-recording',ended:true,recordingState:'stopped' as const};mockSaved.set(historical.id,historical);
    const blob=new Blob(['video']);let finish!:(blob:Blob)=>void;
    (loadVideoStatus as jest.Mock).mockResolvedValue({state:'ready'});(loadVideoBlob as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const operation=api.loadSavedVideo({hostSessionId:historical.id,recordingId:historical.recordingId});await flush();
    if(change==='unmounted')view.unmount();else mockSaved.set(historical.id,{...historical,deletedAt:new Date().toISOString()});
    finish(blob);expect(await operation).toBeNull();if(change!=='unmounted')view.unmount();
});

test('media reads snapshot the requested identity before any await',async()=>{
    const {view}=await connected(),api=view.result.current.bridgeApi,current=view.result.current.session!;
    const original={...current,id:'original-host',recordingId:'original-recording',ended:true,recordingState:'stopped' as const};mockSaved.set(original.id,original);
    const other={...original,id:'other-host',recordingId:'other-recording'};mockSaved.set(other.id,other);
    const reference={hostSessionId:original.id,recordingId:original.recordingId},blob=new Blob(['original']);
    (loadVideoStatus as jest.Mock).mockResolvedValue({state:'ready'});(loadVideoBlob as jest.Mock).mockResolvedValue(blob);
    const operation=api.loadSavedVideo(reference);Object.assign(reference,{hostSessionId:other.id,recordingId:other.recordingId});
    expect(await operation).toBe(blob);expect(loadVideoBlob).toHaveBeenLastCalledWith(current.scope,original.id,original.recordingId);view.unmount();
});

test('a retained bridge becomes inactive immediately when its scope changes',async()=>{
    const view=renderHook(({org})=>useLiveHost({userId:'user',org,classId:'class'},'Sub19'),{initialProps:{org:'org'}});
    await act(async()=>{await flush();});const api=view.result.current.bridgeApi;
    await act(async()=>{view.rerender({org:'other'});await flush();});expect(api.getCaptureStamp()).toBeNull();expect(api.getSnapshot().blockedReason).toBe('inactive');
    expect(await api.loadSavedVideo({hostSessionId:'old-host',recordingId:'old-recording'})).toBeNull();view.unmount();
});

test('the first ready recording frame adds one scoped thumbnail without delaying markers',async()=>{
    const {view,node}=await connected();
    const capture=jest.spyOn(thumbnail,'captureLiveThumbnail').mockReturnValue('data:image/jpeg;base64,/9j/AAAA');
    Object.assign(node,{readyState:2,videoWidth:1920,videoHeight:1080});
    await act(async()=>{node.frame(0,{mediaTime:14});node.frame(0,{mediaTime:15});await flush();});
    expect(capture).toHaveBeenCalledTimes(1);
    expect(view.result.current.session?.thumbnailDataUrl).toBe('data:image/jpeg;base64,/9j/AAAA');
    expect(mockSaved.get(view.result.current.session!.id)?.thumbnailDataUrl).toBe('data:image/jpeg;base64,/9j/AAAA');
    await act(async()=>{await view.result.current.mark(true);});expect(view.result.current.session?.points).toHaveLength(1);
    view.unmount();
});

test('thumbnail capture failure is nonfatal and a late thumbnail write cannot republish a disconnected session',async()=>{
    const {view,node}=await connected();
    const capture=jest.spyOn(thumbnail,'captureLiveThumbnail').mockReturnValue(null);
    Object.assign(node,{readyState:2,videoWidth:1920,videoHeight:1080});
    await act(async()=>{node.frame(0,{mediaTime:14});node.frame(0,{mediaTime:15});await flush();await view.result.current.mark(true);});
    expect(capture).toHaveBeenCalledTimes(1);expect(view.result.current.error).toBe('');expect(view.result.current.session?.points).toHaveLength(1);view.unmount();
    const next=await connected('recording-2');capture.mockReturnValue('data:image/jpeg;base64,/9j/AAAA');
    Object.assign(next.node,{readyState:2,videoWidth:1920,videoHeight:1080});let finish!:()=>void;
    (saveLiveHostSession as jest.Mock).mockImplementationOnce(async(value,scope)=>{await new Promise<void>(resolve=>{finish=resolve;});mockSaved.set(value.id,parseLiveHostSession(value,scope));});
    await act(async()=>{next.node.frame(0,{mediaTime:14});await flush();});
    await act(async()=>{await next.view.result.current.disconnect();finish();await flush();});
    expect(next.view.result.current.connection).toBe('closed');expect(next.view.result.current.session?.thumbnailDataUrl).toBeUndefined();next.view.unmount();
});

test('actual capture settings are bounded and discarded when the camera turns off',async()=>{
    const capture={label:'Rear camera',width:1920,height:1080,frameRate:30,zoom:1};
    expect(parseLiveCaptureInfo({...capture,deviceId:'private'})).toEqual(capture);
    for(const changed of [{width:0},{height:Infinity},{frameRate:241},{zoom:101},{label:'x'.repeat(121)}])expect(parseLiveCaptureInfo({...capture,...changed})).toBeNull();
    const {view,emit}=await connected(null);
    act(()=>emit({kind:'camera-status',roomId:room.roomId,state:'preview',controlsVersion:2,capture}));expect(view.result.current.captureInfo).toEqual(capture);
    act(()=>emit({kind:'camera-status',roomId:room.roomId,state:'off',controlsVersion:2,capture}));expect(view.result.current.captureInfo).toBeNull();view.unmount();
});

test('review thumbnail updates saved history without replacing the active recording',async()=>{
    const {view,emit}=await connected();
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    const prior=view.result.current.session!;
    await act(async()=>{await view.result.current.newRecording();emit({kind:'camera-status',roomId:room.roomId,state:'preview',controlsVersion:2});await flush();});
    await act(async()=>{emit({kind:'recording',recordingId:'recording-2',startEpochMs:Date.now(),state:'recording',mimeType:'video/webm'});await flush();});
    const active=view.result.current.session!;
    let saved=false;await act(async()=>{saved=await view.result.current.saveSavedThumbnail(prior.id,prior.recordingId,'data:image/jpeg;base64,/9j/AAAA');});
    expect(saved).toBe(true);expect(view.result.current.session).toEqual(active);
    expect(view.result.current.history.find(item=>item.id===prior.id)?.thumbnailDataUrl).toBe('data:image/jpeg;base64,/9j/AAAA');
    expect(saveLiveHostThumbnail).toHaveBeenCalledWith({userId:'user',org:'org',classId:'class'},prior.id,prior.recordingId,'data:image/jpeg;base64,/9j/AAAA');view.unmount();
});
test.each([
    ['camera-hidden','Abra a aba da câmera no celular antes de iniciar.'],
    ['source-unavailable','A câmera ainda não está pronta. Confira a imagem no celular.'],
    ['untrusted-message','Não foi possível iniciar a gravação no celular. Confira a tela do aparelho.'],
])('remote start reports only the allowed source failure %s for its paired room',async(reason,message)=>{
    const {view,emit}=await connected(null);
    act(()=>view.result.current.startRecording());
    act(()=>emit({kind:'recording-start-error',roomId:'other',reason}));
    expect(view.result.current.startPending).toBe(true);
    act(()=>emit({kind:'recording-start-error',roomId:room.roomId,reason}));
    expect(view.result.current.startPending).toBe(false);expect(view.result.current.recording).toBeNull();expect(view.result.current.error).toBe(message);
    act(()=>emit({kind:'recording-start-error',roomId:room.roomId,reason:'camera-hidden'}));
    expect(view.result.current.error).toBe(message);view.unmount();
});

test('remote start sends once and waits for a real camera recording, with timeout and explicit failure',async()=>{
    const {view,dc,emit}=await connected(null);
    act(()=>{view.result.current.startRecording();view.result.current.startRecording();});
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).filter(message=>message.kind==='start-recording')).toEqual([{kind:'start-recording',roomId:room.roomId}]);
    expect(view.result.current.startPending).toBe(true);expect(view.result.current.recording).toBeNull();
    act(()=>emit({kind:'recording-start-error',roomId:'other'}));expect(view.result.current.startPending).toBe(true);
    act(()=>emit({kind:'recording-start-error',roomId:room.roomId}));expect(view.result.current.startPending).toBe(false);
    expect(view.result.current.error).toContain('Não foi possível iniciar');
    act(()=>view.result.current.startRecording());act(()=>jest.advanceTimersByTime(15000));
    expect(view.result.current.startPending).toBe(false);expect(view.result.current.recording).toBeNull();
    expect(view.result.current.error).toContain('não confirmou');
    act(()=>view.result.current.startRecording());
    await act(async()=>{emit({kind:'recording',recordingId:'new',startEpochMs:Date.now(),state:'recording',mimeType:'video/webm'});await flush();});
    expect(view.result.current.startPending).toBe(false);expect(view.result.current.recording?.state).toBe('recording');
    const count=dc.send.mock.calls.length;act(()=>view.result.current.startRecording());expect(dc.send.mock.calls).toHaveLength(count);
    view.unmount();
});

test('a fresh camera frame and calibrated recording clock are required before linking a point',async()=>{
    const {view,dc}=await connected();
    expect(view.result.current.canMark).toBe(true);
    await act(async()=>{await view.result.current.mark(true);});
    expect(view.result.current.session?.points).toHaveLength(1);
    expect(view.result.current.session?.points[0]).toMatchObject({recordingId:'recording-1',won:true,setNumber:1,scoreUs:1,scoreThem:0,clockMode:'estimated'});
    expect(view.result.current.pendingCopies).toBe(1);
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='point')).toBe(true);
    view.unmount();
});

test('a saved terminal recording requests a local video copy and its messages use the scoped receiver',async()=>{
    const {view,emit}=await connected();expect(mockVideos.bindVideoChannel).toHaveBeenCalledTimes(1);
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    expect(mockVideos.requestVideo).toHaveBeenCalledWith(expect.objectContaining({recordingId:'recording-1',ended:true}));
    act(()=>emit({kind:'video-offer',recordingId:'recording-1'}));expect(mockVideos.receiveVideoMessage).toHaveBeenCalledWith({kind:'video-offer',recordingId:'recording-1'});view.unmount();
});

test('remote stop waits for camera completion and cannot be sent twice or to a closed channel',async()=>{
    const {view,dc,emit}=await connected();
    act(()=>{view.result.current.stopRecording();view.result.current.stopRecording();});
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).filter(message=>message.kind==='stop-recording')).toEqual([{kind:'stop-recording',recordingId:'recording-1'}]);
    expect(view.result.current.stopPending).toBe(true);
    expect(view.result.current.session?.ended).toBe(false);
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.stopPending).toBe(false);
    expect(view.result.current.session).toMatchObject({ended:true,durationMs:14000});
    view.unmount();
    const offline=await connected('recording-2');offline.dc.readyState='closed';act(()=>{offline.dc.onclose();offline.view.result.current.stopRecording();});
    expect(offline.view.result.current.stopPending).toBe(false);
    expect(offline.view.result.current.error).toContain('Sem conexão');
    offline.view.unmount();
});

test('missing stop confirmation times out without claiming the video is saved',async()=>{
    const {view}=await connected();act(()=>view.result.current.stopRecording());
    act(()=>jest.advanceTimersByTime(30000));
    expect(view.result.current.stopPending).toBe(false);
    expect(view.result.current.error).toContain('não confirmou');
    expect(view.result.current.session?.ended).toBe(false);
    view.unmount();
});
test('host storage failure never confirms or sends a point and preserves the prior manifest',async()=>{
    const {view,dc}=await connected();
    (saveLiveHostSession as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    await act(async()=>{await view.result.current.mark(false);});
    expect(view.result.current.session?.points).toHaveLength(0);
    expect(view.result.current.error).toContain('Disk full');
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='point')).toBe(false);
    view.unmount();
});
test('stale frames block new points, and undo is separately committed and acknowledged by the camera',async()=>{
    const {view,dc,emit}=await connected();
    await act(async()=>{await view.result.current.mark(true);});
    const point=view.result.current.session!.points[0];
    await act(async()=>{emit({kind:'point-ack',id:point.id,recordingId:point.recordingId});await flush();});
    expect(view.result.current.pendingCopies).toBe(0);
    await act(async()=>{await view.result.current.undo();});
    expect(view.result.current.session?.points).toHaveLength(0);
    expect(view.result.current.pendingCopies).toBe(1);
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='undo-point')).toBe(true);
    act(()=>{jest.advanceTimersByTime(4000);});
    expect(view.result.current.canMark).toBe(false);
    const before=(saveLiveHostSession as jest.Mock).mock.calls.length;
    await act(async()=>{await view.result.current.mark(false);});
    expect(saveLiveHostSession).toHaveBeenCalledTimes(before);
    view.unmount();
});

test('offline undo is durable across reload and is replayed only to the same recording',async()=>{
    const first=await connected();
    await act(async()=>{await first.view.result.current.mark(true);});
    const point=first.view.result.current.session!.points[0];
    await act(async()=>{first.emit({kind:'point-ack',id:point.id,recordingId:point.recordingId});await flush();});
    first.dc.readyState='closed';act(()=>first.dc.onclose());
    await act(async()=>{await first.view.result.current.undo();});
    expect(first.view.result.current.session!.delivery!.pending).toEqual([{kind:'undo-point',id:point.id,recordingId:point.recordingId}]);
    const savedId=first.view.result.current.session!.id;first.view.unmount();
    const reopened=await connected();
    expect(reopened.view.result.current.session?.id).toBe(savedId);
    expect(reopened.view.result.current.session?.points).toEqual([]);
    expect(reopened.dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='undo-point'&&message.id===point.id)).toBe(true);
    await act(async()=>{reopened.emit({kind:'undo-point-ack',id:point.id,recordingId:point.recordingId});await flush();});
    expect(mockSaved.get(savedId)!.delivery).toMatchObject({pending:[],acknowledged:[{kind:'point',id:point.id},{kind:'undo-point',id:point.id}]});
    reopened.view.unmount();
    const afterAck=await connected();
    expect(afterAck.dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='undo-point')).toBe(false);
    afterAck.view.unmount();
});

test('pending point recovery never replays into a different recording',async()=>{
    const first=await connected();await act(async()=>{await first.view.result.current.mark(true);});
    const oldRecording=first.view.result.current.session!.recordingId;first.view.unmount();
    const second=await connected('recording-2');
    expect(second.view.result.current.session!.recordingId).not.toBe(oldRecording);
    expect(second.view.result.current.session!.points).toEqual([]);
    expect(second.dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='point'||message.kind==='undo-point')).toBe(false);
    second.view.unmount();
});

test('camera acknowledgement stays pending until the receipt commits on this notebook',async()=>{
    const {view,emit}=await connected();await act(async()=>{await view.result.current.mark(true);});
    const point=view.result.current.session!.points[0];let finish!:()=>void;
    (saveLiveHostSession as jest.Mock).mockImplementationOnce(async(value,scope)=>{await new Promise<void>(resolve=>{finish=resolve;});const parsed=parseLiveHostSession(value,scope);mockSaved.set(parsed.id,parsed);});
    await act(async()=>{emit({kind:'point-ack',id:point.id,recordingId:point.recordingId});await flush();});
    expect(view.result.current.pendingCopies).toBe(1);
    expect(mockSaved.get(view.result.current.session!.id)!.delivery!.pending).toHaveLength(1);
    await act(async()=>{finish();await flush();});
    expect(view.result.current.pendingCopies).toBe(0);
    expect(mockSaved.get(view.result.current.session!.id)!.delivery!.acknowledged).toEqual([{kind:'point',id:point.id}]);
    view.unmount();
});

test('recording stop queued during a point commit preserves both its marker and pending delivery',async()=>{
    const {view,emit}=await connected();let finish!:()=>void;
    (saveLiveHostSession as jest.Mock).mockImplementationOnce(async(value,scope)=>{await new Promise<void>(resolve=>{finish=resolve;});const parsed=parseLiveHostSession(value,scope);mockSaved.set(parsed.id,parsed);});
    let marked!:Promise<void>;
    await act(async()=>{marked=view.result.current.mark(true);await flush();emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    await act(async()=>{finish();await marked;await flush();});
    expect(view.result.current.session!.ended).toBe(true);
    expect(view.result.current.session!.points).toHaveLength(1);
    expect(view.result.current.session!.delivery!.pending).toHaveLength(1);
    view.unmount();
});

test.each(['stopped','error'] as const)('terminal %s retains final duration, stops linking and preserves all points while the preview remains',async state=>{
    const {view,emit,node}=await connected(),stream={} as MediaStream;act(()=>Peer.last.ontrack({streams:[stream]}));await act(async()=>{await view.result.current.mark(true);});
    const before=JSON.stringify(view.result.current.session!.points),sessionId=view.result.current.session!.id;
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state,mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.recording).toMatchObject({state,durationMs:14000});
    expect(view.result.current.session).toMatchObject({ended:true,durationMs:14000,recordingState:state});
    expect(mockSaved.get(sessionId)).toMatchObject({ended:true,durationMs:14000,recordingState:state});
    expect(view.result.current.canMark).toBe(false);expect(view.result.current.stamp).toBeNull();
    expect(view.result.current.stream).toBe(stream);
    const saves=(saveLiveHostSession as jest.Mock).mock.calls.length;
    act(()=>{emit({kind:'clock',recordingId:'recording-1',segmentId:'segment-1',startEpochMs:2000000,timeMs:15000,senderEpochMs:Date.now(),recording:true});node.frame(0,{});});
    await act(async()=>{await view.result.current.mark(false);await view.result.current.undo();await view.result.current.nextSet();});
    expect(saveLiveHostSession).toHaveBeenCalledTimes(saves);expect(JSON.stringify(view.result.current.session!.points)).toBe(before);
    expect(view.result.current.session!.setNumber).toBe(1);expect(view.result.current.canMark).toBe(false);
    if(state==='error')expect(view.result.current.error).toContain('falha na gravação');
    view.unmount();
});

test('camera storage errors block points immediately and foreign storage errors cannot stop this recording',async()=>{
    const {view,emit}=await connected();
    act(()=>emit({kind:'storage-error',recordingId:'foreign-recording'}));expect(view.result.current.canMark).toBe(true);
    act(()=>emit({kind:'storage-error',recordingId:'recording-1'}));
    expect(view.result.current.canMark).toBe(false);expect(view.result.current.recording?.state).toBe('error');
    const before=(saveLiveHostSession as jest.Mock).mock.calls.length;
    await act(async()=>{await view.result.current.mark(true);});expect(saveLiveHostSession).toHaveBeenCalledTimes(before);
    expect(view.result.current.session?.ended).toBe(false);view.unmount();
});

test('a closed saved recording can be removed and restored only after its connection and pending deliveries are clear',async()=>{
    const {view,emit,dc}=await connected();await act(async()=>{await view.result.current.mark(true);});
    const point=view.result.current.session!.points[0],id=view.result.current.session!.id;
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.canDeleteSession(view.result.current.session!)).toBe(false);
    await act(async()=>{expect(await view.result.current.deleteSaved(id,'recording-1')).toBe(false);});
    expect(deleteLiveHostSession).not.toHaveBeenCalled();
    await act(async()=>{emit({kind:'point-ack',id:point.id,recordingId:'recording-1'});await flush();});
    expect(view.result.current.canDeleteSession(view.result.current.session!)).toBe(false);
    await act(async()=>{await view.result.current.disconnect();});
    expect(view.result.current.canDeleteSession(view.result.current.session!)).toBe(true);
    await act(async()=>{expect(await view.result.current.deleteSaved(id,'foreign-recording')).toBe(false);});expect(deleteLiveHostSession).not.toHaveBeenCalled();
    const sent=dc.send.mock.calls.length;
    await act(async()=>{expect(await view.result.current.deleteSaved(id,'recording-1')).toBe(true);});
    expect(deleteLiveHostSession).toHaveBeenCalledWith({userId:'user',org:'org',classId:'class'},id,'recording-1');
    expect(view.result.current.session).toBeNull();expect(view.result.current.history).toEqual([]);expect(view.result.current.deleted?.points).toEqual([point]);
    await act(async()=>{expect(await view.result.current.restoreDeleted()).toBe(true);});
    expect(view.result.current.history[0].points).toEqual([point]);expect(view.result.current.deleted).toBeNull();
    expect(dc.send).toHaveBeenCalledTimes(sent);view.unmount();
});

test('deleting another ended manifest preserves the current peer and deletion failure keeps its records visible',async()=>{
    const old:LiveHostSession={version:1,id:'old-session',scope:{userId:'user',org:'org',classId:'class'},recordingId:'old-recording',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[],gaps:[],mimeType:'video/webm',ended:true,delivery:{pending:[],acknowledged:[]}};
    mockSaved.set(old.id,old);const {view,dc}=await connected();const current=view.result.current.session;
    (deleteLiveHostSession as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    await act(async()=>{expect(await view.result.current.deleteSaved(old.id,old.recordingId)).toBe(false);});
    expect(view.result.current.history.some(item=>item.id===old.id)).toBe(true);expect(view.result.current.error).toContain('Disk full');
    await act(async()=>{expect(await view.result.current.deleteSaved(old.id,old.recordingId)).toBe(true);});
    expect(view.result.current.session).toBe(current);expect(view.result.current.room).toEqual(room);expect(dc.close).not.toHaveBeenCalled();expect(Peer.last.close).not.toHaveBeenCalled();
    view.unmount();
});

test('an abandoned unfinished recording and its pending markers move to trash without affecting the current capture',async()=>{
    const first=await connected('abandoned-recording');await act(async()=>{await first.view.result.current.mark(true);});
    const old=first.view.result.current.session!;await act(async()=>{await first.view.result.current.disconnect();});first.view.unmount();
    const {view,dc}=await connected('current-recording'),current=view.result.current.session!,sent=dc.send.mock.calls.length;
    expect(view.result.current.canDeleteSession(current)).toBe(false);
    expect(view.result.current.canDeleteSession({...old,scope:{...old.scope,org:'foreign'}})).toBe(false);
    expect(view.result.current.canDeleteSession(old)).toBe(true);
    await act(async()=>{expect(await view.result.current.deleteSaved(old.id,old.recordingId)).toBe(true);});
    expect(deleteLiveHostSession).toHaveBeenLastCalledWith(old.scope,old.id,old.recordingId,{allowAbandoned:true});
    expect(view.result.current.deleted).toEqual({...old,deletedAt:expect.any(String)});
    expect(view.result.current.deleted?.ended).toBe(false);expect(view.result.current.deleted).not.toHaveProperty('recordingState');
    expect(view.result.current.session).toBe(current);expect(view.result.current.room).toEqual(room);expect(dc.close).not.toHaveBeenCalled();expect(Peer.last.close).not.toHaveBeenCalled();
    await act(async()=>{expect(await view.result.current.restoreDeleted()).toBe(true);});
    expect(view.result.current.history.find(item=>item.id===old.id)).toEqual(old);expect(view.result.current.session).toBe(current);
    expect(dc.send).toHaveBeenCalledTimes(sent);view.unmount();
});

test('an inactive historical entry is protected while its local video is receiving',async()=>{
    const old:LiveHostSession={version:1,id:'receiving-session',scope:{userId:'user',org:'org',classId:'class'},recordingId:'receiving-recording',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[],gaps:[],mimeType:'video/webm',ended:false,delivery:{pending:[],acknowledged:[]}};
    mockSaved.set(old.id,old);mockVideos.videoStatuses={[old.id]:{state:'receiving'}};
    const {view}=await connected();expect(view.result.current.canDeleteSession(old)).toBe(false);
    await act(async()=>{expect(await view.result.current.deleteSaved(old.id,old.recordingId)).toBe(false);});
    expect(deleteLiveHostSession).not.toHaveBeenCalled();expect(mockSaved.get(old.id)).toEqual(old);view.unmount();
});

test('a recording being archived cannot resume over the camera channel before its tombstone commits',async()=>{
    const old:LiveHostSession={version:1,id:'abandoned-session',scope:{userId:'user',org:'org',classId:'class'},recordingId:'abandoned-recording',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[],gaps:[],mimeType:'video/webm',ended:false,delivery:{pending:[],acknowledged:[]}};
    mockSaved.set(old.id,old);const {view,emit}=await connected(null);
    let finish!:(value:LiveHostSession)=>void;(deleteLiveHostSession as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    let deletion!:Promise<boolean>;await act(async()=>{deletion=view.result.current.deleteSaved(old.id,old.recordingId);await flush();});
    const writes=(saveLiveHostSession as jest.Mock).mock.calls.length;
    await act(async()=>{emit({kind:'recording',recordingId:old.recordingId,startEpochMs:Date.now(),state:'recording',mimeType:'video/webm'});await flush();});
    expect(view.result.current.session).toBeNull();expect(saveLiveHostSession).toHaveBeenCalledTimes(writes);
    await act(async()=>{finish({...old,deletedAt:new Date().toISOString()});expect(await deletion).toBe(true);});view.unmount();
});

test('the notebook trash survives remount and restores only its scoped recording',async()=>{
    const old:LiveHostSession={version:1,id:'trash-session',scope:{userId:'user',org:'org',classId:'class'},recordingId:'trash-recording',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[],gaps:[],mimeType:'video/webm',ended:true,delivery:{pending:[],acknowledged:[]}};
    mockSaved.set(old.id,old);const first=await connected();
    await act(async()=>{expect(await first.view.result.current.deleteSaved(old.id,old.recordingId)).toBe(true);});first.view.unmount();
    const reopened=await connected();expect(reopened.view.result.current.deleted?.id).toBe(old.id);
    expect(reopened.view.result.current.history.some(item=>item.id===old.id)).toBe(false);
    await act(async()=>{expect(await reopened.view.result.current.restoreDeleted()).toBe(true);});
    expect(restoreLiveHostSession).toHaveBeenLastCalledWith(old.scope,old.id,old.recordingId);
    expect(reopened.view.result.current.history.some(item=>item.id===old.id)).toBe(true);reopened.view.unmount();
});

test('reconnecting a trashed recording never creates an empty replacement or replays its saved points',async()=>{
    const first=await connected();await act(async()=>{await first.view.result.current.mark(true);});
    const original=first.view.result.current.session!,point=original.points[0];
    await act(async()=>{first.emit({kind:'point-ack',id:point.id,recordingId:point.recordingId});first.emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:14000});await flush();await first.view.result.current.disconnect();});
    await act(async()=>{expect(await first.view.result.current.deleteSaved(original.id,original.recordingId)).toBe(true);});first.view.unmount();
    const saves=(saveLiveHostSession as jest.Mock).mock.calls.length,reopened=await connected();
    expect(reopened.view.result.current.session).toBeNull();expect(reopened.view.result.current.canMark).toBe(false);
    expect(reopened.view.result.current.error).toContain('lixeira');expect(saveLiveHostSession).toHaveBeenCalledTimes(saves);
    expect(mockDeleted.get(original.id)?.points).toEqual([point]);expect(mockSaved.size).toBe(0);
    expect(reopened.dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='point')).toBe(false);
    reopened.view.unmount();
});

test('a failed final-state commit leaves earlier markers intact and terminal source still blocks every point command',async()=>{
    const {view,emit}=await connected();await act(async()=>{await view.result.current.mark(true);});
    const before=JSON.stringify(view.result.current.session!.points);
    (saveLiveHostSession as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.recording).toMatchObject({state:'stopped',durationMs:14000});expect(view.result.current.session?.ended).toBe(false);
    expect(view.result.current.error).toContain('Disk full');expect(view.result.current.canMark).toBe(false);
    const saves=(saveLiveHostSession as jest.Mock).mock.calls.length;
    await act(async()=>{await view.result.current.mark(false);await view.result.current.undo();await view.result.current.nextSet();});
    expect(saveLiveHostSession).toHaveBeenCalledTimes(saves);expect(JSON.stringify(view.result.current.session!.points)).toBe(before);
    expect(view.result.current.canDeleteSession(view.result.current.session!)).toBe(false);view.unmount();
});

test('data channel backpressure preserves the durable marker and retries after the buffer drains',async()=>{
    const {view,dc}=await connected();dc.bufferedAmount=256*1024;
    await act(async()=>{await view.result.current.mark(true);});
    const marker=()=>dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).filter(message=>message.kind==='point');
    expect(marker()).toHaveLength(0);
    expect(mockSaved.get(view.result.current.session!.id)!.delivery!.pending).toHaveLength(1);
    dc.bufferedAmount=0;
    await act(async()=>{jest.advanceTimersByTime(3000);await flush();});
    expect(marker()).toHaveLength(1);
    expect(view.result.current.pendingCopies).toBe(1);
    view.unmount();
});

test('a data channel send failure leaves its marker pending and does not stop clock synchronization',async()=>{
    const {view,dc}=await connected();dc.send.mockImplementationOnce(()=>{throw new Error('Data channel closed during send');});
    await act(async()=>{await view.result.current.mark(true);});
    expect(view.result.current.session!.points).toHaveLength(1);
    expect(view.result.current.pendingCopies).toBe(1);
    expect(view.result.current.error).toBe('');
    const before=dc.send.mock.calls.length;
    await act(async()=>{jest.advanceTimersByTime(3000);await flush();});
    expect(dc.send.mock.calls.slice(before).map(([raw])=>JSON.parse(raw)).map(message=>message.kind)).toEqual(['ping','point']);
    expect(mockSaved.get(view.result.current.session!.id)!.delivery!.pending).toHaveLength(1);
    view.unmount();
});

test('new recording reuses pairing, waits for camera preview and preserves previous records',async()=>{
    const {view,emit,dc}=await connected();
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm',durationMs:14000});await flush();});
    const saved=view.result.current.session!;
    await act(async()=>{await Promise.all([view.result.current.newRecording(),view.result.current.newRecording()]);});
    expect(createLiveRoom).toHaveBeenCalledTimes(1);expect(closeLiveRoom).not.toHaveBeenCalled();
    expect(view.result.current.session).toEqual(saved);
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).filter(message=>message.kind==='new-recording')).toEqual([{kind:'new-recording',roomId:room.roomId,recordingId:'recording-1'}]);
    await act(async()=>{
        emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});
        emit({kind:'camera-status',roomId:room.roomId,state:'preview',controlsVersion:2});await flush();
    });
    expect(view.result.current.session).toBeNull();expect(view.result.current.recording).toBeNull();
    expect(view.result.current.room).toEqual(room);expect(view.result.current.history).toContainEqual(saved);
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    expect(view.result.current.session).toBeNull();
    await act(async()=>{emit({kind:'recording',recordingId:'recording-2',startEpochMs:Date.now(),state:'recording',mimeType:'video/webm'});await flush();});
    expect(view.result.current.session?.recordingId).toBe('recording-2');expect(mockSaved.get(saved.id)).toEqual(saved);view.unmount();
});

test('phone request for new recording waits for host copies and a confirmed terminal state',async()=>{
    const {view,emit,dc}=await connected();await act(async()=>{await view.result.current.mark(true);});
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    act(()=>emit({kind:'new-recording-request',roomId:room.roomId,recordingId:'recording-1'}));
    expect(view.result.current.controlPending).toBeNull();
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='new-recording-blocked')).toBe(true);
    const point=view.result.current.session!.points[0];
    await act(async()=>{emit({kind:'point-ack',id:point.id,recordingId:point.recordingId});await flush();});
    act(()=>emit({kind:'new-recording-request',roomId:room.roomId,recordingId:'recording-1'}));
    expect(view.result.current.controlPending).toBe('new-recording');view.unmount();
});

test('camera command timeout keeps the prior session available and supports explicit failure/retry',async()=>{
    const {view,emit}=await connected();
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'stopped',mimeType:'video/webm'});await flush();});
    const saved=view.result.current.session!;await act(async()=>{await view.result.current.newRecording();});
    act(()=>jest.advanceTimersByTime(15000));expect(view.result.current.controlPending).toBeNull();
    expect(view.result.current.session).toEqual(saved);expect(view.result.current.error).toContain('não confirmou');
    await act(async()=>{await view.result.current.newRecording();});
    act(()=>emit({kind:'camera-control-error',roomId:room.roomId,command:'new-recording'}));
    expect(view.result.current.controlPending).toBeNull();expect(view.result.current.session).toEqual(saved);view.unmount();
});

test('pause and resume keep one session, block marks until fresh clocks and permit stop while paused',async()=>{
    const {view,emit,dc}=await connected();const id=view.result.current.session!.id;
    act(()=>view.result.current.cameraCommand('pause-recording'));
    expect(view.result.current.controlPending).toBe('pause-recording');expect(view.result.current.canMark).toBe(false);
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'paused',mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.session?.id).toBe(id);expect(view.result.current.session?.ended).toBe(false);expect(view.result.current.controlPending).toBeNull();
    await act(async()=>{await view.result.current.mark(true);});expect(view.result.current.session?.points).toHaveLength(0);
    act(()=>view.result.current.cameraCommand('resume-recording'));
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'recording',mimeType:'video/webm',durationMs:14000});await flush();});
    expect(view.result.current.canMark).toBe(false);expect(view.result.current.session?.id).toBe(id);
    await act(async()=>{emit({kind:'recording',recordingId:'recording-1',startEpochMs:2000000,state:'paused',mimeType:'video/webm',durationMs:14000});await flush();});
    act(()=>view.result.current.stopRecording());expect(view.result.current.stopPending).toBe(true);
    expect(dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).some(message=>message.kind==='stop-recording')).toBe(true);view.unmount();
});

test('camera power acknowledges status only from the current room and is blocked during capture',async()=>{
    const {view,emit,dc}=await connected(null);
    act(()=>view.result.current.cameraCommand('camera-off'));expect(view.result.current.controlPending).toBe('camera-off');
    act(()=>emit({kind:'camera-status',roomId:'other',state:'off',controlsVersion:2}));expect(view.result.current.controlPending).toBe('camera-off');
    act(()=>emit({kind:'camera-status',roomId:room.roomId,state:'off',controlsVersion:2}));expect(view.result.current.controlPending).toBeNull();
    act(()=>view.result.current.cameraCommand('camera-on'));
    act(()=>emit({kind:'camera-status',roomId:room.roomId,state:'preview',controlsVersion:2}));
    await act(async()=>{emit({kind:'recording',recordingId:'new',startEpochMs:Date.now(),state:'recording',mimeType:'video/webm'});await flush();});
    const before=dc.send.mock.calls.length;act(()=>view.result.current.cameraCommand('camera-off'));expect(dc.send.mock.calls).toHaveLength(before);view.unmount();
});

test('a room close failure preserves its peer and saved session until an explicit successful retry',async()=>{
    const {view,dc}=await connected();await act(async()=>{await view.result.current.mark(true);});
    const saved=view.result.current.session;
    (closeLiveRoom as jest.Mock).mockRejectedValueOnce(new Error('Não foi possível encerrar a conexão.'));
    let closed:boolean|undefined;
    await act(async()=>{closed=await view.result.current.disconnect();});
    expect(closed).toBe(false);expect(view.result.current.room).toEqual(room);expect(view.result.current.connection).toBe('connected');
    expect(dc.close).not.toHaveBeenCalled();expect(Peer.last.close).not.toHaveBeenCalled();expect(view.result.current.session).toBe(saved);
    expect(view.result.current.error).toContain('encerrar a conexão');
    await act(async()=>{closed=await view.result.current.disconnect();});
    expect(closed).toBe(true);expect(view.result.current.room).toBeNull();expect(dc.close).toHaveBeenCalledTimes(1);
    expect(view.result.current.session).toBe(saved);view.unmount();
});
