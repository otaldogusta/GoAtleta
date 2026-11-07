import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { createPortal } from 'react-dom';
import ScoutingWorkspace from '../ScoutingWorkspace.web';
import type { ScoutingWorkspaceProps } from '../ScoutingWorkspace.types';
import type { ScoutingCollectorActions } from '../ScoutingCollector';
import type { ScoutingLiveWorkspaceControls, ScoutingLiveWorkspaceStatus } from '../live/workspace-camera-presentation';
import { requestPendingEditsNavigation } from '../../../navigation/pending-edits-navigation';

let mockCameraAvailable = true;
let mockWorkspaceMobile = false;
let mockWorkspaceWidth = 1200;
let mockNextInstance = 0;
let mockVideoGuard: jest.Mock<void, [() => void]>;
let mockLiveVideoGuard: jest.Mock<void, [() => void]>;
let mockCameraGuard: jest.Mock<void, [() => void]>;
let mockLiveIntegration: Record<string, any>;
const mockMounts: string[] = [], mockUnmounts: string[] = [];
function MockPane({ kind, ...props }: { kind: string } & Record<string, unknown>) {
    const React = jest.requireActual<typeof import('react')>('react');
    const [instance] = React.useState(() => `${kind}-${++mockNextInstance}`);
    const [draft, setDraft] = React.useState('');
    React.useEffect(() => {
        mockMounts.push(instance);
        return () => { mockUnmounts.push(instance); };
    }, [instance]);
    return React.createElement(kind, { ...props, instance, draft, editDraft: setDraft });
}

// Jest's native preset leaves import() to Node. Keep real Suspense/lazy timing,
// but resolve the workspace imports to deferred fixture modules.
jest.mock('react', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    let importIndex = 0;
    return { ...React, lazy: () => {
        const index = importIndex++;
        return React.lazy(() => Promise.resolve().then(() => index === 0
            ? jest.requireMock('../video/ScoutingVideoStudio.web') : index === 1 ? jest.requireMock('../live/ScoutingLive.web') : jest.requireMock('../live/LiveScoutingVideo.web')));
    } };
});
jest.mock('react-dom', () => ({ createPortal: jest.fn((children: unknown) => children) }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/use-responsive-layout', () => ({ useResponsiveLayout: () => ({ isMobile: mockWorkspaceMobile, supportsSplitView:!mockWorkspaceMobile, contentWidth: mockWorkspaceWidth, density: { bodyFontSize: 13, metadataFontSize: 11, sectionGap: 8 } }) }));
jest.mock('../../../ui/use-container-responsive-layout',()=>({useContainerResponsiveLayout:()=>({measuredWidth:mockWorkspaceWidth,containerRef:jest.requireActual<typeof import('react')>('react').useRef(null)})}));
jest.mock('../../../components/ui/ResponsivePage', () => ({ ResponsivePage: (props: Record<string, unknown>) => jest.requireActual('react').createElement('responsive-page', props, props.children) }));
jest.mock('../ScoutingUI', () => ({ shortDate: (value: string) => value }));
jest.mock('../live/live-api', () => ({ liveLocalAvailable: () => mockCameraAvailable }));
jest.mock('../live/use-live-scouting', () => ({ useLiveScouting: () => mockLiveIntegration }));
jest.mock('../live/LiveScoutingVideo.web', () => ({ __esModule:true, default:function MockLocalStudio(props:Record<string,unknown>){
    const React=jest.requireActual<typeof import('react')>('react');
    React.useEffect(()=>{const setter=props.onLeaveGuard as (mockGuard:((next:()=>void)=>void)|null)=>void;setter(next=>mockLiveVideoGuard(next));return()=>setter(null);},[props.onLeaveGuard]);
    return React.createElement(MockPane,{...props,kind:'live-replay'});
} }));
jest.mock('../video/studio-styles', () => ({ studioStyles: '' }));
jest.mock('../ScoutingNavigation', () => ({ ScoutingTabs: (props: object) => jest.requireActual('react').createElement('workspace-tabs', props) }));
jest.mock('../ScoutingWorkspaceMenu.web',()=>({ScoutingWorkspaceMenu:(props:Record<string,unknown>)=>jest.requireActual('react').createElement('workspace-menu',props,
    props.canCreate?jest.requireActual('react').createElement('button',{label:'Nova análise no estúdio',onPress:props.onCreate,disabled:props.disabled}):null,
    props.onSources?jest.requireActual('react').createElement('button',{label:'Fonte do vídeo e gravações',onPress:props.onSources,disabled:props.disabled}):null)}));
jest.mock('../NewScoutingModal', () => ({ NewScoutingModal: (props: object) => jest.requireActual('react').createElement('new-analysis', props) }));
jest.mock('../ScoutingCollector', () => ({ ScoutingCollector: (props: Record<string, unknown>) => jest.requireActual('react').createElement(MockPane, { ...props, kind: 'collector' }) }));
jest.mock('../video/StudioSelect.web', () => ({ StudioSelect: (props: object) => jest.requireActual('react').createElement('workspace-select', props) }));
jest.mock('../video/StudioUI.web', () => ({
    StudioAction: (props: object) => jest.requireActual('react').createElement('button', props),
    StudioDialog: (props: Record<string, unknown>) => jest.requireActual('react').createElement('workspace-dialog', props, props.children),
}));
jest.mock('../video/ScoutingVideoStudio.web', () => ({ __esModule: true, default: function MockVideoStudio(props: Record<string, unknown>) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
        const setter = props.onLeaveGuard as (mockGuard: ((next: () => void) => void) | null) => void;
        setter(next => mockVideoGuard(next));
        return () => setter(null);
    }, [props.onLeaveGuard]);
    return React.createElement(MockPane, { ...props, kind: 'video-studio' });
} }));
jest.mock('../live/ScoutingLive.web', () => ({ __esModule: true, default: function MockLiveCamera(props: Record<string, unknown>) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
        const setter = props.onLeaveGuard as (mockGuard: ((next: () => void) => void) | null) => void;
        setter(next => mockCameraGuard(next));
        return () => setter(null);
    }, [props.onLeaveGuard]);
    return React.createElement(MockPane, { ...props, kind: 'live-camera' });
} }));

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const savedAdd = window.addEventListener, savedRemove = window.removeEventListener, savedDispatch = window.dispatchEvent;
let view: ReactTestRenderer | undefined;
let props: ScoutingWorkspaceProps;
let appRoot: { inert: boolean }, body: { style: { overflow: string } }, previousFocus: { focus: jest.Mock };
let overview: { inert: boolean; style: { visibility: string } }, alreadyInert: { inert: boolean; style: { visibility: string } }, workspaceFocus: { focus: jest.Mock };
let listeners: Map<string, Set<(event: unknown) => void>>;
let documentListeners: Map<string, Set<(event: unknown) => void>>;
const rows = [
    { session: { id: 'game-a', title: 'Primeiro set', date: '2026-11-01' } },
    { session: { id: 'game-b', title: 'Segundo set', date: '2026-11-01' } },
] as ScoutingWorkspaceProps['rows'];
const one = (type: string): ReactTestInstance => view!.root.findByType(type as never);
const action = (label: string) => view!.root.findAllByType('button').find(node => node.props.label === label)!;
const choose = (mode: 'register' | 'video' | 'camera') => act(() => mode==='camera'?view!.root.findByProps({className:'sw-capture-chip'}).findByType('button').props.onPress():one('workspace-tabs').props.onChange(mode));
const settle = async () => { await act(async () => { await Promise.resolve(); }); };
const show = async (mode: 'register' | 'video' | 'camera') => { choose(mode); await settle(); };
const mount = async (overrides: Partial<ScoutingWorkspaceProps> = {}) => {
    props = { org: 'org-a', userId: 'user-a', classId: 'class-a', teamName: 'Sub19', students: [{ id: 'athlete-a', name: 'Atleta' }] as ScoutingWorkspaceProps['students'], rows, mode: 'jogo', initialMode: 'register', onClose: jest.fn(), onSaved: jest.fn(), onCreated: jest.fn(), ...overrides };
    act(() => { view = create(createElement(ScoutingWorkspace, props), { createNodeMock: node => {
        const element = { inert: false, parentElement: { children: [] as unknown[] }, querySelector: () => workspaceFocus, querySelectorAll: () => [], contains: (target: unknown) => target === workspaceFocus, addEventListener: () => undefined, removeEventListener: () => undefined };
        if (node.props.className === 'sw-page') element.parentElement.children = [overview, alreadyInert, element];
        return element;
    } }); });
    await settle();
};
const close = () => act(() => action('Voltar à visão geral do scouting').props.onPress());
const changeSession = (id: string) => act(() => one('workspace-select').props.onChange(id));

beforeEach(() => {
    jest.clearAllMocks(); mockCameraAvailable = true; mockWorkspaceMobile = false; mockWorkspaceWidth=1200;mockNextInstance = 0; mockMounts.length = 0; mockUnmounts.length = 0;
    mockVideoGuard = jest.fn(next => next()); mockLiveVideoGuard=jest.fn(next=>next()); mockCameraGuard = jest.fn(next => next());
    mockLiveIntegration={captureBridge:{captureStamp:jest.fn(()=>null),applied:jest.fn(async()=>undefined)},onHostApi:jest.fn(),onHostSnapshot:jest.fn(),recordings:[],loadMedia:jest.fn(),status:'Conecte a câmera para registrar lances com vídeo',synchronized:false,error:'',replayState:{state:'waiting',message:'',revision:0},snapshot:null,revision:0};
    appRoot = { inert: false }; body = { style: { overflow: 'scroll' } }; previousFocus = { focus: jest.fn() }; listeners = new Map(); documentListeners = new Map();
    overview = { inert: false, style: { visibility: '' } }; alreadyInert = { inert: true, style: { visibility: 'hidden' } }; workspaceFocus = { focus: jest.fn() };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        getElementById: () => appRoot, body, activeElement: previousFocus, querySelector: () => null, querySelectorAll: () => [],
        addEventListener: jest.fn((name: string, callback: (event: unknown) => void) => { const set = documentListeners.get(name) ?? new Set(); set.add(callback); documentListeners.set(name, set); }),
        removeEventListener: jest.fn((name: string, callback: (event: unknown) => void) => { documentListeners.get(name)?.delete(callback); }),
    } });
    window.addEventListener = jest.fn((name, callback) => { const set = listeners.get(name) ?? new Set(); set.add(callback as (event: unknown) => void); listeners.set(name, set); });
    window.removeEventListener = jest.fn((name, callback) => { listeners.get(name)?.delete(callback as (event: unknown) => void); });
    window.dispatchEvent = jest.fn(() => true);
});
afterEach(() => {
    act(() => { view?.unmount(); view = undefined; });
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
    window.addEventListener = savedAdd; window.removeEventListener = savedRemove; window.dispatchEvent = savedDispatch;
});

test('mounts all bench tools early and retains their drafts while the selected task only changes keyboard focus', async () => {
    await mount();
    const collector = one('collector').props.instance;
    const camera=one('live-camera').props.instance;
    const video = one('video-studio').props.instance;
    expect(mockMounts).toEqual(expect.arrayContaining([collector,camera,video]));expect(mockMounts).toHaveLength(3);
    expect(one('collector').props).toMatchObject({active:true,keyboardActive:true});expect(one('video-studio').props).toMatchObject({active:true,visible:true,keyboardActive:false});
    expect(one('workspace-tabs').props.items.map((item:{value:string;label:string})=>[item.value,item.label])).toEqual([['register','Registrar'],['video','Revisar']]);
    act(() => one('collector').props.editDraft('contato ainda em edição'));
    choose('video');
    await settle();
    expect(one('collector').props).toMatchObject({active:true,keyboardActive:false});expect(one('video-studio').props.keyboardActive).toBe(true);
    act(() => one('video-studio').props.editDraft('recorte não confirmado'));
    await show('camera');
    expect(one('live-camera').props.instance).toBe(camera);
    act(() => one('live-camera').props.editDraft('gravação independente'));
    await show('video'); await show('register');
    expect(one('collector').props).toMatchObject({ instance: collector, draft: 'contato ainda em edição', active: true });
    expect(one('video-studio').props).toMatchObject({ instance: video, draft: 'recorte não confirmado', visible: true,keyboardActive:false });
    expect(one('live-camera').props).toMatchObject({ instance: camera, draft: 'gravação independente', visible: true, controlsOpen:true });
    expect(mockMounts).toHaveLength(3); expect(mockUnmounts).toEqual([]);
    expect(mockVideoGuard).not.toHaveBeenCalled(); expect(mockCameraGuard).not.toHaveBeenCalled();
});

test('passes source scope unchanged and separates route focus from tool visibility', async () => {
    await mount(); await show('video'); await show('camera');
    expect(documentListeners.get('keydown')?.size ?? 0).toBe(0);
    for (const type of ['collector', 'video-studio', 'live-camera']) {
        const child = one(type).props;
        expect(child.org).toBe(props.org); expect(child.userId).toBe(props.userId);
    }
    expect(one('collector').props).toMatchObject({ sessionId: 'game-a', presentation: 'embedded', active: true,keyboardActive:false, containerWidth: 1200 });
    expect(one('collector').props.students).toBe(props.students);
    expect(one('video-studio').props).toMatchObject({ classId: props.classId, sessionId: 'game-a', embedded: true, active: true, visible: true });
    expect(one('video-studio').props.students).toBe(props.students);
    expect(one('live-camera').props).toMatchObject({ classId: props.classId, className: props.teamName, embedded: true, workspace:true,bench:true, visible:true, controlsOpen:true });
    expect(one('live-camera').props.sessionId).toBeUndefined();
    act(() => view!.update(createElement(ScoutingWorkspace, { ...props, active: false })));
    expect(one('video-studio').props).toMatchObject({ active: false, visible: false });
    expect(one('live-camera').props.visible).toBe(false); expect(one('collector').props.active).toBe(false);
    expect(appRoot.inert).toBe(false); expect(body.style.overflow).toBe('scroll');
    expect(documentListeners.get('keydown')?.size ?? 0).toBe(0);
    expect(previousFocus.focus).not.toHaveBeenCalled(); expect(mockUnmounts).toEqual([]);
    const navigate = jest.fn(); requestPendingEditsNavigation(navigate); expect(navigate).toHaveBeenCalledTimes(1);
    expect(createPortal).not.toHaveBeenCalled();
});

test('the inline studio leaves the shared navigation usable and hides only the covered overview', async () => {
    await mount();
    const studio = view!.root.findByProps({ 'aria-label': 'Estúdio de scouting' });
    expect(studio.props.role).toBe('region'); expect(studio.props['aria-modal']).toBeUndefined();
    expect(appRoot.inert).toBe(false); expect(body.style.overflow).toBe('scroll');
    expect(overview.inert).toBe(true); expect(alreadyInert.inert).toBe(true);
    expect(overview.style.visibility).toBe('hidden'); expect(alreadyInert.style.visibility).toBe('hidden');
    expect(one('responsive-page').props.style).toMatchObject({ height: '100%', minHeight: 0, paddingVertical: 16 });
    expect(workspaceFocus.focus).toHaveBeenCalledTimes(1);
    // Tab remains native, so the real sidebar can receive keyboard focus.
    expect(documentListeners.get('keydown')?.size ?? 0).toBe(0);
    const sidebarFocus = { focus: jest.fn() };
    Object.defineProperty(document, 'activeElement', { configurable: true, value: sidebarFocus });
    act(() => view!.update(createElement(ScoutingWorkspace, { ...props, active: false })));
    expect(overview.inert).toBe(false); expect(alreadyInert.inert).toBe(true);
    expect(overview.style.visibility).toBe(''); expect(alreadyInert.style.visibility).toBe('hidden');
    expect(previousFocus.focus).not.toHaveBeenCalled();
});

test('closing from inside the studio restores the previous route control without remounting tools', async () => {
    await mount(); await show('camera');
    Object.defineProperty(document, 'activeElement', { configurable: true, value: workspaceFocus });
    act(() => view!.update(createElement(ScoutingWorkspace, { ...props, active: false })));
    expect(previousFocus.focus).toHaveBeenCalledTimes(1);
    expect(overview.inert).toBe(false); expect(overview.style.visibility).toBe(''); expect(mockUnmounts).toEqual([]);
});

test('the mobile menu opens the canonical sidebar freely while navigation still waits for capture confirmation', async () => {
    mockWorkspaceMobile = true; await mount({ initialMode: 'camera' });
    const camera = one('live-camera').props.instance;
    let finishCamera: (() => void) | undefined;
    mockCameraGuard.mockImplementation(next => { finishCamera = next; });
    expect(action('Voltar à visão geral do scouting')).toBeDefined();
    act(() => action('Abrir menu de navegação').props.onPress());
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'goatleta:toggle-sidebar' }));
    expect(mockCameraGuard).not.toHaveBeenCalled(); expect(mockVideoGuard).not.toHaveBeenCalled();
    expect(one('live-camera').props.instance).toBe(camera);
    const navigate = jest.fn(); act(() => requestPendingEditsNavigation(navigate));
    expect(mockCameraGuard).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
    act(() => finishCamera!()); expect(navigate).toHaveBeenCalledTimes(1);
});

test('manual draft guards real exits while tool switches stay free and preserve the draft', async () => {
    await mount();
    act(() => one('collector').props.onDirtyChange(true));
    await show('video'); await show('camera');
    expect(view!.root.findAllByType('workspace-dialog' as never)).toHaveLength(0);
    close();
    expect(one('workspace-dialog').props.title).toBe('Há uma jogada em edição');
    expect(props.onClose).not.toHaveBeenCalled(); expect(mockVideoGuard).not.toHaveBeenCalled();
    act(() => action('Voltar à coleta em edição').props.onPress());
    expect(one('workspace-tabs').props.value).toBe('register'); expect(one('collector').props.active).toBe(true);
    close(); act(() => action('Sair sem concluir a edição da coleta').props.onPress());
    expect(mockVideoGuard).toHaveBeenCalledTimes(1); expect(mockCameraGuard).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1); expect(props.onSaved).not.toHaveBeenCalled();
});

test('in-flight collection blocks exit, new analysis and context changes but permits viewing another tool', async () => {
    await mount(); const collector = one('collector').props.instance;
    act(() => one('collector').props.onBusyChange(true));
    expect(action('Voltar à visão geral do scouting').props.disabled).toBe(true);
    close(); changeSession('game-b');
    act(() => action('Nova análise no estúdio').props.onPress());
    expect(props.onClose).not.toHaveBeenCalled(); expect(one('collector').props.sessionId).toBe('game-a');
    expect(view!.root.findAllByType('new-analysis' as never)).toHaveLength(0);
    await show('video'); expect(one('workspace-tabs').props.value).toBe('video');
    expect(one('collector').props.instance).toBe(collector);
    act(() => one('collector').props.onBusyChange(false)); close();
    expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('route navigation waits for the video guard and then camera guard, including a blocked continuation', async () => {
    await mount(); await show('video'); await show('camera'); await show('register');
    let finishVideo: (() => void) | undefined, finishCamera: (() => void) | undefined;
    mockVideoGuard.mockImplementation(next => { finishVideo = next; });
    mockCameraGuard.mockImplementation(next => { finishCamera = next; });
    const navigate = jest.fn(); act(() => requestPendingEditsNavigation(navigate));
    expect(one('workspace-tabs').props.value).toBe('video');
    expect(mockVideoGuard).toHaveBeenCalledTimes(1); expect(mockCameraGuard).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    act(() => finishVideo!());
    expect(one('workspace-tabs').props.value).toBe('register');expect(one('live-camera').props.controlsOpen).toBe(true); expect(mockCameraGuard).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled(); // A failed/cancelled camera guard does not invoke its continuation.
    act(() => finishCamera!());
    expect(navigate).toHaveBeenCalledTimes(1); expect(props.onClose).not.toHaveBeenCalled();
});

test('linked match sets select the manual collector without replacing the review video or independent camera', async () => {
    const linked = [1, 2, 3].map(set => ({ id: `set-${set}`, title: `Set ${set}`, date: '2026-11-01' }));
    const review = { id: 'review-video', title: 'Vídeo completo', date: '2026-11-01' };
    const matchRows = [review, ...linked].map(session => ({ session })) as ScoutingWorkspaceProps['rows'];
    await mount({ rows: matchRows, initialSessionId: review.id, initialMode: 'video' });
    const video = one('video-studio').props.instance;
    act(() => {
        one('video-studio').props.editDraft('revisão e vínculos existentes');
        one('video-studio').props.onLinkedSessionsChange(linked);
    });
    await show('camera'); const camera = one('live-camera').props.instance;
    act(() => one('live-camera').props.editDraft('pontos da nova gravação'));
    await show('register');
    expect(one('collector').props.sessionId).toBe('set-1');
    const originalCollector = one('collector').props.instance;
    act(() => {
        one('collector').props.editDraft('contato ainda não concluído');
        one('collector').props.onDirtyChange(true);
    });
    act(() => one('video-studio').props.onLinkedSessionsChange([linked[1], linked[0], linked[2]]));
    expect(one('collector').props).toMatchObject({ instance: originalCollector, sessionId: 'set-1', draft: 'contato ainda não concluído' });
    changeSession('set-3');
    expect(one('workspace-dialog').props.title).toBe('Há uma jogada em edição');
    expect(one('collector').props).toMatchObject({ instance: originalCollector, sessionId: 'set-1', draft: 'contato ainda não concluído' });
    act(() => action('Voltar à coleta em edição').props.onPress());
    expect(one('collector').props.sessionId).toBe('set-1');
    changeSession('set-3');
    act(() => action('Sair sem concluir a edição da coleta').props.onPress());
    expect(one('collector').props.sessionId).toBe('set-3');
    expect(one('collector').props.instance).not.toBe(originalCollector);
    act(() => one('video-studio').props.onLinkedSessionsChange(linked));
    expect(one('collector').props.sessionId).toBe('set-3');
    expect(mockUnmounts).toContain(originalCollector); expect(mockUnmounts).not.toContain(video);
    expect(one('live-camera').props).toMatchObject({ instance: camera, draft: 'pontos da nova gravação' });
    expect(mockCameraGuard).not.toHaveBeenCalled();
    await show('video');
    expect(one('video-studio').props).toMatchObject({ instance: video, sessionId: review.id, draft: 'revisão e vínculos existentes', visible: true });
    expect(one('live-camera').props.instance).toBe(camera);
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(matchRows.map(row => row.session.id)).toEqual(['review-video', 'set-1', 'set-2', 'set-3']);
});

test.each(['dirty', 'busy'] as const)('a same-batch %s notification protects the collector from incoming linked sources', async state => {
    const linked = [1, 2, 3].map(set => ({ id: `set-${set}`, title: `Set ${set}`, date: '2026-11-01' }));
    const review = { id: 'review-video', title: 'Vídeo completo', date: '2026-11-01' };
    await mount({ rows: [review, ...linked].map(session => ({ session })) as ScoutingWorkspaceProps['rows'], initialSessionId: review.id, initialMode: 'register' });
    const collector = one('collector').props.instance;
    await show('video'); const video = one('video-studio').props.instance;
    const callback = state === 'dirty' ? 'onDirtyChange' : 'onBusyChange';
    act(() => {
        one('collector').props.editDraft('edição em andamento');
        one('collector').props[callback](true);
        one('video-studio').props.onLinkedSessionsChange(linked);
    });
    expect(one('collector').props).toMatchObject({ instance: collector, sessionId: review.id, draft: 'edição em andamento' });
    expect(mockUnmounts).not.toContain(collector);
    act(() => {
        one('collector').props[callback](false);
        one('video-studio').props.onLinkedSessionsChange(linked);
    });
    expect(one('collector').props.sessionId).toBe('set-1');
    expect(one('video-studio').props).toMatchObject({ instance: video, sessionId: review.id });
    expect(props.onSaved).not.toHaveBeenCalled();
});

test.each([
    { initialId: 'review-video', expectedManualId: 'set-1' },
    { initialId: 'set-3', expectedManualId: 'set-3' },
])('opening Registrar from $initialId resolves linked sources to $expectedManualId', async ({ initialId, expectedManualId }) => {
    const linked = [1, 2, 3].map(set => ({ id: `set-${set}`, title: `Set ${set}`, date: '2026-11-01' }));
    const review = { id: 'review-video', title: 'Vídeo completo', date: '2026-11-01' };
    await mount({ rows: [review, ...linked].map(session => ({ session })) as ScoutingWorkspaceProps['rows'], initialSessionId: initialId, initialMode: 'register' });
    const collector = one('collector').props.instance;
    await show('video'); const video = one('video-studio').props.instance;
    act(() => one('video-studio').props.onLinkedSessionsChange(linked));
    await show('register');
    expect(one('collector').props.sessionId).toBe(expectedManualId);
    if (initialId === expectedManualId) expect(one('collector').props.instance).toBe(collector);
    expect(one('video-studio').props).toMatchObject({ instance: video, sessionId: initialId });
    expect(props.onSaved).not.toHaveBeenCalled();
});

test('an unavailable local camera falls back to video without exposing a camera tool', async () => {
    mockCameraAvailable = false; await mount({ initialMode: 'camera' });
    expect(one('workspace-tabs').props.value).toBe('video');
    expect(one('workspace-tabs').props.items.map((item: { value: string }) => item.value)).toEqual(['register', 'video']);
    expect(one('video-studio').props.visible).toBe(true);
    expect(view!.root.findAllByType('live-camera' as never)).toHaveLength(0);
});

test('an empty workspace can create an analysis and starts its collector without touching prior source records', async () => {
    await mount({ rows: [], initialSessionId: undefined });
    expect(view!.root.findAllByType('collector' as never)).toHaveLength(0);
    act(() => action('Criar análise no estúdio').props.onPress());
    expect(one('new-analysis').props).toMatchObject({ org: props.org, classId: props.classId, mode: 'jogo', overlayZIndex: 6101 });
    act(() => one('new-analysis').props.onCreated('game-created'));
    expect(one('workspace-tabs').props.value).toBe('register'); expect(one('collector').props.sessionId).toBe('game-created');
    expect(props.onCreated).toHaveBeenCalledTimes(1); expect(props.onSaved).not.toHaveBeenCalled();
    expect(rows.map(row => row.session.id)).toEqual(['game-a', 'game-b']);
});

test('creating an analysis from an initially empty Video tab does not mount a hidden legacy studio in Registrar',async()=>{
    await mount({rows:[],initialSessionId:undefined,initialMode:'video'});await settle();
    expect(view!.root.findAllByType('video-studio' as never)).toHaveLength(0);
    act(()=>action('Nova análise no estúdio').props.onPress());act(()=>one('new-analysis').props.onCreated('new-game'));await settle();
    expect(one('workspace-tabs').props.value).toBe('register');expect(one('collector').props.sessionId).toBe('new-game');
    expect(view!.root.findAllByType('video-studio' as never)).toHaveLength(0);
    expect(view!.root.findByProps({className:'sw-actions'}).props.hidden).toBe(true);
    await show('video');expect(one('video-studio').props.sessionId).toBe('new-game');
});

test('a newly created analysis waits for its actual Video visit even after an earlier legacy video was opened',async()=>{
    await mount({initialMode:'video'});const previous=one('video-studio').props.instance;await show('register');
    act(()=>action('Nova análise no estúdio').props.onPress());act(()=>one('new-analysis').props.onCreated('new-game'));await settle();
    expect(view!.root.findAllByType('video-studio' as never)).toHaveLength(0);expect(mockUnmounts).toContain(previous);
    await show('video');const next=one('video-studio').props.instance;act(()=>one('video-studio').props.editDraft('novo recorte'));
    await show('register');await show('video');expect(one('video-studio').props).toMatchObject({instance:next,draft:'novo recorte',sessionId:'new-game'});
});

test('creation permissions hide new-analysis actions without blocking review of existing analyses', async () => {
    await mount({ rows: [], canCreate: false });
    expect(action('Criar análise no estúdio')).toBeUndefined();
    expect(action('Nova análise no estúdio')).toBeUndefined();
    expect(view!.root.findAllByType('new-analysis' as never)).toHaveLength(0);
    act(() => { view!.unmount(); view = undefined; });
    await mount({ canCreate: false });
    expect(one('workspace-select').props.options.map((option: { value: string }) => option.value)).toEqual(['game-a', 'game-b']);
    expect(action('Nova análise no estúdio')).toBeUndefined();
    changeSession('game-a'); await show('video');
    expect(one('video-studio').props.sessionId).toBe('game-a');
    expect(props.onCreated).not.toHaveBeenCalled(); expect(props.onSaved).not.toHaveBeenCalled();
});


test('bench studios retain their own tools instead of routing a toolbar into the workspace header', async () => {
    await mount({ initialMode: 'video' });
    expect(action('Abrir menu de navegação')).toBeUndefined();
    const head = view!.root.findByProps({ className: 'sw-head' });
    const actions = view!.root.findByProps({ className: 'sw-actions' });
    expect(one('video-studio').props.toolbarTarget).toBeUndefined();
    for (const mode of ['register', 'camera', 'video'] as const) {
        await show(mode);
        expect(view!.root.findByProps({ className: 'sw-head' })).toBe(head);
        expect(view!.root.findByProps({ className: 'sw-actions' })).toBe(actions);
        expect(actions.props.hidden).toBe(true);
        expect(one('video-studio').props.toolbarTarget).toBeUndefined();
        expect(head.findAllByType('button').some(node => node.props.label === 'Nova análise no estúdio')).toBe(true);
    }
    expect(props.onSaved).not.toHaveBeenCalled();
});


test('focusing each retained bench surface updates keyboard ownership without hiding or remounting either tool', async () => {
    await mount({ initialMode: 'video' });
    await show('register');await show('camera');
    const collector=one('collector').props.instance,video=one('video-studio').props.instance;
    act(()=>view!.root.findByProps({id:'sw-video-panel'}).props.onFocusCapture());
    expect(one('workspace-tabs').props.value).toBe('video');
    expect(one('collector').props).toMatchObject({instance:collector,active:true,keyboardActive:false});expect(one('video-studio').props).toMatchObject({instance:video,visible:true,keyboardActive:true});
    act(()=>view!.root.findByProps({id:'sw-register-panel'}).props.onPointerDownCapture());
    expect(one('workspace-tabs').props.value).toBe('register');expect(one('collector').props.keyboardActive).toBe(true);expect(one('video-studio').props.keyboardActive).toBe(false);
    expect(mockUnmounts).toEqual([]);
    expect(props.onSaved).not.toHaveBeenCalled();
});

test('the collector and camera share the workspace bridge without remounting capture when opening replay',async()=>{
    mockLiveIntegration.recordings=[{analysisSessionId:'game-a',hostSessionId:'host',recordingId:'recording',clips:[],updatedAt:'2026-11-04T10:00:00Z'}];
    await mount();const collector=one('collector').props.instance;
    expect(one('collector').props.captureBridge.captureStamp).toBe(mockLiveIntegration.captureBridge.captureStamp);
    await show('camera');const camera=one('live-camera').props.instance;
    expect(one('live-camera').props.onHostApi).toBe(mockLiveIntegration.onHostApi);
    expect(one('live-camera').props.onHostSnapshot).toBe(mockLiveIntegration.onHostSnapshot);
    await show('video');
    expect(one('live-replay').props.loadMedia).toBe(mockLiveIntegration.loadMedia);
    expect(one('live-replay').props.visible).toBe(true);
    expect(one('live-camera').props.instance).toBe(camera);expect(one('live-camera').props.visible).toBe(true);
    await show('register');expect(one('collector').props.instance).toBe(collector);
    expect(one('live-replay').props.visible).toBe(true);expect(one('live-replay').props.keyboardActive).toBe(false);
});

test('integrated camera actions expose only active linked clip counts and navigate without remounting the camera',async()=>{
    mockLiveIntegration.recordings=[{recordingId:'recording-a',clips:[{active:true},{active:false},{active:true}]},{recordingId:'recording-b',clips:[{active:true}]}];
    await mount({initialMode:'camera'});const camera=one('live-camera').props.instance,integrated=one('live-camera').props.integratedScouting;
    expect(integrated.recordings).toEqual([{recordingId:'recording-a',clipCount:2},{recordingId:'recording-b',clipCount:1}]);
    act(()=>view!.update(createElement(ScoutingWorkspace,props)));await settle();expect(one('live-camera').props.instance).toBe(camera);
    act(()=>integrated.onRegister());await settle();expect(one('workspace-tabs').props.value).toBe('register');expect(one('collector').props.sessionId).toBe('game-a');
    act(()=>integrated.onReview('recording-b'));await settle();expect(one('workspace-tabs').props.value).toBe('video');expect(one('live-replay').props.selectedRecordingId).toBe('recording-b');
    act(()=>one('live-replay').props.onOtherVideos());await settle();expect(one('video-studio').props.visible).toBe(true);
    act(()=>integrated.onReview('recording-a'));await settle();expect(one('live-replay').props.selectedRecordingId).toBe('recording-a');
    expect(one('live-camera').props.instance).toBe(camera);expect(mockCameraGuard).not.toHaveBeenCalled();expect(props.onSaved).not.toHaveBeenCalled();
});

test('camera integration remains absent without a selected analysis and becomes available after creating one',async()=>{
    await mount({rows:[],initialSessionId:undefined,initialMode:'camera'});expect(one('live-camera').props.integratedScouting).toBeUndefined();
    act(()=>action('Nova análise no estúdio').props.onPress());act(()=>one('new-analysis').props.onCreated('new-game'));await settle();
    expect(one('live-camera').props.integratedScouting).toMatchObject({recordings:[],onRegister:expect.any(Function),onReview:expect.any(Function)});
});

test.each([
    {state:'preview',connected:true,label:'Câmera pronta',tone:'success'},
    {state:'disconnected',connected:false,label:'Conexão interrompida',tone:'warning'},
] as const)('the camera chip describes $state and opens controls without switching tasks or reconnecting the host',async status=>{
    await mount();const host=one('live-camera').props.instance,onHostApi=one('live-camera').props.onHostApi;
    act(()=>one('live-camera').props.onWorkspaceStatusChange({elapsedMs:null,copyPercent:null,receiving:false,error:null,sourceLabel:null,...status}));
    const label=status.connected?'Conectada':'Não conectada';
    expect(action(label)).toBeDefined();act(()=>action(label).props.onPress());await settle();
    expect(one('workspace-tabs').props.value).toBe('register');expect(one('live-camera').props).toMatchObject({instance:host,controlsOpen:true,onHostApi});
    act(()=>one('live-camera').props.onControlsClose());expect(one('live-camera').props.controlsOpen).toBe(false);expect(one('live-camera').props.instance).toBe(host);
    expect(mockCameraGuard).not.toHaveBeenCalled();expect(props.onSaved).not.toHaveBeenCalled();
});

test.each([null,{recordingId:null,connection:'connected',cameraState:'preview'}])('persisted linked recordings open replay even without a current recording snapshot %p',async snapshot=>{
    mockLiveIntegration.snapshot=snapshot;
    mockLiveIntegration.recordings=[{recordingId:'saved-recording',clips:[{active:true}]}];
    await mount();const host=one('live-camera').props.instance;await show('video');
    expect(one('workspace-tabs').props.value).toBe('video');expect(one('live-replay').props.recordings).toBe(mockLiveIntegration.recordings);
    expect(one('live-camera').props.instance).toBe(host);expect(one('live-camera').props.visible).toBe(true);
});

test('other videos retain their draft while the local replay is selected independently',async()=>{
    await mount({initialMode:'video'});const legacy=one('video-studio').props.instance;
    act(()=>one('video-studio').props.editDraft('recorte existente'));
    mockLiveIntegration.recordings=[{analysisSessionId:'game-a',hostSessionId:'host',recordingId:'recording',clips:[],updatedAt:'2026-11-04T10:00:00Z'}];
    act(()=>view!.update(createElement(ScoutingWorkspace,props)));await settle();
    expect(one('live-replay').props.recordings).toBe(mockLiveIntegration.recordings);
    expect(one('video-studio').props.instance).toBe(legacy);expect(one('video-studio').props.visible).toBe(false);
    act(()=>one('live-replay').props.onOtherVideos());
    expect(one('video-studio').props.instance).toBe(legacy);expect(one('video-studio').props.draft).toBe('recorte existente');
    expect(one('video-studio').props.visible).toBe(true);
});

test('changing account scope remounts retained tools instead of carrying a live binding to another organization',async()=>{
    await mount();const first=one('collector').props.instance,host=one('live-camera').props.instance;
    act(()=>one('collector').props.editDraft('rascunho de outra instituição'));
    act(()=>view!.update(createElement(ScoutingWorkspace,{...props,org:'other-org'})));await settle();
    expect(one('collector').props.instance).not.toBe(first);expect(one('collector').props.draft).toBe('');
    expect(mockUnmounts).toContain(first);expect(one('collector').props.org).toBe('other-org');
    expect(one('live-camera').props.instance).not.toBe(host);expect(mockUnmounts).toContain(host);expect(one('live-camera').props).toMatchObject({org:'other-org',userId:'user-a',classId:'class-a'});
});

test('late linked-video sources cannot replace the live collector after a confirmed point',async()=>{
    await mount({initialMode:'video'});
    const late=one('video-studio').props.onLinkedSessionsChange;
    await show('register');
    mockLiveIntegration.recordings=[{analysisSessionId:'game-a',hostSessionId:'host',recordingId:'recording',clips:[],updatedAt:'2026-11-04T10:00:00Z'}];
    act(()=>view!.update(createElement(ScoutingWorkspace,props)));await settle();
    act(()=>late([{id:'game-b',title:'Outra análise',date:'2026-11-04'}]));
    expect(one('collector').props.sessionId).toBe('game-a');
    await act(async()=>{await one('collector').props.captureBridge.applied({});});
    await show('video');act(()=>one('live-replay').props.onOtherVideos());
    act(()=>late([{id:'game-b',title:'Outra análise',date:'2026-11-04'}]));
    expect(one('collector').props.sessionId).toBe('game-a');
});

test('the camera recording uses the scoped studio contract and retains local edits when switching sources',async()=>{
    mockLiveIntegration.recordings=[{recordingId:'local-a',clips:[]}];
    await mount({initialMode:'video'});
    const local=one('live-replay').props.instance;
    expect(one('live-replay').props).toMatchObject({org:'org-a',userId:'user-a',classId:'class-a',sessionId:'game-a',students:props.students,teamName:'Sub19',embedded:true,active:true,visible:true});
    expect(one('live-replay').props.toolbarTarget).toBeUndefined();
    act(()=>one('live-replay').props.editDraft('rally local ajustado'));
    act(()=>one('live-replay').props.onOtherVideos());await settle();
    expect(one('live-replay').props).toMatchObject({instance:local,draft:'rally local ajustado',visible:false});expect(one('live-replay').props.toolbarTarget).toBeUndefined();
    act(()=>action('Voltar aos lances da gravação ao vivo').props.onPress());await settle();
    expect(one('live-replay').props).toMatchObject({instance:local,draft:'rally local ajustado',visible:true});
    expect(one('video-studio').props.toolbarTarget).toBeUndefined();
    expect(props.onSaved).not.toHaveBeenCalled();
});

test('local editing guards source, recording and analysis changes before replacing their context',async()=>{
    mockLiveIntegration.recordings=[{recordingId:'local-a',clips:[]},{recordingId:'local-b',clips:[]}];
    await mount({initialMode:'video'});
    let resume:(()=>void)|undefined;
    mockLiveVideoGuard.mockImplementation(next=>{resume=next;});
    act(()=>one('live-replay').props.onOtherVideos());await settle();
    expect(one('live-replay').props.visible).toBe(true);expect(view!.root.findAllByType('video-studio' as never)).toHaveLength(0);
    act(()=>resume!());await settle();
    expect(one('video-studio').props.visible).toBe(true);
    act(()=>action('Voltar aos lances da gravação ao vivo').props.onPress());await settle();
    act(()=>one('live-replay').props.onSelectRecording('local-b'));await settle();
    expect(one('live-replay').props.selectedRecordingId).toBe('');
    act(()=>resume!());await settle();expect(one('live-replay').props.selectedRecordingId).toBe('local-b');
    changeSession('game-b');await settle();expect(one('live-replay').props.sessionId).toBe('game-a');
    act(()=>resume!());await settle();expect(one('live-replay').props.sessionId).toBe('game-b');
    expect(props.onSaved).not.toHaveBeenCalled();
});

test('Registrar returns to the camera rallies after another video source was reviewed',async()=>{
    mockLiveIntegration.recordings=[{recordingId:'local-a',clips:[{active:true}]}];
    await mount({initialMode:'video'});
    act(()=>one('live-replay').props.onOtherVideos());await settle();
    const legacy=one('video-studio').props.instance;act(()=>one('video-studio').props.editDraft('contato manual ainda em edição'));
    await show('register');
    let resume:(()=>void)|undefined;mockVideoGuard.mockImplementation(next=>{resume=next;});
    act(()=>one('live-camera').props.integratedScouting.onReview('local-a'));await settle();
    expect(one('video-studio').props).toMatchObject({instance:legacy,visible:true,draft:'contato manual ainda em edição'});
    expect(one('live-replay').props.visible).toBe(false);expect(resume).toBeDefined();act(()=>resume!());await settle();
    expect(one('live-replay').props.visible).toBe(true);expect(one('video-studio').props.visible).toBe(false);
    expect(mockVideoGuard).toHaveBeenCalled();expect(props.onSaved).not.toHaveBeenCalled();
});

test('an initial camera request opens persistent controls inside Registrar rather than creating a third tab',async()=>{
    await mount({initialMode:'camera'});
    expect(one('workspace-tabs').props.value).toBe('register');expect(one('workspace-tabs').props.items.map((item:{value:string})=>item.value)).toEqual(['register','video']);
    expect(one('collector').props.active).toBe(true);expect(one('live-camera').props).toMatchObject({workspace:true,visible:true,controlsOpen:true});
});

test('opening Revisar first still mounts the scoped collector and capture status owner before visiting Registrar',async()=>{
    await mount({initialMode:'video'});
    expect(one('collector').props).toMatchObject({sessionId:'game-a',org:'org-a',userId:'user-a',active:true,keyboardActive:false,containerWidth:1200});
    expect(one('live-camera').props).toMatchObject({org:'org-a',userId:'user-a',classId:'class-a',visible:true,controlsOpen:false});
    expect(one('live-camera').props.onHostApi).toBe(mockLiveIntegration.onHostApi);expect(one('live-camera').props.onHostSnapshot).toBe(mockLiveIntegration.onHostSnapshot);
    expect(action('Registro oficial: Registro')).toBeDefined();expect(action('Registro oficial: Salvo')).toBeUndefined();expect(action('Encerrar análise sem parar a gravação').props.disabled).toBe(true);
});

test.each([
    {status:'saved',label:'Salvo'}, {status:'dirty',label:'Em edição'}, {status:'pending',label:'Pendente'}, {status:'error',label:'Confira o registro'}, {status:'busy',label:'Salvando…'}, {status:'loading',label:'Registro'},
] as const)('the header represents official $status without promising a different save state',async({status,label})=>{
    await mount({initialMode:'video'});act(()=>one('collector').props.onActionsChange({requestFinish:jest.fn(),canFinish:false,status} satisfies ScoutingCollectorActions));
    expect(action(`Registro oficial: ${label}`)).toBeDefined();if(status!=='saved')expect(action('Registro oficial: Salvo')).toBeUndefined();
    act(()=>action(`Registro oficial: ${label}`).props.onPress());expect(one('workspace-dialog').props.title).toBe('Registro do scouting');
    expect(props.onSaved).not.toHaveBeenCalled();
});

test('the header delegates finishing to the retained collector while Revisar is active and honors pending/busy guards',async()=>{
    await mount({initialMode:'video'});const instance=one('collector').props.instance,requestFinish=jest.fn();
    act(()=>one('collector').props.onActionsChange({requestFinish,canFinish:true,status:'saved'} satisfies ScoutingCollectorActions));
    const finish=()=>action('Encerrar análise sem parar a gravação');expect(finish().props.disabled).toBe(false);act(()=>finish().props.onPress());expect(requestFinish).toHaveBeenCalledTimes(1);
    expect(one('workspace-tabs').props.value).toBe('video');expect(one('collector').props).toMatchObject({instance,active:true,keyboardActive:false});
    act(()=>one('workspace-menu').props.onFinish());expect(requestFinish).toHaveBeenCalledTimes(2);
    act(()=>one('collector').props.onActionsChange({requestFinish,canFinish:false,status:'pending'} satisfies ScoutingCollectorActions));expect(finish().props.disabled).toBe(true);act(()=>finish().props.onPress());expect(requestFinish).toHaveBeenCalledTimes(2);
    act(()=>{one('collector').props.onActionsChange({requestFinish,canFinish:true,status:'saved'} satisfies ScoutingCollectorActions);one('collector').props.onBusyChange(true);});expect(finish().props.disabled).toBe(true);act(()=>finish().props.onPress());expect(requestFinish).toHaveBeenCalledTimes(2);
    expect(props.onSaved).not.toHaveBeenCalled();expect(mockCameraGuard).not.toHaveBeenCalled();
});

test('the capture chip and accessible video state keep a live clock separate from another recording copy',async()=>{
    await mount({initialMode:'video'});
    const status:ScoutingLiveWorkspaceStatus={state:'recording',label:'Gravando',tone:'danger',elapsedMs:34000,copyPercent:13,receiving:true,connected:true,error:null,sourceLabel:'Câmera traseira'};
    act(()=>one('live-camera').props.onWorkspaceStatusChange(status));
    expect(action('Gravando 00:34')).toBeDefined();expect(action('Gravando 13%')).toBeUndefined();expect(action('Vídeo: Gravando 00:34')).toBeUndefined();expect(action('Vídeo: Gravando 13%')).toBeUndefined();
    expect(view!.root.findAllByType('button').filter(node=>node.props.label==='Gravando 00:34')).toHaveLength(1);
    const host=one('live-camera').props.instance;act(()=>action('Gravando 00:34').props.onPress());expect(one('workspace-tabs').props.value).toBe('video');expect(one('live-camera').props).toMatchObject({instance:host,controlsOpen:true});
});

test('the source library opens from Revisar without changing scope or unmounting the camera',async()=>{
    await mount({initialMode:'video'});const host=one('live-camera').props.instance,onHostApi=one('live-camera').props.onHostApi;
    act(()=>action('Fonte do vídeo e gravações').props.onPress());act(()=>action('Abrir gravações da câmera').props.onPress());
    expect(one('workspace-tabs').props.value).toBe('video');expect(one('live-camera').props).toMatchObject({instance:host,libraryOpen:true,onHostApi});
    act(()=>one('live-camera').props.onLibraryClose());expect(one('live-camera').props.libraryOpen).toBe(false);expect(one('live-camera').props.instance).toBe(host);
    expect(props.onSaved).not.toHaveBeenCalled();expect(mockCameraGuard).not.toHaveBeenCalled();
});

test('header recording controls route to the retained camera actions through pause pending, resume and stop',async()=>{
    await mount();const host=one('live-camera').props.instance,onHostApi=one('live-camera').props.onHostApi;
    const actions={start:jest.fn(),pause:jest.fn(),resume:jest.fn(),stop:jest.fn()};
    const controls:ScoutingLiveWorkspaceControls={canStart:false,canPause:true,canResume:false,canStop:true,busy:false,hasPreview:true,pending:null,actions};
    const publish=(value:ScoutingLiveWorkspaceControls|null)=>act(()=>one('live-camera').props.onWorkspaceControlsChange(value));
    publish(controls);expect(action('Pausar gravação no celular').props.disabled).toBe(false);expect(action('Parar gravação no celular').props.disabled).toBe(false);
    act(()=>action('Pausar gravação no celular').props.onPress());expect(actions.pause).toHaveBeenCalledTimes(1);expect(actions.resume).not.toHaveBeenCalled();
    publish({...controls,canPause:false,canStop:false,busy:true,pending:'pause'});
    expect(action('Pausar gravação no celular').props.disabled).toBe(true);expect(action('Continuar gravação no celular')).toBeUndefined();expect(action('Parar gravação no celular').props.disabled).toBe(true);expect(action('Pausando…')).toBeDefined();
    await show('video');await show('register');
    expect(one('live-camera').props).toMatchObject({instance:host,onHostApi,visible:true});expect(mockCameraGuard).not.toHaveBeenCalled();
    publish({...controls,canPause:false,canResume:true});
    act(()=>action('Continuar gravação no celular').props.onPress());expect(actions.resume).toHaveBeenCalledTimes(1);
    publish({...controls,canPause:false,canResume:false,canStop:false,busy:true,pending:'resume'});
    expect(action('Continuar gravação no celular').props.disabled).toBe(true);expect(action('Parar gravação no celular').props.disabled).toBe(true);expect(action('Continuando…')).toBeDefined();
    publish({...controls,canPause:false,canResume:true});
    act(()=>action('Parar gravação no celular').props.onPress());expect(actions.stop).toHaveBeenCalledTimes(1);
    publish({...controls,canPause:false,canStop:false,busy:true,pending:'stop'});expect(action('Parar gravação no celular').props.disabled).toBe(true);
    publish({...controls,canPause:false,canStop:false,canStart:true});
    act(()=>action('Iniciar gravação no celular').props.onPress());expect(actions.start).toHaveBeenCalledTimes(1);
    publish({...controls,canPause:false,canStop:false,busy:true,pending:'start'});expect(action('Iniciando…')).toBeDefined();expect(action('Iniciar gravação no celular')).toBeUndefined();
    publish({...controls,canPause:false,canStop:false,hasPreview:false});
    expect(action('Pausar gravação no celular')).toBeUndefined();expect(action('Parar gravação no celular')).toBeUndefined();expect(action('Iniciar gravação no celular')).toBeUndefined();
    publish(null);expect(view!.root.findAllByType('live-camera' as never)).toHaveLength(1);expect(one('live-camera').props.instance).toBe(host);
    expect(props.onSaved).not.toHaveBeenCalled();expect(mockUnmounts).toEqual([]);
});

test('gallery replay and return-to-live callbacks switch main and PIP within the same stage while preserving all drafts and camera ownership',async()=>{
    mockLiveIntegration.recordings=[{analysisSessionId:'game-a',hostSessionId:'host',recordingId:'recording',clips:[{active:true}],updatedAt:'2026-11-05T12:00:00Z'}];
    await mount();const collector=one('collector').props.instance,replay=one('live-replay').props.instance,host=one('live-camera').props.instance;
    const actions={start:jest.fn(),pause:jest.fn(),resume:jest.fn(),stop:jest.fn()};
    const controls:ScoutingLiveWorkspaceControls={canStart:false,canPause:true,canResume:false,canStop:true,busy:false,hasPreview:true,pending:null,actions};
    const target={id:'canonical-player-stage'} as unknown as HTMLElement;
    act(()=>{
        one('collector').props.editDraft('contato em edição');one('live-replay').props.editDraft('recorte ajustado');one('live-camera').props.editDraft('mesma conexão');
        one('live-camera').props.onWorkspaceControlsChange(controls);one('live-replay').props.onBenchStageTarget(target);
    });
    expect(one('live-camera').props).toMatchObject({instance:host,presentation:'main',previewTarget:target,visible:true});expect(one('live-replay').props.visible).toBe(false);
    const onHostApi=one('live-camera').props.onHostApi,onStage=one('live-replay').props.onBenchStageTarget;
    act(()=>one('live-replay').props.onBenchReplayChange(true));
    expect(one('live-camera').props).toMatchObject({instance:host,presentation:'pip',previewTarget:target});expect(one('live-replay').props).toMatchObject({instance:replay,visible:true,draft:'recorte ajustado'});
    act(()=>action('Pausar gravação no celular').props.onPress());expect(actions.pause).toHaveBeenCalledTimes(1);
    await show('video');expect(one('collector').props).toMatchObject({instance:collector,draft:'contato em edição',active:true,keyboardActive:false});
    expect(one('live-replay').props.onBenchStageTarget).toBe(onStage);expect(one('live-camera').props.onHostApi).toBe(onHostApi);
    act(()=>one('live-replay').props.onReturnToLive());
    expect(one('live-camera').props).toMatchObject({instance:host,presentation:'main',previewTarget:target,draft:'mesma conexão',visible:true});
    expect(one('live-replay').props).toMatchObject({instance:replay,draft:'recorte ajustado',visible:false});
    expect(actions.start).not.toHaveBeenCalled();expect(actions.resume).not.toHaveBeenCalled();expect(actions.stop).not.toHaveBeenCalled();
    expect(mockCameraGuard).not.toHaveBeenCalled();expect(mockVideoGuard).not.toHaveBeenCalled();expect(mockLiveVideoGuard).not.toHaveBeenCalled();expect(mockUnmounts).toEqual([]);
    expect(props.onSaved).not.toHaveBeenCalled();
});

test.each([{mobile:true,width:390},{mobile:false,width:799}])('a compact bench at $width keeps collection mounted but inactive in Revisar while capture stays visible',async({mobile,width})=>{
    mockWorkspaceMobile=mobile;mockWorkspaceWidth=width;await mount({initialMode:'video'});
    const collector=one('collector').props.instance,host=one('live-camera').props.instance;
    expect(view!.root.findByProps({id:'sw-register-panel'}).props.hidden).toBe(true);
    expect(one('collector').props).toMatchObject({instance:collector,active:false,keyboardActive:false,containerWidth:width});
    expect(one('video-studio').props).toMatchObject({active:true,visible:true,keyboardActive:true});expect(one('live-camera').props).toMatchObject({instance:host,visible:true});
    await show('register');expect(view!.root.findByProps({id:'sw-register-panel'}).props.hidden).toBe(false);expect(one('collector').props).toMatchObject({instance:collector,active:true,keyboardActive:true});
    expect(one('live-camera').props.instance).toBe(host);expect(mockUnmounts).toEqual([]);
});

test('the split threshold keeps collection and review active at 800px while keyboard focus remains exclusive',async()=>{
    mockWorkspaceWidth=800;await mount({initialMode:'video'});
    expect(view!.root.findByProps({id:'sw-register-panel'}).props.hidden).toBe(false);
    expect(one('collector').props).toMatchObject({active:true,keyboardActive:false});expect(one('video-studio').props).toMatchObject({visible:true,keyboardActive:true});
    await show('register');expect(one('collector').props).toMatchObject({active:true,keyboardActive:true});expect(one('video-studio').props).toMatchObject({visible:true,keyboardActive:false});
    expect(mockUnmounts).toEqual([]);
});

test('leaving waits for local, imported-video and camera guards in order',async()=>{
    mockLiveIntegration.recordings=[{recordingId:'local-a',clips:[]}];
    await mount({initialMode:'video'});
    act(()=>one('live-replay').props.onOtherVideos());await settle();await show('camera');
    const order:string[]=[],resume:(()=>void)[]=[];
    mockLiveVideoGuard.mockImplementation(next=>{order.push('local');resume.push(next);});
    mockVideoGuard.mockImplementation(next=>{order.push('other');resume.push(next);});
    mockCameraGuard.mockImplementation(next=>{order.push('camera');resume.push(next);});
    close();await settle();expect(order).toEqual(['local']);expect(props.onClose).not.toHaveBeenCalled();
    act(()=>resume.shift()!());await settle();expect(order).toEqual(['local','other']);expect(props.onClose).not.toHaveBeenCalled();
    act(()=>resume.shift()!());await settle();expect(order).toEqual(['local','other','camera']);expect(props.onClose).not.toHaveBeenCalled();
    act(()=>resume.shift()!());expect(props.onClose).toHaveBeenCalledTimes(1);
});


test.each([true, false])('source picker camera capability follows local availability (%s) without replacing its host or draft', async available => {
    mockCameraAvailable = available; await mount({ initialMode: 'video' });
    const source = one('video-studio'), video = source.props.instance;
    act(() => source.props.editDraft('Revisão em andamento'));
    if (!available) { expect(one('video-studio').props.onCameraSourceTarget).toBeUndefined(); return; }
    const host = one('live-camera').props.instance, onHostApi = one('live-camera').props.onHostApi;
    const target = { id: 'source-camera-dialog-content' } as unknown as HTMLElement;
    act(() => one('video-studio').props.onCameraSourceTarget(target)); await settle();
    expect(one('live-camera').props).toMatchObject({ instance: host, controlsOpen: false, controlsTarget: target, onHostApi });
    expect(one('video-studio').props).toMatchObject({ instance: video, draft: 'Revisão em andamento' });
    expect(one('workspace-tabs').props.value).toBe('video');
    act(() => one('video-studio').props.onCameraSourceTarget(null)); await settle();
    expect(one('live-camera').props).toMatchObject({ instance: host, controlsOpen: false, controlsTarget: null, onHostApi });
    expect(one('video-studio').props).toMatchObject({ instance: video, draft: 'Revisão em andamento' });
    expect(mockUnmounts).toEqual([]);expect(mockVideoGuard).not.toHaveBeenCalled();expect(mockCameraGuard).not.toHaveBeenCalled();expect(props.onSaved).not.toHaveBeenCalled();
});

test('the source camera step suppresses an already open header popover and releases its target on return',async()=>{
    await mount({initialMode:'video'});await show('camera');
    const host=one('live-camera').props.instance,video=one('video-studio').props.instance;
    expect(one('live-camera').props.controlsOpen).toBe(true);
    const target={id:'source-step'} as unknown as HTMLElement;
    act(()=>one('video-studio').props.onCameraSourceTarget(target));await settle();
    expect(one('live-camera').props).toMatchObject({instance:host,controlsOpen:false,controlsTarget:target});
    act(()=>one('video-studio').props.onCameraSourceTarget(null));await settle();
    expect(one('live-camera').props).toMatchObject({controlsTarget:null,controlsOpen:false});
    expect(one('live-camera').props.instance).toBe(host);expect(one('video-studio').props.instance).toBe(video);
    expect(mockUnmounts).toEqual([]);expect(mockVideoGuard).not.toHaveBeenCalled();expect(mockCameraGuard).not.toHaveBeenCalled();
});


test('the source chooser opens the retained camera after closing its dialog without starting capture',async()=>{
    await mount({initialMode:'video'});
    const instance=one('live-camera').props.instance;
    act(()=>one('workspace-menu').props.onSources());
    expect(one('workspace-dialog').props.title).toBe('Fonte do vídeo');
    act(()=>action('Conectar câmera pelo seletor de fontes').props.onPress());
    expect(view!.root.findAllByType('workspace-dialog' as never)).toHaveLength(0);
    expect(one('live-camera').props).toMatchObject({instance,controlsOpen:true});
    expect(props.onSaved).not.toHaveBeenCalled();
});
