import { act, renderHook } from '@testing-library/react-native';
import { useLiveVideoDraft, type LiveVideoDraftMediaInfo } from '../live/use-live-video-draft';
import { liveVideoDraftKey } from '../live/live-video-draft';
import { getVideoDraft, persistVideoDraft } from '../video/video-draft-storage';
import type { LiveTimelineRecording } from '../live/live-scouting-contract';
import type { LiveHostScope } from '../live/live-storage';
import type { LiveCaptureStamp } from '../../../core/scouting-live';
import { getScoutingVideoDocument, saveScoutingVideoDocument } from '../../../api/scouting-video-documents';

const mockStored=new Map<string,string>();let mockAuth={userId:'user',generation:1};
jest.mock('../../../auth/session',()=>({getSessionIdentity:()=>({...mockAuth}),assertSessionIdentity:(value:typeof mockAuth)=>{if(value.userId!==mockAuth.userId||value.generation!==mockAuth.generation)throw new Error('Auth changed');}}));
jest.mock('../video/video-draft-storage',()=>({getVideoDraft:jest.fn(async(key:string)=>mockStored.get(key)??null),persistVideoDraft:jest.fn(async(key:string,value:string)=>{mockStored.set(key,value);})}));
jest.mock('../../../api/scouting-video-documents',()=>({getScoutingVideoDocument:jest.fn(),saveScoutingVideoDocument:jest.fn()}));
const scope:LiveHostScope={userId:'user',org:'org',classId:'class'};
const mark=(timeMs:number):LiveCaptureStamp=>({scope,hostSessionId:'host',recordingId:'recording',segmentId:'segment',epoch:1,peerGeneration:1,timeMs,uncertaintyMs:250,mode:'estimated'});
const recording:LiveTimelineRecording={analysisSessionId:'analysis',hostSessionId:'host',recordingId:'recording',updatedAt:'2026-11-04T12:00:00Z',clips:[{id:'capture-one',requestId:'request',analysisSessionId:'analysis',hostSessionId:'host',recordingId:'recording',kind:'point',rallyId:'official-rally',contacts:[],pointStamp:mark(18500),startMs:10000,endMs:20000,uncertaintyMs:250,setNumber:1,scoreUs:1,scoreThem:0,won:true,active:true,createdAt:'2026-11-04T12:00:00Z'}]};
type Props={scope:LiveHostScope;analysis:string;recording:LiveTimelineRecording|null;media:LiveVideoDraftMediaInfo};
const initial:Props={scope,analysis:'analysis',recording,media:{durationSeconds:40,width:1920,height:1080}};
const flush=async()=>{for(let index=0;index<25;index++)await Promise.resolve();};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((done,fail)=>{resolve=done;reject=fail;});return{promise,resolve,reject};}
async function mount(props=initial){const view=renderHook((value:Props)=>useLiveVideoDraft(value.scope,value.analysis,value.recording,value.media),{initialProps:props});await act(flush);return view;}
beforeEach(()=>{jest.useFakeTimers();jest.clearAllMocks();mockStored.clear();mockAuth={userId:'user',generation:1};(getVideoDraft as jest.Mock).mockImplementation(async(key:string)=>mockStored.get(key)??null);(persistVideoDraft as jest.Mock).mockImplementation(async(key:string,value:string)=>{mockStored.set(key,value);});});
afterEach(()=>jest.useRealTimers());

test('boot, edit, autosave, explicit save/retry and reopening never call any cloud document API',async()=>{
    const view=await mount();expect(view.result.current.doc?.rallies[0].id).toBe('capture-one');
    act(()=>view.result.current.resizeRally('capture-one',9,21));
    await act(async()=>{jest.advanceTimersByTime(500);await flush();});
    expect(view.result.current.dirty).toBe(false);expect(persistVideoDraft).toHaveBeenCalled();
    await act(async()=>{expect(await view.result.current.save()).toBe(true);expect(await view.result.current.retrySync()).toBe(true);});
    const before=view.result.current.exportLocal();view.unmount();const reopened=await mount();
    expect(reopened.result.current.ranges['capture-one']).toEqual([9,21]);expect(reopened.result.current.exportLocal()).toBe(before);
    expect(getScoutingVideoDocument).not.toHaveBeenCalled();expect(saveScoutingVideoDocument).not.toHaveBeenCalled();reopened.unmount();
});

test('DVR metadata changes preserve manual history and exact ranges across undo/redo',async()=>{
    const view=await mount();act(()=>view.result.current.resizeRally('capture-one',9,21));
    await act(async()=>{view.rerender({...initial,media:{...initial.media,durationSeconds:90,availableUntilMs:90000}});await flush();});
    expect(view.result.current.history?.past).toHaveLength(1);
    act(()=>view.result.current.undo());expect(view.result.current.ranges['capture-one']).toEqual([10,20]);expect(view.result.current.doc?.media.duration).toBe(90);
    act(()=>view.result.current.undo(true));expect(view.result.current.ranges['capture-one']).toEqual([9,21]);view.unmount();
});

test('quota preserves dirty edits and saved bytes and manual retry can recover without cloud',async()=>{
    const view=await mount();await act(async()=>{await view.result.current.save();});const saved=[...mockStored.values()][0];
    act(()=>view.result.current.resizeRally('capture-one',9,21));(persistVideoDraft as jest.Mock).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await act(async()=>{expect(await view.result.current.save()).toBe(false);});
    expect(view.result.current.error).toMatch(/salvar neste computador/);expect(view.result.current.dirty).toBe(true);expect([...mockStored.values()][0]).toBe(saved);
    await act(async()=>{expect(await view.result.current.retrySync()).toBe(true);});expect(view.result.current.error).toBe('');expect(view.result.current.dirty).toBe(false);view.unmount();
});

test('invalid/foreign imports preserve history; local imports restore ranges as one undoable operation',async()=>{
    const view=await mount(),original=view.result.current.exportLocal()!;
    act(()=>view.result.current.resizeRally('capture-one',9,21));const edited=view.result.current.exportLocal()!,history=view.result.current.history;
    await act(async()=>{expect(await view.result.current.importLocal('{bad')).toBe(false);});expect(view.result.current.history).toEqual(history);
    const foreign=JSON.parse(original);foreign.owner.org='foreign';await act(async()=>{expect(await view.result.current.importLocal(JSON.stringify(foreign))).toBe(false);});expect(view.result.current.ranges['capture-one']).toEqual([9,21]);
    await act(async()=>{expect(await view.result.current.importLocal(original)).toBe(true);});expect(view.result.current.ranges['capture-one']).toEqual([10,20]);
    act(()=>view.result.current.undo());expect(view.result.current.ranges['capture-one']).toEqual([9,21]);expect(edited).not.toMatch(/blob:|https:/);view.unmount();
});

test('source selection and account/organization scopes use separate keys and cannot overwrite a prior draft',async()=>{
    const view=await mount();act(()=>view.result.current.resizeRally('capture-one',9,21));await act(async()=>{await view.result.current.save();});
    const firstKey=liveVideoDraftKey({...scope,analysisSessionId:'analysis',hostSessionId:'host',recordingId:'recording'}),first=mockStored.get(firstKey);
    const other={...recording,recordingId:'other',clips:[]};await act(async()=>{view.rerender({...initial,recording:other});await flush();});
    expect(view.result.current.doc?.media.fingerprint).toBe('live:other');await act(async()=>{await view.result.current.save();});expect(mockStored.get(firstKey)).toBe(first);
    await act(async()=>{view.rerender(initial);await flush();});expect(view.result.current.ranges['capture-one']).toEqual([9,21]);view.unmount();
});

test('a late read from A cannot overwrite a new A after moving A→B→A',async()=>{
    const delayed=deferred<string|null>();(getVideoDraft as jest.Mock).mockReturnValueOnce(delayed.promise);
    const view=await mount();expect(view.result.current.loading).toBe(true);
    await act(async()=>{view.rerender({...initial,recording:{...recording,recordingId:'B',clips:[]}});await flush();});
    await act(async()=>{view.rerender(initial);await flush();});act(()=>view.result.current.resizeRally('capture-one',9,21));
    await act(async()=>{delayed.resolve(null);await flush();});expect(view.result.current.ranges['capture-one']).toEqual([9,21]);view.unmount();
});

test('a late failed save cannot attach its error or busy state to a replacement owner',async()=>{
    const view=await mount(),delayed=deferred<void>();(persistVideoDraft as jest.Mock).mockReturnValueOnce(delayed.promise);
    let operation!:Promise<boolean>;act(()=>{operation=view.result.current.save();});
    await act(async()=>{view.rerender({...initial,recording:{...recording,recordingId:'B',clips:[]}});await flush();});
    await act(async()=>{delayed.reject(new Error('Quota'));expect(await operation).toBe(false);});
    expect(view.result.current.error).toBe('');expect(view.result.current.saving).toBe(false);expect(view.result.current.doc?.media.fingerprint).toBe('live:B');view.unmount();
});

test('import waits for an older save and confirms persistence of the imported snapshot itself',async()=>{
    const view=await mount(),original=view.result.current.exportLocal()!,delayed=deferred<void>();
    act(()=>view.result.current.resizeRally('capture-one',9,21));(persistVideoDraft as jest.Mock).mockReturnValueOnce(delayed.promise);
    let saving!:Promise<boolean>,importing!:Promise<boolean>;act(()=>{saving=view.result.current.save();importing=view.result.current.importLocal(original);});
    expect(persistVideoDraft).toHaveBeenCalledTimes(1);
    await act(async()=>{delayed.resolve();await saving;expect(await importing).toBe(true);});
    expect(persistVideoDraft).toHaveBeenCalledTimes(2);expect(view.result.current.dirty).toBe(false);expect(view.result.current.ranges['capture-one']).toEqual([10,20]);view.unmount();
});

test('changed authentication refuses mutation, import and storage writes',async()=>{
    const view=await mount(),before=view.result.current.doc,raw=view.result.current.exportLocal()!;mockAuth={userId:'other',generation:2};
    act(()=>view.result.current.resizeRally('capture-one',9,21));expect(view.result.current.doc).toBe(before);
    await act(async()=>{expect(await view.result.current.save()).toBe(false);expect(await view.result.current.importLocal(raw)).toBe(false);});
    expect(persistVideoDraft).not.toHaveBeenCalled();expect(view.result.current.exportLocal()).toBeNull();view.unmount();
});

test('corrupt saved data blocks writes instead of replacing the previous record with an empty editor',async()=>{
    const key=liveVideoDraftKey({...scope,analysisSessionId:'analysis',hostSessionId:'host',recordingId:'recording'});mockStored.set(key,'{corrupt');
    const view=await mount();expect(view.result.current.doc).toBeNull();expect(view.result.current.error).toBeTruthy();
    await act(async()=>{expect(await view.result.current.save()).toBe(false);});expect(mockStored.get(key)).toBe('{corrupt');expect(persistVideoDraft).not.toHaveBeenCalled();view.unmount();
});

test('null recording exposes no fabricated document and legacy open rejects a foreign media identity',async()=>{
    const empty=await mount({...initial,recording:null});expect(empty.result.current.doc).toBeNull();expect(empty.result.current.pendingCount).toBe(0);empty.unmount();
    const view=await mount();await expect(view.result.current.open({fingerprint:'foreign',name:'file',duration:40,width:1920,height:1080})).rejects.toThrow(/outra gravação/);
    expect(getScoutingVideoDocument).not.toHaveBeenCalled();view.unmount();
});
