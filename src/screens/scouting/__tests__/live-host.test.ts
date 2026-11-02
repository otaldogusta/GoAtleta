import {act,renderHook} from '@testing-library/react-native';
import {useLiveHost} from '../live/use-live-host';
import {closeLiveRoom,createLiveRoom,pollLiveSignals} from '../live/live-api';
import {deleteLiveHostSession,loadLiveHostSessions,restoreLiveHostSession,saveLiveHostSession,parseLiveHostSession,type LiveHostSession} from '../live/live-storage';
const mockSaved=new Map<string,LiveHostSession>();
const mockDeleted=new Map<string,LiveHostSession>();
jest.mock('../live/live-api',()=>({getLiveServiceConfig:jest.fn(async()=>({cameraReady:false,cameraOrigin:null,hostOrigin:'http://localhost:8081',roomTtlMs:7200000})),createLiveRoom:jest.fn(),pollLiveSignals:jest.fn(),sendLiveSignal:jest.fn(async()=>({})),heartbeatLiveRoom:jest.fn(async()=>({})),closeLiveRoom:jest.fn(async()=>({}))}));
jest.mock('../live/live-storage',()=>({...jest.requireActual('../live/live-storage'),loadLiveHostSessions:jest.fn(async()=>[]),saveLiveHostSession:jest.fn(async()=>{}),deleteLiveHostSession:jest.fn(),restoreLiveHostSession:jest.fn()}));
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
    mockSaved.clear();mockDeleted.clear();
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>`point-${++mockSequence}`}});
    Object.defineProperty(globalThis,'RTCPeerConnection',{configurable:true,value:Peer});
    (createLiveRoom as jest.Mock).mockResolvedValue(room);let once=false;
    (pollLiveSignals as jest.Mock).mockImplementation(async()=>once?{cursor:1,signals:[]}:(once=true,{cursor:1,signals:[{sequence:1,from:'camera',type:'offer',generation:1,sdp:'offer'}]}));
    (loadLiveHostSessions as jest.Mock).mockImplementation(async(_scope,includeDeleted)=>[...mockSaved.values(),...(includeDeleted?[...mockDeleted.values()]:[])]);
    (saveLiveHostSession as jest.Mock).mockImplementation(async(value,scope)=>{const parsed=parseLiveHostSession(value,scope);mockSaved.set(parsed.id,parsed);});
    (deleteLiveHostSession as jest.Mock).mockImplementation(async(scope,id,recordingId)=>{const value=mockSaved.get(id);if(!value||value.recordingId!==recordingId||!value.ended||value.delivery?.pending.length)throw new Error('Protected recording');const removed=parseLiveHostSession({...value,deletedAt:new Date().toISOString()},scope);mockSaved.delete(id);mockDeleted.set(id,removed);return removed;});
    (restoreLiveHostSession as jest.Mock).mockImplementation(async(scope,id,recordingId)=>{const value=mockDeleted.get(id);if(!value||value.recordingId!==recordingId)throw new Error('Missing recording');const {deletedAt:_,...restored}=value;const clean=parseLiveHostSession(restored,scope);mockSaved.set(id,clean);mockDeleted.delete(id);return clean;});
});
afterEach(()=>{jest.useRealTimers();if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else Reflect.deleteProperty(globalThis,'crypto');if(originalPeer)Object.defineProperty(globalThis,'RTCPeerConnection',originalPeer);else Reflect.deleteProperty(globalThis,'RTCPeerConnection');});
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
async function connected(recordingId='recording-1'){
    let once=false;(pollLiveSignals as jest.Mock).mockImplementation(async()=>once?{cursor:1,signals:[]}:(once=true,{cursor:1,signals:[{sequence:1,from:'camera',type:'offer',generation:1,sdp:'offer'}]}));
    const view=renderHook(()=>useLiveHost({userId:'user',org:'org',classId:'class'},'Sub19'));
    await act(async()=>{await flush();await view.result.current.start();await flush();});
    const dc={readyState:'open',bufferedAmount:0,send:jest.fn(),close:jest.fn(),onmessage:null as any,onopen:null as any,onclose:null as any};
    const node={srcObject:null as unknown,play:jest.fn(async()=>{}),addEventListener:jest.fn(),removeEventListener:jest.fn(),requestVideoFrameCallback:jest.fn((fn:any)=>{node.frame=fn;return 1;}),cancelVideoFrameCallback:jest.fn(),frame:null as any};
    act(()=>{view.result.current.attachVideo(node as unknown as HTMLVideoElement);Peer.last.ondatachannel({channel:dc});dc.onopen();});
    const emit=(value:unknown)=>dc.onmessage({data:JSON.stringify(value)});
    await act(async()=>{emit({kind:'recording',recordingId,startEpochMs:2000000,state:'recording',mimeType:'video/webm'});await flush();});
    await act(async()=>{jest.advanceTimersByTime(3000);await flush();});
    const ping=dc.send.mock.calls.map(([raw])=>JSON.parse(raw)).find(message=>message.kind==='ping');
    act(()=>{emit({kind:'pong',id:ping.id,sentEpochMs:ping.sentEpochMs,cameraEpochMs:Date.now(),recordingId});emit({kind:'clock',recordingId,segmentId:'segment-1',startEpochMs:2000000,timeMs:Date.now()-2000000,senderEpochMs:Date.now(),recording:true});node.frame(0,{mediaTime:13});jest.advanceTimersByTime(500);});
    return{view,dc,emit,node};
}
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
