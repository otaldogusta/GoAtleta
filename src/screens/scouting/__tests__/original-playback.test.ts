import type { VideoAnalysisSource, VideoMedia } from '../../../core/scouting-video';
import { matchesTrackingOriginal, originalPlayback } from '../video/original-playback.web';

function original(duration = 60) {
    return { currentTime: 12, duration, paused: true, playbackRate: 1, play: jest.fn().mockResolvedValue(undefined), pause: jest.fn() } as unknown as HTMLVideoElement;
}

test.each([10, -10, 0])('keeps timeline seeks aligned with original offset %s', offset => {
    const video = original(), playback = originalPlayback(video, offset);
    expect(playback.currentTime).toBe(12 + offset);
    playback.currentTime = 20;
    expect(video.currentTime).toBe(20 - offset);
    expect(playback.currentTime).toBe(20);
    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
});

test('clamps timeline seeks to the original media bounds', () => {
    const video = original(), playback = originalPlayback(video, 10);
    playback.currentTime = -30;
    expect(video.currentTime).toBe(0);
    playback.currentTime = 100;
    expect(video.currentTime).toBeCloseTo(59.999);
    playback.currentTime = NaN;
    expect(video.currentTime).toBeCloseTo(59.999);
});

test('can seek before finite metadata and handles zero-duration media', () => {
    const video = original(NaN), playback = originalPlayback(video, 10);
    playback.currentTime = 30;
    expect(video.currentTime).toBe(20);
    Object.assign(video, { duration: 0 });
    playback.currentTime = 30;
    expect(video.currentTime).toBe(0);
});

test('forwards native playback state, controls and rate', async () => {
    const video = original(), playback = originalPlayback(video);
    expect(playback.paused).toBe(true);
    Object.assign(video, { paused: false });
    expect(playback.paused).toBe(false);
    playback.playbackRate = .5;
    expect(video.playbackRate).toBe(.5);
    expect(playback.playbackRate).toBe(.5);
    await playback.play();
    playback.pause();
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.pause).toHaveBeenCalledTimes(1);
});

test.each([NaN, Infinity, -Infinity, 1800.01, -1800.01])('rejects invalid alignment %s', offset => {
    expect(() => originalPlayback(original(), offset)).toThrow(RangeError);
});

describe('tracking original identity', () => {
    const media: VideoMedia = { fingerprint: 'original:abc123', name: 'jogo.mp4', duration: 60, width: 1280, height: 720 };
    const source: VideoAnalysisSource = { ...media, offsetSeconds: 10 };

    test('accepts a renamed original and ignores alignment when matching the file', () => {
        expect(matchesTrackingOriginal({ ...media, name: 'original-renomeado.mp4' }, source)).toBe(true);
        expect(matchesTrackingOriginal(media, { ...source, offsetSeconds: -20 })).toBe(true);
    });

    test('rejects a different fingerprint even when the file name and metadata match', () => {
        expect(matchesTrackingOriginal({ ...media, fingerprint: 'original:other' }, source)).toBe(false);
    });

    test.each([{ width: 1920 }, { height: 1080 }])('rejects cropped/resized original metadata %s', dimensions => {
        expect(matchesTrackingOriginal({ ...media, ...dimensions }, source)).toBe(false);
    });

    test('accepts metadata rounding up to 0.1 seconds and rejects larger duration changes', () => {
        expect(matchesTrackingOriginal({ ...media, duration: 60.1 }, source)).toBe(true);
        expect(matchesTrackingOriginal({ ...media, duration: 59.9 }, source)).toBe(true);
        expect(matchesTrackingOriginal({ ...media, duration: 60.101 }, source)).toBe(false);
    });

    test.each([NaN, Infinity, -1])('rejects invalid original metadata duration %s', duration => {
        expect(matchesTrackingOriginal({ ...media, duration }, source)).toBe(false);
    });
});
