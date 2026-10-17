import { newVideoDocument, splitVideoRally, type VideoDocument, type VideoHistory } from '../../../core/scouting-video';
import { parseStoredVideoDraft, persistVideoDraft, serializeVideoDraft } from '../video/video-draft-storage';

const mockStorage = new Map<string, string>();
const mockSet = jest.fn(async (key: string, data: string) => { mockStorage.set(key, data); });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
    setItem: (...args: [string, string]) => mockSet(...args),
} }));
const media = { fingerprint: 'original-file', name: 'partida.mp4', duration: 60, width: 1280, height: 720 };
const initial = newVideoDocument(media, 'first');
const document = splitVideoRally(initial, 20, 'second');
const edit = (label = 'Dividir rally', after = document) => ({ label, at: '2026-10-16T14:00:00.000Z', before: initial, after });
const history = (present = document): VideoHistory => ({ present, past: [edit()], future: [edit('Refazer')] });
const deferred = () => {
    let resolve!: () => void, reject!: (reason: Error) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

beforeEach(() => {
    mockStorage.clear(); mockSet.mockReset();
    mockSet.mockImplementation(async (key: string, data: string) => { mockStorage.set(key, data); });
});

test('reads legacy raw documents and saved envelopes without inventing a cloud baseline', () => {
    const raw = parseStoredVideoDraft(JSON.stringify(document), media);
    expect(raw).toEqual({ history: { present: document, past: [], future: [] }, savedAt: '', sync: undefined });
    const legacy = parseStoredVideoDraft(JSON.stringify({ document, past: [edit()], savedAt: '2026-10-16T14:00:00.000Z' }), media);
    expect(legacy.history).toEqual({ present: document, past: [edit()], future: [] });
    expect(legacy.savedAt).toBe('2026-10-16T14:00:00.000Z');
    expect(legacy.sync).toBeUndefined();
});

test.each([
    { revision: 0, dirty: true },
    { revision: 3, dirty: false },
    { revision: 3, dirty: true, pending: { id: 'stable-mutation', expectedRevision: 3, matchesCurrent: true } },
    { revision: 3, dirty: true, pending: { id: 'old-mutation', expectedRevision: 3, matchesCurrent: false } },
])('retains compact sync metadata %# while storing only one current document', sync => {
    const data = serializeVideoDraft(history(), sync);
    const stored = parseStoredVideoDraft(data, media);
    expect(stored.history.present).toEqual(document); expect(stored.sync).toEqual(sync);
    expect(stored.history.future).toEqual([]);
    expect(JSON.parse(data)).not.toHaveProperty('baseSignature');
    expect(JSON.parse(data)).not.toHaveProperty('remote');
    expect(JSON.parse(data).sync).not.toHaveProperty('document');
});

test.each([
    { revision: -1, dirty: false }, { revision: 1.5, dirty: true }, { revision: 1, dirty: 'false' },
    { revision: 1, dirty: true, pending: { id: '', expectedRevision: 1, matchesCurrent: true } },
    { revision: 1, dirty: true, pending: { id: 'x'.repeat(129), expectedRevision: 1, matchesCurrent: true } },
    { revision: 1, dirty: true, pending: { id: 'id', expectedRevision: -1, matchesCurrent: true } },
    { revision: 1, dirty: true, pending: { id: 'id', expectedRevision: 1.5, matchesCurrent: true } },
    { revision: 1, dirty: true, pending: { id: 'id', expectedRevision: 1, matchesCurrent: 'yes' } },
])('rejects malformed metadata %# instead of interpreting it as a clean draft', sync => {
    expect(() => parseStoredVideoDraft(JSON.stringify({ document, sync }))).toThrow('Sincronização local inválida');
});

test.each([
    '{broken', 'null', '{}', JSON.stringify({ document, past: 'not-history' }),
    JSON.stringify({ document, past: Array.from({ length: 21 }, () => edit()) }),
    JSON.stringify({ document, past: [edit('Invalid', { ...document, media: { ...media, fingerprint: 'other-file' } })] }),
])('rejects corrupt saved data %# without any storage writes or replacements', raw => {
    mockStorage.set('corrupt', raw);
    expect(() => parseStoredVideoDraft(raw)).toThrow();
    expect(mockStorage.get('corrupt')).toBe(raw);
    expect(mockSet).not.toHaveBeenCalled();
});

test('current media and every history entry must belong to the selected file', () => {
    expect(() => parseStoredVideoDraft(JSON.stringify({ document, past: [] }), { ...media, fingerprint: 'another-file' })).toThrow('outro vídeo');
    expect(() => parseStoredVideoDraft(JSON.stringify({ document, past: [{ ...edit(), before: { ...initial, media: { ...media, duration: 90 } } }] }))).toThrow('outro vídeo');
});

test('retains only the newest 20 undo entries, without mutating in-memory history', () => {
    const source: VideoHistory = { present: document, past: Array.from({ length: 25 }, (_, i) => edit(`Edit ${i}`)), future: [] };
    const parsed = parseStoredVideoDraft(serializeVideoDraft(source));
    expect(parsed.history.past).toHaveLength(20);
    expect(parsed.history.past[0].label).toBe('Edit 5');
    expect(parsed.history.past.at(-1)?.label).toBe('Edit 24');
    expect(source.past).toHaveLength(25);
});

const trackedDocument = (count: number): VideoDocument => ({ ...document,
    contacts: [{ id: 'attack', time: 30, skill: 'Ataque', team: 'us', athlete: 'Atleta', studentId: null, outcome: 'Ponto de ataque' }],
    corrections: [{ time: 31, x: 0.4, y: 0.6 }],
    analysis: { model: 'vballnet-v4c-browser-1', sampledFps: 30, cuts: [20],
        positions: Array.from({ length: count }, (_, i) => ({ time: i / 1000, x: 0.123456789123456, y: 0.987654321123456 })) },
});

test('history yields to the storage budget while the complete current tracking and annotations survive', () => {
    const present = trackedDocument(18000), source: VideoHistory = { present, past: [edit('Tracking', present)], future: [] };
    const data = serializeVideoDraft(source, { revision: 2, dirty: true });
    const parsed = parseStoredVideoDraft(data);
    expect(data.length).toBeLessThanOrEqual(1500000);
    expect(parsed.history.past).toEqual([]);
    expect(parsed.history.present).toEqual(present);
    expect(source.past).toHaveLength(1);
});

test('a current document larger than the history budget is never silently truncated', () => {
    const present = trackedDocument(40000), source = { present, past: [edit('Tracking', present)], future: [] };
    const data = serializeVideoDraft(source);
    expect(data.length).toBeGreaterThan(1500000);
    const parsed = parseStoredVideoDraft(data);
    expect(parsed.history.present.analysis?.positions).toHaveLength(40000);
    expect(parsed.history.present.contacts).toEqual(present.contacts);
    expect(parsed.history.present.corrections).toEqual(present.corrections);
    expect(parsed.history.past).toEqual([]);
});

test('serializes writes of the same draft so a slow older snapshot cannot replace a newer one', async () => {
    const gate = deferred();
    mockSet.mockImplementationOnce(async (key: string, data: string) => { await gate.promise; mockStorage.set(key, data); });
    const first = persistVideoDraft('ordered', 'older'), second = persistVideoDraft('ordered', 'newer');
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1); expect(mockStorage.has('ordered')).toBe(false);
    gate.resolve(); await Promise.all([first, second]);
    expect(mockSet.mock.calls).toEqual([['ordered', 'older'], ['ordered', 'newer']]);
    expect(mockStorage.get('ordered')).toBe('newer');
});

test('different draft keys proceed independently while one storage write is blocked', async () => {
    const gate = deferred();
    mockSet.mockImplementationOnce(async (key: string, data: string) => { await gate.promise; mockStorage.set(key, data); });
    const blocked = persistVideoDraft('blocked-file', 'old');
    const independent = persistVideoDraft('other-file', 'available');
    await independent;
    expect(mockStorage.get('other-file')).toBe('available'); expect(mockStorage.has('blocked-file')).toBe(false);
    gate.resolve(); await blocked;
});

test('a failed write rejects its caller but does not poison later saves of that draft', async () => {
    const gate = deferred();
    mockSet.mockImplementationOnce(async () => gate.promise);
    const first = persistVideoDraft('recovered', 'unsaved');
    const rejected = expect(first).rejects.toThrow('quota');
    const next = persistVideoDraft('recovered', 'retry');
    await flush(); expect(mockSet).toHaveBeenCalledTimes(1);
    gate.reject(new Error('quota')); await rejected; await next;
    expect(mockStorage.get('recovered')).toBe('retry');
    await persistVideoDraft('recovered', 'after-cleanup');
    expect(mockStorage.get('recovered')).toBe('after-cleanup');
});
