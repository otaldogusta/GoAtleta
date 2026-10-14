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
test('YouTube uses its poster until a real original is attached; thumbnails never enable file downloads', async () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    doc.rallies.push({ id: 'r2', start: 15, winner: null, reviewed: false });
    const props = { doc, source: 'youtube:abcdefghijk', focus: null, teams: { us: 'Equipe', them: 'Adversário' }, localMedia: false, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, props), { createNodeMock: () => ({}) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    expect(view.root.findAllByType('img')).toHaveLength(2);
    await act(async () => { view.update(createElement(VideoGallery, { ...props, thumbnailSource: 'https://media.example/original.mp4', offsetSeconds: 8 })); });
    expect(videoThumbnail).toHaveBeenCalledTimes(1);
    expect(videoThumbnail).toHaveBeenCalledWith('https://media.example/original.mp4', 7, expect.any(AbortSignal));
    expect(view.root.findAllByType('img').map(n => n.props.src)).toContain('data:image/jpeg;base64,fixture');
    expect(view.root.findAllByType('button').some(b => b.props.label?.startsWith('Baixar'))).toBe(false);
    expect(props.onDownload).not.toHaveBeenCalled();
    act(() => view.unmount());
});
