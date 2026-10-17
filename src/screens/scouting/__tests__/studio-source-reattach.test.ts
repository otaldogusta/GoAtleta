import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newVideoDocument, splitVideoRally, type VideoDocument } from '../../../core/scouting-video';
import { Studio } from '../video/ScoutingVideoStudio.web';
import { inspectVideo } from '../video/video-media.web';
import { useVideoDraft } from '../video/use-video-draft';

jest.mock('../video/use-video-draft', () => ({ useVideoDraft: jest.fn() }));
jest.mock('../video/video-media.web', () => ({ inspectVideo: jest.fn() }));
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
    StudioDialog: ({ children }: { children: unknown }) => children,
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
jest.mock('../video/VideoLinkField.web', () => ({ VideoLinkField: () => null }));
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
const savedCreateUrl = URL.createObjectURL, savedRevokeUrl = URL.revokeObjectURL;
let view: ReactTestRenderer | undefined;
const studioProps = { org: 'org', userId: 'user', classId: 'class', sessionId: 'session', teamName: 'Equipe', students: [], onClose: jest.fn(), session: { title: 'Análise existente', opponent: 'Outra equipe', status: 'em_andamento' as const } };

beforeEach(() => {
    jest.clearAllMocks();
    globalThis.document = { getElementById: () => null, activeElement: null, body: { style: { overflow: '' } } } as unknown as Document;
    window.addEventListener = jest.fn(); window.removeEventListener = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:selected-original') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    (inspectVideo as jest.Mock).mockResolvedValue(original);
});
afterEach(() => { act(() => { view?.unmount(); view = undefined; }); });
afterAll(() => {
    globalThis.document = savedDocument;
    window.addEventListener = savedAddEventListener; window.removeEventListener = savedRemoveEventListener;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: savedCreateUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: savedRevokeUrl });
});

function mount(overrides = {}) {
    const doc = canonical();
    const draft = { doc, history: { present: doc, past: [{ label: 'Revisão preservada' }], future: [] },
        dirty: false, saving: false, loading: false, syncStatus: 'synced', conflict: null, error: '',
        open: jest.fn().mockResolvedValue(undefined), save: jest.fn().mockResolvedValue(true), change: jest.fn(), undo: jest.fn(),
        setError: jest.fn(), retrySync: jest.fn().mockResolvedValue(true), resolveConflict: jest.fn().mockResolvedValue(true), ...overrides };
    (useVideoDraft as jest.Mock).mockReturnValue(draft);
    act(() => { view = create(createElement(Studio, studioProps)); });
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
