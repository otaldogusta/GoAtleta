import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {Blob as NodeBlob,File as NodeFile} from 'node:buffer';
import LiveScoutingVideo,{type LiveScoutingVideoProps} from '../live/LiveScoutingVideo.web';
import type {LiveReplayMedia,LiveTimelineClip,LiveTimelineRecording} from '../live/live-scouting-contract';
import type {LocalStudioDraft,LocalStudioSource} from '../video/local-studio-types';
import {useLiveVideoDraft} from '../live/use-live-video-draft';
import {liveReplayContactTime,liveReplayRange} from '../live/live-replay-presentation';
import {newVideoDocument} from '../../../core/scouting-video';

const mockDraft={doc:null,ranges:{},sourceContacts:[],pendingCount:0} as unknown as LocalStudioDraft;
jest.mock('../live/use-live-video-draft',()=>({useLiveVideoDraft:jest.fn(()=>mockDraft)}));
jest.mock('../video/ScoutingVideoStudio.web',()=>({__esModule:true,default:(props:object)=>jest.requireActual('react').createElement('canonical-studio',props)}));
const stamp=(timeMs:number)=>({scope:{userId:'user',org:'org',classId:'class'},hostSessionId:'host-1',recordingId:'recording-1',segmentId:'segment-1',epoch:1,peerGeneration:1,timeMs,uncertaintyMs:500,mode:'estimated' as const});
const clip:LiveTimelineClip={id:'clip-1',requestId:'request-1',analysisSessionId:'analysis-1',hostSessionId:'host-1',recordingId:'recording-1',kind:'point',rallyId:'rally-1',contacts:[{id:'contact-1',stamp:stamp(9500),contact:{fundamental:'comunicacao',phase:'pressao',resultKey:'coletado',athleteName:'Atleta A',studentId:'student-1',zone:6}}],pointStamp:stamp(11500),startMs:8000,endMs:12000,uncertaintyMs:500,setNumber:2,scoreUs:4,scoreThem:3,won:true,active:true,createdAt:'2026-11-04T12:00:00Z'};
const recording:LiveTimelineRecording={hostSessionId:'host-1',recordingId:'recording-1',analysisSessionId:'analysis-1',clips:[clip],updatedAt:'2026-11-04T12:00:00Z'};
const media=(patch:Partial<LiveReplayMedia>={}):LiveReplayMedia=>({blob:new Blob(['local'],{type:'video/webm'}),offsetMs:5000,availableUntilMs:15000,original:false,uncertaintyMs:700,...patch});
const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');
const originalBlob=Object.getOwnPropertyDescriptor(globalThis,'Blob'),originalFile=Object.getOwnPropertyDescriptor(globalThis,'File');
const createUrl=jest.fn(),revokeUrl=jest.fn();
let view:ReactTestRenderer,props:LiveScoutingVideoProps;
const flush=async()=>{for(let index=0;index<20;index++)await Promise.resolve();};
const studio=()=>view.root.findByType('canonical-studio');
const source=()=>studio().props.localReplay as LocalStudioSource;
const mount=async(patch:Partial<LiveScoutingVideoProps>={})=>{
    props={org:'org',userId:'user',classId:'class',sessionId:'analysis-1',teamName:'Team',students:[],embedded:true,active:true,visible:true,toolbarTarget:{} as HTMLElement,onLeaveGuard:jest.fn(),onClose:jest.fn(),recordings:[recording],selectedRecordingId:'recording-1',onSelectRecording:jest.fn(),loadMedia:jest.fn(async()=>null),revision:0,onOtherVideos:jest.fn(),...patch};
    await act(async()=>{view=create(createElement(LiveScoutingVideo,props));await flush();});
};
const update=async(patch:Partial<LiveScoutingVideoProps>)=>{props={...props,...patch};await act(async()=>{view.update(createElement(LiveScoutingVideo,props));await flush();});};
beforeEach(()=>{
    jest.clearAllMocks();let sequence=0;createUrl.mockImplementation(()=>`blob:replay-${++sequence}`);
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:createUrl});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revokeUrl});
    Object.defineProperty(globalThis,'Blob',{configurable:true,value:NodeBlob});Object.defineProperty(globalThis,'File',{configurable:true,value:NodeFile});
});
afterEach(()=>{
    if(view)act(()=>view.unmount());
    for(const[target,name,descriptor]of [[URL,'createObjectURL',originalCreate],[URL,'revokeObjectURL',originalRevoke],[globalThis,'Blob',originalBlob],[globalThis,'File',originalFile]] as const){if(descriptor)Object.defineProperty(target,name,descriptor);else Reflect.deleteProperty(target,name);}
});

test('the live wrapper renders only the canonical studio with all authorized scope and shell props',async()=>{
    const before=JSON.stringify(recording);await mount();
    expect(view.root.findAllByType('canonical-studio')).toHaveLength(1);expect(view.root.findAllByType('video')).toHaveLength(0);expect(view.root.findAllByType('aside')).toHaveLength(0);
    for(const key of ['org','userId','classId','sessionId','teamName','students','active','embedded','visible','toolbarTarget','onLeaveGuard','onClose'] as const)expect(studio().props[key]).toBe(props[key]);
    expect(props.loadMedia).toHaveBeenCalledWith({hostSessionId:'host-1',recordingId:'recording-1'},clip);
    expect(source().draft).toBe(mockDraft);expect(source().source).toBe('');expect(JSON.stringify(recording)).toBe(before);expect(createUrl).not.toHaveBeenCalled();
    act(()=>source().onOtherVideos());expect(props.onOtherVideos).toHaveBeenCalledTimes(1);
});

test('gallery metadata follows confirmed source contacts into manual ranges without inventing a set for mixed-source merges',async()=>{
    const second={...clip,id:'clip-2',setNumber:3,contacts:[{...clip.contacts[0],id:'mark-2'}]},third={...clip,id:'clip-3',setNumber:4,contacts:[{...clip.contacts[0],id:'mark-3'}]};
    const sourceRecording={...recording,clips:[clip,second,third]},before=JSON.stringify(sourceRecording);
    const doc=newVideoDocument({fingerprint:'local',name:'Ao vivo',duration:40,width:640,height:360},'clip-1');
    doc.rallies.push({id:'manual-part',start:10,winner:null,reviewed:false},{id:'joined',start:15,winner:null,reviewed:false},{id:'unlinked',start:25,winner:null,reviewed:false});
    const sourceContact=(id:string,rallyId:string)=>({id,rallyId,time:10,skill:'Comunicação',result:'Positiva',athlete:'',detail:'',uncertaintyMs:50});
    jest.mocked(useLiveVideoDraft).mockReturnValue({...mockDraft,doc,sourceContacts:[sourceContact('clip-1:contact-1','manual-part'),sourceContact('clip-2:mark-2','joined'),sourceContact('clip-3:mark-3','joined')]});
    try{
        await mount({recordings:[sourceRecording]});
        expect(source().rallyMetadata?.['manual-part']).toMatchObject({setNumber:2,scoreUs:4,scoreThem:3,fundamentals:['Comunicação']});
        expect(source().rallyMetadata?.joined.setNumber).toBeUndefined();expect(source().rallyMetadata?.joined.scoreUs).toBeUndefined();
        expect(source().rallyMetadata?.unlinked.setNumber).toBeUndefined();expect(JSON.stringify(sourceRecording)).toBe(before);
    }finally{jest.mocked(useLiveVideoDraft).mockReturnValue(mockDraft);}
});

test('native metadata supplies global source duration and real dimensions without a rotating source identity',async()=>{
    await mount({loadMedia:jest.fn(async()=>media())});const identity=source().identity;
    expect(source()).toMatchObject({source:'blob:replay-1',offsetSeconds:5,availableUntilSeconds:15,original:false});
    expect(source().file?.name).toBe('go-atleta-recording-1.webm');expect(source().blob?.type).toBe('video/webm');
    act(()=>source().onMetadata({durationSeconds:10,width:1920,height:1080}));
    expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[3]).toMatchObject({durationSeconds:15,width:1920,height:1080,offsetMs:5000,availableUntilMs:15000});
    await update({revision:1});expect(source().identity).toBe(identity);expect(createUrl).toHaveBeenCalledTimes(1);
});

test('non-finite metadata waits for the canonical Infinity decoder recovery and rejects stale decoder callbacks',async()=>{
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValueOnce(media({offsetMs:6000,availableUntilMs:17000}));await mount({loadMedia});
    const old=source();act(()=>old.onMetadata({durationSeconds:Infinity,width:1280,height:720}));
    expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[3].durationSeconds).toBeNull();
    await update({revision:1});act(()=>{old.onMetadata({durationSeconds:99,width:320,height:180});old.mediaError();});
    expect(source().error).toBe('');expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[3].durationSeconds).toBeNull();
    act(()=>source().onMetadata({durationSeconds:11,width:1920,height:1080}));expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[3].durationSeconds).toBe(17);
});

test('growing DVR revisions defer their URL swap during playback until the studio pauses',async()=>{
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValueOnce(media({availableUntilMs:16000}));await mount({loadMedia});
    act(()=>source().playbackState(true));await update({revision:1});expect(source().source).toBe('blob:replay-1');expect(revokeUrl).not.toHaveBeenCalled();
    act(()=>source().playbackState(false));expect(source().source).toBe('blob:replay-2');expect(revokeUrl).toHaveBeenCalledWith('blob:replay-1');
});

test('ready original media becomes preferred without interrupting playback or an active export',async()=>{
    const original=media({blob:new Blob(['original'],{type:'video/mp4'}),offsetMs:0,availableUntilMs:7200000,original:true});
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValueOnce(original);await mount({loadMedia});
    act(()=>{source().playbackState(true);source().exportState(true);});await update({revision:1000000});expect(source().original).toBe(false);expect(createUrl).toHaveBeenCalledTimes(1);
    act(()=>source().playbackState(false));expect(createUrl).toHaveBeenCalledTimes(1);
    act(()=>source().exportState(false));expect(source()).toMatchObject({original:true,offsetSeconds:0,source:'blob:replay-2'});
    act(()=>source().onMetadata({durationSeconds:43.389917,width:1920,height:1080}));
    expect(source().availableUntilSeconds).toBe(43.389917);expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[3]).toMatchObject({durationSeconds:43.389917,width:1920,height:1080});
});

test('slow snapshot reads coalesce revisions without starving the first source or starting parallel same-key reads',async()=>{
    let finish!:(value:LiveReplayMedia)=>void;
    const loadMedia=jest.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue(media({availableUntilMs:16000}));
    await mount({loadMedia});await update({revision:1});await update({revision:2});expect(loadMedia).toHaveBeenCalledTimes(1);
    await act(async()=>{finish(media());await flush();});expect(loadMedia).toHaveBeenCalledTimes(2);expect(createUrl).toHaveBeenCalledTimes(2);expect(source().source).toBe('blob:replay-2');
});

test('explicit refresh recreates the decoder while equivalent passive revisions preserve an error and URL',async()=>{
    const same=media(),loadMedia=jest.fn(async()=>same);await mount({loadMedia});act(()=>source().mediaError());
    expect(source().error).toContain('Atualize');await update({revision:1});expect(createUrl).toHaveBeenCalledTimes(1);expect(source().error).toContain('Atualize');
    await act(async()=>{source().refresh();await flush();});expect(createUrl).toHaveBeenCalledTimes(2);expect(revokeUrl).toHaveBeenCalledWith('blob:replay-1');expect(source().error).toBe('');
});

test('denied lookups revoke old media immediately even while playback and export are busy',async()=>{
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValueOnce(null);await mount({loadMedia});act(()=>{source().playbackState(true);source().exportState(true);});
    await update({revision:1});expect(source().source).toBe('');expect(source().blob).toBeNull();expect(source().file).toBeNull();expect(revokeUrl).toHaveBeenCalledWith('blob:replay-1');
});

test('recording and scope ownership changes revoke earlier URLs and ignore late media through A to B to A',async()=>{
    let finish!:(value:LiveReplayMedia)=>void;
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue(media());
    await mount({loadMedia});await update({revision:1});
    const other={...recording,recordingId:'recording-2',hostSessionId:'host-2',clips:[{...clip,recordingId:'recording-2',hostSessionId:'host-2'}]};
    await update({recordings:[recording,other],selectedRecordingId:'recording-2'});expect(revokeUrl).toHaveBeenCalledWith('blob:replay-1');
    await update({selectedRecordingId:'recording-1'});const current=source().source;await act(async()=>{finish(media({availableUntilMs:19000}));await flush();});expect(source().source).toBe(current);expect(createUrl).toHaveBeenCalledTimes(3);
    await update({userId:'other-user',org:'other-org'});expect(revokeUrl).toHaveBeenCalledWith(current);expect(source().identity).toContain('other-user');
});

test('rally selection requests its scoped clip and manual or whole-capture selections request all available footage',async()=>{
    const second={...clip,id:'clip-2'},loadMedia=jest.fn(async()=>media());await mount({recordings:[{...recording,clips:[clip,second]}],loadMedia});
    await act(async()=>{source().selectRally('clip-2');await flush();});expect(loadMedia).toHaveBeenLastCalledWith({hostSessionId:'host-1',recordingId:'recording-1'},second);
    await act(async()=>{source().selectRally(null);await flush();});expect(loadMedia).toHaveBeenLastCalledWith({hostSessionId:'host-1',recordingId:'recording-1'},undefined);
    await act(async()=>{source().selectRally('manual-split');await flush();});expect(loadMedia).toHaveBeenLastCalledWith({hostSessionId:'host-1',recordingId:'recording-1'},undefined);
    act(()=>{source().selectRecording('foreign');source().selectRecording('recording-1');});expect(props.onSelectRecording).toHaveBeenCalledTimes(1);expect(props.onSelectRecording).toHaveBeenCalledWith('recording-1');
});

test('hidden retained editors stop periodic loads, preserve the source and export, then reload the latest window when visible',async()=>{
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValue(media({availableUntilMs:18000}));await mount({loadMedia});act(()=>source().exportState(true));
    await update({visible:false,revision:1});await update({revision:2});expect(loadMedia).toHaveBeenCalledTimes(1);expect(source().source).toBe('blob:replay-1');expect(revokeUrl).not.toHaveBeenCalled();
    await update({visible:true});expect(loadMedia).toHaveBeenCalledTimes(2);expect(source().source).toBe('blob:replay-1');
    act(()=>source().exportState(false));expect(source().source).toBe('blob:replay-2');
});

test('unmount revokes its only owned URL and drops queued media without revoking a new owner',async()=>{
    const loadMedia=jest.fn().mockResolvedValueOnce(media()).mockResolvedValueOnce(media({availableUntilMs:18000}));await mount({loadMedia});act(()=>source().exportState(true));await update({revision:1});
    const old=source();act(()=>view.unmount());expect(revokeUrl).toHaveBeenCalledTimes(1);expect(revokeUrl).toHaveBeenCalledWith('blob:replay-1');
    act(()=>{old.exportState(false);old.playbackState(false);old.onMetadata({durationSeconds:18,width:1280,height:720});});expect(createUrl).toHaveBeenCalledTimes(1);
});

test('recordings from another analysis never reach the current loader or draft owner',async()=>{
    await mount({recordings:[{...recording,analysisSessionId:'foreign-analysis'}]});expect(props.loadMedia).not.toHaveBeenCalled();expect(source().recordingId).toBe('');expect((useLiveVideoDraft as jest.Mock).mock.calls.at(-1)[2]).toBeNull();
});

test('legacy range calculations retain decoded EOF padding and reject gestures outside the original',()=>{
    const original=media({offsetMs:0,availableUntilMs:20000,original:true}),last={...clip,endMs:21500};
    expect(liveReplayRange(last,original,19.9)?.complete).toBe(true);expect(liveReplayRange(last,{...original,original:false},19.9)?.complete).toBe(false);
    expect(liveReplayRange({...last,pointStamp:stamp(20500)},original,19.9)?.complete).toBe(false);
    expect(liveReplayRange({...last,contacts:[{...clip.contacts[0],stamp:stamp(20500)}]},original,19.9)?.complete).toBe(false);
    expect(liveReplayContactTime({...clip.contacts[0],stamp:{...stamp(9500),recordingId:'foreign'}},clip)).toBeNull();
});
