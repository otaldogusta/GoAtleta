import { editVideo, newVideoDocument, parseVideoDocument, undoVideo, type VideoDocument } from '../scouting-video';
import { attachDriveTracking, parseDriveTrackingResult, type DriveTrackingResult } from '../scouting-video-drive';

const media = { fingerprint: 'a'.repeat(64), name: 'partida.mp4', duration: 60, width: 1200, height: 600 };
const youtubeMedia = { youtubeId: 'mdfgd1K3HTc', fingerprint: 'youtube:mdfgd1K3HTc', name: 'YouTube', duration: 60, width: 1280, height: 720 };
const ball = (x = 120, y = 180, confidence = .9) => ({ class: 'Ball', x, y, confidence, width: 12, height: 12 });
function result(rows: unknown[][] = [[ball()], [ball(132)]], offsets = rows.map((_, index) => index)): DriveTrackingResult {
    return { media, provider: 'roboflow', model: 'volleyball_v2/3', sampledFps: 30, sourceFps: 30,
        predictions: { frame_offset: offsets, volleyball_v2: rows.map(predictions => ({ image: { width: media.width, height: media.height }, predictions })) } };
}
const youtube = (): VideoDocument => ({ ...newVideoDocument(youtubeMedia, 'yt-r1'),
    rallies: [{ id: 'yt-r1', start: 0, winner: 'us', reviewed: true, pointTime: 4 }, { id: 'yt-r2', start: 10, winner: null, reviewed: false }],
    contacts: [{ id: 'yt-contact', time: 3, skill: 'Defesa', team: 'us', athlete: 'Visível', studentId: null, outcome: 'Controlada' }],
    corrections: [{ time: 2, x: .4, y: .5 }] });

test('converts the provider video output using native frame offsets and original pixels', () => {
    const input = result([[ball()], [ball(240, 300)], []], [0, 3, 6]);
    const before = JSON.stringify(input);
    const parsed = parseDriveTrackingResult(input);
    expect(parsed.media).toEqual(media);
    expect(parsed.analysis).toEqual({ model: 'roboflow-volleyball-v2-3', sampledFps: 30,
        positions: [{ time: 0, x: .1, y: .3 }, { time: .1, x: .2, y: .5 }], cuts: [] });
    expect(parsed.metrics).toMatchObject({ frames: 3, accepted: 2, ballDetections: 2 });
    expect(JSON.stringify(input)).toBe(before);
});

test('prefers explicit provider timestamps and never fills the missing frames', () => {
    const input = result([[ball()], [], [ball(240)]], [0, 3, 6]);
    const output = { ...(input.predictions as object), time_offset: [0, .105, .21] };
    expect(parseDriveTrackingResult({ ...input, sourceFps: undefined, predictions: output }).analysis.positions)
        .toEqual([{ time: 0, x: .1, y: .3 }, { time: .21, x: .2, y: .3 }]);
});

test('uses the declared native FPS rather than the requested inference FPS', () => {
    expect(parseDriveTrackingResult({ ...result([[ball()], [ball(240)]], [0, 60]), sourceFps: 59.94 }).analysis.positions[1].time).toBeCloseTo(60 / 59.94);
    expect(() => parseDriveTrackingResult({ ...result(), sourceFps: undefined })).toThrow('FPS real');
});

test('preserves the existing YouTube document, all human annotation bytes and manual corrections', () => {
    const target = youtube(), before = JSON.stringify(target), attached = attachDriveTracking(target, result(), 2);
    for (const key of ['media', 'rallies', 'contacts', 'corrections'] as const)
        expect(JSON.stringify(attached[key])).toBe(JSON.stringify(target[key]));
    expect(attached.analysis).toMatchObject({ model: 'roboflow-volleyball-v2-3', sampledFps: 30, source: { ...media, offsetSeconds: 2 } });
    expect(attached.analysis?.positions[0].time).toBe(2);
    expect(JSON.stringify(target)).toBe(before);
    expect(parseVideoDocument(JSON.parse(JSON.stringify(attached)), youtubeMedia)).toEqual(attached);
});

test('a blank YouTube draft keeps its original rally instead of accepting scene cuts', () => {
    const target = newVideoDocument(youtubeMedia, 'initial');
    expect(attachDriveTracking(target, result(), 0).rallies).toEqual(target.rallies);
});

test('applying a new candidate preserves contacts added while processing and supports exact undo/redo', () => {
    const target = youtube(), latest = { ...target, contacts: [...target.contacts, { ...target.contacts[0], id: 'new-contact', time: 12 }] };
    const attached = attachDriveTracking(latest, result(), 0);
    const history = editVideo({ present: latest, past: [], future: [] }, attached, 'Tracking do Drive');
    expect(attached.contacts).toEqual(latest.contacts);
    expect(undoVideo(history).present).toEqual(latest);
    expect(undoVideo(undoVideo(history), true).present).toEqual(attached);
});

test('source metadata is explicitly selected, with no provider URLs, Drive IDs, credentials or paths', () => {
    const input = { ...result(), playback: { url: 'https://media.example/private?token=secret', expiresAt: 123 }, fileId: 'drive-private-file', token: 'secret',
        media: { ...media, url: 'https://media.example', path: 'C:/private/video.mp4', fileId: 'drive-private-file', authorization: 'secret' } };
    const attached = attachDriveTracking(youtube(), input, 0);
    expect(attached.analysis?.source).toEqual({ ...media, offsetSeconds: 0 });
    expect(JSON.stringify(attached)).not.toMatch(/secret|drive-private-file|media\.example|private|authorization|expiresAt/);
    const imported = parseVideoDocument({ ...attached, analysis: { ...attached.analysis,
        providerUrl: 'https://media.example', source: { ...attached.analysis?.source, fileId: 'drive-private-file', token: 'secret' } } });
    expect(imported).toEqual(attached);
});

test('an opaque source fingerprint is checked instead of trusting duration, name or Drive ID', () => {
    expect(() => attachDriveTracking(youtube(), result(), 0, 'b'.repeat(64))).toThrow('outro arquivo original');
    expect(() => parseDriveTrackingResult({ ...result(), media: { ...media, fingerprint: 'drive-private-file' } })).toThrow('Metadados');
    expect(() => attachDriveTracking(newVideoDocument(media, 'local'), result(), 0)).toThrow('Abra o vídeo do YouTube');
});

test('ignores people and low confidence; distinguishes duplicate boxes from ambiguous balls', () => {
    const parsed = parseDriveTrackingResult(result([
        [ball(), { ...ball(), class: 'person', confidence: 1 }],
        [ball(240, 180, .49)],
        [ball(300, 180, .82), ball(900, 180, .8)],
        [ball(360, 180, .9), ball(361, 180, .85)],
        [ball(480, 180, .99), ball(900, 180, .6)],
    ]));
    expect(parsed.analysis.positions.map(point => point.time)).toEqual([0, 3 / 30, 4 / 30]);
    expect(parsed.analysis.positions[1].x).toBe(.3);
    expect(parsed.analysis.positions[2].x).toBe(.4);
    expect(parsed.metrics).toMatchObject({ belowConfidence: 1, ambiguousFrames: 1, duplicateDetections: 1, accepted: 3 });
});

test('accepts only the explicit ball/volleyball class aliases exposed by this model', () => {
    const parsed = parseDriveTrackingResult(result([
        [{ ...ball(), class: 'volleyball' }], [{ ...ball(240), class: ' VOLLEYBALL ' }],
        [{ ...ball(360), class: 'ball' }], [{ ...ball(), class: 0 }],
        [{ ...ball(), class: 'person' }], [{ ...ball(), class: 'sports ball' }],
    ]));
    expect(parsed.analysis.positions).toEqual([
        { time: 0, x: .1, y: .3 }, { time: 1 / 30, x: .2, y: .3 }, { time: 2 / 30, x: .3, y: .3 },
    ]);
    expect(parsed.metrics).toMatchObject({ ballDetections: 3, accepted: 3 });
});

test('rejects a weak isolated excursion using adjacent detections without synthesizing a replacement', () => {
    const parsed = parseDriveTrackingResult(result([[ball(120)], [ball(132)], [ball(960, 480, .6)], [ball(156)], [ball(168)]]));
    expect(parsed.analysis.positions.map(point => point.time)).toEqual([0, 1 / 30, 3 / 30, 4 / 30]);
    expect(parsed.metrics.isolatedSpikes).toBe(1);
    // Strong jumps can be real fast shots; no global maximum ball speed is assumed.
    expect(parseDriveTrackingResult(result([[ball(120)], [ball(132)], [ball(960, 480, .95)], [ball(156)], [ball(168)]])).analysis.positions).toHaveLength(5);
});

test('discards malformed coordinates, oversized boxes and invalid confidence without clamping', () => {
    const parsed = parseDriveTrackingResult(result([[ball()], [
        { ...ball(), x: -1 }, { ...ball(), y: 601 }, { ...ball(), x: NaN }, { ...ball(), width: 0 },
        { ...ball(), height: 151 }, { ...ball(), confidence: Infinity }, { ...ball(), confidence: 1.1 },
    ]]));
    expect(parsed.analysis.positions).toHaveLength(1);
    expect(parsed.metrics.invalidDetections).toBe(7);
});

test('empty or wholly uncertain results cannot overwrite the current trajectory', () => {
    for (const rows of [[[]], [[ball(120, 180, .49)]], [[ball(120, 180, .9), ball(900, 180, .9)]]])
        expect(() => attachDriveTracking(youtube(), result(rows), 0)).toThrow('Nenhuma posição');
});

test.each([null, {}, { ...result(), provider: 'other' }, { ...result(), model: 'volleyball_v2/4' }, { ...result(), sampledFps: 5 }, { ...result(), predictions: [] }])
('rejects a mismatched transport/provider/model contract %s', input => {
    expect(() => parseDriveTrackingResult(input)).toThrow('Resultado');
});

test.each([0, -30, NaN, Infinity, 241, '30'])('rejects invalid native FPS %s', sourceFps => {
    expect(() => parseDriveTrackingResult({ ...result(), sourceFps })).toThrow('FPS');
});

test.each([
    { duration: 0 }, { duration: Infinity }, { width: 0 }, { width: 1200.1 }, { height: 20000 }, { youtubeId: 'mdfgd1K3HTc' },
    { fingerprint: 'https://drive.google.com/private' }, { name: 'C:/private/video.mp4' }, { name: '\nvideo.mp4' },
])('rejects invalid or URL-like media identity %s', patch => {
    expect(() => parseDriveTrackingResult({ ...result(), media: { ...media, ...patch } })).toThrow('Metadados');
});

test.each([
    { frame_offset: [0, 0] }, { frame_offset: [1, 0] }, { frame_offset: [0, -1] }, { frame_offset: [0, .5] },
    { frame_offset: [0] }, { frame_offset: [0, 1800] }, { frame_offset: [] },
    { time_offset: [0] }, { time_offset: [0, 0] }, { time_offset: [0, 60] }, { time_offset: [0, NaN] }, { time_offset: [0, '1'] },
    { volleyball_v2: [{ predictions: 'invalid' }, { predictions: [] }] },
    { volleyball_v2: [{ image: { width: 640, height: 360 }, predictions: [ball()] }, { predictions: [] }] },
])('rejects malformed, unordered, mismatched or out-of-bounds provider frames %s', patch => {
    const input = result();
    expect(() => parseDriveTrackingResult({ ...input, predictions: { ...(input.predictions as object), ...patch } })).toThrow();
});

test('also accepts the exact model key but rejects conflicting alternative arrays', () => {
    const input = result(), output = input.predictions as { frame_offset: number[]; volleyball_v2: object[] };
    const variant = { frame_offset: output.frame_offset, 'volleyball_v2/3': output.volleyball_v2 };
    expect(parseDriveTrackingResult({ ...input, predictions: variant }).analysis.positions).toHaveLength(2);
    expect(() => parseDriveTrackingResult({ ...input, predictions: { ...variant, volleyball_v2: output.volleyball_v2 } })).toThrow('Quadros');
});
