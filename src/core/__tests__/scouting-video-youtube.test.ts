import { youtubeVideoId, youtubePlayerError } from '../scouting-video-youtube';
import { newVideoDocument, parseVideoDocument } from '../scouting-video';
import { publishableVideoDocument } from '../scouting-video-sharing';
const id = 'M7lc1UVf-VE';
test.each([`https://www.youtube.com/watch?v=${id}&t=20`, `https://youtu.be/${id}?si=abc`, `https://m.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`, `https://youtube.com/live/${id}`])('normalizes known video URL %s', url => {
    expect(youtubeVideoId(url)).toBe(id);
});
test.each(['javascript:alert(1)', 'http://youtube.com/watch?v=M7lc1UVf-VE', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE', 'https://user@youtube.com/watch?v=M7lc1UVf-VE', 'https://youtu.be/x/extra', 'https://youtube.com/playlist?list=abc', 'https://youtube.com/watch?v=bad', 'https://youtube.com:123/watch?v=M7lc1UVf-VE'])('refuses untrusted or non-video URL %s', url => {
    expect(() => youtubeVideoId(url)).toThrow();
});
test('roundtrip and published projection retain only a valid provider ID', () => {
    const media = { fingerprint: `youtube:${id}`, youtubeId: id, name: 'Video', duration: 60, width: 1280, height: 720 };
    const doc = newVideoDocument(media, 'rally');
    expect(parseVideoDocument(doc).media).toEqual(media);
    expect(publishableVideoDocument(doc).media.youtubeId).toBe(id);
    expect(() => parseVideoDocument({ ...doc, media: { ...media, youtubeId: 'https://evil.test' } })).toThrow();
    expect(() => parseVideoDocument(doc, { ...media, youtubeId: 'abcdefghijk' })).toThrow();
    expect(parseVideoDocument(newVideoDocument({ ...media, youtubeId: undefined }, 'rally')).media.youtubeId).toBeUndefined();
});
test('unavailable and embed errors are actionable', () => {
    expect(youtubePlayerError(100)).toContain('privado');
    expect(youtubePlayerError(150)).toContain('incorporar');
    expect(youtubePlayerError(153)).toContain('navegador');
});
