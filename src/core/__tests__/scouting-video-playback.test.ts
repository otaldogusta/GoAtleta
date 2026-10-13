import { sceneCuts, trackingIndex, trackingTrail } from '../scouting-video-playback';
import { newVideoDocument, parseVideoDocument, videoRallyIndex } from '../scouting-video';

test('tracking follows individual video frames and vanishes across missing samples', () => {
    const rows = [{time: 1, x: .2, y: .3}, {time: 1 + 1 / 30, x: .21, y: .3}, {time: 2, x: .4, y: .3}];
    expect(trackingIndex(rows, .9)).toBe(-1);
    expect(trackingIndex(rows, 1.02)).toBe(0);
    expect(trackingIndex(rows, 1.034)).toBe(1);
    expect(trackingIndex(rows, 1 + 2 / 30)).toBe(-1);
    expect(trackingIndex(rows, 1.1)).toBe(-1);
    expect(trackingIndex(rows, 2)).toBe(2);
    expect(trackingIndex([], 0)).toBe(-1);
    const doc = newVideoDocument({fingerprint:'seek', name:'video', duration:30, width:1202, height:676}, 'r1');
    doc.rallies.push({id:'r2', start:13.466668638, winner:null, reviewed:false});
    expect(videoRallyIndex(doc, 13.466668)).toBe(1);
    expect(videoRallyIndex(doc, 13.4)).toBe(0);
});
test('trail does not connect missing periods, scene boundaries or spatial jumps', () => {
    const rows = [{time: 1, x: .2, y: .3}, {time: 1.033, x: .21, y: .3}, {time: 1.066, x: .22, y: .3}, {time: 2, x: .25, y: .3}, {time: 2.033, x: .9, y: .3}];
    expect(trackingTrail(rows, 2, 0)).toHaveLength(3);
    expect(trackingTrail(rows, 2, 1.05)).toEqual([rows[2]]);
    expect(trackingTrail(rows, 3, 0)).toEqual([rows[3]]);
    expect(trackingTrail(rows, 4, 0)).toEqual([rows[4]]);
});
test('scene cuts retain strongest separated changes instead of requiring a threshold of twelve', () => {
    const scores = Array(300).fill(.2); scores[60] = 5; scores[64] = 8; scores[150] = 4; scores[299] = 20;
    expect(sceneCuts(scores)).toEqual([64 / 30, 5]);
    expect(sceneCuts(Array(300).fill(2))).toEqual([]);
    expect(sceneCuts([])).toEqual([]);
});
test('processed local results retain their provenance and still require matching media', () => {
    const media = {fingerprint:'reference-video', name:'match.mp4', duration:60, width:1202, height:676};
    const doc = {...newVideoDocument(media, 'first'), analysis:{model:'vballnet-v2b-local', sampledFps:30, positions:[{time:1,x:.2,y:.3}], cuts:[10]}};
    expect(parseVideoDocument(doc, media).analysis?.model).toBe('vballnet-v2b-local');
    expect(() => parseVideoDocument(doc, {...media, fingerprint:'other'})).toThrow('outro vídeo');
    expect(() => parseVideoDocument({...doc, analysis:{...doc.analysis, model:'unknown'}})).toThrow();
});
