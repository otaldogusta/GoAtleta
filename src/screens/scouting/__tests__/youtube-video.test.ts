import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { YouTubeVideo } from '../video/YouTubeVideo.web';
import { mountYouTube, type VideoPlayback } from '../video/youtube-player.web';
jest.mock('../video/youtube-player.web', () => ({ mountYouTube: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('ready binds the playback ref before notifying the studio that it can restore the position', () => {
    const youtube = { currentTime: 0, playbackRate: 1 } as VideoPlayback;
    const playback: { current: VideoPlayback | null } = { current: null };
    const onReady = jest.fn((value: VideoPlayback) => {
        expect(playback.current).toBe(value);
        value.currentTime = 23.3;
        value.playbackRate = .5;
    });
    const dispose = jest.fn();
    (mountYouTube as jest.Mock).mockImplementation((_node, _id, callbacks) => { callbacks.ready(youtube); return dispose; });
    let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeVideo, { id: 'M7lc1UVf-VE', playback, onReady, onError: jest.fn() }), { createNodeMock: () => ({}) }); });
    expect(onReady).toHaveBeenCalledWith(youtube);
    expect(youtube.currentTime).toBe(23.3);
    expect(youtube.playbackRate).toBe(.5);
    act(() => view.unmount());
    expect(playback.current).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
});

test('a player becoming ready uses the latest callback without remounting for callback changes', () => {
    const youtube = {} as VideoPlayback;
    const playback: { current: VideoPlayback | null } = { current: null };
    const firstReady = jest.fn(), latestReady = jest.fn(), onError = jest.fn(), dispose = jest.fn();
    let ready!: (value: VideoPlayback) => void;
    (mountYouTube as jest.Mock).mockImplementation((_node, _id, callbacks) => { ready = callbacks.ready; return dispose; });
    let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeVideo, { id: 'M7lc1UVf-VE', playback, onReady: firstReady, onError }), { createNodeMock: () => ({}) }); });
    act(() => { view.update(createElement(YouTubeVideo, { id: 'M7lc1UVf-VE', playback, onReady: latestReady, onError })); });
    act(() => ready(youtube));
    expect(mountYouTube).toHaveBeenCalledTimes(1);
    expect(firstReady).not.toHaveBeenCalled();
    expect(latestReady).toHaveBeenCalledWith(youtube);
    expect(playback.current).toBe(youtube);
    act(() => view.unmount());
    expect(dispose).toHaveBeenCalledTimes(1);
});

test('iframe cleanup never clears a replacement local player attached before passive cleanup', () => {
    const youtube = {} as VideoPlayback, local = {} as VideoPlayback;
    const playback: { current: VideoPlayback | null } = { current: null };
    const dispose = jest.fn();
    (mountYouTube as jest.Mock).mockImplementation((_node, _id, callbacks) => { callbacks.ready(youtube); return dispose; });
    let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeVideo, { id: 'M7lc1UVf-VE', playback, onError: jest.fn() }), { createNodeMock: () => ({}) }); });
    expect(playback.current).toBe(youtube);
    // React attaches the replacement DOM ref before unmounted passive effects run.
    playback.current = local;
    act(() => view.unmount());
    expect(playback.current).toBe(local);
    expect(dispose).toHaveBeenCalledTimes(1);
});
