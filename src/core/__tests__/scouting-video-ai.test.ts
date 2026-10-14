import { applyVideoAi, parseVideoAiResult, type VideoAiResult } from '../scouting-video-ai';
import { newVideoDocument } from '../scouting-video';
const media = { fingerprint: 'youtube:mdfgd1K3HTc', youtubeId: 'mdfgd1K3HTc', name: 'Video', duration: 120, width: 1280, height: 720 };
const result: VideoAiResult = { videoId: media.youtubeId, start: 0, end: 60, model: 'gemini-3.1-flash-lite', rallies: [{ start: 12, end: 22, evidence: 'Saque visível' }], contacts: [{ time: 12, skill: 'Saque', side: 'near', evidence: 'Contato visível' }, { time: 14, skill: 'Recepção', side: 'unknown', evidence: 'Lado incerto' }], limitations: [] };
test('rejects another video, out-of-range time and unsupported actions', () => {
    expect(() => parseVideoAiResult(result, 'another-id1', 0, 60)).toThrow();
    expect(() => parseVideoAiResult({ ...result, rallies: [{ start: 70, end: null, evidence: '' }] }, media.youtubeId, 0, 60)).toThrow();
    expect(() => parseVideoAiResult({ ...result, contacts: [{ ...result.contacts[0], skill: 'Inventado' }] }, media.youtubeId, 0, 60)).toThrow();
});
test('applies without identities or points, ignores unknown side and deduplicates', () => {
    let n = 0; const id = () => `ai-${++n}`, original = newVideoDocument(media, 'r0');
    const next = applyVideoAi(original, [result], 'them', id);
    expect(original.contacts).toHaveLength(0);
    expect(next.contacts).toHaveLength(1);
    expect(next.contacts[0]).toMatchObject({ team: 'them', studentId: null, outcome: '', athlete: '' });
    expect(next.rallies).toHaveLength(2);
    expect(applyVideoAi(next, [result], 'them', id)).toEqual(next);
});
test('preserves scored rallies and human contacts', () => {
    const doc = newVideoDocument(media, 'r0'); doc.rallies[0].pointTime = 35; doc.rallies[0].winner = 'us';
    const next = applyVideoAi(doc, [result], 'us', () => 'contact');
    expect(next.rallies).toEqual(doc.rallies);
    expect(() => applyVideoAi({ ...doc, media: { ...media, youtubeId: 'M7lc1UVf-VE' } }, [result], 'us', () => 'id')).toThrow();
});
