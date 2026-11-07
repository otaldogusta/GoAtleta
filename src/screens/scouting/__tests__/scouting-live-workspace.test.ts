import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ScoutingLive, { type ScoutingLiveProps, type ScoutingLiveWorkspaceControls } from '../live/ScoutingLive.web';
import LiveCameraConnection from '../live/LiveCameraConnection.web';
import { workspaceCameraControlState, workspaceCameraStatus } from '../live/workspace-camera-presentation';

let mockLayout={viewportWidth:1197,height:884,isMobile:false};
jest.mock('react-native',()=>({Platform:{OS:'web',select:(options:any)=>options.web??options.default},useWindowDimensions:()=>({width:mockLayout.viewportWidth,height:mockLayout.height,scale:1,fontScale:1})}));
const snapshot={scope:{userId:'user',org:'org',classId:'class'},epoch:1,peerGeneration:1,hostSessionId:null,recordingId:null,segmentId:null,recordingState:null,cameraState:null,connection:'idle',blockedReason:'no-recording',ended:false,videoState:null};
const mockApi={getSnapshot:()=>snapshot,getCaptureStamp:()=>null,loadSavedVideo:async()=>null,getReplayCapture:()=>({stream:null,stamp:null,snapshot,playoutDelayMs:0})};
const session={version:1,id:'host-1',scope:snapshot.scope,recordingId:'recording-1',createdAt:'2026-11-05T12:00:00Z',updatedAt:'2026-11-05T12:00:00Z',setNumber:1,className:'QA',points:[],gaps:[],mimeType:'video/mp4',ended:false};
const mockBase={bridgeApi:mockApi,captureInfo:null as any,previewPlaybackBlocked:false,checkingConfig:false,serviceCheck:null,videoStatuses:{} as any,loadSavedVideo:jest.fn(async()=>null),saveImportedVideo:jest.fn(async()=>true),downloadSavedVideo:jest.fn(),requestSavedVideo:jest.fn(),cameraState:null as any,controlPending:null as any,cameraCommand:jest.fn(),canNewRecording:false,newRecording:jest.fn(),startPending:false,startRecording:jest.fn(),stopPending:false,stopRecording:jest.fn(),config:null as any,room:null as any,error:'',connection:'idle',stream:null as any,session:null as any,history:[] as any[],recording:null as any,busy:false,saving:false,pendingCopies:0,stamp:null as any,deleted:null as any,attachVideo:jest.fn(),refreshConfig:jest.fn(),start:jest.fn(),mark:jest.fn(),undo:jest.fn(),nextSet:jest.fn(),disconnect:jest.fn(async()=>true),deleteSaved:jest.fn(async()=>true),restoreDeleted:jest.fn(async()=>true),canDeleteSession:jest.fn(()=>true),canMark:false};
let mockLive={...mockBase};
jest.mock('../live/use-live-host',()=>({useLiveHost:()=>mockLive}));
jest.mock('../../../observability/perf',()=>({markRender:()=>{},measureAsync:(_name:string,work:()=>Promise<unknown>)=>work()}));
jest.mock('react-dom',()=>({createPortal:(children:unknown,container:unknown)=>jest.requireActual('react').createElement('portal',{container},children)}));
jest.mock('../../../ui/use-responsive-layout',()=>({useResponsiveLayout:()=>mockLayout}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{background:'#080f1b',card:'#172234',inputBg:'#121c30',text:'#fff',muted:'#8fa1ba',border:'#283548',primaryBg:'#30d786',primaryText:'#052819',warning:'#e3b260'}})}));
jest.mock('../../../core/scouting-live-qr',()=>({liveQrSvg:()=>'<svg/>'}));
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:object)=>jest.requireActual('react').createElement('button',props),StudioDialog:({children,...props}:any)=>jest.requireActual('react').createElement('dialog',props,children)}));
jest.mock('../../../ui/AnchoredDropdown',()=>({AnchoredDropdown:(props:any)=>props.visible&&props.layout?jest.requireActual('react').createElement('dropdown',props,props.children):null}));
jest.mock('../live/LiveCameraConnection.web',()=>({__esModule:true,default:(props:object)=>jest.requireActual('react').createElement('pairing',props)}));
jest.mock('../live/LiveSavedRecordings.web',()=>({__esModule:true,default:(props:object)=>jest.requireActual('react').createElement('library',props)}));
jest.mock('../live/LiveRecordingReview.web',()=>({__esModule:true,default:(props:object)=>jest.requireActual('react').createElement('recording-review',props)}));
jest.mock('../video/video-media.web',()=>({downloadVideoBlob:jest.fn()}));

let view:ReactTestRenderer|undefined,props:ScoutingLiveProps;
const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
const originalAdd=window.addEventListener,originalRemove=window.removeEventListener;
let listeners:Map<string,Set<(event:any)=>void>>;
let previewAssignments:unknown[];
let activePreviewNode:unknown;
const body={id:'portal-body'},play=jest.fn(async()=>{}),pause=jest.fn(),focus=jest.fn();
const anchor={isConnected:true,getBoundingClientRect:()=>({x:800,y:40,width:190,height:44}),closest:(selector:string)=>selector==='details'?{querySelector:()=>activePreviewNode}:null,focus} as unknown as HTMLElement;
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
const action=(label:string)=>view!.root.findAllByType('button').find(node=>node.props.label===label)!;
async function mount(values:Partial<ScoutingLiveProps>={}){
    props={userId:'user',org:'org',classId:'class',className:'QA',embedded:true,workspace:true,controlsAnchor:anchor,onClose:jest.fn(),onControlsClose:jest.fn(),onLibraryClose:jest.fn(),...values};
    await act(async()=>{view=create(createElement(ScoutingLive,props),{createNodeMock:node=>{if(node.type==='video'){let source:unknown=null;return activePreviewNode={play,pause,get srcObject(){return source;},set srcObject(value:unknown){previewAssignments.push(value);source=value;}};}return node.type==='span'?anchor:node.props.role==='dialog'?{focus}:null;}});await flush();});
}
async function update(values:Partial<ScoutingLiveProps>={}){props={...props,...values};await act(async()=>{view!.update(createElement(ScoutingLive,props));await flush();});}
beforeEach(()=>{
    jest.clearAllMocks();mockLayout={viewportWidth:1197,height:884,isMobile:false};mockLive={...mockBase};
    previewAssignments=[];activePreviewNode=null;mockLive.attachVideo.mockImplementation((node:HTMLVideoElement|null)=>{if(node)node.srcObject=mockLive.stream;});
    listeners=new Map();
    window.addEventListener=jest.fn((name,callback)=>{const registered=listeners.get(name)??new Set();registered.add(callback as (event:any)=>void);listeners.set(name,registered);});
    window.removeEventListener=jest.fn((name,callback)=>{listeners.get(name)?.delete(callback as (event:any)=>void);});
    Object.defineProperty(globalThis,'document',{configurable:true,value:{body,activeElement:anchor}});
});
afterEach(()=>{if(view)act(()=>{view!.unmount();view=undefined;});if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');window.addEventListener=originalAdd;window.removeEventListener=originalRemove;});

test('workspace presentation has one host bridge and preview across panels/tabs without disconnecting or adding point controls',async()=>{
    mockLive={...mockLive,room:{cameraUrl:'https://camera/#private',localCameraUrl:'http://local'},stream:{},connection:'connected',cameraState:'preview'};
    const onHostApi=jest.fn(),onLeaveGuard=jest.fn();await mount({onHostApi,onLeaveGuard});
    expect(view!.root.findAllByType('video')).toHaveLength(1);expect(view!.root.findAllByType('pairing' as never)).toHaveLength(0);expect(view!.root.findAllByType('library' as never)).toHaveLength(0);
    expect(action('Registrar nosso ponto no vídeo ao vivo')).toBeUndefined();expect(action('Registrar ponto adversário no vídeo ao vivo')).toBeUndefined();
    const guard=onLeaveGuard.mock.calls[0][0];await update({controlsOpen:true});await update({controlsOpen:false,libraryOpen:true,visible:false});await update({libraryOpen:false,visible:true});
    expect(onHostApi).toHaveBeenCalledTimes(1);expect(onHostApi).toHaveBeenLastCalledWith(mockApi);expect(onLeaveGuard).toHaveBeenCalledTimes(1);expect(onLeaveGuard.mock.calls[0][0]).toBe(guard);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();expect(mockLive.mark).not.toHaveBeenCalled();expect(pause).toHaveBeenCalled();expect(play).toHaveBeenCalled();
});

test.each([false,true])('source dialog receives one controls body inside its own top layer without another panel (mobile: %s)',async(mobile)=>{
    mockLayout={viewportWidth:mobile?390:1346,height:884,isMobile:mobile};
    const target={id:'source-dialog-camera-content'} as unknown as HTMLElement,onHostApi=jest.fn(),onLeaveGuard=jest.fn();
    await mount({controlsOpen:false,controlsTarget:target,onHostApi,onLeaveGuard});
    const portals=view!.root.findAllByType('portal' as never).filter(node=>node.props.container===target);
    expect(portals).toHaveLength(1);expect(portals[0].findAllByType('pairing' as never)).toHaveLength(1);
    expect(portals[0].findByType('pairing' as never).props.inline).toBe(true);
    expect(view!.root.findAllByType('pairing' as never)).toHaveLength(1);expect(view!.root.findAllByType('dropdown' as never)).toHaveLength(0);expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    expect(view!.root.findByType('pairing' as never).props.portalToBodyOnWeb).toBe(false);
    expect(action('Conectar câmera ao vivo')).toBeDefined();expect(onHostApi).toHaveBeenCalledTimes(1);expect(onLeaveGuard).toHaveBeenCalledTimes(1);
    expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
    await update({controlsOpen:true});
    expect(view!.root.findAllByType('pairing' as never)).toHaveLength(1);expect(view!.root.findAllByType('dropdown' as never)).toHaveLength(0);expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    await update({controlsTarget:null,controlsOpen:false});
    expect(view!.root.findAllByType('pairing' as never)).toHaveLength(0);expect(onHostApi).toHaveBeenCalledTimes(1);expect(onLeaveGuard).toHaveBeenCalledTimes(1);
    await update({controlsOpen:true});
    expect(view!.root.findAllByType('pairing' as never)).toHaveLength(1);
    expect(view!.root.findByType('pairing' as never).props.portalToBodyOnWeb).toBe(!mobile);
    expect(view!.root.findByType('pairing' as never).props.inline).toBe(true);
    expect(onHostApi).toHaveBeenCalledTimes(1);expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('the source camera step starts without idle summary and receives pairing and preview updates in the same target',async()=>{
    const target={id:'source-camera-step'} as unknown as HTMLElement,onHostApi=jest.fn(),onLeaveGuard=jest.fn();
    await mount({controlsTarget:target,onHostApi,onLeaveGuard});
    const portal=view!.root.findByProps({container:target});
    expect(portal.findAllByProps({className:'lwc-capture-summary'})).toHaveLength(0);expect(portal.findAllByType('time')).toHaveLength(0);
    expect(action('Conectar câmera ao vivo').props.children).toBe('Gerar QR code');expect(portal.findByType('pairing' as never).props.hasRoom).toBe(false);
    mockLive={...mockLive,room:{cameraUrl:'https://camera/#private',localCameraUrl:'http://local'},connection:'waiting'};await update();
    expect(view!.root.findByProps({container:target})).toBe(portal);expect(portal.findByType('pairing' as never).props).toMatchObject({hasRoom:true,connected:false,portalToBodyOnWeb:false});
    expect(portal.findByProps({className:'lwc-capture-summary'}).findByType('strong').children).toEqual(['Aguardando celular']);expect(action('Conectar câmera ao vivo')).toBeUndefined();
    mockLive={...mockLive,stream:{id:'phone-preview'},connection:'connected',cameraState:'preview'};await update();
    expect(view!.root.findByProps({container:target})).toBe(portal);expect(portal.findByType('pairing' as never).props).toMatchObject({hasRoom:true,connected:true,portalToBodyOnWeb:false});
    expect(portal.findByProps({className:'lwc-capture-summary'}).findByType('strong').children).toEqual(['Câmera pronta']);expect(action('Iniciar gravação no celular')).toBeDefined();
    expect(view!.root.findAllByType('pairing' as never)).toHaveLength(1);expect(view!.root.findAllByType('dropdown' as never)).toHaveLength(0);expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    expect(onHostApi).toHaveBeenCalledTimes(1);expect(onLeaveGuard).toHaveBeenCalledTimes(1);expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('bench main and PIP use the same preview element, attachment and host bridge inside the selected stage target',async()=>{
    const target={id:'canonical-stage'} as unknown as HTMLElement,onHostApi=jest.fn(),onLeaveGuard=jest.fn();
    const stream={id:'actual-camera-stream'};mockLive={...mockLive,room:{},stream,connection:'connected',cameraState:'preview'};
    await mount({workspace:false,bench:true,presentation:'main',previewTarget:target,onHostApi,onLeaveGuard});
    const video=view!.root.findByType('video'),attachment=mockLive.attachVideo.mock.calls[0][0];
    expect(attachment.srcObject).toBe(stream);expect(view!.root.findByProps({'data-presentation':'main'}).parent?.props.container).toBe(target);
    expect(view!.root.findByProps({'data-presentation':'main'}).props.className).toContain('lwc-bench');
    const refCalls=mockLive.attachVideo.mock.calls.length;
    await update({presentation:'pip'});expect(view!.root.findByType('video')).toBe(video);
    expect(view!.root.findByProps({'data-presentation':'pip'}).parent?.props.container).toBe(target);
    await update({presentation:'main',controlsOpen:true});expect(view!.root.findByType('video')).toBe(video);
    expect(mockLive.attachVideo).toHaveBeenCalledTimes(refCalls);expect(onHostApi).toHaveBeenCalledTimes(1);expect(onLeaveGuard).toHaveBeenCalledTimes(1);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
    expect(view!.root.findByProps({className:'lwc-live-badge'}).children).toEqual(['Ao vivo']);
});

test('changing the preview portal target reattaches the current stream without restarting capture or the host',async()=>{
    const stream={id:'same-source'},target={id:'stage'} as unknown as HTMLElement,onHostApi=jest.fn();
    mockLive={...mockLive,room:{},stream,connection:'connected',cameraState:'recording',session,recording:{state:'recording'}};
    await mount({bench:true,onHostApi});await update({previewTarget:target,presentation:'pip'});await update({previewTarget:null,presentation:'main'});
    expect(mockLive.attachVideo.mock.calls.filter(([node])=>node).every(([node])=>node.srcObject===stream)).toBe(true);
    expect(view!.root.findAllByType('video')).toHaveLength(1);expect(onHostApi).toHaveBeenCalledTimes(1);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
});

test('the first received stream has one srcObject owner and is never replaced by a stale wrapper snapshot',async()=>{
    mockLive={...mockLive,room:{},connection:'connected',cameraState:'preview'};await mount({bench:true});expect(view!.root.findAllByType('video')).toHaveLength(0);
    const stream={id:'first-received-stream'};mockLive={...mockLive,stream};await update();
    expect(view!.root.findByType('video')).toBeDefined();expect(previewAssignments).toEqual([stream]);
    expect(mockLive.attachVideo.mock.calls.find(([node])=>node)?.[0].srcObject).toBe(stream);
});

test('autoplay recovery offers a real preview action without starting another recording or replacing the host',async()=>{
    const onHostApi=jest.fn();mockLive={...mockLive,room:{},stream:{id:'blocked-stream'},connection:'connected',cameraState:'preview',previewPlaybackBlocked:true};
    await mount({bench:true,onHostApi});const video=view!.root.findByType('video');expect(action('Iniciar prévia')).toBeDefined();
    play.mockClear();act(()=>action('Iniciar prévia').props.onPress());expect(play).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,previewPlaybackBlocked:false};await update();expect(action('Iniciar prévia')).toBeUndefined();expect(view!.root.findByType('video')).toBe(video);
    expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.start).not.toHaveBeenCalled();expect(onHostApi).toHaveBeenCalledTimes(1);
});

test('header controls publish only capability changes, keep stable actions across clock ticks and call the current host commands',async()=>{
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'preview'};
    const onWorkspaceControlsChange=jest.fn();await mount({bench:true,onWorkspaceControlsChange});
    const initial=onWorkspaceControlsChange.mock.lastCall![0] as ScoutingLiveWorkspaceControls;
    expect(initial).toMatchObject({canStart:true,canPause:false,canResume:false,canStop:false,busy:false,hasPreview:true,pending:null});
    act(()=>initial.actions.start());expect(mockLive.startRecording).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,stamp:{timeMs:2000}};await update({presentation:'pip',controlsOpen:true});
    expect(onWorkspaceControlsChange).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,startPending:true};await update();
    const starting=onWorkspaceControlsChange.mock.lastCall![0] as ScoutingLiveWorkspaceControls;
    expect(starting).toMatchObject({canStart:false,busy:true,pending:'start'});expect(starting.actions).toBe(initial.actions);
    act(()=>initial.actions.start());expect(mockLive.startRecording).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,startPending:false,session,recording:{state:'recording'},cameraState:'recording'};await update();
    const recording=onWorkspaceControlsChange.mock.lastCall![0] as ScoutingLiveWorkspaceControls;
    expect(recording).toMatchObject({canStart:false,canPause:true,canResume:false,canStop:true,busy:false});
    act(()=>initial.actions.pause());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('pause-recording');
    mockLive={...mockLive,controlPending:'pause-recording'};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({canPause:false,canStop:false,busy:true,pending:'pause'});
    act(()=>initial.actions.pause());expect(mockLive.cameraCommand).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,controlPending:null,recording:{state:'paused'},cameraState:'paused'};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({canPause:false,canResume:true,canStop:true});
    act(()=>initial.actions.resume());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('resume-recording');
    act(()=>initial.actions.stop());expect(mockLive.stopRecording).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,stopPending:true};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({canResume:false,canStop:false,busy:true,pending:'stop'});
    act(()=>initial.actions.stop());expect(mockLive.stopRecording).toHaveBeenCalledTimes(1);
});

test('header commands become unavailable on disconnection, completion, camera off and unmount without fabricating a capture clock',async()=>{
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'recording',recording:{state:'recording'},session};
    const onWorkspaceControlsChange=jest.fn(),onWorkspaceStatusChange=jest.fn();await mount({bench:true,onWorkspaceControlsChange,onWorkspaceStatusChange});
    const commands=onWorkspaceControlsChange.mock.lastCall![0] as ScoutingLiveWorkspaceControls;
    expect(onWorkspaceStatusChange.mock.lastCall![0].elapsedMs).toBeNull();
    mockLive={...mockLive,connection:'disconnected'};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({canStart:false,canPause:false,canResume:false,canStop:false});
    act(()=>{commands.actions.pause();commands.actions.resume();commands.actions.stop();});
    expect(mockLive.cameraCommand).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
    mockLive={...mockLive,connection:'connected',recording:{state:'stopped'},session:{...session,ended:true},stream:null,cameraState:'off'};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({canStart:false,canPause:false,canResume:false,canStop:false,hasPreview:false});
    act(()=>{view!.unmount();view=undefined;});expect(onWorkspaceControlsChange).toHaveBeenLastCalledWith(null);
    act(()=>{commands.actions.start();commands.actions.pause();commands.actions.resume();commands.actions.stop();});
    expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.cameraCommand).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
});

test('all pending camera commands disable header operations and preserve their real pending identity',()=>{
    const derive=(patch:object)=>workspaceCameraControlState({...mockBase,room:{},stream:{},connection:'connected',cameraState:'preview',...patch} as any);
    expect(derive({controlPending:'resume-recording'})).toMatchObject({busy:true,pending:'resume',canStart:false});
    expect(derive({controlPending:'camera-on'})).toMatchObject({busy:true,pending:'camera'});
    expect(derive({controlPending:'new-recording'})).toMatchObject({busy:true,pending:'new-recording'});
    expect(derive({busy:true})).toMatchObject({busy:true,pending:'preparing'});
    expect(derive({cameraState:'finalizing'})).toMatchObject({busy:true,pending:'stop'});
    expect(derive({saving:true})).toMatchObject({busy:true,pending:null});
    expect(derive({cameraState:'off',stream:null})).toMatchObject({canStart:false,hasPreview:false});
});

test('desktop controls are a body-portal popover anchored to the header and closing only changes presentation',async()=>{
    await mount({controlsOpen:true});const dropdown=view!.root.findByType('dropdown' as never);
    expect(dropdown.props).toMatchObject({layout:{x:800,y:40,width:190,height:44},density:'popover',surface:'solid',portalToBodyOnWeb:true});
    expect(view!.root.findAllByType('portal' as never).every(node=>node.props.container===body)).toBe(true);
    act(()=>action('Fechar câmera').props.onPress());expect(props.onControlsClose).toHaveBeenCalledTimes(1);expect(mockLive.disconnect).not.toHaveBeenCalled();expect(props.onClose).not.toHaveBeenCalled();
});

test('mobile controls use the canonical sheet and keep nested pairing help inside its native dialog',async()=>{
    mockLayout={viewportWidth:390,height:844,isMobile:true};await mount({controlsOpen:true});
    const dialog=view!.root.findByType('dialog');expect(dialog.props.className).toContain('lwc-sheet');
    expect(view!.root.findByType('pairing' as never).props.portalToBodyOnWeb).toBe(false);
    expect(view!.root.findByType('details').props.open).toBe(false);
    act(()=>dialog.props.onClose());expect(props.onControlsClose).toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('nested pairing popover is included among desktop controls interactive roots',async()=>{
    await mount({controlsOpen:true});const helper=view!.root.findByType('pairing' as never),element={contains:()=>true};
    act(()=>helper.props.onPopoverElement(element));
    expect(view!.root.findByType('dropdown' as never).props.interactiveRefs[0].current).toBe(element);
    expect(helper.props.portalToBodyOnWeb).toBe(true);expect(view!.root.findByType(LiveCameraConnection).props.onCopy).toBeDefined();
});

test('Escape delegates to nested help before the outer primitive can consume it; the next Escape returns focus to the camera chip',async()=>{
    await mount({controlsOpen:true});const helper=view!.root.findByType('pairing' as never),dropdown=view!.root.findByType('dropdown' as never);
    const closeHelp=jest.fn(()=>helper.props.onPopoverElement(null));
    act(()=>helper.props.onPopoverElement({isConnected:true,getClientRects:()=>[{}],closest:()=>null},closeHelp));focus.mockClear();
    const event=()=>({key:'Escape',preventDefault:jest.fn(),stopPropagation:jest.fn(),stopImmediatePropagation:jest.fn()});
    const key=(value:ReturnType<typeof event>)=>{for(const callback of listeners.get('keydown')??[])callback(value);};
    const first=event();act(()=>{key(first);dropdown.props.onRequestClose();});
    expect(closeHelp).toHaveBeenCalledTimes(1);expect(first.preventDefault).toHaveBeenCalledTimes(1);expect(first.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(props.onControlsClose).not.toHaveBeenCalled();expect(focus).not.toHaveBeenCalled();
    await act(flush);
    const second=event();await act(async()=>{key(second);dropdown.props.onRequestClose();await flush();});
    expect(second.preventDefault).not.toHaveBeenCalled();expect(closeHelp).toHaveBeenCalledTimes(1);
    expect(props.onControlsClose).toHaveBeenCalledTimes(1);expect(focus).toHaveBeenCalledTimes(1);expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('outside dismissal gives visible nested help priority while an explicit camera X still closes the whole panel',async()=>{
    await mount({controlsOpen:true});const helper=view!.root.findByType('pairing' as never),dropdown=view!.root.findByType('dropdown' as never);
    act(()=>helper.props.onPopoverElement({isConnected:true,getClientRects:()=>[{}],closest:()=>null}));
    act(()=>{for(const callback of listeners.get('pointerdown')??[])callback({type:'pointerdown'});helper.props.onPopoverElement(null);dropdown.props.onRequestClose();});
    expect(props.onControlsClose).not.toHaveBeenCalled();await act(flush);
    act(()=>helper.props.onPopoverElement({isConnected:true,getClientRects:()=>[{}],closest:()=>null}));
    act(()=>action('Fechar câmera').props.onPress());expect(props.onControlsClose).toHaveBeenCalledTimes(1);
    expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('preparing, pairing, start and power actions call only their actual host operations',async()=>{
    await mount({controlsOpen:true});act(()=>action('Conectar câmera ao vivo').props.onPress());expect(mockLive.start).toHaveBeenCalledTimes(1);
    act(()=>view!.root.findByType('pairing' as never).props.onCheck());expect(mockLive.refreshConfig).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'preview'};await update();
    act(()=>action('Iniciar gravação no celular').props.onPress());expect(mockLive.startRecording).toHaveBeenCalledTimes(1);
    act(()=>action('Desligar câmera do celular').props.onPress());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('camera-off');
    mockLive={...mockLive,stream:null,cameraState:'off'};await update();act(()=>action('Ligar câmera do celular').props.onPress());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('camera-on');
});

test('pause/resume/stop retain pending and disconnection guards without parallel scoreboard',async()=>{
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'recording',session,recording:{state:'recording',durationMs:12500}};await mount({controlsOpen:true});
    act(()=>action('Pausar gravação no celular').props.onPress());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('pause-recording');
    act(()=>action('Parar gravação no celular').props.onPress());expect(mockLive.stopRecording).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,recording:{state:'paused'},cameraState:'paused'};await update();act(()=>action('Continuar gravação no celular').props.onPress());expect(mockLive.cameraCommand).toHaveBeenLastCalledWith('resume-recording');
    mockLive={...mockLive,controlPending:'resume-recording'};await update();expect(action('Continuar gravação no celular').props.disabled).toBe(true);expect(action('Parar gravação no celular').props.disabled).toBe(true);
    mockLive={...mockLive,controlPending:null,connection:'disconnected'};await update();expect(action('Continuar gravação no celular')).toBeUndefined();expect(action('Parar gravação no celular')).toBeUndefined();
});

test('capture clock updates do not refocus the panel or reset its nested-help listeners',async()=>{
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'recording',recording:{state:'recording'},stamp:{timeMs:1000}};
    await mount({controlsOpen:true});expect(focus).toHaveBeenCalledTimes(1);
    const adds=(window.addEventListener as jest.Mock).mock.calls.length;
    act(()=>view!.root.findByType('pairing' as never).props.onPopoverElement({isConnected:true,getClientRects:()=>[{}],closest:()=>null}));
    focus.mockClear();
    for(const timeMs of [1500,2000,2500]){mockLive={...mockLive,stamp:{timeMs}};await update();}
    expect(focus).not.toHaveBeenCalled();expect((window.addEventListener as jest.Mock).mock.calls).toHaveLength(adds);
    await update({controlsOpen:false});await update({controlsOpen:true});expect(focus).toHaveBeenCalledTimes(1);
});

test.each(['error',null,'off'])('unsupported camera state %s exposes no enabled start action',async(cameraState)=>{
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState};await mount({controlsOpen:true});
    expect(action('Iniciar gravação no celular')).toBeUndefined();expect(mockLive.startRecording).not.toHaveBeenCalled();
});

test('an ended video track disables start even while a connected camera reports preview',async()=>{
    mockLive={...mockLive,room:{},stream:{getVideoTracks:()=>[{readyState:'ended'}]},connection:'connected',cameraState:'preview'};
    const onWorkspaceControlsChange=jest.fn();await mount({controlsOpen:true,bench:true,onWorkspaceControlsChange});
    expect(onWorkspaceControlsChange.mock.lastCall![0]).toMatchObject({hasPreview:false,canStart:false});
    expect(action('Iniciar gravação no celular').props.disabled).toBe(true);act(()=>action('Iniciar gravação no celular').props.onPress());
    expect(mockLive.startRecording).not.toHaveBeenCalled();expect(view!.root.findByProps({'data-presentation':'main'}).props.hidden).toBe(true);
});

test('a stale disconnected stream releases the stage preview portal without remounting or disconnecting its host',async()=>{
    const target={id:'stage-with-empty-video-cta'} as unknown as HTMLElement,onHostApi=jest.fn(),onWorkspaceControlsChange=jest.fn();
    const stream={getVideoTracks:()=>[{readyState:'live'}]};mockLive={...mockLive,room:{},stream,connection:'connected',cameraState:'preview'};
    await mount({bench:true,previewTarget:target,onHostApi,onWorkspaceControlsChange});const video=view!.root.findByType('video'),attachmentCalls=mockLive.attachVideo.mock.calls.length;
    mockLive={...mockLive,connection:'disconnected'};await update();
    expect(onWorkspaceControlsChange.mock.lastCall![0].hasPreview).toBe(false);expect(view!.root.findByType('video')).toBe(video);
    expect(view!.root.findByProps({'data-presentation':'main'}).props.hidden).toBe(true);expect(view!.root.findByProps({'data-presentation':'main'}).parent?.props.container).toBe(target);
    expect(mockLive.attachVideo).toHaveBeenCalledTimes(attachmentCalls);expect(mockLive.stream).toBe(stream);expect(onHostApi).toHaveBeenCalledTimes(1);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
});

test('disconnected saved recording separates local download from reconnection and removes dead capture controls',async()=>{
    const current={...session,ended:true,recordingState:'stopped',durationMs:28000};
    mockLive={...mockLive,room:{},stream:{},connection:'disconnected',cameraState:'preview',session:current,recording:{state:'stopped',durationMs:28000},canNewRecording:true,videoStatuses:{'host-1':{state:'ready',receivedBytes:100,totalBytes:100}},error:'Falha local preservada'};
    await mount({controlsOpen:true,bench:true});
    expect(action('Nova gravação ao vivo')).toBeUndefined();expect(action('Desligar câmera do celular')).toBeUndefined();
    expect(view!.root.findByProps({className:'lwc-capture-summary'}).findAllByType('time')).toHaveLength(0);
    expect(view!.root.findByProps({className:'lwc-reconnect'}).findByType('strong').children).toEqual(['Reconectar']);
    const saved=view!.root.findByProps({'aria-label':'Vídeo no computador'});expect(saved.findByType('strong').children).toEqual(['Vídeo salvo']);
    expect(saved.findByType('small').children.join('')).toBe('00:28 · Neste computador');expect(action('Baixar vídeo desta gravação ao vivo').props.children).toBeUndefined();
    expect(view!.root.findByProps({className:'sv-alert'}).children).toEqual(['Falha local preservada']);
    act(()=>action('Baixar vídeo desta gravação ao vivo').props.onPress());expect(mockLive.downloadSavedVideo).toHaveBeenCalledWith(current);
    expect(mockLive.newRecording).not.toHaveBeenCalled();expect(mockLive.cameraCommand).not.toHaveBeenCalled();
});

test('camera source labels configured quality without claiming measured recording frames',async()=>{
    const captureInfo={label:'back camera',width:1920,height:1080,frameRate:59.94,zoom:1};
    mockLive={...mockLive,room:{},stream:{},connection:'connected',cameraState:'preview',captureInfo};await mount({controlsOpen:true});
    expect(view!.root.findByProps({className:'lwc-source'}).children.join('')).toBe('Câmera traseira · 1× · 1080p · 60 fps configurados');expect(mockLive.captureInfo).toBe(captureInfo);
});

test('historical copy progress cannot replace the current saved video status or error',()=>{
    const current={...session,ended:true,recordingState:'stopped'};
    const derived=workspaceCameraStatus({...mockBase,session:current,videoStatuses:{'host-1':{state:'ready',receivedBytes:100,totalBytes:100},old:{state:'receiving',receivedBytes:13,totalBytes:100,error:'Erro antigo'}}} as any);
    expect(derived).toMatchObject({state:'saved',label:'Original salvo',receiving:false,error:null,copyPercent:100,elapsedMs:null});
    const pending=workspaceCameraStatus({...mockBase,videoStatuses:{old:{state:'receiving',receivedBytes:13,totalBytes:100}}} as any);
    expect(pending).toMatchObject({state:'copying',label:'Envio pausado',receiving:true,connected:false,copyPercent:13});
});

test('an explicit camera failure stays visible without stopping a known capture or changing its session',()=>{
    const source={...mockBase,room:{},connection:'connected',cameraState:'error',recording:{state:'recording'},session,stream:{}};
    expect(workspaceCameraStatus(source as any)).toMatchObject({state:'error',label:'Falha na câmera',error:'A câmera informou uma falha. Confira o celular.'});
    expect(workspaceCameraControlState(source as any)).toMatchObject({canStop:true,hasPreview:false});
    expect(source.recording.state).toBe('recording');expect(source.session).toBe(session);
});

test('new recording respects host eligibility and copy progress does not claim a ready original',async()=>{
    mockLive={...mockLive,room:{},connection:'connected',session:{...session,ended:true,recordingState:'stopped'},recording:{state:'stopped'},videoStatuses:{'host-1':{state:'receiving',receivedBytes:390,totalBytes:1000}},canNewRecording:false};
    const onWorkspaceStatusChange=jest.fn();await mount({controlsOpen:true,onWorkspaceStatusChange});
    expect(action('Nova gravação ao vivo').props.disabled).toBe(true);expect(action('Baixar vídeo desta gravação ao vivo')).toBeUndefined();
    expect(view!.root.findByType('progress').props).toMatchObject({value:39,max:100});expect(onWorkspaceStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({state:'copying',label:'Salvando vídeo',copyPercent:39,receiving:true}));
    mockLive={...mockLive,videoStatuses:{'host-1':{state:'ready',receivedBytes:1000,totalBytes:1000}},canNewRecording:true};await update();
    expect(action('Nova gravação ao vivo').props.disabled).toBe(false);act(()=>action('Nova gravação ao vivo').props.onPress());expect(mockLive.newRecording).toHaveBeenCalledTimes(1);
    act(()=>action('Baixar vídeo desta gravação ao vivo').props.onPress());expect(mockLive.downloadSavedVideo).toHaveBeenCalledWith(mockLive.session);
    expect(onWorkspaceStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({state:'saved',label:'Original salvo',receiving:false}));
});

test('a disconnected peer reports a paused copy and keeps its committed progress while the same channel recovers',async()=>{
    const partial=Object.freeze({state:'receiving',receivedBytes:30,totalBytes:1000});
    mockLive={...mockLive,room:{},connection:'disconnected',session:{...session,ended:true,recordingState:'stopped'},recording:{state:'stopped'},videoStatuses:{'host-1':partial}};
    const onHostApi=jest.fn();await mount({controlsOpen:true,onHostApi});
    expect(view!.root.findAllByType('p').some(node=>node.children.join('')==='Envio pausado · 3%')).toBe(true);
    expect(view!.root.findByType('progress').props.value).toBe(3);expect(action('Baixar vídeo desta gravação ao vivo')).toBeUndefined();
    mockLive={...mockLive,connection:'connected'};await update();
    expect(view!.root.findAllByType('p').some(node=>node.children.join('')==='Salvando no computador · 3%')).toBe(true);
    expect(mockLive.videoStatuses['host-1']).toBe(partial);expect(onHostApi).toHaveBeenCalledTimes(1);
    expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.requestSavedVideo).not.toHaveBeenCalled();
});

test('library includes current recording once and keeps review/download/removal tied to true sessions',async()=>{
    const current={...session,ended:true,recordingState:'stopped'},old={...current,id:'old',recordingId:'old-recording'};
    mockLive={...mockLive,session:current,history:[current,old]};await mount({libraryOpen:true,visible:false});
    const library=view!.root.findByType('library' as never);expect(library.props.sessions.map((value:any)=>value.id)).toEqual(['host-1','old']);
    act(()=>library.props.onReview(old));expect(view!.root.findByType('recording-review' as never).props.session).toBe(old);
    act(()=>library.props.onRemove(old));expect(view!.root.findAllByType('dialog').some(node=>node.props.title==='Excluir registros deste notebook?')).toBe(true);
    expect(mockLive.deleteSaved).not.toHaveBeenCalled();expect(view!.root.findAllByType('portal' as never).every(node=>node.props.container===body)).toBe(true);
});

test('integrated library opens official linked replay and dismisses only the library',async()=>{
    const onReview=jest.fn(),integratedScouting={recordings:[],onRegister:jest.fn(),onReview};mockLive={...mockLive,history:[session]};await mount({libraryOpen:true,integratedScouting});
    act(()=>view!.root.findByType('library' as never).props.integratedScouting.onReview(session.recordingId));
    expect(props.onLibraryClose).toHaveBeenCalled();expect(onReview).toHaveBeenCalledWith(session.recordingId);expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('a leave guard opened from a hidden preview renders its confirmation in the body and disconnects only on explicit confirmation',async()=>{
    mockLive={...mockLive,room:{},session,recording:{state:'recording'}};const onLeaveGuard=jest.fn(),next=jest.fn();await mount({visible:false,onLeaveGuard});
    act(()=>onLeaveGuard.mock.calls[0][0](next));expect(view!.root.findByType('dialog').props.title).toBe('Fechar conexão no notebook?');expect(mockLive.disconnect).not.toHaveBeenCalled();
    act(()=>action('Continuar no modo ao vivo').props.onPress());expect(next).not.toHaveBeenCalled();
    act(()=>onLeaveGuard.mock.calls[0][0](next));await act(async()=>{await action('Fechar conexão do notebook').props.onPress();await flush();});
    expect(mockLive.disconnect).toHaveBeenCalledTimes(1);expect(next).toHaveBeenCalledTimes(1);
});

test('status publishes only actual changes, rounds elapsed to seconds and contains no camera capability URL',async()=>{
    mockLive={...mockLive,connection:'connected',stream:{},cameraState:'recording',recording:{state:'recording'},stamp:{timeMs:12345},room:{cameraUrl:'https://camera/#secret'}};
    const onWorkspaceStatusChange=jest.fn();await mount({onWorkspaceStatusChange});expect(onWorkspaceStatusChange).toHaveBeenCalledTimes(1);
    await update({controlsOpen:true});await update({controlsOpen:false,visible:false});expect(onWorkspaceStatusChange).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,stamp:{timeMs:12999}};await update();expect(onWorkspaceStatusChange).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,stamp:{timeMs:13001}};await update();expect(onWorkspaceStatusChange).toHaveBeenCalledTimes(2);
    expect(onWorkspaceStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({label:'Gravando',elapsedMs:13000}));expect(JSON.stringify(onWorkspaceStatusChange.mock.calls)).not.toMatch(/secret|https:/);
});

test('truthful status distinguishes prepared camera, camera off, interrupted capture and incomplete originals',()=>{
    const derive=(patch:object)=>workspaceCameraStatus({...mockBase,...patch} as any);
    expect(derive({connection:'connected',stream:{},cameraState:'preview'}).label).toBe('Câmera pronta');
    expect(derive({connection:'connected',cameraState:'off'}).label).toBe('Câmera desligada');
    expect(derive({connection:'disconnected',recording:{state:'recording'}})).toMatchObject({state:'disconnected',label:'Conexão interrompida'});
    expect(derive({session:{...session,ended:true,recordingState:'stopped'},recording:{state:'stopped'}}).label).toBe('Gravação encerrada');
    expect(derive({session:{...session,ended:true},videoStatuses:{'host-1':{state:'error',receivedBytes:13,totalBytes:100,error:'Sem espaço'}}})).toMatchObject({state:'error',label:'Vídeo pendente',error:'Sem espaço',copyPercent:13,receiving:false});
});
