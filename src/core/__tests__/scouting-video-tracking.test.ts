import { editVideo, newVideoDocument, parseVideoDocument, undoVideo, type VideoAnalysis, type VideoDocument } from '../scouting-video';
import { attachYoutubeTracking } from '../scouting-video-tracking';

const originalMedia = { fingerprint: 'original-a', name: 'partida.mp4', duration: 60, width: 1202, height: 676 };
const youtubeMedia = { youtubeId: 'mdfgd1K3HTc', fingerprint: 'youtube:mdfgd1K3HTc', name: 'YouTube · mdfgd1K3HTc', duration: 60, width: 1280, height: 720 };
const analysis: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30,
    positions: [{ time: 0, x: .1, y: .2 }, { time: 1, x: .3, y: .4 }, { time: 59, x: .8, y: .9 }], cuts: [1, 30, 59] };
const original = (): VideoDocument => ({ ...newVideoDocument(originalMedia, 'original-r1'), analysis,
    contacts: [{ id: 'original-contact', time: 4, skill: 'Saque', team: 'them', athlete: 'Original', studentId: 'original-student', outcome: 'Ace' }],
    corrections: [{ time: 1, x: .5, y: .6 }] });
const youtube = (): VideoDocument => ({ ...newVideoDocument(youtubeMedia, 'yt-r1'),
    rallies: [{ id: 'yt-r1', start: 0, winner: 'us', reviewed: true, pointTime: 4 }, { id: 'yt-r2', start: 10, winner: null, reviewed: false }],
    contacts: [{ id: 'yt-contact', time: 3, skill: 'Defesa', team: 'us', athlete: 'Visível', studentId: null, outcome: 'Controlada' }],
    corrections: [{ time: 2, x: .4, y: .5 }] });

test('attaches only original tracking and preserves all YouTube annotations and source documents', () => {
    const target = youtube(), source = original(), snapshots = JSON.stringify([target, source]);
    const attached = attachYoutubeTracking(target, source, 0);
    expect(attached.media).toEqual(target.media);
    expect(attached.rallies).toEqual(target.rallies);
    expect(attached.contacts).toEqual(target.contacts);
    expect(attached.corrections).toEqual(target.corrections);
    expect(attached.analysis).toEqual({ ...analysis, source: { ...originalMedia, offsetSeconds: 0 } });
    expect(JSON.stringify([target, source])).toBe(snapshots);
    expect(parseVideoDocument(JSON.parse(JSON.stringify(attached)), youtubeMedia)).toEqual(attached);
});

test('accepts a fresh processing result and never initializes suggested rallies on a blank YouTube draft', () => {
    const target = newVideoDocument(youtubeMedia, 'initial');
    const attached = attachYoutubeTracking(target, { media: originalMedia, analysis }, 0);
    expect(attached.rallies).toEqual(target.rallies);
    expect(attached.contacts).toEqual([]);
    expect(attached.analysis?.cuts).toEqual(analysis.cuts);
});

test('maps positive offsets and removes positions/cuts outside YouTube duration', () => {
    const attached = attachYoutubeTracking(youtube(), original(), 2);
    expect(attached.analysis?.positions).toEqual([{ time: 2, x: .1, y: .2 }, { time: 3, x: .3, y: .4 }]);
    expect(attached.analysis?.cuts).toEqual([3, 32]);
    expect(attached.analysis?.source?.offsetSeconds).toBe(2);
});

test('maps negative offsets, retains position at zero and excludes cuts at zero', () => {
    const attached = attachYoutubeTracking(youtube(), original(), -1);
    expect(attached.analysis?.positions).toEqual([{ time: 0, x: .3, y: .4 }, { time: 58, x: .8, y: .9 }]);
    expect(attached.analysis?.cuts).toEqual([29, 58]);
});

test('different duration is permitted for explicit matching, never used to prove source identity', () => {
    const source = { ...original(), media: { ...originalMedia, duration: 65 } };
    expect(attachYoutubeTracking(youtube(), source, 0).analysis?.source?.duration).toBe(65);
    expect(() => attachYoutubeTracking(youtube(), source, 0, 'original-b')).toThrow('outro arquivo original');
    expect(attachYoutubeTracking(youtube(), source, 0, 'original-a').analysis?.source?.fingerprint).toBe('original-a');
});

test('requires original positions and a YouTube target, and rejects no overlap/invalid offsets', () => {
    expect(() => attachYoutubeTracking(newVideoDocument(originalMedia, 'local'), original(), 0)).toThrow('Abra o vídeo do YouTube');
    expect(() => attachYoutubeTracking(youtube(), newVideoDocument(originalMedia, 'empty'), 0)).toThrow('não contém posições');
    expect(() => attachYoutubeTracking(youtube(), original(), 60)).toThrow('não coincide');
    for (const offset of [NaN, Infinity, -1801, 1801]) expect(() => attachYoutubeTracking(youtube(), original(), offset)).toThrow('ajuste de tempo');
    expect(() => attachYoutubeTracking(youtube(), { ...original(), analysis: { ...analysis, positions: [{ time: 1, x: 1.01, y: .2 }] } }, 0)).toThrow();
});

test('rejects YouTube sources and prevents adding an offset twice to already linked tracking', () => {
    const linked = attachYoutubeTracking(youtube(), original(), 2);
    expect(() => attachYoutubeTracking(youtube(), linked, 2)).toThrow('arquivo original');
    expect(() => attachYoutubeTracking(youtube(), { ...original(), analysis: linked.analysis }, 0)).toThrow();
});

test('persisted source contains only bounded original identity, dimensions and alignment', () => {
    const linked = attachYoutubeTracking(youtube(), original(), 0);
    const source = linked.analysis!.source!;
    const imported = parseVideoDocument({ ...linked, analysis: { ...linked.analysis,
        source: { ...source, url: 'https://untrusted.example/video?token=secret', path: 'C:/private/video.mp4', token: 'secret', permission: 'editor' } } });
    expect(imported.analysis?.source).toEqual(source);
    for (const patch of [
        { fingerprint: 'https://untrusted.example' }, { fingerprint: 'C:\\private\\video.mp4' }, { fingerprint: 'a'.repeat(129) },
        { name: 'C:\\private\\video.mp4' }, { name: 'https://untrusted.example' }, { name: '\nvideo.mp4' }, { name: '' },
        { duration: 0 }, { duration: 86401 }, { width: 0 }, { width: 16385 }, { height: 1.5 }, { offsetSeconds: 1801 },
    ]) expect(() => parseVideoDocument({ ...linked, analysis: { ...linked.analysis, source: { ...source, ...patch } } })).toThrow('Fonte original');
});

test('parser refuses a source on local media or positions/cuts outside the declared original interval', () => {
    const linked = attachYoutubeTracking(youtube(), original(), 0);
    expect(() => parseVideoDocument({ ...linked, media: originalMedia })).toThrow('Fonte original');
    expect(() => parseVideoDocument({ ...linked, analysis: { ...linked.analysis, source: { ...linked.analysis!.source!, offsetSeconds: 2 } } })).toThrow('intervalo');
    expect(() => parseVideoDocument({ ...linked, analysis: { ...linked.analysis, source: { ...linked.analysis!.source!, duration: 59 } } })).toThrow('intervalo');
});

test('legacy local tracking remains compatible and linked changes support undo/redo', () => {
    expect(parseVideoDocument(original()).analysis).toEqual(analysis);
    const target = youtube(), linked = attachYoutubeTracking(target, original(), .1);
    const history = editVideo({ present: target, past: [], future: [] }, linked, 'Tracking original');
    expect(undoVideo(history).present).toEqual(target);
    expect(undoVideo(undoVideo(history), true).present).toEqual(linked);
});
