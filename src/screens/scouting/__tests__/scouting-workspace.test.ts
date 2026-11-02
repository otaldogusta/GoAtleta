import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { createPortal } from 'react-dom';
import ScoutingWorkspace from '../ScoutingWorkspace.web';
import type { ScoutingWorkspaceProps } from '../ScoutingWorkspace.types';
import { requestPendingEditsNavigation } from '../../../navigation/pending-edits-navigation';

let mockCameraAvailable = true;
let mockNextInstance = 0;
let mockVideoGuard: jest.Mock<void, [() => void]>;
let mockCameraGuard: jest.Mock<void, [() => void]>;
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
// but resolve the two workspace imports to deferred fixture modules.
jest.mock('react', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    let importIndex = 0;
    return { ...React, lazy: () => {
        const index = importIndex++;
        return React.lazy(() => Promise.resolve().then(() => index === 0
            ? jest.requireMock('../video/ScoutingVideoStudio.web') : jest.requireMock('../live/ScoutingLive.web')));
    } };
});
jest.mock('react-dom', () => ({ createPortal: jest.fn((children: unknown) => children) }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/use-responsive-layout', () => ({ useResponsiveLayout: () => ({ contentWidth: 1200, density: { bodyFontSize: 13, metadataFontSize: 11 } }) }));
jest.mock('../ScoutingUI', () => ({ shortDate: (value: string) => value }));
jest.mock('../live/live-api', () => ({ liveLocalAvailable: () => mockCameraAvailable }));
jest.mock('../video/studio-styles', () => ({ studioStyles: '' }));
jest.mock('../ScoutingNavigation', () => ({ ScoutingTabs: (props: object) => jest.requireActual('react').createElement('workspace-tabs', props) }));
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
const savedAdd = window.addEventListener, savedRemove = window.removeEventListener;
let view: ReactTestRenderer | undefined;
let props: ScoutingWorkspaceProps;
let appRoot: { inert: boolean }, body: { style: { overflow: string } }, previousFocus: { focus: jest.Mock };
let listeners: Map<string, Set<(event: unknown) => void>>;
let documentListeners: Map<string, Set<(event: unknown) => void>>;
let toolbarClick: ((event: unknown) => void) | undefined;
const rows = [
    { session: { id: 'game-a', title: 'Primeiro set', date: '2026-11-01' } },
    { session: { id: 'game-b', title: 'Segundo set', date: '2026-11-01' } },
] as ScoutingWorkspaceProps['rows'];
const one = (type: string): ReactTestInstance => view!.root.findByType(type as never);
const action = (label: string) => view!.root.findAllByType('button').find(node => node.props.label === label)!;
const choose = (mode: 'register' | 'video' | 'camera') => act(() => one('workspace-tabs').props.onChange(mode));
const settle = async () => { await act(async () => { await Promise.resolve(); }); };
const show = async (mode: 'register' | 'video' | 'camera') => { choose(mode); await settle(); };
const mount = async (overrides: Partial<ScoutingWorkspaceProps> = {}) => {
    props = { org: 'org-a', userId: 'user-a', classId: 'class-a', teamName: 'Sub19', students: [{ id: 'athlete-a', name: 'Atleta' }] as ScoutingWorkspaceProps['students'], rows, mode: 'jogo', initialMode: 'register', onClose: jest.fn(), onSaved: jest.fn(), onCreated: jest.fn(), ...overrides };
    act(() => { view = create(createElement(ScoutingWorkspace, props), { createNodeMock: node => ({ inert: false, querySelector: () => ({ focus: jest.fn() }), querySelectorAll: () => [], contains: () => false, addEventListener: (_name: string, listener: (event: unknown) => void) => { if (node.props.className === 'sw-actions') toolbarClick = listener; }, removeEventListener: () => undefined }) }); });
    await settle();
};
const close = () => act(() => action('Voltar à visão geral do scouting').props.onPress());
const changeSession = (id: string) => act(() => one('workspace-select').props.onChange(id));

beforeEach(() => {
    jest.clearAllMocks(); mockCameraAvailable = true; mockNextInstance = 0; mockMounts.length = 0; mockUnmounts.length = 0;
    mockVideoGuard = jest.fn(next => next()); mockCameraGuard = jest.fn(next => next());
    appRoot = { inert: false }; body = { style: { overflow: 'scroll' } }; previousFocus = { focus: jest.fn() }; listeners = new Map(); documentListeners = new Map();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        getElementById: () => appRoot, body, activeElement: previousFocus, querySelector: () => null, querySelectorAll: () => [],
        addEventListener: jest.fn((name: string, callback: (event: unknown) => void) => { const set = documentListeners.get(name) ?? new Set(); set.add(callback); documentListeners.set(name, set); }),
        removeEventListener: jest.fn((name: string, callback: (event: unknown) => void) => { documentListeners.get(name)?.delete(callback); }),
    } });
    window.addEventListener = jest.fn((name, callback) => { const set = listeners.get(name) ?? new Set(); set.add(callback as (event: unknown) => void); listeners.set(name, set); });
    window.removeEventListener = jest.fn((name, callback) => { listeners.get(name)?.delete(callback as (event: unknown) => void); });
});
afterEach(() => {
    act(() => { view?.unmount(); view = undefined; });
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
    window.addEventListener = savedAdd; window.removeEventListener = savedRemove;
});

test('loads each tool on its first visit and keeps unsaved pane state while switching tools', async () => {
    await mount();
    const collector = one('collector').props.instance;
    expect(mockMounts).toEqual([collector]);
    expect(view!.root.findAllByType('video-studio' as never)).toHaveLength(0);
    expect(view!.root.findAllByType('live-camera' as never)).toHaveLength(0);
    act(() => one('collector').props.editDraft('contato ainda em edição'));
    choose('video');
    expect(view!.root.findAllByProps({ role: 'status' })).toHaveLength(1);
    await settle();
    const video = one('video-studio').props.instance;
    act(() => one('video-studio').props.editDraft('recorte não confirmado'));
    await show('camera');
    const camera = one('live-camera').props.instance;
    act(() => one('live-camera').props.editDraft('gravação independente'));
    await show('video'); await show('register');
    expect(one('collector').props).toMatchObject({ instance: collector, draft: 'contato ainda em edição', active: true });
    expect(one('video-studio').props).toMatchObject({ instance: video, draft: 'recorte não confirmado', visible: false });
    expect(one('live-camera').props).toMatchObject({ instance: camera, draft: 'gravação independente', visible: false });
    expect(mockMounts).toHaveLength(3); expect(mockUnmounts).toEqual([]);
    expect(mockVideoGuard).not.toHaveBeenCalled(); expect(mockCameraGuard).not.toHaveBeenCalled();
});

test('passes source scope unchanged and separates route focus from tool visibility', async () => {
    await mount(); await show('video'); await show('camera');
    expect(documentListeners.get('keydown')?.size).toBe(1);
    for (const type of ['collector', 'video-studio', 'live-camera']) {
        const child = one(type).props;
        expect(child.org).toBe(props.org); expect(child.userId).toBe(props.userId);
    }
    expect(one('collector').props).toMatchObject({ sessionId: 'game-a', presentation: 'embedded', active: false, containerWidth: 1200 });
    expect(one('collector').props.students).toBe(props.students);
    expect(one('video-studio').props).toMatchObject({ classId: props.classId, sessionId: 'game-a', embedded: true, active: true, visible: false });
    expect(one('video-studio').props.students).toBe(props.students);
    expect(one('live-camera').props).toMatchObject({ classId: props.classId, className: props.teamName, embedded: true, visible: true });
    expect(one('live-camera').props.sessionId).toBeUndefined();
    act(() => view!.update(createElement(ScoutingWorkspace, { ...props, active: false })));
    expect(one('video-studio').props).toMatchObject({ active: false, visible: false });
    expect(one('live-camera').props.visible).toBe(false); expect(one('collector').props.active).toBe(false);
    expect(appRoot.inert).toBe(false); expect(body.style.overflow).toBe('scroll');
    expect(documentListeners.get('keydown')?.size).toBe(0);
    expect(previousFocus.focus).toHaveBeenCalledTimes(1); expect(mockUnmounts).toEqual([]);
    const navigate = jest.fn(); requestPendingEditsNavigation(navigate); expect(navigate).toHaveBeenCalledTimes(1);
    expect(createPortal).toHaveBeenCalled();
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
    expect(one('workspace-tabs').props.value).toBe('camera'); expect(mockCameraGuard).toHaveBeenCalledTimes(1);
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


test('the header retains video actions and new-analysis placement across workspace modes', async () => {
    await mount({ initialMode: 'video' });
    const head = view!.root.findByProps({ className: 'sw-head' });
    const actions = view!.root.findByProps({ className: 'sw-actions' });
    for (const mode of ['register', 'camera', 'video'] as const) {
        await show(mode);
        expect(view!.root.findByProps({ className: 'sw-head' })).toBe(head);
        expect(view!.root.findByProps({ className: 'sw-actions' })).toBe(actions);
        expect(actions.props.hidden).not.toBe(true);
        expect(head.findAllByType('button').some(node => node.props.label === 'Nova análise no estúdio')).toBe(true);
    }
    expect(props.onSaved).not.toHaveBeenCalled();
});


test('retained video actions reveal their workspace before opening a dialog', async () => {
    await mount({ initialMode: 'video' });
    await show('camera');
    expect(toolbarClick).toBeDefined();
    act(() => toolbarClick!({ target: { closest: () => ({}) } }));
    expect(one('workspace-tabs').props.value).toBe('camera');
    act(() => toolbarClick!({ target: { closest: () => null } }));
    await settle();
    expect(one('workspace-tabs').props.value).toBe('video');
    expect(props.onSaved).not.toHaveBeenCalled();
});
