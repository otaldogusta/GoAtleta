import type { ScoutingRally } from '../models';
import type { VideoDocument, VideoSkill } from '../scouting-video';
import type { VideoAiResult } from '../scouting-video-ai';
import type { ScoutingVideoLinks } from '../scouting-video-links';
import { acceptScoutingVideoSuggestions, buildScoutingVideoAlignment } from '../scouting-video-alignment';

const point = (index: number, at = index * 30 + 10, sessionId = 'set-one', setNumber = 1): ScoutingRally => ({ id: `p${index}`, sessionId, setNumber, number: index + 1,
    won: true, serve: 'us', rotation: null, scoreUs: index + 1, scoreThem: 0, contacts: [], createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, at)).toISOString() });
const video = (count = 3): VideoDocument => ({ version: 1, media: { youtubeId: 'abcdefghijk', name: 'Partida', fingerprint: 'video', duration: count * 30, width: 1920, height: 1080 },
    rallies: Array.from({ length: count }, (_, index) => ({ id: `v${index}`, start: index * 30, reviewed: false, winner: null })), contacts: [], corrections: [] });
const linked = (indexes: number[], sessionIds = ['set-one']): ScoutingVideoLinks => ({ version: 1, sessionIds,
    links: indexes.map(index => ({ sessionId: 'set-one', rallyId: `p${index}`, videoRallyId: `v${index}`, time: index * 30 + 10, missing: false })) });
const observations = (contacts: { time: number; skill: VideoSkill }[]): VideoAiResult[] => [{ videoId: 'abcdefghijk', start: 0, end: 90, model: 'model', rallies: [], contacts: contacts.map(contact => ({ ...contact, side: 'far', evidence: 'Contato visível' })), limitations: [] }];

test('a high confidence proposal needs a consistent clock and independently reviewed video evidence', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    const before = JSON.stringify({ doc, points, links });
    expect(buildScoutingVideoAlignment({ video: doc, points, links }).suggestions).toEqual([]);
    doc.rallies[1] = { ...doc.rallies[1], winner: 'us', reviewed: true };
    const reviewedBefore = JSON.stringify({ doc, points, links });
    const result = buildScoutingVideoAlignment({ video: doc, points, links });
    expect(result).toMatchObject({ preserved: 2, unresolved: [], suggestions: [{ rallyId: 'p1', videoRallyId: 'v1', time: 40, confidence: 'high' }] });
    expect(JSON.stringify({ doc, points, links })).toBe(reviewedBefore);
    expect(before).not.toBe(reviewedBefore);
});

test('99 reviewed video links and one missing-footage flag survive build and explicit acceptance byte for byte', () => {
    const doc = video(101), points = Array.from({ length: 101 }, (_, index) => point(index)), links = linked(Array.from({ length: 99 }, (_, index) => index));
    doc.rallies[100] = { ...doc.rallies[100], winner: 'us', reviewed: true };
    links.links.push({ sessionId: 'set-one', rallyId: 'p99', videoRallyId: null, time: null, missing: true });
    const before = JSON.stringify({ doc, points, links });
    const result = buildScoutingVideoAlignment({ video: doc, points, links });
    expect(result.preserved).toBe(100);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ rallyId: 'p100', confidence: 'review' });
    const saved = acceptScoutingVideoSuggestions(links, doc, points, result.suggestions);
    expect(saved.links.slice(0, 100)).toEqual(links.links);
    expect(saved.links).toHaveLength(101);
    expect(acceptScoutingVideoSuggestions(saved, doc, points, result.suggestions)).toEqual(saved);
    expect(JSON.stringify({ doc, points, links })).toBe(before);
});

test('retrospective compressed timestamps and pause discontinuities cannot become high confidence', () => {
    const doc = video(), points = [point(0, 10), point(1, 10.1), point(2, 10.2)], links = linked([0, 2]);
    doc.rallies[1] = { ...doc.rallies[1], winner: 'us', reviewed: true };
    const compressed = buildScoutingVideoAlignment({ video: doc, points, links });
    expect(compressed.suggestions[0].confidence).toBe('review');
    expect(compressed.suggestions[0].reasons.some(reason => reason.includes('muito próximos'))).toBe(true);
    const paused = buildScoutingVideoAlignment({ video: doc, points: [point(0, 10), point(1, 40), point(2, 170)], links });
    expect(paused.suggestions.every(proposal => proposal.confidence === 'review')).toBe(true);
});

test('no confirmed reference or visual observation leaves unresolved points rather than matching equal counts', () => {
    const result = buildScoutingVideoAlignment({ video: video(), points: [point(0), point(1), point(2)], links: linked([]) });
    expect(result.suggestions).toEqual([]);
    expect(result.unresolved).toHaveLength(3);
});

test('checkpoint contacts contribute visual evidence but camera near/far never identifies our team or a winner', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    points[1].contacts = [
        { fundamental: 'recepcao', phase: 'side_out', resultKey: 'boa' },
        { fundamental: 'ataque', phase: 'side_out', resultKey: 'ponto' },
    ];
    const seen = observations([{ time: 33, skill: 'Recepção' }, { time: 37, skill: 'Ataque' }]);
    const result = buildScoutingVideoAlignment({ video: doc, points, links, observations: seen });
    expect(result.suggestions[0].confidence).toBe('review');
    expect(result.suggestions[0].reasons.some(reason => reason.includes('2 fundamentos observados'))).toBe(true);
    const before = JSON.stringify(seen);
    expect(acceptScoutingVideoSuggestions(links, doc, points, result.suggestions, seen).links).toHaveLength(3);
    expect(JSON.stringify(seen)).toBe(before);
    const foreign = seen.map(observation => ({ ...observation, videoId: 'other-video' }));
    expect(buildScoutingVideoAlignment({ video: doc, points: [points[1]], links: linked([]), observations: foreign }).suggestions).toEqual([]);
});

test('observed sequence and reviewed winner can reject incompatible candidates without inventing omitted contacts', () => {
    const doc = video(5), points = [point(0), point(1, 48), point(2, 78), point(3, 130)];
    const links = linked([0]); links.links.push({ sessionId: 'set-one', rallyId: 'p3', videoRallyId: 'v4', time: 130, missing: false });
    points[1].contacts = [{ fundamental: 'saque', phase: 'side_out', resultKey: 'entrou' }];
    points[2].contacts = [{ fundamental: 'ataque', phase: 'side_out', resultKey: 'ponto' }];
    doc.rallies[1] = { ...doc.rallies[1], winner: 'them', reviewed: true };
    doc.contacts = [
        { id: 'serve', time: 62, skill: 'Saque', team: 'us', athlete: '', studentId: null, outcome: '' },
        { id: 'attack', time: 92, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: '' },
    ];
    const result = buildScoutingVideoAlignment({ video: doc, points, links });
    expect(result.suggestions.map(proposal => proposal.videoRallyId)).toEqual(['v2', 'v3']);
    expect(new Set(result.suggestions.map(proposal => proposal.videoRallyId)).size).toBe(result.suggestions.length);
    expect(result.suggestions.every(proposal => proposal.confidence === 'review')).toBe(true);
});

test('crossed reviewed anchors are preserved and stop new associations in that set', () => {
    const doc = video(), links = linked([0, 2]);
    links.links[0] = { ...links.links[0], videoRallyId: 'v2', time: 70 };
    links.links[1] = { ...links.links[1], videoRallyId: 'v0', time: 10 };
    const result = buildScoutingVideoAlignment({ video: doc, points: [point(0), point(1), point(2)], links });
    expect(result).toMatchObject({ preserved: 2, suggestions: [], unresolved: [{ rallyId: 'p1', reason: expect.stringContaining('fora de ordem') }] });
});

test('a reviewed reference outside its edited clip blocks new suggestions until checked', () => {
    const doc = video(), links = linked([0, 2]);
    links.links[0] = { ...links.links[0], time: 31 };
    const result = buildScoutingVideoAlignment({ video: doc, points: [point(0), point(1), point(2)], links });
    expect(result).toMatchObject({ preserved: 2, suggestions: [], unresolved: [{ rallyId: 'p1', reason: expect.stringContaining('fora do recorte') }] });
});

test('nearby overlapping checkpoint observations count once and never mutate input', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    points[1].contacts = [{ fundamental: 'ataque', phase: 'side_out', resultKey: 'ponto' }, { fundamental: 'ataque', phase: 'side_out', resultKey: 'ponto' }];
    const seen = observations([{ time: 33, skill: 'Ataque' }, { time: 33.1, skill: 'Ataque' }]), before = JSON.stringify(seen);
    const result = buildScoutingVideoAlignment({ video: doc, points, links, observations: seen });
    expect(result.suggestions[0].reasons.some(reason => reason.startsWith('1 fundamento'))).toBe(true);
    expect(JSON.stringify(seen)).toBe(before);
});

test('stale, duplicate, foreign and conflicting proposals fail atomically without touching reviewed links', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    doc.rallies[1] = { ...doc.rallies[1], winner: 'us', reviewed: true };
    const proposals = buildScoutingVideoAlignment({ video: doc, points, links }).suggestions, before = JSON.stringify(links);
    expect(() => acceptScoutingVideoSuggestions(links, doc, points, [proposals[0], proposals[0]])).toThrow('repetidas');
    expect(() => acceptScoutingVideoSuggestions(links, doc, points, [{ ...proposals[0], sessionId: 'other' }])).toThrow('mudou');
    expect(() => acceptScoutingVideoSuggestions(links, { ...doc, rallies: doc.rallies.map(rally => rally.id === 'v1' ? { ...rally, id: 'changed' } : rally) }, points, proposals)).toThrow('mudou');
    const missing = { ...links, links: [...links.links, { sessionId: 'set-one', rallyId: 'p1', videoRallyId: null, time: null, missing: true }] };
    expect(() => acceptScoutingVideoSuggestions(missing, doc, points, proposals)).toThrow('já tem');
    expect(JSON.stringify(links)).toBe(before);
});

test('a second visual pass proposes the observed rally instant and winner only for explicit review', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    const visualRallies = [{ start: 34, end: 38, winner: 'us' as const, evidence: 'Bola no chão no lado adversário' }];
    const before = JSON.stringify({ doc, points, links, visualRallies });
    const result = buildScoutingVideoAlignment({ video: doc, points, links, visualRallies });
    expect(result.suggestions).toMatchObject([{ rallyId: 'p1', videoRallyId: 'v1', time: 34, confidence: 'review' }]);
    expect(result.suggestions[0].reasons.some(reason => reason.includes('Vencedor sugerido'))).toBe(true);
    expect(acceptScoutingVideoSuggestions(links, doc, points, result.suggestions, [], visualRallies).links).toHaveLength(3);
    expect(() => acceptScoutingVideoSuggestions(links, doc, points, result.suggestions)).toThrow('mudou');
    expect(JSON.stringify({ doc, points, links, visualRallies })).toBe(before);
});

test('a clip containing only a clock hint has no proposal, even between two confirmed references', () => {
    const result = buildScoutingVideoAlignment({ video: video(), points: [point(0), point(1), point(2)], links: linked([0, 2]) });
    expect(result).toMatchObject({ suggestions: [], unresolved: [{ rallyId: 'p1' }] });
});

test('conflicting visual winners need corroboration and can never become a high confidence proposal', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0, 2]);
    const visualRallies = [{ start: 34, end: 38, winner: 'them' as const, evidence: 'Resultado incerto' }];
    expect(buildScoutingVideoAlignment({ video: doc, points, links, visualRallies }).suggestions).toEqual([]);
    doc.rallies[1] = { ...doc.rallies[1], winner: 'us', reviewed: true };
    const result = buildScoutingVideoAlignment({ video: doc, points, links, visualRallies });
    expect(result.suggestions[0].confidence).toBe('review');
    expect(result.suggestions[0].reasons.some(reason => reason.includes('diverge'))).toBe(true);
});

test('explicit regulation leaves surplus or above-cap records unresolved while preserving reviewed references', () => {
    const doc = video(4), points = [point(0), point(1), point(2), point(3)], links = linked([0]);
    points[0] = { ...points[0], scoreUs: 20, scoreThem: 20 };
    points[1] = { ...points[1], scoreUs: 21, scoreThem: 20 };
    points[2] = { ...points[2], scoreUs: 21, scoreThem: 23 };
    points[3] = { ...points[3], scoreUs: 21, scoreThem: 24 };
    const visualRallies = [{ start: 35, end: 44, winner: null, evidence: 'Rally visível' }, { start: 65, end: 74, winner: null, evidence: 'Rally visível' }, { start: 95, end: 104, winner: null, evidence: 'Rally visível' }];
    const before = JSON.stringify({ doc, points, links });
    const result = buildScoutingVideoAlignment({ video: doc, points, links, visualRallies, regulation: { pointsToWin: 21, cap: 23 } });
    expect(result.suggestions.map(proposal => proposal.rallyId)).toEqual(['p1', 'p2']);
    expect(result.unresolved).toMatchObject([{ rallyId: 'p3', reason: expect.stringContaining('teto de 23') }]);
    const saved = acceptScoutingVideoSuggestions(links, doc, points, result.suggestions, [], visualRallies, { pointsToWin: 21, cap: 23 });
    expect(saved.links[0]).toEqual(links.links[0]);
    expect(JSON.stringify({ doc, points, links })).toBe(before);
    expect(buildScoutingVideoAlignment({ video: doc, points, links, visualRallies }).suggestions).toHaveLength(3);
});

test('first terminal score ends a set even below the cap, and an invalid regulation is rejected', () => {
    const doc = video(), points = [point(0), point(1), point(2)], links = linked([0]);
    points[0] = { ...points[0], scoreUs: 21, scoreThem: 19 };
    const result = buildScoutingVideoAlignment({ video: doc, points, links, regulation: { pointsToWin: 21, cap: 23 } });
    expect(result.suggestions).toEqual([]);
    expect(result.unresolved).toHaveLength(2);
    const tied = buildScoutingVideoAlignment({ video: doc, points: [{ ...point(0), scoreUs: 23, scoreThem: 23 }], links: linked([]), regulation: { pointsToWin: 21, cap: 23 } });
    expect(tied.unresolved[0].reason).toContain('teto de 23');
    expect(() => buildScoutingVideoAlignment({ video: doc, points, links, regulation: { pointsToWin: 25, cap: 23 } })).toThrow('Regra');
});

test('sessions and set windows prevent proposals from borrowing a reviewed clip in another set', () => {
    const doc = video(4), first = point(0), later = point(1, 40, 'set-two', 2);
    const links = linked([0], ['set-one', 'set-two']);
    const result = buildScoutingVideoAlignment({ video: doc, points: [first, later, point(2, 70, 'foreign', 3)], links });
    expect(result.suggestions).toEqual([]);
    expect(result.unresolved.map(unresolved => unresolved.sessionId)).toEqual(['set-two']);
});
