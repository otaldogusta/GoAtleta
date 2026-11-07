import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import ScoutingLive,{exportLiveHostSession} from '../live/ScoutingLive.web';
import LiveCameraConnection from '../live/LiveCameraConnection.web';
import {downloadVideoBlob} from '../video/video-media.web';
import {createPortal} from 'react-dom';
import type {LiveHostSnapshot} from '../live/live-scouting-contract';
const mockHostSnapshot:LiveHostSnapshot={scope:{userId:'user',org:'org',classId:'class'},epoch:1,peerGeneration:1,hostSessionId:null,recordingId:null,segmentId:null,recordingState:null,cameraState:null,connection:'idle',blockedReason:'no-recording',ended:false,videoState:null};
const mockHostApi={getSnapshot:jest.fn(()=>mockHostSnapshot),getCaptureStamp:jest.fn(()=>null),loadSavedVideo:jest.fn(async()=>null),getReplayCapture:jest.fn(()=>({stream:null as MediaStream|null,stamp:null,snapshot:mockHostSnapshot,playoutDelayMs:0}))};
const mockBase={bridgeApi:mockHostApi,captureInfo:null as any,checkingConfig:false,serviceCheck:null as string|null,videoStatuses:{} as any,loadSavedVideo:jest.fn(async()=>null),saveImportedVideo:jest.fn(async()=>true),downloadSavedVideo:jest.fn(),requestSavedVideo:jest.fn(),cameraState:null as any,controlPending:null as any,cameraCommand:jest.fn(),canNewRecording:false,newRecording:jest.fn(),startPending:false,startRecording:jest.fn(),stopPending:false,stopRecording:jest.fn(),config:null,room:null as any,error:'',connection:'idle',stream:null as any,session:null as any,history:[] as any[],recording:null as any,busy:false,saving:false,pendingCopies:0,stamp:null as any,deleted:null as any,attachVideo:jest.fn(),refreshConfig:jest.fn(),start:jest.fn(),mark:jest.fn(),undo:jest.fn(),nextSet:jest.fn(),disconnect:jest.fn(async()=>true),deleteSaved:jest.fn(async()=>true),restoreDeleted:jest.fn(async()=>true),canDeleteSession:jest.fn(()=>true),canMark:false};
let mockLive={...mockBase};
jest.mock('../live/use-live-host',()=>({useLiveHost:()=>mockLive}));
// UI contracts do not exercise telemetry or its background cleanup interval.
jest.mock('../../../observability/perf',()=>({markRender:jest.fn(),measureAsync:(_name:string,task:()=>Promise<unknown>)=>task()}));
jest.mock('react-dom',()=>({createPortal:jest.fn((children:unknown)=>children)}));
jest.mock('../../../core/scouting-live-qr',()=>({liveQrSvg:jest.fn(()=>'<svg/>')}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{background:'#080f1b',card:'#172234',inputBg:'#121c30',text:'#fff',muted:'#8fa1ba',border:'#283548',primaryBg:'#30d786',primaryText:'#052819',warning:'#e3b260'}})}));
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:object)=>jest.requireActual('react').createElement('button',props),StudioDialog:({children,...props}:any)=>jest.requireActual('react').createElement('dialog',props,children)}));
jest.mock('../../../ui/AnchoredDropdown',()=>({AnchoredDropdown:({visible,children}:any)=>visible?jest.requireActual('react').createElement('popover',null,children):null}));
jest.mock('../../../ui/icon-registry',()=>({GoAtletaIcon:(props:object)=>jest.requireActual('react').createElement('icon',props)}));
jest.mock('../video/video-media.web',()=>({downloadVideoBlob:jest.fn()}));
const point={id:'point-1',recordingId:'recording-1',timeMs:10000,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:500,clockMode:'estimated',createdAtHostEpochMs:2000000};
const session={version:1 as const,id:'session-1',scope:{userId:'user',org:'org',classId:'class'},recordingId:'recording-1',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[point],gaps:[],mimeType:'video/webm',ended:false};
let view:ReactTestRenderer;
const mount=(onClose=jest.fn())=>{act(()=>{view=create(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',className:'Sub19',onClose}));});return onClose;};
beforeEach(()=>{jest.clearAllMocks();mockHostApi.getSnapshot.mockReturnValue(mockHostSnapshot);mockHostApi.getReplayCapture.mockReturnValue({stream:null,stamp:null,snapshot:mockHostSnapshot,playoutDelayMs:0});mockLive={...mockBase,start:jest.fn(),mark:jest.fn(),disconnect:jest.fn(async()=>true),deleteSaved:jest.fn(async()=>true),restoreDeleted:jest.fn(async()=>true),canDeleteSession:jest.fn(()=>true)};});
afterEach(()=>{if(view)act(()=>view.unmount());});
test('idle camera exposes connection without unusable point controls',()=>{
    mount();
    expect(view.root.findAllByProps({label:'Registrar nosso ponto no vídeo ao vivo'})).toHaveLength(0);
    expect(view.root.findAllByProps({label:'Registrar ponto adversário no vídeo ao vivo'})).toHaveLength(0);
    expect(view.root.findAllByType('video')).toHaveLength(0);
    expect(view.root.findByProps({label:'Conectar câmera ao vivo'}).parent?.props['aria-label']).toBe('Conectar ou recuperar câmera');
    act(()=>view.root.findByProps({label:'Conectar câmera ao vivo'}).props.onPress());
    expect(mockLive.start).toHaveBeenCalledTimes(1);
    expect(mockLive.mark).not.toHaveBeenCalled();
});

test('the embedded camera publishes one stable bridge and clears it when unmounted',()=>{
    const onHostApi=jest.fn(),onHostSnapshot=jest.fn(),props={userId:'user',org:'org',classId:'class',embedded:true,onClose:jest.fn(),onHostApi,onHostSnapshot};
    act(()=>{view=create(createElement(ScoutingLive,props));});
    expect(onHostApi).toHaveBeenCalledTimes(1);expect(onHostApi).toHaveBeenLastCalledWith(mockHostApi);
    expect(onHostSnapshot).toHaveBeenLastCalledWith(mockHostSnapshot);
    act(()=>view.update(createElement(ScoutingLive,{...props,visible:false})));
    expect(onHostApi).toHaveBeenCalledTimes(1);expect(onHostSnapshot).toHaveBeenCalledTimes(1);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.stopRecording).not.toHaveBeenCalled();
    act(()=>view.unmount());expect(onHostApi).toHaveBeenLastCalledWith(null);
});

test('snapshot callbacks include stream and segment changes without publishing a stream field',()=>{
    const onHostSnapshot=jest.fn(),props={userId:'user',org:'org',classId:'class',embedded:true,onClose:jest.fn(),onHostSnapshot};
    act(()=>{view=create(createElement(ScoutingLive,props));});expect(onHostSnapshot).toHaveBeenCalledTimes(1);
    const stream={} as MediaStream;mockHostApi.getReplayCapture.mockReturnValue({...mockHostApi.getReplayCapture(),stream});
    act(()=>view.update(createElement(ScoutingLive,props)));expect(onHostSnapshot).toHaveBeenCalledTimes(2);
    mockHostApi.getSnapshot.mockReturnValue({...mockHostSnapshot,segmentId:'segment-2'} as typeof mockHostSnapshot);
    act(()=>view.update(createElement(ScoutingLive,props)));expect(onHostSnapshot).toHaveBeenCalledTimes(3);
    expect(onHostSnapshot.mock.calls[2][0]).toMatchObject({segmentId:'segment-2'});expect(onHostSnapshot.mock.calls[2][0]).not.toHaveProperty('stream');
});

test('camera information uses a friendly facing and keeps quality inside a closed disclosure',()=>{
    mockLive={...mockLive,captureInfo:{label:'camera 0, facing back',width:1920,height:1080,frameRate:30,zoom:1}};mount();
    const info=view.root.findByProps({'aria-label':'Informações da câmera'});
    expect(info.type).toBe('details');expect(info.props.open).not.toBe(true);
    expect(info.findByType('summary').children.join('')).toBe('Câmera traseira · 1×');
    expect(info.findByType('small').children.join('')).toBe('Full HD · 30 quadros/s configurados');
});

test('checking the local service shows pending and then a visible result, without duplicating failures',()=>{
    mount();
    act(()=>view.root.findByProps({label:'Verificar serviço ao vivo'}).props.onPress());
    expect(mockLive.refreshConfig).toHaveBeenCalledTimes(1);
    mockLive={...mockLive,checkingConfig:true};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findByProps({label:'Verificar serviço ao vivo'}).props.disabled).toBe(true);
    expect(view.root.findByProps({label:'Verificar serviço ao vivo'}).props.children).toBe('Verificando…');
    mockLive={...mockLive,checkingConfig:false,serviceCheck:'Serviço disponível · câmera pronta.'};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findAllByType('p').find(node=>node.props.role==='status')?.children.join('')).toBe('Serviço disponível · câmera pronta.');
    expect(view.root.findByProps({label:'Verificar serviço ao vivo'}).props.disabled).toBe(false);
    mockLive={...mockLive,serviceCheck:null,error:'Serviço ao vivo desconectado.'};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findAllByType('p').filter(node=>node.props.role==='status')).toHaveLength(0);
    expect(view.root.findAllByProps({role:'alert'})).toHaveLength(1);
});

test('copying the current camera link preserves the pairing and reports clipboard failure to the connection tools',async()=>{
    const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
    const writeText=jest.fn(async()=>{});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText}}});
    const room={cameraUrl:'https://phone.local/camera#room=fixture&token=camera-only',localCameraUrl:'http://localhost:8096/camera#room=fixture&token=camera-only'};
    try{
        mockLive={...mockLive,room,connection:'disconnected'};mount();
        const connection=view.root.findByType(LiveCameraConnection);
        await expect(connection.props.onCopy()).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith(room.cameraUrl);
        writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
        await expect(connection.props.onCopy()).resolves.toBe(false);
        expect(mockLive.room).toBe(room);
        expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();
    }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator');}
});

test('an abandoned unfinished recording offers recoverable removal while retaining its points until confirmed',()=>{
    const abandoned={...session,id:'abandoned'};
    mockLive={...mockLive,history:[abandoned]};mount();
    const label=`Excluir registros do notebook de ${new Date(abandoned.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}`;
    expect(view.root.findByProps({label}).props.disabled).toBe(false);
    expect(view.root.findAllByType('button').some(button=>button.props.label?.startsWith('Receber vídeo'))).toBe(false);
    act(()=>view.root.findByProps({label}).props.onPress());
    expect(view.root.findByType('dialog').props.title).toBe('Excluir registros deste notebook?');
    expect(view.root.findAllByType('p').some(node=>node.children.join('').includes('Este registro não foi finalizado.'))).toBe(true);
    act(()=>view.root.findByProps({label:'Cancelar exclusão dos registros'}).props.onPress());
    expect(mockLive.deleteSaved).not.toHaveBeenCalled();expect(mockLive.history[0].points).toHaveLength(1);
});
test('completed capture offers a new recording inside the studio and blocks it during pending work',()=>{
    mockLive={...mockLive,session:{...session,ended:true,recordingState:'stopped'},recording:{state:'stopped'},canNewRecording:true};mount();
    act(()=>view.root.findByProps({label:'Nova gravação ao vivo'}).props.onPress());expect(mockLive.newRecording).toHaveBeenCalledTimes(1);
    act(()=>view.unmount());mockLive={...mockLive,canNewRecording:false,controlPending:'new-recording'};mount();
    const button=view.root.findByProps({label:'Nova gravação ao vivo'});expect(button.props.disabled).toBe(true);expect(button.props.children).toBe('Preparando câmera…');
});

test('prepared preview exposes start and waits without pretending capture is active',()=>{
    mockLive={...mockLive,connection:'connected',stream:{},room:{}};mount();
    act(()=>view.root.findByProps({label:'Iniciar gravação no celular'}).props.onPress());
    expect(mockLive.startRecording).toHaveBeenCalledTimes(1);
    act(()=>view.unmount());mockLive={...mockLive,startPending:true};mount();
    const button=view.root.findByProps({label:'Iniciar gravação no celular'});
    expect(button.props.disabled).toBe(true);expect(button.props.children).toBe('Iniciando no celular…');
    expect(view.root.findAllByProps({label:'Parar gravação no celular'})).toHaveLength(0);
});

test('paused capture offers continue and stop, while idle paired camera offers its power switch',()=>{
    mockLive={...mockLive,connection:'connected',cameraState:'paused',recording:{state:'paused',durationMs:14000},session};mount();
    act(()=>view.root.findByProps({label:'Continuar gravação no celular'}).props.onPress());
    expect(mockLive.cameraCommand).toHaveBeenCalledWith('resume-recording');
    expect(view.root.findByProps({label:'Parar gravação no celular'}).props.disabled).toBe(false);
    expect(view.root.findAllByProps({label:'Desligar câmera do celular'})).toHaveLength(0);
    act(()=>view.unmount());mockLive={...mockLive,cameraState:'off',room:{},recording:null,session:null};mount();
    act(()=>view.root.findByProps({label:'Ligar câmera do celular'}).props.onPress());
    expect(mockLive.cameraCommand).toHaveBeenCalledWith('camera-on');
});

test('recording exposes remote stop and disables it while waiting for camera finalization',()=>{
    mockLive={...mockLive,connection:'connected',recording:{state:'recording'},session};mount();
    act(()=>view.root.findByProps({label:'Parar gravação no celular'}).props.onPress());
    expect(mockLive.stopRecording).toHaveBeenCalledTimes(1);
    act(()=>view.unmount());mockLive={...mockLive,stopPending:true};mount();
    const button=view.root.findByProps({label:'Parar gravação no celular'});
    expect(button.props.disabled).toBe(true);expect(button.props.children).toBe('Finalizando no celular…');
});

test('Wi-Fi QR keeps one instruction and exposes Android setup through the on-demand help',()=>{
    mockLive={...mockLive,config:{cameraReady:true} as any,room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'}};
    mount();
    expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByType('p').some(p=>p.children.join('')==='Leia o QR no celular.')).toBe(true);
    expect(view.root.findByType(LiveCameraConnection).props.cameraReady).toBe(true);
    expect(view.root.findAllByProps({accessibilityLabel:'Ajuda da conexão da câmera'}).length).toBeGreaterThan(0);
    expect(view.root.findAllByType('a').some(link=>link.props.href==='http://127.0.0.1:8096/certificate.crt')).toBe(false);
});
test('a local test link is distinct from a Wi-Fi QR requiring secure camera access',async()=>{
    mockLive.room={cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'};
    const close=mount(),connection=view.root.findByType(LiveCameraConnection);
    expect(view.root.findAllByType('img')).toHaveLength(0);
    expect(connection.props.localCameraUrl).toBe(mockLive.room.localCameraUrl);
    expect(view.root.findAllByType('a')).toHaveLength(0);
    await expect(connection.props.onCopy()).resolves.toBe(false);
    expect(view.root.findAllByType('p').some(p=>p.children.join('').includes('acesso seguro'))).toBe(true);
    const cameraUrl='https://192.168.1.10:8097/camera#room=test&token=camera';
    mockLive={...mockLive,room:{...mockLive.room,cameraUrl}};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:close})));
    const localTest=view.root.findByProps({'aria-label':'Testar câmera neste computador'});
    expect(localTest.type).toBe('a');expect(localTest.props.href).toBe(mockLive.room.localCameraUrl);
    expect(localTest.props.target).toBe('_blank');expect(localTest.props.rel).toBe('noopener noreferrer');
    expect(jest.requireMock('../../../core/scouting-live-qr').liveQrSvg).toHaveBeenLastCalledWith(cameraUrl);
    expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.startRecording).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('pairing appears beside the empty player once a room exists, without duplicating the central connection action',()=>{
    mockLive={...mockLive,connection:'waiting',room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'}};
    mount();
    expect(view.root.findAllByType('video')).toHaveLength(0);expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByProps({label:'Conectar câmera ao vivo'})).toHaveLength(0);
    expect(view.root.findAllByProps({accessibilityLabel:'Copiar link da câmera'}).length).toBeGreaterThan(0);
    expect(view.root.findAllByType('details').find(node=>node.props.className.includes('sv-live-pair'))?.props.open).toBe(true);
    expect(mockLive.start).not.toHaveBeenCalled();
});

test('a disconnected recording keeps its same room and timeline and directs reconnection from the open phone page',()=>{
    mockLive={...mockLive,room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},connection:'disconnected',stream:{},session,recording:{state:'recording'}};
    mount();
    expect(view.root.findByType('video').props.controls).toBe(true);
    expect(view.root.findByProps({'aria-label':'Conectar ou recuperar câmera'}).findByType('h2').children.join('')).toBe('Conexão interrompida');
    expect(view.root.findAllByType('p').some(node=>node.children.join('')==='No celular, toque em Reconectar na tela que já está aberta.')).toBe(true);
    const warning=view.root.findByProps({className:'lc-warning'});
    expect(warning.props.role).toBe('alert');expect(warning.findByType('span').children.join('')).toBe('A gravação pode continuar no celular. Não recarregue.');
    expect(warning.parent?.props.className).toBe('lc-connection');
    expect(view.root.findAllByProps({label:'Conectar câmera ao vivo'})).toHaveLength(0);
    expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.session).toBe(session);
});

test('an unfinished capture without a room and a terminal snapshot never start another capture automatically',()=>{
    mockLive={...mockLive,session,recording:{state:'recording'}};mount();
    expect(view.root.findAllByProps({label:'Conectar câmera ao vivo'})).toHaveLength(0);
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    mockLive={...mockLive,session:{...session,ended:true},recording:{state:'stopped'}};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findAllByProps({label:'Conectar câmera ao vivo'})).toHaveLength(0);
    expect(mockLive.start).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});
test('a synchronized source enables only explicit point actions and shows estimated timing honestly',()=>{
    mockLive={...mockLive,canMark:true,session,connection:'connected',recording:{state:'recording'} as any,stamp:{timeMs:10000,mode:'estimated',uncertaintyMs:500}};
    mount();
    const action=view.root.findByProps({label:'Registrar nosso ponto no vídeo ao vivo'});
    expect(action.props.disabled).toBe(false);act(()=>action.props.onPress());
    expect(mockLive.mark).toHaveBeenCalledWith(true);
    expect(view.root.findAllByType('small').some(p=>p.children.join('').includes('Sincronização aproximada'))).toBe(true);
});

test.each([false,true])('integrated scouting shows canonical lances and routes both actions without a parallel score (ended: %s)',ended=>{
    const integratedScouting={recordings:[{recordingId:session.recordingId,clipCount:1}],onRegister:jest.fn(),onReview:jest.fn()};
    mockLive={...mockLive,session:{...session,points:[],ended,recordingState:ended?'stopped':undefined},recording:{recordingId:session.recordingId,state:ended?'stopped':'recording'},connection:'connected',canMark:true};
    act(()=>{view=create(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn(),integratedScouting}));});
    const summary=view.root.findByProps({'aria-label':'Scouting da gravação'});expect(summary.findByType('small').children.join('')).toBe('1 lance');
    for(const label of ['Registrar nosso ponto no vídeo ao vivo','Registrar ponto adversário no vídeo ao vivo','Iniciar próximo set ao vivo','Desfazer último ponto ao vivo','Rever vídeo desta gravação ao vivo'])expect(view.root.findAllByProps({label})).toHaveLength(0);
    expect(view.root.findAllByType('h2').some(node=>node.children.join('')==='Pontos desta gravação')).toBe(false);
    act(()=>view.root.findByProps({label:'Registrar scouting desta gravação'}).props.onPress());expect(integratedScouting.onRegister).toHaveBeenCalledTimes(1);
    act(()=>view.root.findByProps({label:'Ver lances desta gravação'}).props.onPress());expect(integratedScouting.onReview).toHaveBeenCalledWith(session.recordingId);
    expect(mockLive.mark).not.toHaveBeenCalled();expect(mockLive.nextSet).not.toHaveBeenCalled();expect(mockLive.undo).not.toHaveBeenCalled();expect(view.root.findAllByType('dialog')).toHaveLength(0);
});

test('integrated scouting starts at zero lances and follows live count updates without changing camera commands',()=>{
    const integratedScouting={recordings:[],onRegister:jest.fn(),onReview:jest.fn()},props={userId:'user',org:'org',classId:'class',onClose:jest.fn(),integratedScouting};
    mockLive={...mockLive,session,recording:{recordingId:session.recordingId,state:'recording'},connection:'connected'};
    act(()=>{view=create(createElement(ScoutingLive,props));});expect(view.root.findByProps({'aria-label':'Scouting da gravação'}).findByType('small').children.join('')).toBe('0 lances');
    act(()=>view.update(createElement(ScoutingLive,{...props,integratedScouting:{...integratedScouting,recordings:[{recordingId:session.recordingId,clipCount:2}]}})));
    expect(view.root.findByProps({'aria-label':'Scouting da gravação'}).findByType('small').children.join('')).toBe('2 lances');
    act(()=>view.root.findByProps({label:'Parar gravação no celular'}).props.onPress());expect(mockLive.stopRecording).toHaveBeenCalledTimes(1);expect(mockLive.mark).not.toHaveBeenCalled();
});

test('a linked saved card routes to the integrated review without opening the legacy video dialog',()=>{
    const saved={...session,id:'saved-2',recordingId:'recording-2',points:[],ended:true},integratedScouting={recordings:[{recordingId:'recording-2',clipCount:1}],onRegister:jest.fn(),onReview:jest.fn()};
    mockLive={...mockLive,session,history:[session,saved]};
    act(()=>{view=create(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn(),integratedScouting}));});
    const action=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Ver lances da gravação de '));
    act(()=>action!.props.onPress());expect(integratedScouting.onReview).toHaveBeenCalledWith('recording-2');expect(view.root.findAllByType('dialog')).toHaveLength(0);
});
test('leaving an active connection requires a concrete close action and does not send camera-stop',async()=>{
    mockLive.room={cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'};
    const close=mount();act(()=>view.root.findByProps({label:'Voltar do modo ao vivo'}).props.onPress());
    expect(close).not.toHaveBeenCalled();
    expect(view.root.findByType('dialog').props.title).toBe('Fechar conexão no notebook?');
    await act(async()=>{await view.root.findByProps({label:'Fechar conexão do notebook'}).props.onPress();await Promise.resolve();});
    expect(mockLive.disconnect).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledTimes(1);
});
test('portable point exports omit organization, user and pairing capabilities',()=>{
    const original=global.Blob;
    class TestBlob{parts:unknown[];constructor(parts:unknown[]){this.parts=parts;}}
    global.Blob=TestBlob as unknown as typeof Blob;
    try{exportLiveHostSession(session as any);const blob=(downloadVideoBlob as jest.Mock).mock.calls[0][0] as TestBlob;const raw=blob.parts.join('');expect(raw).toContain('recording-1');expect(raw).not.toContain('userId');expect(raw).not.toContain('hostToken');expect(raw).not.toContain('"org"');}finally{global.Blob=original;}
});

test('saved video review opens independently while the current live connection stays active',async()=>{
    mockLive={...mockLive,room:{cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},connection:'connected',history:[{...session,ended:true}]};
    mount();const review=view.root.findAllByType('button').find(button=>button.props.label?.startsWith('Rever vídeo ao vivo de '));
    await act(async()=>{review!.props.onPress();await Promise.resolve();});
    expect(view.root.findByType('dialog').props.title).toBe('Rever gravação');
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.mark).not.toHaveBeenCalled();
});

test('saved recordings use an actual thumbnail and compact icon actions without inventing missing images',()=>{
    const thumb='data:image/jpeg;base64,/9j/AAAA';
    const ended={...session,ended:true,thumbnailDataUrl:thumb,durationMs:18000};
    mockLive={...mockLive,videoStatuses:{[ended.id]:{sessionId:ended.id,recordingId:ended.recordingId,state:'ready',receivedBytes:100,totalBytes:100}},history:[ended,{...ended,id:'older',recordingId:'older-recording',thumbnailDataUrl:undefined,createdAt:'2026-11-01T11:00:00Z'}]};mount();
    expect(view.root.findAllByType('img').filter(node=>node.props.src===thumb)).toHaveLength(1);
    const actions=view.root.findAllByType('button');
    const download=actions.find(node=>node.props.label?.startsWith('Baixar vídeo de '));
    const remove=actions.find(node=>node.props.label?.startsWith('Excluir registros do notebook de '));
    expect(download?.props.icon).toBe('download');expect(download?.props.children).toBeUndefined();
    expect(remove?.props.icon).toBe('close');expect(remove?.props.children).toBeUndefined();
    act(()=>download!.props.onPress());expect(mockLive.downloadSavedVideo).toHaveBeenCalledWith(ended);
    expect(view.root.findAllByType('small').some(node=>node.children.join('')==='Vídeo no celular')).toBe(true);
});

test('a paused partial copy retains its percentage and offers retry only through a connected phone',()=>{
    const ended={...session,ended:true};
    mockLive={...mockLive,connection:'connected',history:[ended],videoStatuses:{[ended.id]:{sessionId:ended.id,recordingId:ended.recordingId,state:'error',receivedBytes:131072,totalBytes:1000000,nextPart:16,partCount:123,mimeType:'video/mp4',error:'Cópia pausada. Reconecte o celular para continuar.'}}};
    mount();
    expect(view.root.findAllByType('small').some(node=>node.children.join('')==='Envio pausado · 13%')).toBe(true);
    const retry=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Continuar envio do vídeo'));
    expect(retry?.props.icon).toBe('refresh');expect(retry?.props.disabled).toBe(false);
    act(()=>retry!.props.onPress());expect(mockLive.requestSavedVideo).toHaveBeenCalledWith(ended);
    mockLive={...mockLive,connection:'disconnected'};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Continuar envio do vídeo'))?.props.disabled).toBe(true);
    expect(view.root.findAllByType('small').some(node=>node.children.join('')==='Salvo neste computador')).toBe(false);
});

test('an active local import keeps its progress and busy action without a connected phone',()=>{
    const ended={...session,ended:true};
    mockLive={...mockLive,connection:'disconnected',history:[ended],videoStatuses:{[ended.id]:{sessionId:ended.id,recordingId:ended.recordingId,state:'receiving',receivedBytes:131072,totalBytes:1000000,nextPart:16,partCount:123,mimeType:'video/mp4'}}};
    mount();
    expect(view.root.findAllByType('small').some(node=>node.children.join('')==='Salvando no PC · 13%')).toBe(true);
    expect(view.root.findAllByType('small').some(node=>node.children.join('')==='Envio pausado · 13%')).toBe(false);
    const receiving=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Salvando vídeo'));
    expect(receiving?.props.icon).toBe('hourglass');expect(receiving?.props.disabled).toBe(true);
    expect(view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Excluir registros do notebook'))?.props.disabled).toBe(true);
    expect(mockLive.requestSavedVideo).not.toHaveBeenCalled();
});

test.each(['stopped','error'])('a terminal %s shows final elapsed time without awaiting a new clock and disables every point mutation',state=>{
    mockLive={...mockLive,session:{...session,ended:true,durationMs:152000,recordingState:state},stream:{},recording:{state,durationMs:152000},canMark:true};
    mount();
    expect(view.root.findByType('time').children.join('')).toBe('02:32');
    const captions=view.root.findAllByType('small').map(node=>node.children.join(''));
    expect(captions).not.toContain('Aguardando referência de tempo da câmera.');
    expect(captions).toContain(state==='error'?'Confira o arquivo no celular.':'A imagem é uma prévia; a gravação já terminou.');
    for(const label of ['Registrar nosso ponto no vídeo ao vivo','Registrar ponto adversário no vídeo ao vivo','Desfazer último ponto ao vivo','Iniciar próximo set ao vivo'])expect(view.root.findByProps({label}).props.disabled).toBe(true);
    expect(mockLive.mark).not.toHaveBeenCalled();expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('notebook deletion requires an explicit confirmation with exact identity, and cancelling keeps the records',async()=>{
    const ended={...session,ended:true};mockLive={...mockLive,history:[ended]};mount();
    const open=()=>view.root.findByProps({label:`Excluir registros do notebook de ${new Date(ended.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}`}).props.onPress();
    act(open);expect(view.root.findByType('dialog').props.title).toBe('Excluir registros deste notebook?');
    expect(view.root.findAllByType('p').some(node=>node.children.join('')==='Estes registros vão para a lixeira do notebook e podem ser restaurados. O vídeo no celular permanece.')).toBe(true);
    act(()=>view.root.findByProps({label:'Cancelar exclusão dos registros'}).props.onPress());
    expect(mockLive.deleteSaved).not.toHaveBeenCalled();expect(view.root.findAllByType('dialog')).toHaveLength(0);
    act(open);await act(async()=>{view.root.findByProps({label:'Confirmar exclusão dos registros do notebook'}).props.onPress();await Promise.resolve();});
    expect(mockLive.deleteSaved).toHaveBeenCalledWith(ended.id,ended.recordingId);expect(view.root.findAllByType('dialog')).toHaveLength(0);
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.history[0]).toBe(ended);
});

test('failed deletion keeps confirmation open and a protected recording cannot be confirmed',async()=>{
    const ended={...session,ended:true};mockLive={...mockLive,session:ended};mockLive.deleteSaved.mockResolvedValueOnce(false);mount();
    act(()=>view.root.findByProps({label:'Excluir registros desta gravação do notebook'}).props.onPress());
    await act(async()=>{view.root.findByProps({label:'Confirmar exclusão dos registros do notebook'}).props.onPress();await Promise.resolve();});
    expect(view.root.findAllByType('dialog')).toHaveLength(1);
    mockLive={...mockLive,canDeleteSession:jest.fn(()=>false),error:'Aguarde as cópias pendentes.'};
    act(()=>view.update(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',onClose:jest.fn()})));
    expect(view.root.findByProps({label:'Confirmar exclusão dos registros do notebook'}).props.disabled).toBe(true);
    expect(view.root.findByProps({role:'alert'}).children.join('')).toContain('cópias pendentes');
});

test('an ended current room offers closing the connection before deletion without deleting any records',async()=>{
    mockLive={...mockLive,session:{...session,ended:true},room:{cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},canDeleteSession:jest.fn(()=>false)};
    mount();expect(view.root.findByProps({label:'Excluir registros desta gravação do notebook'}).props.disabled).toBe(true);
    await act(async()=>{view.root.findByProps({label:'Fechar conexão para excluir registros'}).props.onPress();await Promise.resolve();});
    expect(mockLive.disconnect).toHaveBeenCalledTimes(1);expect(mockLive.deleteSaved).not.toHaveBeenCalled();expect(view.root.findAllByType('dialog')).toHaveLength(0);
});

test('protected active recordings expose no delete action and a local removal can be restored without disconnecting the camera',async()=>{
    mockLive={...mockLive,session,history:[{...session,id:'old-active'}],canDeleteSession:jest.fn(()=>false),deleted:{...session,id:'removed',ended:true}};mount();
    expect(view.root.findAllByType('button').filter(button=>button.props.label?.startsWith('Excluir registros'))).toHaveLength(0);
    await act(async()=>{view.root.findByProps({label:'Restaurar registros excluídos do notebook'}).props.onPress();await Promise.resolve();});
    expect(mockLive.restoreDeleted).toHaveBeenCalledTimes(1);expect(mockLive.disconnect).not.toHaveBeenCalled();
});

test('embedded pane visibility pauses only the preview and preserves its connected session',()=>{
    const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),root={inert:false},body={style:{overflow:'scroll'}},lookup=jest.fn(()=>root);
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:lookup,body,activeElement:null}});
    mockLive={...mockLive,room:{cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},connection:'connected',stream:{} as any,session};
    const node={pause:jest.fn(),play:jest.fn(async()=>{})};
    const props={userId:'user',org:'org',classId:'class',onClose:jest.fn(),embedded:true,visible:true};
    try{
        act(()=>{view=create(createElement(ScoutingLive,props),{createNodeMock:element=>element.type==='video'?node:null});});
        expect(createPortal).not.toHaveBeenCalled();expect(lookup).not.toHaveBeenCalled();expect(root.inert).toBe(false);expect(body.style.overflow).toBe('scroll');
        expect(view.root.findAllByProps({label:'Voltar do modo ao vivo'})).toHaveLength(0);expect(view.root.findAllByType('h1')).toHaveLength(0);
        act(()=>view.update(createElement(ScoutingLive,{...props,visible:false})));
        expect(node.pause).toHaveBeenCalledTimes(1);expect(view.root.findByType('video').props.autoPlay).toBe(false);
        expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.session).toBe(session);expect(mockLive.session.points).toHaveLength(1);
        act(()=>view.update(createElement(ScoutingLive,props)));expect(node.play).toHaveBeenCalledTimes(2);
    }finally{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');}
});

test('embedded leave guard stays stable and cannot proceed after a failed disconnect',async()=>{
    mockLive.room={cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'};
    let guard:((next:()=>void)=>void)|null=null;const setter=jest.fn((value:typeof guard)=>{guard=value;});
    const props={userId:'user',org:'org',classId:'class',onClose:jest.fn(),embedded:true,visible:true,onLeaveGuard:setter};
    act(()=>{view=create(createElement(ScoutingLive,props));});const initial=guard;
    act(()=>view.update(createElement(ScoutingLive,{...props,visible:false})));expect(guard).toBe(initial);expect(setter).toHaveBeenCalledTimes(1);
    act(()=>view.update(createElement(ScoutingLive,props)));
    const cancelled=jest.fn();act(()=>guard!(cancelled));act(()=>view.root.findByProps({label:'Continuar no modo ao vivo'}).props.onPress());expect(cancelled).not.toHaveBeenCalled();
    const proceed=jest.fn();act(()=>guard!(proceed));mockLive.disconnect.mockResolvedValueOnce(false);
    await act(async()=>{view.root.findByProps({label:'Fechar conexão do notebook'}).props.onPress();await Promise.resolve();});
    expect(proceed).not.toHaveBeenCalled();expect(props.onClose).not.toHaveBeenCalled();expect(view.root.findAllByType('dialog')).toHaveLength(1);
    await act(async()=>{view.root.findByProps({label:'Fechar conexão do notebook'}).props.onPress();await Promise.resolve();});
    expect(proceed).toHaveBeenCalledTimes(1);expect(props.onClose).not.toHaveBeenCalled();expect(view.root.findAllByType('dialog')).toHaveLength(0);
    act(()=>view.unmount());expect(setter).toHaveBeenLastCalledWith(null);
});
