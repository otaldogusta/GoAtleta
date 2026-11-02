import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import LiveRecordingReview from '../live/LiveRecordingReview.web';
import type {LiveHostSession} from '../live/live-storage';
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:object)=>jest.requireActual('react').createElement('button',props),StudioDialog:({children,...props}:any)=>jest.requireActual('react').createElement('dialog',props,children)}));
const session:LiveHostSession={version:1,id:'session-1',scope:{userId:'user',org:'org',classId:'class'},recordingId:'recording-1',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',mimeType:'video/webm',ended:true,gaps:[],points:[{id:'point-1',recordingId:'recording-1',timeMs:10425,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:500,clockMode:'estimated',createdAtHostEpochMs:1762000000000}]};
const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');
const createUrl=jest.fn(),revokeUrl=jest.fn();
let view:ReactTestRenderer,video:any;
beforeEach(()=>{
    jest.useFakeTimers();jest.clearAllMocks();createUrl.mockReset().mockReturnValueOnce('blob:live-1').mockReturnValue('blob:live-2');
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:createUrl});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revokeUrl});
    video={duration:30,videoWidth:1280,videoHeight:720,currentTime:0,pause:jest.fn(),load:jest.fn(),removeAttribute:jest.fn()};
    act(()=>{view=create(createElement(LiveRecordingReview,{session,onClose:jest.fn()}),{createNodeMock:node=>node.type==='video'?video:node.type==='input'?{click:jest.fn()}:null});});
});
afterEach(()=>{
    if(view)act(()=>view.unmount());jest.useRealTimers();
    if(originalCreate)Object.defineProperty(URL,'createObjectURL',originalCreate);else Reflect.deleteProperty(URL,'createObjectURL');
    if(originalRevoke)Object.defineProperty(URL,'revokeObjectURL',originalRevoke);else Reflect.deleteProperty(URL,'revokeObjectURL');
});
const choose=(name='go-atleta-recording-1.webm',type='video/webm')=>act(()=>view.root.findByType('input').props.onChange({currentTarget:{files:[{name,type,size:2000}],value:name}}));
const pointAction=()=>view.root.findByProps({label:'Ver ponto 1 a 0, set 1, em 00:10'});
test('a wrong recording or non-video file is rejected before creating a local media URL',()=>{
    choose('go-atleta-other-recording.webm');
    expect(createUrl).not.toHaveBeenCalled();expect(view.root.findByProps({role:'alert'}).children.join('')).toContain('recording-1');
    choose('go-atleta-recording-1.mp4','image/png');expect(createUrl).not.toHaveBeenCalled();
    expect(pointAction().props.disabled).toBe(true);
});
test('a compatible recording with valid duration seeks exactly to its preserved host marker',()=>{
    const before=JSON.stringify(session);choose();expect(pointAction().props.disabled).toBe(true);
    act(()=>view.root.findByType('video').props.onLoadedMetadata({currentTarget:video}));
    expect(pointAction().props.disabled).toBe(false);act(()=>pointAction().props.onPress());
    expect(video.currentTime).toBe(10.425);expect(video.pause).toHaveBeenCalled();expect(pointAction().props.active).toBe(true);
    expect(JSON.stringify(session)).toBe(before);expect(view.root.findByType('video').props.src).toBe('blob:live-1');
});
test('a truncated recording cannot enable points beyond the actual video duration',()=>{
    choose();video.duration=5;act(()=>view.root.findByType('video').props.onLoadedMetadata({currentTarget:video}));
    expect(view.root.findAllByType('video')).toHaveLength(0);expect(pointAction().props.disabled).toBe(true);
    expect(revokeUrl).toHaveBeenCalledWith('blob:live-1');expect(view.root.findByProps({role:'alert'}).children.join('')).toContain('não inclui todos os pontos');
});
test('MediaRecorder WebM waits for a finite final duration before enabling seeks',()=>{
    choose();video.duration=Infinity;act(()=>view.root.findByType('video').props.onLoadedMetadata({currentTarget:video}));
    expect(video.currentTime).toBe(1e10);expect(pointAction().props.disabled).toBe(true);
    video.duration=30;act(()=>view.root.findByType('video').props.onDurationChange({currentTarget:video}));
    expect(video.currentTime).toBe(0);expect(pointAction().props.disabled).toBe(false);
});
test('local video URLs are revoked on file change and modal unmount',()=>{
    choose();choose('go-atleta-recording-1.mp4','video/mp4');
    expect(revokeUrl).toHaveBeenCalledWith('blob:live-1');expect(video.pause).toHaveBeenCalled();
    act(()=>view.unmount());expect(revokeUrl).toHaveBeenCalledWith('blob:live-2');
});
