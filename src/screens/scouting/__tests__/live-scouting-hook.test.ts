import {act,renderHook} from '@testing-library/react-native';
import {useLiveScouting} from '../live/use-live-scouting';
import {loadLiveHostSession,type LiveHostScope} from '../live/live-storage';
import {loadVideoBlob,loadVideoStatus} from '../live/live-video-storage';
import {applyLiveScoutingEvent,loadLiveScoutingTimeline,type LiveScoutingTimeline} from '../live/live-scouting-storage';
import {loadLiveReplay} from '../live/live-replay';
import type {CaptureAppliedEvent,LiveHostBridgeApi,LiveHostSnapshot,LiveReplayMedia,LiveTimelineClip} from '../live/live-scouting-contract';
import type {LiveCaptureStamp} from '../../../core/scouting-live';

type MockRecorder={scope:LiveHostScope;api:()=>LiveHostBridgeApi|null;state:(value:{state:string;message:string;revision:number})=>void;tick:jest.Mock;flush:jest.Mock;dispose:jest.Mock};
const mockRecorders:MockRecorder[]=[];
let mockAuth={userId:'user',generation:1};
jest.mock('../../../auth/session',()=>({getSessionIdentity:()=>({...mockAuth}),assertSessionIdentity:(identity:typeof mockAuth)=>{if(identity.userId!==mockAuth.userId||identity.generation!==mockAuth.generation)throw new Error('Auth changed');}}));
jest.mock('../live/live-storage',()=>({loadLiveHostSession:jest.fn()}));
jest.mock('../live/live-video-storage',()=>({loadVideoBlob:jest.fn(),loadVideoStatus:jest.fn()}));
jest.mock('../live/live-scouting-storage',()=>({
    loadLiveScoutingTimeline:jest.fn(),applyLiveScoutingEvent:jest.fn(),
    timelineRecordings:(timeline:LiveScoutingTimeline)=>timeline.clips.length?[{analysisSessionId:timeline.analysisSessionId,hostSessionId:timeline.clips[0].hostSessionId,recordingId:timeline.clips[0].recordingId,clips:timeline.clips,updatedAt:'2026-11-04T12:00:00Z'}]:[],
}));
jest.mock('../live/live-replay',()=>({loadLiveReplay:jest.fn(),LiveReplayRecorder:jest.fn().mockImplementation((scope:LiveHostScope,api:()=>LiveHostBridgeApi|null,state:MockRecorder['state'])=>{
    const recorder={scope,api,state,tick:jest.fn(),flush:jest.fn(),dispose:jest.fn()};mockRecorders.push(recorder);return recorder;
})}));
const scope={userId:'user',org:'org',classId:'class'},reference={hostSessionId:'host-1',recordingId:'recording-1'};
const timeline=(analysisSessionId='analysis-A',revision=0,clips:LiveTimelineClip[]=[]):LiveScoutingTimeline=>({version:1,scope:{...scope},analysisSessionId,revision,clips,receipts:[]});
const clip={...reference,id:'clip-1',analysisSessionId:'analysis-A',active:true} as LiveTimelineClip;
const manifest={id:reference.hostSessionId,scope,recordingId:reference.recordingId,ended:true,recordingState:'stopped',durationMs:20000};
const stamp:LiveCaptureStamp={scope,...reference,segmentId:'segment-1',epoch:1,peerGeneration:1,timeMs:12500.625,uncertaintyMs:500,mode:'estimated'};
const snapshot=(patch:Partial<LiveHostSnapshot>={}):LiveHostSnapshot=>({scope,...reference,segmentId:'segment-1',epoch:1,peerGeneration:1,recordingState:'recording',cameraState:'recording',connection:'connected',blockedReason:null,ended:false,videoState:null,...patch});
const event=(sessionId='analysis-A'):CaptureAppliedEvent=>({userId:'user',org:'org',sessionId,pending:{requestId:'confirmed-request',revision:1,command:{name:'point',payload:{contacts:[],winner:'us'}}},before:{},saved:{},timing:{contacts:[],pointStamp:stamp}} as CaptureAppliedEvent);
function api(){
    const getSnapshot=jest.fn(()=>snapshot()),getCaptureStamp=jest.fn(()=>stamp);
    return {getSnapshot,getCaptureStamp,loadSavedVideo:jest.fn(async()=>null),getReplayCapture:()=>({stream:null,stamp:getCaptureStamp(),snapshot:getSnapshot(),playoutDelayMs:0})} satisfies LiveHostBridgeApi;
}
const flush=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Props={scope:LiveHostScope;analysisSessionId:string;enabled:boolean};
const initial:Props={scope,analysisSessionId:'analysis-A',enabled:true};
async function mount(props:Props=initial){const view=renderHook((value:Props)=>useLiveScouting(value.scope,value.analysisSessionId,value.enabled),{initialProps:props});await act(flush);return view;}
beforeEach(()=>{
    jest.useFakeTimers();jest.clearAllMocks();mockAuth={userId:'user',generation:1};mockRecorders.length=0;
    (loadLiveScoutingTimeline as jest.Mock).mockImplementation(async(_scope,id)=>timeline(id));
    (applyLiveScoutingEvent as jest.Mock).mockResolvedValue({timeline:timeline('analysis-A',1,[clip])});
    (loadLiveHostSession as jest.Mock).mockResolvedValue(manifest);(loadVideoStatus as jest.Mock).mockResolvedValue({state:'ready'});
    (loadVideoBlob as jest.Mock).mockResolvedValue(new Blob(['original'],{type:'video/mp4'}));
    (loadLiveReplay as jest.Mock).mockResolvedValue({blob:new Blob(['dvr'],{type:'video/webm'}),offsetMs:10000,availableUntilMs:18000,original:false,uncertaintyMs:800});
});
afterEach(()=>{jest.useRealTimers();});

test('status distinguishes a prepared camera, camera off and paused capture from missing pairing',async()=>{
    const view=await mount();expect(view.result.current.status).toBe('Conecte a câmera para registrar lances com vídeo');
    act(()=>view.result.current.onHostSnapshot(snapshot({hostSessionId:null,recordingId:null,recordingState:null,cameraState:'preview'})));
    expect(view.result.current.status).toBe('Câmera pronta · inicie a gravação');
    act(()=>view.result.current.onHostSnapshot(snapshot({hostSessionId:null,recordingId:null,recordingState:null,cameraState:'off'})));
    expect(view.result.current.status).toBe('Ligue a câmera para gravar lances com vídeo');
    act(()=>view.result.current.onHostSnapshot(snapshot({recordingState:'paused',cameraState:'paused',blockedReason:'paused'})));
    expect(view.result.current.status).toBe('Gravação pausada · continue na Câmera');view.unmount();
});

test('capture bridge reads the fresh host API, rejects foreign scope and clears when detached',async()=>{
    const view=await mount(),host=api(),bridge=view.result.current.captureBridge;
    expect(bridge.captureStamp()).toBeNull();expect(bridge.captureReference?.()).toBeNull();
    act(()=>view.result.current.onHostApi(host));expect(bridge.captureStamp()).toEqual(stamp);expect(bridge.captureReference?.()).toEqual(reference);
    host.getCaptureStamp.mockReturnValue({...stamp,timeMs:14000.875});expect(bridge.captureStamp()?.timeMs).toBe(14000.875);
    const foreign=api();foreign.getSnapshot.mockReturnValue(snapshot({scope:{...scope,org:'foreign'}}));
    act(()=>view.result.current.onHostApi(foreign));expect(bridge.captureStamp()?.timeMs).toBe(14000.875);
    host.getCaptureStamp.mockReturnValue({...stamp,scope:{...scope,userId:'foreign'}});expect(bridge.captureStamp()).toBeNull();
    host.getSnapshot.mockReturnValue(snapshot({ended:true}));expect(bridge.captureReference?.()).toBeNull();
    act(()=>view.result.current.onHostApi(null));expect(bridge.captureStamp()).toBeNull();expect(view.result.current.snapshot).toBeNull();view.unmount();expect(bridge.captureStamp()).toBeNull();
});

test('enabled mount ticks and disposes its recorder without re-creating it when only the analysis changes',async()=>{
    const view=await mount(),host=api(),recorder=mockRecorders[0];expect(recorder.tick).toHaveBeenCalledTimes(1);
    act(()=>view.result.current.onHostApi(host));expect(recorder.api()).toBe(host);
    act(()=>{jest.advanceTimersByTime(1500);});expect(recorder.tick).toHaveBeenCalledTimes(5);
    await act(async()=>{view.rerender({...initial,analysisSessionId:'analysis-B'});await flush();});expect(mockRecorders).toHaveLength(1);
    await act(async()=>{view.rerender({...initial,enabled:false});await flush();});expect(recorder.dispose).toHaveBeenCalledTimes(1);expect(view.result.current.captureBridge.captureStamp()).toBeNull();
    const calls=recorder.tick.mock.calls.length;act(()=>jest.advanceTimersByTime(1000));expect(recorder.tick).toHaveBeenCalledTimes(calls);view.unmount();expect(recorder.dispose).toHaveBeenCalledTimes(1);
});

test('only matching host snapshots affect synchronization and the current live recording list',async()=>{
    const view=await mount(),host=api();act(()=>view.result.current.onHostApi(host));
    expect(view.result.current.recordings).toEqual([expect.objectContaining({...reference,analysisSessionId:'analysis-A',clips:[]})]);
    act(()=>mockRecorders[0].state({state:'recording',message:'Replay active',revision:2}));expect(view.result.current.synchronized).toBe(true);expect(view.result.current.revision).toBe(2);
    act(()=>view.result.current.onHostSnapshot(snapshot({scope:{...scope,classId:'foreign'},ended:true})));
    expect(view.result.current.snapshot?.ended).toBe(false);
    act(()=>view.result.current.onHostSnapshot(snapshot({blockedReason:'paused',recordingState:'paused'})));expect(view.result.current.synchronized).toBe(false);expect(mockRecorders[0].tick).toHaveBeenCalledTimes(3);view.unmount();
});

test('confirmed collection events project the local timeline, recover timing and flush DVR chunks',async()=>{
    const view=await mount(),input=event(),recoveredTiming={contacts:[],pointStamp:stamp};
    (applyLiveScoutingEvent as jest.Mock).mockResolvedValueOnce({timeline:timeline('analysis-A',3,[clip]),recoveredTiming});
    let result:unknown;await act(async()=>{result=await view.result.current.captureBridge.applied(input);});
    expect(applyLiveScoutingEvent).toHaveBeenCalledWith(scope,input);expect(result).toEqual({recoveredTiming});
    expect(view.result.current.recordings[0].clips).toEqual([clip]);expect(view.result.current.revision).toBe(3);expect(mockRecorders[0].flush).toHaveBeenCalledTimes(1);
    (applyLiveScoutingEvent as jest.Mock).mockRejectedValueOnce(new Error('Quota'));
    await act(async()=>{await expect(view.result.current.captureBridge.applied(input)).rejects.toThrow('Quota');});
    expect(view.result.current.error).toBe('O scouting foi salvo. Tente sincronizar os lances novamente.');expect(mockRecorders[0].flush).toHaveBeenCalledTimes(1);expect(view.result.current.recordings[0].clips).toEqual([clip]);view.unmount();
});

test('wrong analysis or changed account never applies a new projection',async()=>{
    const view=await mount();await expect(view.result.current.captureBridge.applied(event('other'))).rejects.toThrow('análise mudou');
    mockAuth={userId:'other',generation:2};await expect(view.result.current.captureBridge.applied(event())).rejects.toThrow('conta mudou');
    expect(applyLiveScoutingEvent).not.toHaveBeenCalled();view.unmount();
});

test('late application from A cannot update a new A after visiting B',async()=>{
    const view=await mount(),pending=deferred<{timeline:LiveScoutingTimeline}>();(applyLiveScoutingEvent as jest.Mock).mockReturnValueOnce(pending.promise);
    let operation!:Promise<unknown>;act(()=>{operation=view.result.current.captureBridge.applied(event());});
    await act(async()=>{view.rerender({...initial,analysisSessionId:'analysis-B'});await flush();});
    await act(async()=>{view.rerender(initial);await flush();});
    await act(async()=>{pending.resolve({timeline:timeline('analysis-A',99,[clip])});await operation;});
    expect(view.result.current.recordings).toEqual([]);expect(view.result.current.revision).toBe(0);expect(mockRecorders[0].flush).not.toHaveBeenCalled();view.unmount();
});

test('late failed application from A cannot set an error on a new A after B',async()=>{
    const view=await mount(),pending=deferred<{timeline:LiveScoutingTimeline}>();(applyLiveScoutingEvent as jest.Mock).mockReturnValueOnce(pending.promise);
    let operation!:Promise<unknown>;act(()=>{operation=view.result.current.captureBridge.applied(event());});
    const assertion=expect(operation).rejects.toThrow('Old quota');
    await act(async()=>{view.rerender({...initial,analysisSessionId:'analysis-B'});await flush();});await act(async()=>{view.rerender(initial);await flush();});
    await act(async()=>{pending.reject(new Error('Old quota'));await assertion;});
    expect(view.result.current.error).toBe('');expect(mockRecorders[0].flush).not.toHaveBeenCalled();view.unmount();
});

test('account change while a projection commits rejects without publishing its timeline or flushing DVR',async()=>{
    const view=await mount(),pending=deferred<{timeline:LiveScoutingTimeline}>();(applyLiveScoutingEvent as jest.Mock).mockReturnValueOnce(pending.promise);
    let operation!:Promise<unknown>;act(()=>{operation=view.result.current.captureBridge.applied(event());});
    await act(async()=>{mockAuth={userId:'other',generation:2};pending.resolve({timeline:timeline('analysis-A',5,[clip])});await expect(operation).rejects.toThrow('Auth changed');});
    expect(view.result.current.recordings).toEqual([]);expect(mockRecorders[0].flush).not.toHaveBeenCalled();view.unmount();
});

test('late initial timeline reads from A cannot replace the new A after B',async()=>{
    const pending=deferred<LiveScoutingTimeline>();(loadLiveScoutingTimeline as jest.Mock).mockReturnValueOnce(pending.promise);
    const view=await mount();await act(async()=>{view.rerender({...initial,analysisSessionId:'analysis-B'});await flush();});
    await act(async()=>{view.rerender(initial);await flush();pending.resolve(timeline('analysis-A',88,[clip]));await flush();});
    expect(view.result.current.recordings).toEqual([]);expect(view.result.current.revision).toBe(0);view.unmount();
});

test('ready original media takes priority over DVR while an in-progress or partial recording uses DVR',async()=>{
    const view=await mount();const media=await view.result.current.loadMedia(reference);
    expect(media).toMatchObject({original:true,offsetMs:0,availableUntilMs:20000,uncertaintyMs:0});expect(loadVideoBlob).toHaveBeenCalledWith(scope,reference.hostSessionId,reference.recordingId);expect(loadLiveReplay).not.toHaveBeenCalled();
    (loadLiveHostSession as jest.Mock).mockResolvedValue({...manifest,ended:false});
    expect(await view.result.current.loadMedia(reference,clip)).toMatchObject({original:false,offsetMs:10000});expect(loadLiveReplay).toHaveBeenLastCalledWith(scope,reference,clip);
    (loadLiveHostSession as jest.Mock).mockResolvedValue(manifest);(loadVideoStatus as jest.Mock).mockResolvedValue({state:'receiving'});
    expect(await view.result.current.loadMedia(reference)).toMatchObject({original:false});view.unmount();
});

test('missing, foreign-recording and deleted manifests never expose original or DVR bytes',async()=>{
    const view=await mount();for(const value of [null,{...manifest,recordingId:'foreign'},{...manifest,deletedAt:'2026-11-04T00:00:00Z'}]){
        (loadLiveHostSession as jest.Mock).mockResolvedValueOnce(value);expect(await view.result.current.loadMedia(reference)).toBeNull();
    }
    expect(loadVideoBlob).not.toHaveBeenCalled();expect(loadLiveReplay).not.toHaveBeenCalled();view.unmount();
});

test('a host tombstone committed after media loading discards the result',async()=>{
    const view=await mount();(loadLiveHostSession as jest.Mock).mockResolvedValueOnce(manifest).mockResolvedValueOnce({...manifest,deletedAt:'2026-11-04T00:00:00Z'});
    expect(await view.result.current.loadMedia(reference)).toBeNull();view.unmount();
});

test('media loading snapshots the requested tuple before asynchronous reads',async()=>{
    const view=await mount(),requested={...reference},operation=view.result.current.loadMedia(requested);
    requested.recordingId='mutated-recording';requested.hostSessionId='mutated-host';
    expect(await operation).toMatchObject({original:true});expect(loadVideoBlob).toHaveBeenCalledWith(scope,reference.hostSessionId,reference.recordingId);view.unmount();
});

test('disabled integration does not mount DVR or load a timeline and its capture API stays empty',async()=>{
    const view=await mount({...initial,enabled:false});act(()=>view.result.current.onHostApi(api()));
    expect(mockRecorders).toHaveLength(0);expect(loadLiveScoutingTimeline).not.toHaveBeenCalled();
    expect(view.result.current.captureBridge.captureStamp()).toBeNull();expect(view.result.current.captureBridge.captureReference?.()).toBeNull();
    await expect(view.result.current.captureBridge.applied(event())).rejects.toThrow('análise mudou');expect(applyLiveScoutingEvent).not.toHaveBeenCalled();view.unmount();
});

test.each(['original','dvr'])('a stale %s load from A returns null after the analysis moves A to B to A',async(kind)=>{
    const pending=deferred<Blob|LiveReplayMedia|null>(),view=await mount();
    if(kind==='original')(loadVideoBlob as jest.Mock).mockReturnValueOnce(pending.promise);
    else{(loadVideoStatus as jest.Mock).mockResolvedValue({state:'receiving'});(loadLiveReplay as jest.Mock).mockReturnValueOnce(pending.promise);}
    const operation=view.result.current.loadMedia(reference);await flush();
    await act(async()=>{view.rerender({...initial,analysisSessionId:'analysis-B'});await flush();});await act(async()=>{view.rerender(initial);await flush();});
    pending.resolve(kind==='original'?new Blob(['old']):{blob:new Blob(['old']),offsetMs:0,availableUntilMs:1,original:false,uncertaintyMs:500});
    expect(await operation).toBeNull();view.unmount();
});

test('account change while original bytes load rejects the stale result',async()=>{
    const pending=deferred<Blob|null>(),view=await mount();(loadVideoBlob as jest.Mock).mockReturnValueOnce(pending.promise);
    const operation=view.result.current.loadMedia(reference);await flush();mockAuth={userId:'other',generation:2};pending.resolve(new Blob(['old']));
    await expect(operation).rejects.toThrow('Auth changed');view.unmount();
});

test('account change during the final manifest read cannot return old-account media',async()=>{
    const pending=deferred<typeof manifest|null>(),view=await mount();(loadLiveHostSession as jest.Mock).mockResolvedValueOnce(manifest).mockReturnValueOnce(pending.promise);
    const operation=view.result.current.loadMedia(reference);await flush();mockAuth={userId:'other',generation:2};pending.resolve(manifest);
    await expect(operation).rejects.toThrow('Auth changed');view.unmount();
});

test('scope changes clear the previous host reference before the new organization supplies an API',async()=>{
    const view=await mount();act(()=>view.result.current.onHostApi(api()));expect(view.result.current.recordings).toHaveLength(1);
    await act(async()=>{view.rerender({...initial,scope:{...scope,org:'other-org'}});await flush();});
    expect(view.result.current.snapshot).toBeNull();expect(view.result.current.recordings).toEqual([]);expect(view.result.current.captureBridge.captureStamp()).toBeNull();
    expect(mockRecorders[0].dispose).toHaveBeenCalledTimes(1);expect(mockRecorders[1].api()).toBeNull();view.unmount();expect(mockRecorders[1].dispose).toHaveBeenCalledTimes(1);
});
