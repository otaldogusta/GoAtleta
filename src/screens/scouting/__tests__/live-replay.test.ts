import {Blob as NodeBlob} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {LiveReplayRecorder,loadLiveReplay,type LiveReplayState} from '../live/live-replay';
import {loadLiveHostSession} from '../live/live-storage';
import type {LiveHostBridgeApi,LiveTimelineClip} from '../live/live-scouting-contract';
import {createMemoryIdb} from './fixtures/memory-idb';

jest.mock('../live/live-storage',()=>({loadLiveHostSession:jest.fn()}));
const scope={userId:'user',org:'org',classId:'class'},reference={hostSessionId:'host-1',recordingId:'recording-1'};
const database='goatleta-scouting-live-replay-v1',LIMIT=4*1024*1024*1024;
const originals=new Map(['indexedDB','MediaRecorder','Blob','crypto'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
class Recorder{
    static instances:Recorder[]=[];static isTypeSupported=(mime:string)=>mime==='video/mp4';
    state='inactive';mimeType:string;onstart:any;onstop:any;onerror:any;ondataavailable:any;
    start=jest.fn((_slice:number)=>{this.state='recording';});
    stop=jest.fn(()=>{this.state='inactive';this.onstop?.();});requestData=jest.fn();
    constructor(public stream:MediaStream,options:{mimeType:string}){this.mimeType=options.mimeType;Recorder.instances.push(this);}
    started(){this.onstart?.();}
    chunk(text:string){this.ondataavailable?.({data:new Blob([text],{type:this.mimeType})});}
}
let memory:ReturnType<typeof createMemoryIdb>,mono:number;
const flush=async()=>{for(let n=0;n<150;n++)await Promise.resolve();};
const segments=()=>[...(memory.databases.get(database)?.get('segments')?.values()??[])];
beforeEach(()=>{
    memory=createMemoryIdb();mono=0;Recorder.instances=[];jest.clearAllMocks();
    for(const[name,value]of [['indexedDB',memory.factory],['MediaRecorder',Recorder],['Blob',NodeBlob],['crypto',webcrypto]] as const)Object.defineProperty(globalThis,name,{configurable:true,value});
    jest.spyOn(performance,'now').mockImplementation(()=>mono);
    (loadLiveHostSession as jest.Mock).mockImplementation(async(requested,hostId)=>hostId===reference.hostSessionId?{id:hostId,recordingId:reference.recordingId,scope:{...requested},ended:false}:null);
});
afterEach(()=>{jest.restoreAllMocks();for(const[name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}});
function context(){
    const track={stop:jest.fn()},stream={getTracks:()=>[track]} as unknown as MediaStream;
    const stamp={scope:{...scope},...reference,segmentId:'segment-1',epoch:1,peerGeneration:1,timeMs:10000.125,uncertaintyMs:500,mode:'estimated' as const};
    const snapshot={scope:{...scope},...reference,epoch:1,peerGeneration:1,segmentId:'segment-1',recordingState:'recording',cameraState:'recording',connection:'connected',blockedReason:null as string|null,ended:false,videoState:null};
    const capture={stream:stream as MediaStream|null,stamp:stamp as typeof stamp|null,snapshot,playoutDelayMs:200};
    const api={getReplayCapture:()=>capture} as LiveHostBridgeApi;
    const onState=jest.fn<void,[LiveReplayState]>(),replay=new LiveReplayRecorder(scope,()=>api,onState);
    return{capture,api,onState,replay,track,recorder:()=>Recorder.instances[Recorder.instances.length-1]};
}
async function started(){const value=context();value.replay.tick();value.recorder().started();await flush();return value;}

test('native one-second chunks anchor at onstart and produce a bounded support replay',async()=>{
    const c=context();c.replay.tick();expect(c.recorder().start).toHaveBeenCalledWith(1000);
    c.capture.stamp!.timeMs=10500.625;mono=250;c.recorder().started();await flush();
    mono=1250;c.recorder().chunk('first');await flush();mono=1750;c.recorder().chunk('last');await flush();c.replay.flush();
    expect(c.recorder().requestData).toHaveBeenCalledTimes(1);
    const media=await loadLiveReplay(scope,reference);
    expect(media).toMatchObject({offsetMs:10300.625,availableUntilMs:11800.625,original:false,uncertaintyMs:800});
    expect(await media!.blob.text()).toBe('firstlast');expect(media!.blob.type).toBe('video/mp4');
    c.replay.dispose();await flush();expect(c.track.stop).not.toHaveBeenCalled();expect([...memory.databases.keys()]).toEqual([database]);
});

test('stop freezes its timeline before delayed IndexedDB work completes',async()=>{
    const c=await started(),offset=segments()[0].offsetMs;memory.state.pauseWrites=true;
    mono=1000;c.recorder().chunk('prefix');await flush();mono=1500;c.replay.stop();
    mono=45000;memory.resumeWrites();await flush();
    expect(segments()[0]).toMatchObject({untilMs:offset+1500,stopped:true,bytes:6,parts:1});c.replay.dispose();
});

test.each(['pause','disconnect','segment','generation','epoch','stream'])('a %s transition closes the old recorder and splits the replay when valid',async(change)=>{
    const c=await started(),old=c.recorder();mono=1000;old.chunk('old');await flush();
    if(change==='pause'){c.capture.snapshot.recordingState='paused';c.capture.snapshot.blockedReason='paused';}
    if(change==='disconnect'){c.capture.snapshot.connection='disconnected';c.capture.snapshot.blockedReason='disconnected';}
    if(change==='segment'){c.capture.stamp!.segmentId='segment-2';c.capture.snapshot.segmentId='segment-2';}
    if(change==='generation'){c.capture.stamp!.peerGeneration=2;c.capture.snapshot.peerGeneration=2;}
    if(change==='epoch'){c.capture.stamp!.epoch=2;c.capture.snapshot.epoch=2;}
    if(change==='stream')c.capture.stream={} as MediaStream;
    mono=1500;c.replay.tick();await flush();expect(old.stop).toHaveBeenCalledTimes(1);expect(segments()[0].stopped).toBe(true);
    expect(Recorder.instances).toHaveLength(['pause','disconnect'].includes(change)?1:2);
    if(c.recorder()!==old)c.recorder().started();c.replay.dispose();await flush();expect(c.track.stop).not.toHaveBeenCalled();
});

test.each(['foreign-scope','stream','paused','disposed'])('onstart refuses a changed %s source before creating a segment',async(change)=>{
    const c=context();c.replay.tick();const old=c.recorder();
    if(change==='foreign-scope')c.capture.stamp!.scope.org='other';
    if(change==='stream')c.capture.stream={} as MediaStream;
    if(change==='paused'){c.capture.snapshot.recordingState='paused';c.capture.snapshot.blockedReason='paused';}
    if(change==='disposed')c.replay.dispose();
    old.started();await flush();expect(segments()).toHaveLength(0);expect(c.onState.mock.calls.some(([state])=>state.state==='recording')).toBe(false);c.replay.dispose();
});

test('old queued progress and failure cannot overwrite a newer recorder state',async()=>{
    const c=await started(),old=c.recorder();memory.state.pauseWrites=true;mono=1000;old.chunk('old');await flush();
    c.capture.stamp!.segmentId='segment-2';c.capture.snapshot.segmentId='segment-2';c.capture.stamp!.timeMs=15000;
    mono=1200;c.replay.tick();const current=c.recorder();current.started();
    expect(c.onState.mock.calls.at(-1)![0].state).toBe('recording');memory.resumeWrites();await flush();
    expect(c.onState.mock.calls.at(-1)![0].state).toBe('recording');old.onerror();await flush();expect(c.onState.mock.calls.at(-1)![0].state).toBe('recording');
    mono=2200;current.chunk('new');await flush();expect(segments().map(s=>s.bytes)).toEqual([3,3]);c.replay.dispose();await flush();
});

test.each(['quota','recorder'])('%s failure preserves the confirmed prefix and never restarts the failed source on every tick',async(failure)=>{
    const c=await started();mono=1000;c.recorder().chunk('confirmed');await flush();
    if(failure==='quota'){
        memory.state.failWrite=(_database,store)=>{if(store!=='parts')return null;const error=new Error('Quota exceeded');error.name='QuotaExceededError';return error;};
        mono=2000;c.recorder().chunk('failed');await flush();
    }else c.recorder().onerror();
    expect(c.onState.mock.calls.at(-1)![0].state).toBe('error');
    c.replay.tick();c.replay.tick();expect(Recorder.instances).toHaveLength(1);
    expect(await (await loadLiveReplay(scope,reference))!.blob.text()).toBe('confirmed');expect(c.track.stop).not.toHaveBeenCalled();
    expect([...memory.databases.keys()]).toEqual([database]);c.replay.dispose();await flush();
});

test('the 4 GiB budget includes earlier segments of the same recording',async()=>{
    const c=await started();mono=1000;c.recorder().chunk('a');await flush();c.replay.stop();await flush();
    const first=segments()[0];first.bytes=LIMIT;
    c.capture.stamp!.segmentId='segment-2';c.capture.snapshot.segmentId='segment-2';c.replay.tick();c.recorder().started();await flush();
    mono=2000;c.recorder().chunk('b');await flush();
    expect(c.onState.mock.calls.at(-1)![0]).toMatchObject({state:'error',message:expect.stringContaining('limite local')});
    expect(segments().map(s=>s.bytes)).toEqual([LIMIT,0]);expect(memory.databases.get(database)!.get('parts')!.size).toBe(1);c.replay.dispose();
});

test('replay loads fail closed for foreign scope, clip identity, incomplete parts and a host tombstone',async()=>{
    const c=await started();mono=1000;c.recorder().chunk('safe');await flush();
    expect(await loadLiveReplay({...scope,org:'other'},reference)).toBeNull();
    expect(await loadLiveReplay(scope,reference,{...reference,recordingId:'foreign',startMs:0,endMs:30000} as LiveTimelineClip)).toBeNull();
    (loadLiveHostSession as jest.Mock).mockResolvedValue({id:reference.hostSessionId,scope,recordingId:reference.recordingId,deletedAt:'2026-11-04T00:00:00Z'});
    expect(await loadLiveReplay(scope,reference)).toBeNull();
    (loadLiveHostSession as jest.Mock).mockResolvedValue({id:reference.hostSessionId,scope,recordingId:reference.recordingId});
    memory.databases.get(database)!.get('parts')!.clear();await expect(loadLiveReplay(scope,reference)).rejects.toThrow('incompleto');c.replay.dispose();await flush();
});

test('a tombstone committed during the replay read discards the blob',async()=>{
    const c=await started();mono=1000;c.recorder().chunk('safe');await flush();
    memory.state.beforeRead=(_db,store)=>{if(store==='parts')(loadLiveHostSession as jest.Mock).mockResolvedValue({id:reference.hostSessionId,scope,recordingId:reference.recordingId,deletedAt:'2026-11-04T00:00:00Z'});};
    expect(await loadLiveReplay(scope,reference)).toBeNull();c.replay.dispose();await flush();
});

test.each(['key','time','bytes','mime'])('corrupt %s metadata cannot load another or invalid replay',async(field)=>{
    const c=await started();mono=1000;c.recorder().chunk('safe');await flush();const saved=segments()[0];
    if(field==='key')saved.key=JSON.stringify(['other-user',scope.org,scope.classId,reference.hostSessionId,reference.recordingId,'fake']);
    if(field==='time')saved.untilMs=Infinity;if(field==='bytes')saved.bytes=LIMIT+1;if(field==='mime')saved.mimeType='text/html';
    expect(await loadLiveReplay(scope,reference)).toBeNull();c.replay.dispose();await flush();
});

test('replay reads freeze their requested scope and tuple before asynchronous storage',async()=>{
    const c=await started();mono=1000;c.recorder().chunk('safe');await flush();
    const requestedScope={...scope},requestedReference={...reference},operation=loadLiveReplay(requestedScope,requestedReference);
    requestedScope.org='other';requestedReference.recordingId='other-recording';
    expect(await (await operation)!.blob.text()).toBe('safe');c.replay.dispose();await flush();
});

test('clip overlap selects an available segment without claiming the phone original quality',async()=>{
    const c=await started();mono=1000;c.recorder().chunk('one');await flush();
    c.capture.stamp!.segmentId='segment-2';c.capture.snapshot.segmentId='segment-2';c.capture.stamp!.timeMs=20000;c.replay.tick();c.recorder().started();await flush();
    mono=2500;c.recorder().chunk('two');await flush();
    const media=await loadLiveReplay(scope,reference,{...reference,startMs:19800,endMs:21000} as LiveTimelineClip);
    expect(media).toMatchObject({offsetMs:19800,original:false,availableUntilMs:21300});expect(await media!.blob.text()).toBe('two');
    expect(await loadLiveReplay(scope,reference,{...reference,startMs:30000,endMs:31000} as LiveTimelineClip)).toBeNull();c.replay.dispose();await flush();
});

test('dispose suppresses late state callbacks while preserving final local writes',async()=>{
    const c=await started();memory.state.pauseWrites=true;mono=1000;c.recorder().chunk('safe');await flush();
    c.replay.dispose();const count=c.onState.mock.calls.length;mono=10000;memory.resumeWrites();await flush();
    expect(c.onState).toHaveBeenCalledTimes(count);expect(segments()[0]).toMatchObject({bytes:4,stopped:true});expect(c.track.stop).not.toHaveBeenCalled();
});
