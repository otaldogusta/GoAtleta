import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import ScoutingLive,{exportLiveHostSession} from '../live/ScoutingLive.web';
import {downloadVideoBlob} from '../video/video-media.web';
import {createPortal} from 'react-dom';
const mockBase={config:null,room:null as any,error:'',connection:'idle',stream:null as any,session:null as any,history:[] as any[],recording:null as any,busy:false,saving:false,pendingCopies:0,stamp:null as any,deleted:null as any,attachVideo:jest.fn(),refreshConfig:jest.fn(),start:jest.fn(),mark:jest.fn(),undo:jest.fn(),nextSet:jest.fn(),disconnect:jest.fn(async()=>true),deleteSaved:jest.fn(async()=>true),restoreDeleted:jest.fn(async()=>true),canDeleteSession:jest.fn(()=>true),canMark:false};
let mockLive={...mockBase};
jest.mock('../live/use-live-host',()=>({useLiveHost:()=>mockLive}));
jest.mock('react-dom',()=>({createPortal:jest.fn((children:unknown)=>children)}));
jest.mock('../../../core/scouting-live-qr',()=>({liveQrSvg:jest.fn(()=>'<svg/>')}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{background:'#080f1b',card:'#172234',inputBg:'#121c30',text:'#fff',muted:'#8fa1ba',border:'#283548',primaryBg:'#30d786',primaryText:'#052819',warning:'#e3b260'}})}));
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:object)=>jest.requireActual('react').createElement('button',props),StudioDialog:({children,...props}:any)=>jest.requireActual('react').createElement('dialog',props,children)}));
jest.mock('../video/video-media.web',()=>({downloadVideoBlob:jest.fn()}));
const point={id:'point-1',recordingId:'recording-1',timeMs:10000,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:500,clockMode:'estimated',createdAtHostEpochMs:2000000};
const session={version:1 as const,id:'session-1',scope:{userId:'user',org:'org',classId:'class'},recordingId:'recording-1',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',points:[point],gaps:[],mimeType:'video/webm',ended:false};
let view:ReactTestRenderer;
const mount=(onClose=jest.fn())=>{act(()=>{view=create(createElement(ScoutingLive,{userId:'user',org:'org',classId:'class',className:'Sub19',onClose}));});return onClose;};
beforeEach(()=>{jest.clearAllMocks();mockLive={...mockBase,start:jest.fn(),mark:jest.fn(),disconnect:jest.fn(async()=>true),deleteSaved:jest.fn(async()=>true),restoreDeleted:jest.fn(async()=>true),canDeleteSession:jest.fn(()=>true)};});
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
test('Wi-Fi QR readiness still explains Android certificate trust without implying installation',()=>{
    mockLive={...mockLive,config:{cameraReady:true} as any,room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'}};
    mount();
    expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByType('p').some(p=>p.children.join('').includes('O Android precisa reconhecer o certificado local.'))).toBe(true);
    expect(view.root.findAllByType('p').some(p=>p.children.join('')==='Leia no celular e toque em Preparar câmera.')).toBe(true);
    expect(view.root.findAllByType('a').some(link=>link.props.href==='http://127.0.0.1:8096/certificate.crt'&&link.props.download==='go-atleta-live-ca.crt')).toBe(true);
});
test('a local test link is distinct from a Wi-Fi QR requiring secure camera access',()=>{
    mockLive.room={cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'};
    mount();
    expect(view.root.findAllByType('img')).toHaveLength(0);
    expect(view.root.findByType('a').props.href).toBe(mockLive.room.localCameraUrl);
    expect(view.root.findAllByType('p').some(p=>p.children.join('').includes('acesso seguro'))).toBe(true);
});

test('pairing appears beside the empty player once a room exists, without duplicating the central connection action',()=>{
    mockLive={...mockLive,connection:'waiting',room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'}};
    mount();
    expect(view.root.findAllByType('video')).toHaveLength(0);expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByProps({label:'Conectar câmera ao vivo'})).toHaveLength(0);
    expect(view.root.findByProps({label:'Copiar link da câmera'})).toBeDefined();
    expect(view.root.findAllByType('details').find(node=>node.props.className==='sv-live-pair')?.props.open).toBe(true);
    expect(mockLive.start).not.toHaveBeenCalled();
});

test('a disconnected recording keeps its same room and timeline and directs reconnection from the open phone page',()=>{
    mockLive={...mockLive,room:{cameraUrl:'https://192.168.1.10:8097/camera#room=test&token=camera',localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},connection:'disconnected',stream:{},session,recording:{state:'recording'}};
    mount();
    expect(view.root.findByType('video').props.controls).toBe(true);
    expect(view.root.findByProps({'aria-label':'Conectar ou recuperar câmera'}).findByType('h2').children.join('')).toBe('Conexão interrompida');
    expect(view.root.findAllByType('p').some(node=>node.children.join('')==='No celular, toque em Reconectar na tela que já está aberta.')).toBe(true);
    expect(view.root.findAllByType('p').some(node=>node.children.join('')==='Não recarregue nem abra outra câmera durante a gravação.')).toBe(true);
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

test('saved video review opens independently while the current live connection stays active',()=>{
    mockLive={...mockLive,room:{cameraUrl:null,localCameraUrl:'http://localhost:8096/camera#room=test&token=camera'},connection:'connected',history:[{...session,ended:true}]};
    mount();const review=view.root.findAllByType('button').find(button=>button.props.label?.startsWith('Rever vídeo ao vivo de '));
    act(()=>review!.props.onPress());
    expect(view.root.findByType('dialog').props.title).toBe('Rever gravação ao vivo');
    expect(mockLive.disconnect).not.toHaveBeenCalled();expect(mockLive.mark).not.toHaveBeenCalled();
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

test('unfinished recordings expose no delete action and a local removal can be restored without disconnecting the camera',async()=>{
    mockLive={...mockLive,session,history:[{...session,id:'old-active'}],deleted:{...session,id:'removed',ended:true}};mount();
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
