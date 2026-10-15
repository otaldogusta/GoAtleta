import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoGallery } from '../video/VideoGallery.web';
import { videoThumbnail } from '../video/video-media.web';
import { newVideoDocument } from '../../../core/scouting-video';
jest.mock('../video/video-media.web', () => ({ videoThumbnail: jest.fn().mockResolvedValue('data:image/jpeg;base64,fixture') }));
jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: object) => jest.requireActual('react').createElement('button', props) }));
const originalObserver = globalThis.IntersectionObserver;
beforeEach(() => {
    jest.clearAllMocks();
    globalThis.IntersectionObserver = class {
        constructor(private callback: (entries: unknown[]) => void) {}
        observe() { this.callback([{ isIntersecting: true }]); }
        disconnect() {}
    } as unknown as typeof IntersectionObserver;
});
afterEach(() => { globalThis.IntersectionObserver = originalObserver; });
test('YouTube poster is limited to the full video; rally thumbnails require the original', async () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    doc.rallies.push({ id: 'r2', start: 15, winner: null, reviewed: false });
    const props = { doc, source: 'youtube:abcdefghijk', focus: null, teams: { us: 'Equipe', them: 'Adversário' }, localMedia: false, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, props), { createNodeMock: () => ({}) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    const full = view.root.findByProps({ label: 'Abrir vídeo completo' });
    expect(full.props.active).toBe(true);
    act(() => view.root.findByProps({ label: 'Abrir rally 2' }).props.onPress());
    expect(props.onFocus).toHaveBeenLastCalledWith('r2');
    act(() => full.props.onPress());
    expect(props.onFocus).toHaveBeenLastCalledWith(null);
    expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByProps({ className: 'sv-thumb-unavailable' })).toHaveLength(2);
    await act(async () => { view.update(createElement(VideoGallery, { ...props, thumbnailSource: 'https://media.example/original.mp4', offsetSeconds: 8 })); });
    expect(videoThumbnail).toHaveBeenCalledTimes(1);
    expect(videoThumbnail).toHaveBeenCalledWith('https://media.example/original.mp4', 7, expect.any(AbortSignal));
    expect(view.root.findAllByType('img').map(n => n.props.src)).toContain('data:image/jpeg;base64,fixture');
    expect(view.root.findAllByType('button').some(b => b.props.label?.startsWith('Baixar'))).toBe(false);
    expect(props.onDownload).not.toHaveBeenCalled();
    act(() => view.unmount());
});

test('rally indicators use only the recorded winner, with team names accessible in read-only viewing', async () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    doc.rallies.push({ id: 'r2', start: 15, winner: 'us', reviewed: true }, { id: 'r3', start: 30, winner: 'them', reviewed: true });
    doc.contacts.push({ id: 'c1', time: 2, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Ponto de ataque' });
    const before = JSON.stringify(doc);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, { doc, source: 'youtube:abcdefghijk', focus: 'r2', teams: { us: 'ElCartel', them: 'Regenerados' }, localMedia: false, readOnly: true, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() })); });
    const results = view.root.findAllByProps({ className: 'sv-rally-result' });
    expect(results).toHaveLength(3);
    expect(results.map(result => result.props['aria-label'])).toEqual([
        'ElCartel × Regenerados. Resultado não definido.',
        'ElCartel × Regenerados. Vencedor: ElCartel.',
        'ElCartel × Regenerados. Vencedor: Regenerados.',
    ]);
    expect(results.map(result => result.findAllByProps({ className: 'sv-team-dot won' }).map(dot => dot.children.join('')))).toEqual([[], ['EC'], ['R']]);
    results.forEach((result, i) => expect(view.root.findByProps({ label: `Abrir rally ${i + 1}` }).props.describedBy).toBe(result.props.id));
    expect(view.root.findByProps({ label: 'Abrir vídeo completo' }).findAllByProps({ role: 'img' })).toHaveLength(0);
    expect(JSON.stringify(doc)).toBe(before);
    act(() => view.unmount());
});

test('Space on the selected card toggles playback without selecting it again', () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    const onPlay = jest.fn(), onFocus = jest.fn();
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(VideoGallery, { doc, source: '', focus: 'r1', teams: { us: 'A', them: 'B' }, localMedia: false, onPlay, onFocus, onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() })); });
    const grid = view.root.findByProps({ className: 'sv-grid' });
    const event = { code: 'Space', key: ' ', repeat: false, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { closest: () => ({}) } };
    act(() => grid.props.onKeyDownCapture(event));
    act(() => grid.props.onKeyDownCapture({ ...event, repeat: true }));
    act(() => grid.props.onKeyUpCapture(event));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onFocus).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
    act(() => grid.props.onKeyDownCapture({ ...event, target: { closest: () => null } }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    act(() => view.unmount());
});

test('only visible thumbnails start, leaving the panel cancels work and returning retries', async () => {
    const callbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    const options: unknown[] = [];
    globalThis.IntersectionObserver = class {
        constructor(callback: typeof callbacks[number], option: unknown) { callbacks.push(callback); options.push(option); }
        observe() {} disconnect() {}
    } as unknown as typeof IntersectionObserver;
    jest.mocked(videoThumbnail).mockImplementation(() => new Promise(() => {}));
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    let view!: ReactTestRenderer;
    const panel = {};
    await act(async () => { view = create(createElement(VideoGallery, { doc, source: '', thumbnailSource: 'https://media.example/original.mp4', focus: 'r1', teams: { us: 'A', them: 'B' }, localMedia: false, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() }), { createNodeMock: () => ({ closest: () => panel }) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    expect(options[0]).toEqual({ root: panel, rootMargin: '0px', threshold: .01 });
    act(() => callbacks[0]([{ isIntersecting: true }]));
    expect(videoThumbnail).toHaveBeenCalledTimes(1);
    const signal = jest.mocked(videoThumbnail).mock.calls[0][2];
    act(() => callbacks[0]([{ isIntersecting: false }]));
    expect(signal.aborted).toBe(true);
    act(() => callbacks[0]([{ isIntersecting: true }]));
    expect(videoThumbnail).toHaveBeenCalledTimes(2);
    act(() => view.unmount());
    expect(jest.mocked(videoThumbnail).mock.calls[1][2].aborted).toBe(true);
});

test('playback suspends thumbnail extraction until paused', async () => {
    const doc = newVideoDocument({ fingerprint: 'play', name: 'test', duration: 60, width: 640, height: 360 }, 'r1');
    const props = { doc, source: 'blob:test', focus: null, teams: { us: 'A', them: 'B' }, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, { ...props, playing: true }), { createNodeMock: () => ({}) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    await act(async () => { view.update(createElement(VideoGallery, { ...props, playing: false })); });
    expect(videoThumbnail).toHaveBeenCalled();
    act(() => view.unmount());
});
