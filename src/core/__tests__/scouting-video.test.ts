import { editVideo, markVideoPoint, mergeVideoRally, newVideoDocument, parseVideoDocument, splitVideoRally, undoVideo, videoContacts, videoDraftKey, videoRange, type VideoHistory } from '../scouting-video';
const media = { fingerprint: 'video-a', name: 'partida.mp4', duration: 60, width: 1280, height: 720 };
const make = () => ({ ...newVideoDocument(media, 'r1'), contacts: [
  { id: 'serve', time: 2, skill: 'Saque' as const, team: 'them' as const, athlete: '', studentId: null, outcome: 'Em jogo' },
  { id: 'pass', time: 4, skill: 'Recepção' as const, team: 'us' as const, athlete: '', studentId: null, outcome: 'Controlada' },
] });

test('point timestamp persists independently, validates rally bounds and supports undo/removal/cuts', () => {
  const doc = splitVideoRally(make(), 10, 'r2');
  const marked = markVideoPoint(doc, 'r2', 25.046);
  expect(parseVideoDocument(JSON.parse(JSON.stringify(marked)))).toEqual(marked);
  expect(marked.rallies[1]).toMatchObject({ pointTime: 25.046, winner: null });
  expect(marked.contacts).toEqual(doc.contacts);
  expect(parseVideoDocument(doc)).toEqual(doc);
  for (const time of [9.9, 60, NaN]) {
    expect(() => markVideoPoint(doc, 'r2', time)).toThrow();
    expect(() => parseVideoDocument({ ...doc, rallies: doc.rallies.map(r => r.id === 'r2' ? { ...r, pointTime: time } : r) })).toThrow();
  }
  const history = editVideo({ present: doc, past: [], future: [] }, marked, 'Instante do ponto');
  expect(undoVideo(history).present).toEqual(doc);
  expect(undoVideo(undoVideo(history), true).present).toEqual(marked);
  expect(parseVideoDocument(markVideoPoint(marked, 'r2', null))).toEqual(doc);
  expect(parseVideoDocument(splitVideoRally(marked, 20, 'r3')).rallies.every(r => r.pointTime === undefined)).toBe(true);
  expect(parseVideoDocument(mergeVideoRally(marked, 'r2')).rallies[0].pointTime).toBeUndefined();
});
test('contacts survive split/merge, including a contact exactly at the boundary', () => {
  const split = splitVideoRally(make(), 4, 'r2');
  expect(videoRange(split, 'r2')).toEqual([4, 60]);
  expect(videoContacts(split, 'r1').map(c => c.id)).toEqual(['serve']);
  expect(videoContacts(split, 'r2').map(c => c.id)).toEqual(['pass']);
  expect(mergeVideoRally(split, 'r2').contacts).toEqual(make().contacts);
  expect(videoRange(split, null)).toEqual([0, 60]);
});
test('editing, undo and redo restore exact times, outcomes and winner; new edit drops redo', () => {
  const initial: VideoHistory = { present: make(), past: [], future: [] };
  const next = { ...make(), rallies: [{ ...make().rallies[0], winner: 'us' as const }] };
  const changed = editVideo(initial, next, 'Ponto');
  const undone = undoVideo(changed);
  expect(undone.present).toEqual(initial.present);
  expect(undoVideo(undone, true).present).toEqual(next);
  expect(editVideo(undone, splitVideoRally(make(), 10, 'r2'), 'Divisão').future).toEqual([]);
});
test('cut changes require reconfirming results, without inventing point totals', () => {
  const doc = make(); doc.rallies[0].winner = 'us';
  const split = splitVideoRally(doc, 10, 'r2');
  expect(split.rallies.map(r => r.winner)).toEqual([null, null]);
  split.rallies[1].winner = 'them';
  expect(mergeVideoRally(split, 'r2').rallies[0].winner).toBeNull();
});
test('invalid cuts and mismatched media are refused', () => {
  for (const time of [-1, 0, 60, NaN]) expect(() => splitVideoRally(make(), time, 'r2')).toThrow();
  expect(() => parseVideoDocument(make(), { ...media, fingerprint: 'video-b' })).toThrow('outro vídeo');
  expect(() => parseVideoDocument({ ...make(), contacts: [{ ...make().contacts[0], time: 61 }] })).toThrow();
  expect(() => parseVideoDocument({ ...make(), rallies: [{ ...make().rallies[0], start: 2 }] })).toThrow();
  expect(() => parseVideoDocument({ ...make(), contacts: [make().contacts[0], make().contacts[0]] })).toThrow();
});
test('free ball and coverage are accepted without changing the official scouting taxonomy', () => {
  const doc = make();
  const contacts = [{ ...doc.contacts[0], skill: 'Bola de graça', outcome: 'Em jogo' }, { ...doc.contacts[1], skill: 'Cobertura de ataque', outcome: 'Controlada' }];
  expect(parseVideoDocument({ ...doc, contacts }).contacts).toHaveLength(2);
  expect(() => parseVideoDocument({ ...doc, contacts: [{ ...contacts[0], outcome: 'Ace' }] })).toThrow();
});
test('draft keys isolate identity, organization, session and video with no delimiter collision', () => {
  const keys = [videoDraftKey('u', 'o', 's', 'm'), videoDraftKey('v', 'o', 's', 'm'), videoDraftKey('u', 'p', 's', 'm'), videoDraftKey('u', 'o', 't', 'm'), videoDraftKey('u', 'o', 's', 'n'), videoDraftKey('u:o', 's', 'm', 'a'), videoDraftKey('u', 'o:s', 'm', 'a')];
  expect(new Set(keys).size).toBe(keys.length);
  expect(() => videoDraftKey('', 'o', 's', 'm')).toThrow();
});
test('import strips extra fields so embedded URLs or grants cannot affect playback or authorization', () => {
  const parsed = parseVideoDocument({ ...make(), source: 'https://untrusted.example', permission: 'editor', media: { ...media, url: 'javascript:alert(1)' } });
  expect(parsed).not.toHaveProperty('source'); expect(parsed.media).not.toHaveProperty('url');
});
