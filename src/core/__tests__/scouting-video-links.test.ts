import { newVideoDocument, splitVideoRally } from '../scouting-video';
import { emptyScoutingVideoLinks, parseScoutingVideoLinks, savePointVideoLink, scoutingVideoLinksKey, suggestPointVideoTime } from '../scouting-video-links';
import type { ScoutingRally } from '../models';
const video = splitVideoRally(newVideoDocument({ name: 'game', fingerprint: 'video', duration: 600, width: 1920, height: 1080 }, 'v1'), 100, 'v2');
const point = (id: string, seconds: number, setNumber = 1): ScoutingRally => ({ id, sessionId: 'set-one', setNumber, number: 1, won: true, serve: 'us', rotation: null, scoreUs: 1, scoreThem: 0, contacts: [], createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, seconds)).toISOString() });
const initial = { ...emptyScoutingVideoLinks(), sessionIds: ['set-one', 'set-two'] };

test('links a point without rewriting original statistics, supports missing footage and prevents duplicate video assignments', () => {
    const p = point('p1', 20), before = JSON.stringify({ p, video });
    const saved = savePointVideoLink(initial, p, video, 50);
    expect(saved.links[0]).toMatchObject({ rallyId: 'p1', videoRallyId: 'v1', time: 50, missing: false });
    expect(() => savePointVideoLink(saved, point('p2', 30), video, 60)).toThrow('outro ponto');
    const missing = savePointVideoLink(saved, p, video, null);
    expect(missing.links[0]).toMatchObject({ time: null, videoRallyId: null, missing: true });
    expect(JSON.stringify({ p, video })).toBe(before);
    expect(() => savePointVideoLink(initial, { ...p, sessionId: 'foreign' }, video, 0)).toThrow();
    expect(() => savePointVideoLink(initial, p, video, 600)).toThrow();
});
test('parser rejects invalid references, duplicate points, non-finite timestamps and missing flags carrying a video time', () => {
    const saved = savePointVideoLink(initial, point('p', 0), video, 0);
    expect(parseScoutingVideoLinks(JSON.parse(JSON.stringify(saved)), 600)).toEqual(saved);
    expect(() => parseScoutingVideoLinks({ ...saved, links: [...saved.links, ...saved.links] }, 600)).toThrow();
    for (const change of [{ time: NaN }, { time: 601 }, { missing: true }, { sessionId: 'foreign' }]) {
        expect(() => parseScoutingVideoLinks({ ...saved, links: [{ ...saved.links[0], ...change }] }, 600)).toThrow();
    }
});
test('clock suggestions require a nearby confirmed anchor in the same session and set and never confirm a link', () => {
    const first = point('first', 20), next = point('next', 50), saved = savePointVideoLink(initial, first, video, 100);
    expect(suggestPointVideoTime(next, [first, next], saved, 600)).toBe(130);
    expect(saved.links).toHaveLength(1);
    expect(suggestPointVideoTime({ ...next, setNumber: 2 }, [first], saved, 600)).toBeNull();
    expect(suggestPointVideoTime({ ...next, sessionId: 'set-two' }, [first], saved, 600)).toBeNull();
    expect(suggestPointVideoTime(point('late', 400), [first], saved, 600)).toBeNull();
    expect(suggestPointVideoTime(next, [first], savePointVideoLink(initial, first, video, null), 600)).toBeNull();
});
test('storage identity includes account, organization, class, review and media without separator collisions', () => {
    const base: [string, string, string, string, string] = ['user', 'org', 'class', 'review', 'video'];
    const key = scoutingVideoLinksKey(...base);
    for (let i = 0; i < base.length; i++) { const other = [...base] as typeof base; other[i] += 'x'; expect(scoutingVideoLinksKey(...other)).not.toBe(key); }
    expect(scoutingVideoLinksKey('a:b', 'c', 'd', 'e', 'f')).not.toBe(scoutingVideoLinksKey('a', 'b:c', 'd', 'e', 'f'));
    expect(() => scoutingVideoLinksKey('', 'org', 'class', 'review', 'video')).toThrow();
});
