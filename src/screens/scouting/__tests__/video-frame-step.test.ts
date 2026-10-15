import { stepPlaybackFrame } from '../video/video-frame-step';
import { originalPlayback } from '../video/original-playback.web';
import { youtubePlayback } from '../video/youtube-player.web';

function video() {
    return { currentTime: 18.85, duration: 40, paused: false, playbackRate: 1, play: jest.fn(), pause: jest.fn() } as unknown as HTMLVideoElement;
}

test('fine stepping pauses and advances by 1/30 s without snapping to the next contact', () => {
    const media = video(), pauseTime: number[] = [];
    media.pause = jest.fn(() => { pauseTime.push(media.currentTime); });
    const transport = originalPlayback(media);
    expect(stepPlaybackFrame(transport, 1, 17.5, 28.767)).toBeCloseTo(18.883333, 6);
    expect(stepPlaybackFrame(transport, 1, 17.5, 28.767)).toBeCloseTo(18.916667, 6);
    expect(stepPlaybackFrame(transport, -1, 17.5, 28.767)).toBeCloseTo(18.883333, 6);
    expect(pauseTime).toHaveLength(3);
    expect(pauseTime[0]).toBe(18.85);
});

test('steps stop at the selected rally boundaries', () => {
    const media = video(), transport = originalPlayback(media);
    media.currentTime = 17.51;
    expect(stepPlaybackFrame(transport, -1, 17.5, 28.767)).toBe(17.5);
    expect(stepPlaybackFrame(transport, -1, 17.5, 28.767)).toBeNull();
    media.currentTime = 28.76;
    expect(stepPlaybackFrame(transport, 1, 17.5, 28.767)).toBe(28.766);
    expect(stepPlaybackFrame(transport, 1, 17.5, 28.767)).toBeNull();
});

test('linked original keeps the YouTube offset while respecting the available range', () => {
    const media = video();
    media.currentTime = .02;
    const transport = originalPlayback(media, 100);
    expect(stepPlaybackFrame(transport, -1, 100, 140)).toBe(100);
    expect(media.currentTime).toBe(0);
    expect(stepPlaybackFrame(transport, 1, 100, 140)).toBeCloseTo(100 + 1 / 30);
    expect(media.currentTime).toBeCloseTo(1 / 30);
});

test('rapid YouTube steps accumulate pending destinations rather than stale iframe time', () => {
    const player = { getCurrentTime: () => 18.85, getDuration: () => 40, getPlayerState: () => 2, getPlaybackRate: () => 1, setPlaybackRate: jest.fn(), seekTo: jest.fn(), playVideo: jest.fn(), pauseVideo: jest.fn(), destroy: jest.fn() };
    const transport = youtubePlayback(player);
    for (let i = 0; i < 3; i++) stepPlaybackFrame(transport, 1, 17.5, 28.767);
    expect(transport.currentTime).toBeCloseTo(18.95);
    expect(player.seekTo.mock.calls.map(call => call[0])).toEqual([
        expect.closeTo(18.883333, 6), expect.closeTo(18.916667, 6), expect.closeTo(18.95, 6),
    ]);
    expect(player.playVideo).not.toHaveBeenCalled();
});

test('unavailable or invalid ranges do not issue a seek', () => {
    const media = video(), transport = originalPlayback(media);
    expect(stepPlaybackFrame(transport, 1, 20, 20)).toBeNull();
    expect(stepPlaybackFrame(transport, -1, 30, 20)).toBeNull();
    expect(stepPlaybackFrame(transport, 1, 0, NaN)).toBeNull();
    expect(media.currentTime).toBe(18.85);
    expect(media.pause).not.toHaveBeenCalled();
});
