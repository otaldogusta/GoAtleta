import { acceptVideoAnalysis, newVideoDocument, parseVideoDocument, editVideo, undoVideo, type VideoAnalysis } from '../scouting-video';
const media = { fingerprint: 'local-test', name: 'test.mp4', duration: 30, width: 1202, height: 676 };
const result: VideoAnalysis = { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{time: 1, x: .2, y: .3}], cuts: [10] };
test('automatic results survive round trip without silently creating rallies or altering human annotations', () => {
  const doc = newVideoDocument(media, 'r1'); doc.rallies[0].winner = 'us'; doc.corrections = [{time: 1, x: .5, y: .6}];
  const next = parseVideoDocument(JSON.parse(JSON.stringify({...doc, analysis: result})), media);
  expect(next.analysis).toEqual(result); expect(next.rallies).toEqual(doc.rallies); expect(next.corrections).toEqual(doc.corrections);
  const history = editVideo({present: doc, past: [], future: []}, next, 'Automatic');
  expect(undoVideo(history).present.analysis).toBeUndefined(); expect(undoVideo(undoVideo(history), true).present.analysis).toEqual(result);
});
test('invalid or unbounded results and wrong-media imports are refused', () => {
  const doc = newVideoDocument(media, 'r1');
  for(const analysis of [{...result, cuts:[30]}, {...result, cuts:[10, 9]}, {...result, positions:[{time: 1, x: NaN, y:.2}]}, {...result, positions:[{time: 31, x: .1, y:.2}]}, {...result, positions:Array(54001).fill(result.positions[0])}]) expect(() => parseVideoDocument({...doc, analysis})).toThrow();
  expect(() => parseVideoDocument({...doc, analysis:result}, {...media, fingerprint:'another'})).toThrow();
});
test('legacy drafts remain readable without analysis', () => { expect(parseVideoDocument(newVideoDocument(media,'r1')).analysis).toBeUndefined(); });
test('explicit acceptance initializes suggested cuts only on a blank document', () => {
  const empty = newVideoDocument(media, 'r1');
  expect(acceptVideoAnalysis(empty, result).rallies.map(r => r.start)).toEqual([0, 10]);
  expect(acceptVideoAnalysis(empty, result).rallies.every(r => !r.reviewed && !r.winner)).toBe(true);
  const annotated = {...empty, corrections:[{time:2, x:.2, y:.3}]};
  expect(acceptVideoAnalysis(annotated, result).rallies).toEqual(annotated.rallies);
  const scored = {...empty, rallies:[{...empty.rallies[0], winner:'us' as const}]};
  expect(acceptVideoAnalysis(scored, result).rallies).toEqual(scored.rallies);
  expect(() => parseVideoDocument(acceptVideoAnalysis(newVideoDocument(media, 'suggested-cut-0'), result))).not.toThrow();
  expect(() => acceptVideoAnalysis(empty, {...result, cuts: Array(2000).fill(10)})).toThrow('limite');
});
