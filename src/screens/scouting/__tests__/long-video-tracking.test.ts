import { loadFullTracking, matchingFullTracking, processLongVideo, trackingRanges, trackingSyncPreview } from '../video/long-video-tracking';
import { processScoutingVideo } from '../video/video-processing.web';
import type { VideoAnalysis } from '../../../core/scouting-video';
const mockStore = new Map<string, string>();
jest.mock('../video/video-draft-storage', () => ({
    getVideoDraft: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    persistVideoDraft: jest.fn(async (key: string, raw: string) => { mockStore.set(key, raw); }),
}));
jest.mock('../video/video-processing.web', () => ({ processScoutingVideo: jest.fn(), TrackingWorkerSession: jest.fn(() => ({ dispose: jest.fn() })) }));
const media = { fingerprint: 'original', name: 'match.mp4', duration: 1861, width: 1920, height: 1080 };
beforeEach(() => { mockStore.clear(); jest.clearAllMocks(); });
test('covers after 30 minutes and the final fractional range without overlap', () => {
    const ranges = trackingRanges(3700.5);
    expect(ranges).toHaveLength(62);
    expect(ranges.at(-1)).toEqual({ start: 3660, end: 3700.5 });
    expect(ranges.slice(1).every((r,i) => r.start === ranges[i].end)).toBe(true);
    expect(() => trackingRanges(7201)).toThrow();
});
test('failure preserves committed minutes; resume reuses them with original absolute timestamps', async () => {
    const small = { ...media, duration: 61 };
    (processScoutingVideo as jest.Mock).mockImplementation(async (_file, _duration, _signal, _progress, options) => {
        if (options.range.start === 60) throw new Error('interrupted');
        return { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: .1, x: .2, y: .3 }], cuts: [20] };
    });
    const run = () => processLongVideo({} as File, small, 'user:org:game:video', 'v2b', new AbortController().signal, jest.fn());
    await expect(run()).rejects.toThrow('interrupted');
    expect(mockStore.size).toBe(1);
    (processScoutingVideo as jest.Mock).mockClear().mockResolvedValue({ model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: 60.1, x: .4, y: .5 }], cuts: [] });
    const result = await run();
    expect(processScoutingVideo).toHaveBeenCalledTimes(1);
    expect(result.positions.map(p => p.time)).toEqual([.1, 60.1]);
    expect(await loadFullTracking('user:org:game:video', small, 'v2b')).toEqual(result);
    expect(await loadFullTracking('another-user:org:game:video', small, 'v2b')).toBeNull();
});
test('synchronized preview is bounded while full positions remain unchanged', () => {
    const full: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30,
        positions: Array.from({ length: 111000 }, (_, i) => ({ time: i / 30, x: .2, y: .3 })), cuts: [2000] };
    expect(trackingSyncPreview(full).positions.length).toBeLessThanOrEqual(54000);
    expect(full.positions).toHaveLength(111000);
    expect(trackingSyncPreview(full).positions.at(-1)!.time).toBeGreaterThan(3600);
});

test('full matching track reuses positions at zero offset and rejects different edits', () => {
 const full: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: Array.from({ length: 111000 }, (_, i) => ({ time: i / 30, x: .2, y: .3 })), cuts: [] };
 const preview = trackingSyncPreview(full);
 expect(matchingFullTracking(full, preview.positions, 0, 4000)).toBe(full.positions);
 expect(matchingFullTracking(full, [{ ...preview.positions[0], x: .8 }, ...preview.positions.slice(1)], 0, 4000)).toBeNull();
});
test('offset and clipped boundaries retain exact full precision without mutating originals', () => {
 const full: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{time:0,x:.2,y:.3},{time:1,x:.4,y:.5},{time:2,x:.6,y:.7}], cuts: [] };
 const expected = [{time:0,x:.4,y:.5},{time:1,x:.6,y:.7}];
 expect(matchingFullTracking(full, expected, -1, 2)).toEqual(expected);
 expect(full.positions[1].time).toBe(1);
});
