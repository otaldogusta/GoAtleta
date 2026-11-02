import { parseVisualAlignmentCache, parseVisualAlignmentResult, planVisualAlignment, uncoveredVisualAlignmentRequests, visualRalliesForTeam } from '../scouting-video-visual-alignment';
import type { ScoutingRally } from '../models';
const media = { youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Video', duration: 600, width: 1920, height: 1080 };
const point = (number: number, setNumber = 1): ScoutingRally => ({ id: `p${setNumber}-${number}`, sessionId: `set${setNumber}`, setNumber, number, scoreUs: number, scoreThem: 0, won: true, serve: 'us', rotation: null,
    createdAt: '2026-11-01T12:00:00Z', contacts: [{ fundamental: 'ataque', resultKey: 'ponto', studentId: 'private-id', athleteName: 'Private athlete', phase: null, zone: null }] });
const link = (number: number, time: number, setNumber = 1) => ({ sessionId: `set${setNumber}`, rallyId: `p${setNumber}-${number}`, videoRallyId: `v${setNumber}-${number}`, time, missing: false });
const input = { ourSide: 'far' as const, points: [point(1), point(2), point(3)], anchors: [link(1, 60), link(3, 180)], setNumber: 1, sessionId: 'set1' };

test('plans bounded windows between reviewed anchors and sends only anonymous sporting context', () => {
    const before = JSON.stringify(input), requests = planVisualAlignment(media, input);
    expect(requests.map(r => [r.start,r.end])).toEqual([[60,120],[120,180]]);
    const serialized = JSON.stringify(requests);
    expect(serialized).not.toContain('Private athlete'); expect(serialized).not.toContain('private-id'); expect(serialized).not.toContain('set1');
    expect(requests[0].points[0]).toEqual({ number: 1, won: true, skills: ['Ataque'] });
    expect(JSON.stringify(input)).toBe(before);
    const repeated = { ...input, points: input.points.map(p => ({ ...p, contacts: [...p.contacts, ...p.contacts] })) };
    expect(planVisualAlignment(media, repeated)[0].points[0].skills).toEqual(['Ataque']);
});

test('protects footage marked missing and does not scan an unanchored set', () => {
    expect(planVisualAlignment(media, { ...input, anchors: [] })).toEqual([]);
    expect(planVisualAlignment(media, { ...input, anchors: [...input.anchors, { sessionId: 'set1', rallyId: 'p1-2', videoRallyId: null, time: null, missing: true }] })).toEqual([]);
});

test('never rounds a gap into already reviewed footage on either side', () => {
    const requests = planVisualAlignment(media, { ...input, anchors: [link(1,61.5),link(3,83)] });
    expect(requests.map(r => [r.start,r.end])).toEqual([[61.5,83]]);
});

test('cached observations cover updated anchor contexts and only uncovered fragments incur work', () => {
    const requests = planVisualAlignment(media,input);
    expect(uncoveredVisualAlignmentRequests(requests,[{start:60,end:120},{start:120,end:180}])).toEqual([]);
    expect(uncoveredVisualAlignmentRequests(requests,[{start:70,end:100}]).map(r => [r.start,r.end])).toEqual([[60,70],[100,120],[120,180]]);
});

test('uses the previous set as a lower boundary and skips records after the explicit set limit', () => {
    const requests = planVisualAlignment(media, { ...input, points: [point(1),point(1,2),point(2,2),point(3,2)], anchors: [link(1,120),link(3,300,2)], setNumber: 2, sessionId: 'set2' });
    expect(requests[0].start).toBe(120);
    expect(planVisualAlignment(media, { ...input, points: [point(21),point(22)], anchors: [link(21,120)], regulation: { pointsToWin: 21, cap: 23 } })).toEqual([]);
});

test('rejects wrong video, out-of-range and invented winner fields without clamping', () => {
    const request = { videoId: media.youtubeId, start: 60, end: 120 };
    const result = { ...request, model: 'test', rallies: [{ start: 70, end: 80, winner: 'far', evidence: 'Bola toca o piso do lado próximo.' }], limitations: [] };
    const parsed = parseVisualAlignmentResult(result, request);
    expect(visualRalliesForTeam(parsed, 'far')[0].winner).toBe('us');
    expect(visualRalliesForTeam(parsed, 'near')[0].winner).toBe('them');
    for (const changed of [{ ...result, videoId: 'foreign' }, { ...result, rallies: [{ ...result.rallies[0], start: 130 }] }, { ...result, rallies: [{ ...result.rallies[0], winner: 'team-name' }] }]) expect(() => parseVisualAlignmentResult(changed, request)).toThrow('preservados');
    expect(visualRalliesForTeam({ ...parsed, rallies: [{ ...parsed.rallies[0], winner: 'unknown' }] }, 'far')[0].winner).toBeNull();
});

test('recovery uses the same scoped cache parser as the application', () => {
    const request = planVisualAlignment(media,input)[0];
    const entry = { sessionId: 'set1', setNumber: 1, request, result: { ...request, model: 'test', rallies: [], limitations: [] } };
    const raw = JSON.stringify({version:1,entries:[entry]});
    expect(parseVisualAlignmentCache(raw,media)).toHaveLength(1);
    expect(() => parseVisualAlignmentCache(raw,{...media,youtubeId:'other-video'})).toThrow('outro vídeo');
    expect(() => parseVisualAlignmentCache(JSON.stringify({version:1,entries:[{...entry,setNumber:0}]}),media)).toThrow();
    const failed = { ...entry, result: null, error: 'Sem leitura confiável' };
    expect(parseVisualAlignmentCache(JSON.stringify({version:1,entries:[failed]}),media)[0].result).toBeNull();
    expect(() => parseVisualAlignmentCache(JSON.stringify({version:1,entries:[{...failed,error:''}]}),media)).toThrow();
});
