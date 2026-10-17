import { newVideoDocument, splitVideoRally, type VideoDocument } from '../../../core/scouting-video';
import { matchingOriginalDocument } from '../video/video-source-selection';

const original = { fingerprint: 'a'.repeat(64), name: 'original.mp4', duration: 60, width: 1202, height: 676 };
const canonical = (): VideoDocument => ({
    ...splitVideoRally(newVideoDocument({ fingerprint: 'youtube:mdfgd1K3HTc', youtubeId: 'mdfgd1K3HTc', name: 'YouTube', duration: 70, width: 1280, height: 720 }, 'remote-rally'), 15, 'reviewed-rally'),
    contacts: [{ id: 'reviewed-contact', time: 18, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Em jogo' }],
    corrections: [{ time: 19, x: .4, y: .3 }],
    analysis: { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: 12, x: .2, y: .3 }], cuts: [15], source: { ...original, offsetSeconds: 10 } },
});

test('recognizes the associated original as playback of the existing canonical analysis', () => {
    const document = canonical(), before = JSON.stringify(document);
    const selected = matchingOriginalDocument(document, { ...original, name: 'video-no-celular.mp4', duration: 60.1 });
    expect(selected).toBe(document);
    expect(selected?.media.youtubeId).toBe('mdfgd1K3HTc');
    expect(selected?.contacts[0].id).toBe('reviewed-contact');
    expect(selected?.rallies[1].id).toBe('reviewed-rally');
    expect(selected?.analysis?.source?.offsetSeconds).toBe(10);
    expect(JSON.stringify(document)).toBe(before);
});

test.each([
    { fingerprint: 'b'.repeat(64) }, { width: 1920 }, { height: 1080 }, { duration: 60.101 },
])('a different file or edit cannot attach by matching its name and partial metadata: %s', change => {
    expect(matchingOriginalDocument(canonical(), { ...original, ...change })).toBeNull();
});

test('unassociated local and YouTube documents keep their independent draft paths', () => {
    expect(matchingOriginalDocument(null, original)).toBeNull();
    expect(matchingOriginalDocument(newVideoDocument(original, 'local-rally'), original)).toBeNull();
    const { analysis: ignored, ...unassociated } = canonical();
    void ignored;
    expect(matchingOriginalDocument(unassociated, original)).toBeNull();
});
