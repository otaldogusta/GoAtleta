import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newVideoDocument, type VideoAnalysis, type VideoDocument } from '../../../core/scouting-video';
import { attachYoutubeTracking } from '../../../core/scouting-video-tracking';
import { YouTubeTrackingSetup } from '../video/YouTubeTrackingSetup.web';
import { YouTubeTrackingPanel } from '../video/YouTubeTrackingPanel.web';
import { inspectVideo } from '../video/video-media.web';
import { processScoutingVideo } from '../video/video-processing.web';

jest.mock('../video/video-media.web', () => ({ inspectVideo: jest.fn() }));
jest.mock('../video/video-processing.web', () => ({ processScoutingVideo: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({
    StudioDialog: ({ children }: { children: unknown }) => children,
    StudioAction: (props: object) => jest.requireActual('react').createElement('button', props),
}));

const media = { fingerprint: 'original-match', name: 'partida.mp4', duration: 60, width: 640, height: 480 };
const analysis: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30,
    positions: [{ time: 1, x: .2, y: .3 }, { time: 1 + 1 / 30, x: .21, y: .31 }, { time: 2, x: .5, y: .6 }], cuts: [] };
const original = (): VideoDocument => ({ ...newVideoDocument(media, 'original-r1'), analysis });
const youtube = (): VideoDocument => ({ ...newVideoDocument({ youtubeId: 'mdfgd1K3HTc', fingerprint: 'youtube:mdfgd1K3HTc', duration: 60, width: 1280, height: 720, name: 'YouTube' }, 'yt-r1'),
    contacts: [{ id: 'manual', time: 3, skill: 'Saque', team: 'us', athlete: '', studentId: null, outcome: '' }] });
const file = (document: VideoDocument = original(), size = 1000) => ({ name: 'analysis.json', size, text: jest.fn().mockResolvedValue(JSON.stringify(document)) }) as unknown as File;
let view: ReactTestRenderer | undefined;
const savedCreateUrl = URL.createObjectURL, savedRevokeUrl = URL.revokeObjectURL;

beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:tracking-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    (inspectVideo as jest.Mock).mockResolvedValue(media);
    (processScoutingVideo as jest.Mock).mockResolvedValue(analysis);
});
afterEach(() => { act(() => { view?.unmount(); view = undefined; }); });
afterAll(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: savedCreateUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: savedRevokeUrl });
});

function mountSetup() {
    const doc = youtube(), onApply = jest.fn();
    act(() => { view = create(createElement(YouTubeTrackingSetup, { doc, onApply, onClose: jest.fn() })); });
    return { doc, onApply };
}
function button(label: string) { return view!.root.findByProps({ label }); }
function confirm() { act(() => view!.root.findAllByType('input').find(input => input.props.type === 'checkbox')!.props.onChange({ target: { checked: true } })); }
function offset(value: string) { act(() => view!.root.findByProps({ 'aria-label': 'Ajuste de sincronização do tracking' }).props.onChange({ target: { value } })); }
async function select(input: File, processed = true) {
    const target = { files: [input], value: 'selected' };
    const element = view!.root.findAllByType('input').find(node => node.props.type === 'file' && (processed ? node.props.accept.includes('json') : node.props.accept.includes('video')))!;
    await act(async () => { element.props.onChange({ target }); });
    expect(target.value).toBe('');
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

test('processed tracking requires same-edit confirmation and a finite explicit offset before applying', async () => {
    const { doc, onApply } = mountSetup();
    await select(file());
    expect(onApply).not.toHaveBeenCalled();
    expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(true);
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    expect(onApply).not.toHaveBeenCalled();
    confirm();
    for (const invalid of ['', 'NaN', 'Infinity', '1801']) {
        offset(invalid);
        expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(true);
        act(() => button('Aplicar tracking ao YouTube').props.onPress());
        expect(onApply).not.toHaveBeenCalled();
    }
    offset('0');
    expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(false);
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    const applied = onApply.mock.calls[0][0] as VideoDocument;
    expect(applied.analysis?.source).toEqual({ ...media, offsetSeconds: 0 });
    expect(applied.contacts).toEqual(doc.contacts);
    expect(applied.rallies).toEqual(doc.rallies);
    expect(onApply).toHaveBeenCalledWith(applied, undefined);
    expect(doc.analysis).toBeUndefined();
    expect(processScoutingVideo).not.toHaveBeenCalled();
});

test('changing the selected original revokes confirmation and alignment failure preserves annotations', async () => {
    const { onApply } = mountSetup();
    await select(file()); confirm();
    await select(file({ ...original(), media: { ...media, fingerprint: 'second-original', name: 'second.mp4' } }));
    expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(true);
    confirm(); offset('1800');
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    expect(view!.root.findByProps({ role: 'alert' }).children.join('')).toContain('não coincide');
    expect(onApply).not.toHaveBeenCalled();
});

test('rejects oversized and already linked analysis instead of treating it as an original', async () => {
    const { onApply } = mountSetup();
    const oversized = file(original(), 5000001);
    await select(oversized);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(view!.root.findByProps({ role: 'alert' }).children.join('')).toContain('5 MB');
    await select(file(attachYoutubeTracking(youtube(), original(), 0)));
    expect(view!.root.findByProps({ role: 'alert' }).children.join('')).toContain('arquivo original');
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking ao YouTube' })).toHaveLength(0);
    expect(onApply).not.toHaveBeenCalled();
});

test('processing stays local and produces a candidate requiring a separate Apply action', async () => {
    const { onApply } = mountSetup();
    const video = { name: 'partida.mp4', type: 'video/mp4', size: 5000 } as File;
    await select(video, false);
    expect(inspectVideo).toHaveBeenCalledWith(video);
    expect(processScoutingVideo).not.toHaveBeenCalled();
    expect(button('Processar tracking neste aparelho').props.disabled).toBe(true);
    confirm(); offset('1.5');
    await act(async () => { button('Processar tracking neste aparelho').props.onPress(); });
    expect(processScoutingVideo).toHaveBeenCalledWith(video, 60, expect.any(AbortSignal), expect.any(Function), { model: 'v2b' });
    expect(onApply).not.toHaveBeenCalled();
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    expect((onApply.mock.calls[0][0] as VideoDocument).analysis?.positions[0].time).toBe(2.5);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][1]).toBe(video);
    act(() => { view!.unmount(); view = undefined; });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tracking-preview');
});

test('replacing a local video candidate with processed JSON never hands off the previous file', async () => {
    const { onApply } = mountSetup();
    const video = { name: 'partida.mp4', type: 'video/mp4', size: 5000 } as File;
    await select(video, false); confirm();
    await act(async () => { button('Processar tracking neste aparelho').props.onPress(); });
    expect(onApply).not.toHaveBeenCalled();
    await select(file());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tracking-preview');
    expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(true);
    expect(view!.root.findAllByType('video')).toHaveLength(0);
    confirm();
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][1]).toBeUndefined();
});

test('selecting V4c uses that model for local processing and keeps its provenance when applied', async () => {
    const v4Analysis: VideoAnalysis = { ...analysis, model: 'vballnet-v4c-browser-1' };
    (processScoutingVideo as jest.Mock).mockResolvedValue(v4Analysis);
    const { onApply } = mountSetup();
    const video = { name: 'partida.mp4', type: 'video/mp4', size: 5000 } as File;
    await select(video, false);
    act(() => view!.root.findByProps({ 'aria-label': 'Modelo de tracking' }).props.onChange({ target: { value: 'v4c' } }));
    confirm();
    await act(async () => { button('Processar tracking neste aparelho').props.onPress(); });
    expect(processScoutingVideo).toHaveBeenCalledWith(video, 60, expect.any(AbortSignal), expect.any(Function), { model: 'v4c' });
    expect(onApply).not.toHaveBeenCalled();
    act(() => button('Aplicar tracking ao YouTube').props.onPress());
    expect((onApply.mock.calls[0][0] as VideoDocument).analysis?.model).toBe('vballnet-v4c-browser-1');
});

test('cancel aborts processing and a late successful result cannot become applicable', async () => {
    const pending = deferred<VideoAnalysis>();
    (processScoutingVideo as jest.Mock).mockReturnValue(pending.promise);
    const { onApply } = mountSetup();
    await select({ name: 'match.mp4', type: 'video/mp4', size: 1 } as File, false); confirm();
    act(() => button('Processar tracking neste aparelho').props.onPress());
    const signal = (processScoutingVideo as jest.Mock).mock.calls[0][2] as AbortSignal;
    act(() => button('Cancelar tracking').props.onPress());
    expect(signal.aborted).toBe(true);
    const progress = (processScoutingVideo as jest.Mock).mock.calls[0][3] as (done: number, total: number, status: string) => void;
    act(() => progress(9, 10, 'Progresso atrasado'));
    expect(view!.root.findAllByProps({ role: 'status' })).toHaveLength(0);
    await act(async () => pending.resolve(analysis));
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking ao YouTube' })).toHaveLength(0);
    expect(onApply).not.toHaveBeenCalled();
});

test('processing failure is recoverable and never attaches an empty trajectory', async () => {
    (processScoutingVideo as jest.Mock).mockRejectedValueOnce(new Error('Detector indisponível'));
    const { onApply } = mountSetup();
    await select({ name: 'match.mp4', type: 'video/mp4', size: 1 } as File, false); confirm();
    await act(async () => button('Processar tracking neste aparelho').props.onPress());
    expect(view!.root.findByProps({ role: 'alert' }).children.join('')).toContain('Detector indisponível');
    expect(button('Processar tracking neste aparelho').props.disabled).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => button('Processar tracking neste aparelho').props.onPress());
    expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
    expect(button('Aplicar tracking ao YouTube').props.disabled).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
});

test('unmount aborts processing and ignores deferred file inspection/results', async () => {
    const inspection = deferred<typeof media>();
    (inspectVideo as jest.Mock).mockReturnValue(inspection.promise);
    mountSetup();
    await select({ name: 'match.mp4', type: 'video/mp4', size: 1 } as File, false);
    act(() => { view!.unmount(); view = undefined; });
    await act(async () => inspection.resolve(media));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    const processing = deferred<VideoAnalysis>();
    (inspectVideo as jest.Mock).mockResolvedValue(media);
    (processScoutingVideo as jest.Mock).mockReturnValue(processing.promise);
    const { onApply } = mountSetup();
    await select({ name: 'match.mp4', type: 'video/mp4', size: 1 } as File, false); confirm();
    act(() => button('Processar tracking neste aparelho').props.onPress());
    const signal = (processScoutingVideo as jest.Mock).mock.calls[0][2] as AbortSignal;
    act(() => { view!.unmount(); view = undefined; });
    expect(signal.aborted).toBe(true);
    await act(async () => processing.resolve(analysis));
    expect(onApply).not.toHaveBeenCalled();
});

function mountPanel(doc: VideoDocument, time: number, correcting = false, onCorrect?: (x: number, y: number) => void) {
    act(() => { view = create(createElement(YouTubeTrackingPanel, { doc, time, correcting, onCorrect })); });
}
const bounds = (width = 200, height = 100) => ({ currentTarget: { getBoundingClientRect: () => ({ left: 100, top: 200, width, height }) }, clientX: 150, clientY: 250 });

test('panel uses original image proportions and does not draw across missing frames or cuts', () => {
    const doc = attachYoutubeTracking(youtube(), original(), 0);
    mountPanel(doc, 1 + 1 / 30);
    expect(view!.root.findByType('svg').props.style.aspectRatio).toBe('640 / 480');
    expect(view!.root.findByType('ellipse').props.ry).toBe(24);
    expect(view!.root.findByType('polyline').props.points).toBe('200,300 210,310');
    act(() => view!.update(createElement(YouTubeTrackingPanel, { doc, time: 1.1, correcting: false })));
    expect(view!.root.findAllByType('ellipse')).toHaveLength(0);
    expect(view!.root.findAllByType('small')[0].children).toContain('Sem posição neste instante');
    const withCut = { ...doc, analysis: { ...doc.analysis!, cuts: [1 + 1 / 30] } };
    act(() => view!.update(createElement(YouTubeTrackingPanel, { doc: withCut, time: 1 + 1 / 30, correcting: false })));
    expect(view!.root.findByType('polyline').props.points).toBe('210,310');
});

test('corrections are visible in read-only mode while clicks require editing permission', () => {
    const doc = { ...attachYoutubeTracking(youtube(), original(), 0), corrections: [{ time: 1, x: .7, y: .8 }] };
    const onCorrect = jest.fn();
    mountPanel(doc, 1, false, onCorrect);
    expect(view!.root.findByType('ellipse').props.cx).toBe(700);
    expect(view!.root.findByType('polyline').props.points).toBe('');
    expect(view!.root.findAllByType('small')[0].children).toContain('Corrigida');
    act(() => view!.root.findByType('svg').props.onClick(bounds()));
    expect(onCorrect).not.toHaveBeenCalled();
    act(() => view!.update(createElement(YouTubeTrackingPanel, { doc, time: 1, correcting: true, onCorrect })));
    act(() => view!.root.findByType('svg').props.onClick({ ...bounds(), clientX: -50, clientY: 900 }));
    expect(onCorrect).toHaveBeenCalledWith(0, 1);
    const before = JSON.stringify(doc);
    act(() => view!.update(createElement(YouTubeTrackingPanel, { doc, time: 1, correcting: true })));
    act(() => view!.root.findByType('svg').props.onClick(bounds()));
    expect(JSON.stringify(doc)).toBe(before);
});

test('a correction before a cut is hidden and reported as absent at the new scene', () => {
    const doc = { ...attachYoutubeTracking(youtube(), original(), 0), analysis: { ...attachYoutubeTracking(youtube(), original(), 0).analysis!, cuts: [1.01] }, corrections: [{ time: 1, x: .7, y: .8 }] };
    mountPanel(doc, 1.02);
    expect(view!.root.findAllByType('ellipse')).toHaveLength(0);
    expect(view!.root.findAllByType('small')[0].children).toContain('Sem posição neste instante');
});

test('hidden or zero-size panels cannot create non-finite corrections', () => {
    const onCorrect = jest.fn();
    mountPanel(attachYoutubeTracking(youtube(), original(), 0), 1, true, onCorrect);
    act(() => view!.root.findByType('svg').props.onClick(bounds(0, 0)));
    expect(onCorrect).not.toHaveBeenCalled();
});
