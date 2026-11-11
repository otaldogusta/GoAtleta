import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newVideoDocument, splitVideoRally, type VideoDocument } from '../../../core/scouting-video';
import { Studio } from '../video/ScoutingVideoStudio.web';
import { inspectVideo } from '../video/video-media.web';
import { useVideoDraft } from '../video/use-video-draft';
import { startPhoneVideoReception } from '../video/phone-video-pairing.web';
import { readStoredPhoneVideo, type PhoneVideoReceived } from '../video/phone-video-transfer.web';

jest.mock('../video/use-video-draft', () => ({ useVideoDraft: jest.fn() }));
jest.mock('../video/video-media.web', () => ({ inspectVideo: jest.fn() }));
jest.mock('../video/phone-video-pairing.web', () => ({ startPhoneVideoReception: jest.fn() }));
jest.mock('../video/phone-video-transfer.web', () => ({ readStoredPhoneVideo: jest.fn(), removeStoredPhoneVideo: jest.fn() }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../observability/perf', () => ({ markRender: jest.fn() }));
jest.mock('../../../db/scouting-collection', () => ({ loadScoutingDetail: jest.fn() }));
jest.mock('../../../api/scouting-video-drive', () => ({ driveTrackingAvailable: () => false }));
jest.mock('../../../api/scouting-video-ai', () => ({ localVideoAiAvailable: () => false }));
jest.mock('../video/video-processing.web', () => ({ processScoutingVideo: jest.fn() }));
jest.mock('../video/studio-styles', () => ({ studioStyles: '' }));
jest.mock('../video/use-studio-interactions', () => ({ useStudioInteractions: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({
    StudioAction: (props: object) => jest.requireActual('react').createElement('button', props),
    StudioDialog: ({ children, headerActions, ...props }: any) => jest.requireActual('react').createElement('dialog', props, headerActions, children),
}));
jest.mock('../video/StudioPanel.web', () => ({ StudioPanel: ({ children }: { children: unknown }) => children }));
jest.mock('../video/StudioSelect.web', () => ({ StudioSelect: () => null }));
jest.mock('../video/VideoGallery.web', () => ({ VideoGallery: (props: object) => jest.requireActual('react').createElement('gallery', props) }));
jest.mock('../video/VideoTimeline.web', () => ({ VideoTimeline: () => null }));
jest.mock('../video/VideoFrame.web', () => ({ VideoFrame: () => null }));
jest.mock('../video/VideoBufferStatus.web', () => ({ VideoBufferStatus: () => null }));
jest.mock('../video/VideoTrackingOverlay.web', () => ({ VideoTrackingOverlay: () => null }));
jest.mock('../video/VideoCorrectionLens.web', () => ({ VideoCorrectionLens: () => null }));
jest.mock('../video/YouTubeVideo.web', () => ({ YouTubeVideo: () => null }));
jest.mock('../video/VideoLinkField.web', () => ({ VideoLinkField: (props: object) => jest.requireActual('react').createElement('video-link', props) }));
jest.mock('../video/VideoRallyRange.web', () => ({ VideoRallyRange: () => null }));
jest.mock('../video/YouTubeAnalysis.web', () => ({ YouTubeAnalysis: () => null }));
jest.mock('../video/YouTubeTrackingSetup.web', () => ({ YouTubeTrackingSetup: () => null }));
jest.mock('../video/DriveTrackingSetup.web', () => ({ DriveTrackingSetup: () => null }));
jest.mock('../video/YouTubeTrackingPanel.web', () => ({ YouTubeTrackingPanel: () => null }));
jest.mock('../video/VideoShareDialog.web', () => ({ VideoShareDialog: () => null }));
jest.mock('../video/VideoContactEditor.web', () => ({ VideoContactEditor: () => null }));

const original = { fingerprint: 'a'.repeat(64), name: 'original.mp4', duration: 60, width: 1202, height: 676 };
const canonical = (): VideoDocument => ({
    ...splitVideoRally(newVideoDocument({ fingerprint: 'youtube:mdfgd1K3HTc', youtubeId: 'mdfgd1K3HTc', name: 'YouTube', duration: 70, width: 1280, height: 720 }, 'remote-rally'), 15, 'reviewed-rally'),
    contacts: [{ id: 'reviewed-contact', time: 18, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Em jogo' }],
    analysis: { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: 12, x: .2, y: .3 }], cuts: [15], source: { ...original, offsetSeconds: 10 } },
});
const savedDocument = globalThis.document;
const savedAddEventListener = window.addEventListener, savedRemoveEventListener = window.removeEventListener;
const savedLocation = Object.getOwnPropertyDescriptor(window, 'location');
const savedStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
const savedCreateUrl = URL.createObjectURL, savedRevokeUrl = URL.revokeObjectURL;
let view: ReactTestRenderer | undefined;
const cameraSourceTarget = { focus: jest.fn() }, sourceCameraFocus = jest.fn(), sourcePhoneFocus = jest.fn();
const studioProps = { org: 'org', userId: 'user', classId: 'class', sessionId: 'session', teamName: 'Equipe', students: [], onClose: jest.fn(), session: { title: 'Análise existente', opponent: 'Outra equipe', status: 'em_andamento' as const } };

beforeEach(() => {
    jest.clearAllMocks();
    globalThis.document = { getElementById: () => null, activeElement: null, body: { style: { overflow: '' } } } as unknown as Document;
    window.addEventListener = jest.fn(); window.removeEventListener = jest.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'https://goatleta.com' } });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:selected-original') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    (inspectVideo as jest.Mock).mockResolvedValue(original);
});
afterEach(() => {
    act(() => { view?.unmount(); view = undefined; });
    if (savedStorage) Object.defineProperty(window, 'localStorage', savedStorage);
    else Reflect.deleteProperty(window, 'localStorage');
});
afterAll(() => {
    globalThis.document = savedDocument;
    window.addEventListener = savedAddEventListener; window.removeEventListener = savedRemoveEventListener;
    if (savedLocation) Object.defineProperty(window, 'location', savedLocation);
    else Reflect.deleteProperty(window, 'location');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: savedCreateUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: savedRevokeUrl });
});

function mount(overrides = {}, extraProps: Partial<Parameters<typeof Studio>[0]> = {}) {
    const doc = canonical();
    const draft = { doc, history: { present: doc, past: [{ label: 'Revisão preservada' }], future: [] },
        dirty: false, saving: false, loading: false, syncStatus: 'synced', conflict: null, error: '',
        open: jest.fn().mockResolvedValue(undefined), save: jest.fn().mockResolvedValue(true), change: jest.fn(), undo: jest.fn(),
        setError: jest.fn(), retrySync: jest.fn().mockResolvedValue(true), resolveConflict: jest.fn().mockResolvedValue(true), ...overrides };
    (useVideoDraft as jest.Mock).mockReturnValue(draft);
    act(() => { view = create(createElement(Studio, { ...studioProps, ...extraProps }), { createNodeMock: node => node.props.className === 'sv-source-camera' ? cameraSourceTarget : node.props.className === 'sv-source-camera-trigger' ? { querySelector: () => ({ focus: sourceCameraFocus }) } : node.props.className === 'sv-source-phone-trigger' ? { querySelector: () => ({ focus: sourcePhoneFocus }) } : null }); });
    return draft;
}

async function selectFile() {
    const file = { name: 'video-no-celular.mp4' } as File;
    const input = view!.root.findAllByType('input').filter(node => node.props.type === 'file' && node.props.accept.startsWith('video/'))[1];
    await act(async () => { input.props.onChange({ target: { files: [file], value: 'selected' } }); });
    return file;
}

test.each([false, true])('the generic picker reattaches the original without opening or saving another draft (dirty: %s)', async dirty => {
    const draft = mount({ dirty }), before = JSON.stringify(draft.history);
    const selected = await selectFile();
    expect(inspectVideo).toHaveBeenCalledWith(selected);
    expect(draft.open).not.toHaveBeenCalled(); expect(draft.save).not.toHaveBeenCalled();
    expect(draft.change).not.toHaveBeenCalled(); expect(JSON.stringify(draft.history)).toBe(before);
    const player = view!.root.findByType('video');
    expect(player.props.src).toBe('blob:selected-original');
    expect(view!.root.findByType('gallery' as never).props.doc).toBe(draft.doc);
    expect(view!.root.findByType('gallery' as never).props.offsetSeconds).toBe(10);
});

test('an unmatched video keeps its independent document path', async () => {
    const draft = mount();
    (inspectVideo as jest.Mock).mockResolvedValue({ ...original, fingerprint: 'b'.repeat(64) });
    await selectFile();
    expect(draft.open).toHaveBeenCalledWith({ ...original, fingerprint: 'b'.repeat(64) });
    expect(draft.save).toHaveBeenCalledTimes(1);
});

test('cloud loading and conflict disable source switching instead of replacing an unreconciled document', async () => {
    const draft = mount({ loading: true });
    await selectFile();
    expect(inspectVideo).not.toHaveBeenCalled(); expect(draft.open).not.toHaveBeenCalled();
    expect(view!.root.findByProps({ label: 'Salvar rascunho' }).props.disabled).toBe(true);
    act(() => { view!.unmount(); view = undefined; });
    mount({ conflict: { local: canonical(), remote: {} }, syncStatus: 'conflict' });
    expect(view!.root.findByProps({ label: 'Salvar rascunho' }).props.disabled).toBe(true);
    expect(view!.root.findAllByProps({ label: 'Manter versão deste aparelho' })).toHaveLength(2);
});

test('retrying cloud synchronization does not require modifying an already saved local draft', async () => {
    const draft = mount({ syncStatus: 'offline' });
    const save = view!.root.findByProps({ label: 'Salvar rascunho' });
    expect(save.props.disabled).toBe(false);
    await act(async () => { save.props.onPress(); });
    expect(draft.retrySync).toHaveBeenCalledTimes(1); expect(draft.save).not.toHaveBeenCalled();
});

test('choosing a remote version for a different local video cannot display the previously attached file', async () => {
    const first = newVideoDocument(original, 'local-rally');
    const draft = mount({ doc: first });
    await selectFile();
    expect(view!.root.findByType('video').props.src).toBe('blob:selected-original');
    const remote = newVideoDocument({ ...original, fingerprint: 'b'.repeat(64) }, 'remote-rally');
    draft.doc = remote;
    act(() => view!.update(createElement(Studio, studioProps)));
    expect(view!.root.findAllByType('video')).toHaveLength(0);
    expect(view!.root.findByType('gallery' as never).props.doc).toBe(remote);
    expect(draft.change).not.toHaveBeenCalled();
});


test('camera source stays in the same dialog and returns to the typed link without replacing media', () => {
    const onCameraSourceTarget = jest.fn(), draft = mount({ dirty: true }, { onCameraSourceTarget });
    const open = () => act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    open();
    const dialog = view!.root.findByType('dialog');
    act(() => view!.root.findByType('video-link' as never).props.onChange('https://youtu.be/mdfgd1K3HTc'));
    act(() => view!.root.findByProps({ label: 'Conectar câmera' }).props.onPress());
    expect(view!.root.findByType('dialog')).toBe(dialog); expect(dialog.props.title).toBe('Conectar câmera');
    expect(onCameraSourceTarget).toHaveBeenCalledTimes(1); expect(onCameraSourceTarget).toHaveBeenLastCalledWith(cameraSourceTarget);
    expect(cameraSourceTarget.focus).toHaveBeenCalledTimes(1);
    expect(view!.root.findAllByProps({ label: 'Conectar câmera' })).toHaveLength(0);
    expect(draft.open).not.toHaveBeenCalled(); expect(draft.change).not.toHaveBeenCalled(); expect(draft.save).not.toHaveBeenCalled();
    act(() => view!.root.findByProps({ label: 'Voltar para fontes de vídeo' }).props.onPress());
    expect(view!.root.findByType('dialog')).toBe(dialog); expect(dialog.props.title).toBe('Adicionar vídeo');
    expect(onCameraSourceTarget).toHaveBeenLastCalledWith(null); expect(sourceCameraFocus).toHaveBeenCalledTimes(1);
    expect(view!.root.findByType('video-link' as never).props.value).toBe('https://youtu.be/mdfgd1K3HTc');
});

test.each(['close', 'unmount'])('the camera source target is released on %s', method => {
    const onCameraSourceTarget = jest.fn(); mount({}, { onCameraSourceTarget });
    act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    act(() => view!.root.findByProps({ label: 'Conectar câmera' }).props.onPress());
    expect(onCameraSourceTarget).toHaveBeenLastCalledWith(cameraSourceTarget);
    if (method === 'close') act(() => view!.root.findByType('dialog').props.onClose());
    else act(() => { view!.unmount(); view = undefined; });
    expect(onCameraSourceTarget).toHaveBeenLastCalledWith(null);
});

test('the camera dialog closes when the live recording takes over and stays closed on return', () => {
    const onCameraSourceTarget = jest.fn();
    const available = { ...studioProps, onCameraSourceTarget };
    const draft = mount({ dirty: true }, { onCameraSourceTarget });
    const open = () => act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    open();
    const link = 'https://youtu.be/mdfgd1K3HTc';
    act(() => view!.root.findByType('video-link' as never).props.onChange(link));
    act(() => view!.root.findByProps({ label: 'Conectar câmera' }).props.onPress());

    act(() => view!.update(createElement(Studio, { ...available, visible: false })));
    expect(view!.root.findByType('dialog').props.title).toBe('Conectar câmera');
    expect(onCameraSourceTarget).toHaveBeenLastCalledWith(cameraSourceTarget);

    act(() => view!.update(createElement(Studio, { ...available, visible: false, onCameraSourceTarget: undefined })));
    expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    expect(onCameraSourceTarget).toHaveBeenLastCalledWith(null);
    expect(sourceCameraFocus).not.toHaveBeenCalled();

    act(() => view!.update(createElement(Studio, available)));
    expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    open();
    expect(view!.root.findByType('video-link' as never).props.value).toBe(link);
    expect(draft.change).not.toHaveBeenCalled();
});

test('camera source is absent without the workspace capability', () => {
    mount(); act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    expect(view!.root.findAllByProps({ label: 'Conectar câmera' })).toHaveLength(0);
});

function mockPhonePairing() {
    let complete!: (original: PhoneVideoReceived) => void;
    const file = new Promise<PhoneVideoReceived>(resolve => { complete = resolve; });
    (startPhoneVideoReception as jest.Mock).mockResolvedValue({
        url: `https://goatleta.com/scouting/enviar-video#id=12345678-1234-1234-1234-123456789abc&code=${'a'.repeat(64)}`,
        expiresAt: Date.now() + 60_000, file,
    });
    return complete;
}

const phoneStorageId = '12345678-1234-4234-8234-123456789abc';

test('cellphone import works without the local camera and adopts the approved original until Studio closes', async () => {
    const complete = mockPhonePairing(), draft = mount();
    const file = { name: 'original.mp4' } as File, release = jest.fn().mockResolvedValue(undefined);
    act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    const dialog = view!.root.findByType('dialog');
    await act(async () => { view!.root.findByProps({ label: 'Enviar MP4 do celular' }).props.onPress(); });
    expect(view!.root.findByType('dialog')).toBe(dialog);
    expect(dialog.props.title).toBe('Enviar MP4 do celular');
    expect(view!.root.findByType('img').props.src).toMatch(/^data:image\/svg\+xml;/);
    const [scope, pairing] = (startPhoneVideoReception as jest.Mock).mock.calls[0];
    expect(scope).toEqual({ org: 'org', classId: 'class', sessionId: 'session' });
    let approval!: Promise<boolean>;
    act(() => { approval = pairing.accept({ name: file.name, bytes: 500 }); });
    expect(inspectVideo).not.toHaveBeenCalled();
    await act(async () => { view!.root.findByProps({ label: 'Receber vídeo' }).props.onPress(); });
    await expect(approval).resolves.toBe(true);
    await act(async () => { complete({ file, storageId: phoneStorageId, release }); });
    expect(inspectVideo).toHaveBeenCalledWith(file);
    expect(draft.open).not.toHaveBeenCalled();
    expect(view!.root.findByType('video').props.src).toBe('blob:selected-original');
    expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
    act(() => { view!.unmount(); view = undefined; });
    expect(release).toHaveBeenCalledTimes(1);
});

test('a received original reopens only in the same scoped analysis with the matching document', async () => {
    const complete = mockPhonePairing();
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
    } });
    const file = { name: 'original.mp4', size: 500 } as File, release = jest.fn().mockResolvedValue(undefined);
    (readStoredPhoneVideo as jest.Mock).mockResolvedValue(file);
    mount();
    act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    await act(async () => { view!.root.findByProps({ label: 'Enviar MP4 do celular' }).props.onPress(); });
    const [, pairing] = (startPhoneVideoReception as jest.Mock).mock.calls[0];
    act(() => { void pairing.accept({ name: file.name, bytes: file.size }); });
    act(() => view!.root.findByProps({ label: 'Receber vídeo' }).props.onPress());
    await act(async () => { complete({ file, storageId: phoneStorageId, release }); });
    act(() => { view!.unmount(); view = undefined; });
    expect(release).not.toHaveBeenCalled();
    expect(storage.size).toBe(1);

    await act(async () => { mount(); });
    expect(readStoredPhoneVideo).toHaveBeenCalledWith(phoneStorageId, file.name, file.size);
    expect(view!.root.findByType('video').props.src).toBe('blob:selected-original');
    act(() => { view!.unmount(); view = undefined; });

    (readStoredPhoneVideo as jest.Mock).mockClear();
    await act(async () => { mount({}, { org: 'other-org' }); });
    expect(readStoredPhoneVideo).not.toHaveBeenCalled();
    expect(view!.root.findAllByType('video')).toHaveLength(0);
});

test('back from cellphone import cancels pairing and restores the typed link and source focus', async () => {
    mockPhonePairing(); mount();
    act(() => view!.root.findByProps({ label: 'Adicionar vídeo' }).props.onPress());
    act(() => view!.root.findByType('video-link' as never).props.onChange('https://youtu.be/mdfgd1K3HTc'));
    await act(async () => { view!.root.findByProps({ label: 'Enviar MP4 do celular' }).props.onPress(); });
    const [, pairing] = (startPhoneVideoReception as jest.Mock).mock.calls[0];
    act(() => view!.root.findByProps({ label: 'Voltar para fontes de vídeo' }).props.onPress());
    expect(pairing.signal.aborted).toBe(true);
    expect(sourcePhoneFocus).toHaveBeenCalledTimes(1);
    expect(view!.root.findByType('video-link' as never).props.value).toBe('https://youtu.be/mdfgd1K3HTc');
    expect(inspectVideo).not.toHaveBeenCalled();
});
