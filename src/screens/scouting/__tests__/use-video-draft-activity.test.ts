import { act, renderHook } from '@testing-library/react-native';
import { useVideoDraft } from '../video/use-video-draft';
import { newVideoDocument, splitVideoRally, videoDraftKey, type VideoDocument } from '../../../core/scouting-video';
import { serializeVideoDraft } from '../video/video-draft-storage';

const mockStored = new Map<string, string>();
const mockKeys = jest.fn(async (prefix: string) => [...mockStored.keys()].filter(key => key.startsWith(prefix)));
const mockGet = jest.fn(async (key: string) => mockStored.get(key) ?? null);
const mockPersist = jest.fn(async (key: string, raw: string) => { mockStored.set(key, raw); });
let mockUser = 'user', mockGeneration = 1;
const mockCloudGet = jest.fn();
const mockCloudSave = jest.fn();
jest.mock('../video/video-draft-storage', () => ({
  ...jest.requireActual('../video/video-draft-storage'),
  getVideoDraftKeys: (prefix: string) => mockKeys(prefix),
  getVideoDraft: (key: string) => mockGet(key),
  persistVideoDraft: (key: string, raw: string) => mockPersist(key, raw),
}));
jest.mock('../../../auth/session', () => ({
  getSessionIdentity: () => ({ userId: mockUser, generation: mockGeneration }),
  assertSessionIdentity: (identity: { userId: string; generation: number }) => {
    if (identity.userId !== mockUser || identity.generation !== mockGeneration) throw new Error('Session changed');
  },
}));
jest.mock('../../../api/scouting-video-documents', () => ({
  getScoutingVideoDocument: (...args: unknown[]) => mockCloudGet(...args),
  saveScoutingVideoDocument: (...args: unknown[]) => mockCloudSave(...args),
  VideoDocumentSyncError: class extends Error { code: string; constructor(mockCode: string) { super(mockCode); this.code = mockCode; } },
}));

const media = { fingerprint: 'activity-fixture', name: 'FICTICIO.mp4', duration: 20, width: 960, height: 540 };
const initial = newVideoDocument(media, 'rally');
const record = (document: VideoDocument = initial, revision = 1, organizationId = 'org') => ({
  organizationId, sessionId: 'session', fingerprint: document.media.fingerprint,
  document, revision, updatedAt: '2026-10-25T12:00:00.000Z', mutationId: '',
});
const flush = async () => { for (let step = 0; step < 45; step++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let listeners: Map<string, Set<() => void>>;
const emit = (event: string) => listeners.get(event)?.forEach(callback => callback());
const mount = (active = true, org = 'org') => renderHook(
  ({ visible, organization }) => useVideoDraft(organization, 'user', 'session', undefined, true, visible),
  { initialProps: { visible: active, organization: org } },
);
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockUser = 'user'; mockGeneration++;
  mockStored.clear(); mockStored.set(videoDraftKey('user', 'org', 'session', media.fingerprint), serializeVideoDraft({ present: initial, past: [], future: [] }));
  mockCloudGet.mockReset().mockImplementation(async (scope: { org: string }) => scope.org === 'org' ? record() : null);
  mockCloudSave.mockReset().mockImplementation(async (scope, document, revision, mutationId) => ({ ...record(document, revision + 1, scope.org), mutationId }));
  mockPersist.mockReset().mockImplementation(async (key, raw) => { mockStored.set(key, raw); });
  listeners = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener: (event: string, callback: () => void) => { const set = listeners.get(event) ?? new Set(); set.add(callback); listeners.set(event, set); },
    removeEventListener: (event: string, callback: () => void) => listeners.get(event)?.delete(callback),
  } });
});
afterEach(() => {
  jest.useRealTimers();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
});

test('an initially hidden studio performs no local or cloud reads until activated', async () => {
  const hook = mount(false);
  await act(flush);
  expect(mockKeys).not.toHaveBeenCalled(); expect(mockGet).not.toHaveBeenCalled();
  expect(mockCloudGet).not.toHaveBeenCalled(); expect(mockPersist).not.toHaveBeenCalled();
  expect([...listeners.values()].every(set => set.size === 0)).toBe(true);
  await act(async () => { hook.rerender({ visible: true, organization: 'org' }); await flush(); });
  expect(hook.result.current.doc).toEqual(initial); expect(hook.result.current.loading).toBe(false);
  expect(mockCloudGet).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test('blur suspends autosave and focus/online work, then resumes with the same dirty document and undo history', async () => {
  const hook = mount(); await act(flush);
  act(() => hook.result.current.change(splitVideoRally(hook.result.current.doc!, 5, 'cut'), 'Divisão'));
  const document = hook.result.current.doc, history = hook.result.current.history;
  hook.rerender({ visible: false, organization: 'org' });
  mockCloudGet.mockClear(); mockPersist.mockClear(); mockCloudSave.mockClear();
  await act(async () => { emit('focus'); emit('online'); await jest.advanceTimersByTimeAsync(2000); await flush(); });
  expect(mockCloudGet).not.toHaveBeenCalled(); expect(mockPersist).not.toHaveBeenCalled(); expect(mockCloudSave).not.toHaveBeenCalled();
  expect(hook.result.current.doc).toBe(document); expect(hook.result.current.history).toBe(history); expect(hook.result.current.dirty).toBe(true);
  const remote = deferred<ReturnType<typeof record>>(); mockCloudGet.mockReturnValueOnce(remote.promise);
  await act(async () => { hook.rerender({ visible: true, organization: 'org' }); await flush(); });
  expect(hook.result.current.doc).toBe(document); expect(hook.result.current.history).toBe(history);
  await act(async () => { remote.resolve(record()); await flush(); });
  expect(mockCloudSave).toHaveBeenCalledTimes(1); expect(hook.result.current.dirty).toBe(false);
  expect(hook.result.current.history?.past).toHaveLength(1);
  act(() => hook.result.current.undo()); expect(hook.result.current.doc?.rallies).toHaveLength(1);
  act(() => hook.result.current.undo(true)); expect(hook.result.current.doc?.rallies).toHaveLength(2);
  hook.unmount();
});

test('a passive remote response after blur cannot replace RAM or start persistence', async () => {
  const hook = mount(); await act(flush);
  const document = hook.result.current.doc;
  const remote = deferred<ReturnType<typeof record>>(); mockCloudGet.mockReturnValueOnce(remote.promise);
  act(() => { emit('focus'); emit('online'); }); await act(flush);
  expect(mockCloudGet).toHaveBeenCalledTimes(2);
  hook.rerender({ visible: false, organization: 'org' }); mockPersist.mockClear();
  await act(async () => { remote.resolve(record(splitVideoRally(initial, 7, 'external'), 2)); await flush(); });
  expect(hook.result.current.doc).toBe(document); expect(mockPersist).not.toHaveBeenCalled(); expect(mockCloudSave).not.toHaveBeenCalled();
  hook.unmount();
});

test('a scope change rejects the old passive response and defers reads for the hidden new scope', async () => {
  const hook = mount(); await act(flush);
  const remote = deferred<ReturnType<typeof record>>(); mockCloudGet.mockReturnValueOnce(remote.promise);
  act(() => emit('focus')); await act(flush);
  hook.rerender({ visible: false, organization: 'other-org' }); mockKeys.mockClear(); mockPersist.mockClear();
  await act(async () => { remote.resolve(record(splitVideoRally(initial, 6, 'old-scope'), 2)); emit('online'); await flush(); });
  expect(hook.result.current.doc).toBeNull(); expect(mockKeys).not.toHaveBeenCalled(); expect(mockPersist).not.toHaveBeenCalled();
  await act(async () => { hook.rerender({ visible: true, organization: 'other-org' }); await flush(); });
  expect(mockCloudGet).toHaveBeenLastCalledWith({ org: 'other-org', userId: 'user', sessionId: 'session' });
  expect(hook.result.current.doc).toBeNull(); hook.unmount();
});

test('blur never cancels confirmation of an already authorized cloud write', async () => {
  const hook = mount(); await act(flush);
  act(() => hook.result.current.change(splitVideoRally(initial, 5, 'saved-cut'), 'Divisão'));
  const pending = deferred<ReturnType<typeof record>>(); mockCloudSave.mockReturnValueOnce(pending.promise);
  let saved!: Promise<boolean>;
  await act(async () => { saved = hook.result.current.save(); await flush(); });
  expect(mockCloudSave).toHaveBeenCalledTimes(1);
  const submitted = mockCloudSave.mock.calls[0][1] as VideoDocument;
  hook.rerender({ visible: false, organization: 'org' });
  await act(async () => { pending.resolve(record(submitted, 2)); expect(await saved).toBe(true); await flush(); });
  expect(hook.result.current.doc).toBe(submitted); expect(hook.result.current.dirty).toBe(false);
  expect(hook.result.current.syncStatus).toBe('synced'); expect(hook.result.current.history?.past).toHaveLength(1);
  hook.unmount();
});

test('a passive autosave waiting for local storage cannot begin a cloud write after blur', async () => {
  const hook = mount(); await act(flush);
  act(() => hook.result.current.change(splitVideoRally(initial, 5, 'local-cut'), 'Divisão'));
  const local = deferred<void>(); mockPersist.mockImplementationOnce(() => local.promise);
  await act(async () => { jest.advanceTimersByTime(800); await flush(); });
  hook.rerender({ visible: false, organization: 'org' });
  await act(async () => { local.resolve(); await flush(); });
  expect(mockCloudSave).not.toHaveBeenCalled(); expect(hook.result.current.syncStatus).toBe('pending');
  expect(hook.result.current.doc?.rallies).toHaveLength(2); hook.unmount();
});

test('a late initialization response after blur is discarded and activation restores the current local document', async () => {
  const remote = deferred<ReturnType<typeof record>>(); mockCloudGet.mockReturnValueOnce(remote.promise);
  const hook = mount(); await act(flush);
  hook.rerender({ visible: false, organization: 'org' });
  await act(async () => { remote.resolve(record(splitVideoRally(initial, 8, 'late'), 2)); await flush(); });
  expect(hook.result.current.loading).toBe(true);
  await act(async () => { hook.rerender({ visible: true, organization: 'org' }); await flush(); });
  expect(hook.result.current.doc).toEqual(initial); expect(hook.result.current.loading).toBe(false); hook.unmount();
});

test('a session change while passive synchronization is pending prevents late persistence', async () => {
  const hook = mount(); await act(flush);
  const document = hook.result.current.doc;
  const remote = deferred<ReturnType<typeof record>>(); mockCloudGet.mockReturnValueOnce(remote.promise);
  act(() => emit('online')); await act(flush);
  mockGeneration++; mockPersist.mockClear();
  await act(async () => { remote.resolve(record(splitVideoRally(initial, 9, 'other-session'), 2)); await flush(); });
  expect(hook.result.current.doc).toBe(document); expect(mockPersist).not.toHaveBeenCalled(); expect(mockCloudSave).not.toHaveBeenCalled();
  hook.unmount();
});

test('readonly documents never subscribe or read storage even across visibility changes', async () => {
  const hook = renderHook(({ active }) => useVideoDraft('', '', '', initial, false, active), { initialProps: { active: false } });
  hook.rerender({ active: true }); await act(flush);
  expect(hook.result.current.doc).toEqual(initial); expect(mockKeys).not.toHaveBeenCalled(); expect(mockCloudGet).not.toHaveBeenCalled();
  expect([...listeners.values()].every(set => set.size === 0)).toBe(true); hook.unmount();
});

const trackedFixture = (): VideoDocument => ({ ...initial, analysis: {
  model: 'vballnet-v2b-browser-1', sampledFps: 30,
  positions: Array.from({ length: 1000 }, (_, index) => ({ time: index / 100, x: 0.5, y: 0.5 })), cuts: [],
} });
const mountTracked = async () => {
  const document = trackedFixture();
  mockStored.set(videoDraftKey('user', 'org', 'session', media.fingerprint), serializeVideoDraft({ present: document, past: [], future: [] }));
  mockCloudGet.mockResolvedValue(record(document));
  const hook = mount(); await act(flush); return hook;
};
const annotate = (document: VideoDocument, index: number): VideoDocument => ({ ...document, contacts: [...document.contacts, {
  id: `annotation-${index}`, time: 1, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Em jogo',
}] });

test('fifty annotation edits retain one normalized track and the existing fifty-step undo/redo contract', async () => {
  const hook = await mountTracked();
  const positions = hook.result.current.doc!.analysis!.positions;
  for (let index = 0; index < 51; index++) {
    act(() => hook.result.current.change(annotate(hook.result.current.doc!, index), `Contato ${index}`));
  }
  const history = hook.result.current.history!;
  const documents = [history.present, ...history.past.flatMap(edit => [edit.before, edit.after])];
  expect(history.past).toHaveLength(50);
  expect(new Set(documents.map(document => document.analysis!.positions))).toEqual(new Set([positions]));
  expect(new Set(documents.flatMap(document => document.analysis!.positions)).size).toBe(1000);
  const final = JSON.stringify(history.present);
  for (let index = 0; index < 50; index++) act(() => hook.result.current.undo());
  expect(hook.result.current.doc!.contacts).toHaveLength(1);
  for (let index = 0; index < 50; index++) act(() => hook.result.current.undo(true));
  expect(JSON.stringify(hook.result.current.doc)).toBe(final); hook.unmount();
});

test('shared positions come from parsed state and never retain mutable input or replace new analysis metadata', async () => {
  const hook = await mountTracked();
  const positions = hook.result.current.doc!.analysis!.positions;
  const input = annotate({ ...hook.result.current.doc!, analysis: { ...hook.result.current.doc!.analysis!,
    model: 'vballnet-v4c-browser-1', cuts: [0.5], positions: positions.map(point => ({ ...point, ignoredInput: 'discard' })),
  } }, 1);
  act(() => hook.result.current.change(input, 'Anotação'));
  expect(hook.result.current.doc!.analysis!.positions).toBe(positions);
  expect(hook.result.current.doc!.analysis!.model).toBe('vballnet-v4c-browser-1');
  expect(hook.result.current.doc!.analysis!.cuts).toEqual([0.5]);
  expect(hook.result.current.doc!.analysis!.positions[0]).toEqual({ time: 0, x: 0.5, y: 0.5 });
  input.analysis!.positions[0].x = 0.9; input.analysis!.cuts.push(1); input.contacts[0].athlete = 'Mutação externa';
  expect(hook.result.current.doc!.analysis!.positions[0].x).toBe(0.5);
  expect(hook.result.current.doc!.analysis!.cuts).toEqual([0.5]); expect(hook.result.current.doc!.contacts[0].athlete).toBe('');
  hook.unmount();
});

test.each(['change', 'undo', 'redo'] as const)('the real hook.doc input alias cannot mutate present or undo snapshots after %s', async callback => {
  const hook = await mountTracked();
  // Same reference callers get from the public hook, deliberately not a clone.
  const input = annotate(hook.result.current.doc!, 1);
  const alias = input.analysis!.positions, point = alias[0];
  act(() => hook.result.current.change(input, 'Contato 1'));
  act(() => hook.result.current.change(annotate(hook.result.current.doc!, 2), 'Contato 2'));
  if (callback === 'undo' || callback === 'redo') act(() => hook.result.current.undo());
  if (callback === 'redo') act(() => hook.result.current.undo(true));
  const history = hook.result.current.history!;
  const documents = [history.present, ...[...history.past, ...history.future].flatMap(edit => [edit.before, edit.after])];
  const before = documents.map(document => JSON.stringify(document));
  expect(hook.result.current.doc!.analysis!.positions).toBe(alias);
  expect(Object.isFrozen(alias)).toBe(true); expect(alias.every(Object.isFrozen)).toBe(true);
  // Expo/Jest may compile assignment in non-strict mode: freezing must prevent
  // changes both when assignment throws and when it is silently ignored.
  for (const mutate of [() => { point.time = 0.001; }, () => { point.x = 0.9; }, () => { point.y = 0.9; },
    () => { alias[0] = { time: 0, x: 0.8, y: 0.8 }; }]) {
    try { mutate(); } catch (error) { expect(error).toBeInstanceOf(TypeError); }
  }
  expect(Reflect.set(point, 'x', 0.9)).toBe(false);
  expect(Reflect.set(alias, '0', { time: 0, x: 0.8, y: 0.8 })).toBe(false);
  expect(() => { alias.push({ time: 10, x: 0.5, y: 0.5 }); }).toThrow(TypeError);
  expect(() => { alias.splice(0, 1); }).toThrow(TypeError);
  expect(documents.map(document => JSON.stringify(document))).toEqual(before);
  // Normal immutable edits remain usable after undo/redo; they do not mutate the frozen track.
  act(() => hook.result.current.change(annotate(hook.result.current.doc!, 3), 'Contato 3'));
  expect(hook.result.current.doc!.analysis!.positions).toBe(alias);
  hook.unmount();
});

test.each(['time', 'x', 'y'] as const)('a real %s change keeps independent normalized snapshots and undo/redo values', async field => {
  const hook = await mountTracked();
  const old = hook.result.current.doc!, positions = old.analysis!.positions;
  const input = annotate({ ...old, analysis: { ...old.analysis!, positions: positions.map((point, index) => index ? { ...point } : {
    ...point, [field]: field === 'time' ? 0.001 : 0.7,
  }) } }, 1);
  act(() => hook.result.current.change(input, `Alteração ${field}`));
  const changed = hook.result.current.doc!.analysis!.positions;
  expect(changed).not.toBe(positions); expect(changed[0]).not.toBe(input.analysis!.positions[0]);
  expect(changed[0][field]).toBe(field === 'time' ? 0.001 : 0.7);
  input.analysis!.positions[0][field] = 0.9;
  expect(changed[0][field]).toBe(field === 'time' ? 0.001 : 0.7);
  act(() => hook.result.current.undo()); expect(hook.result.current.doc!.analysis!.positions).toBe(positions);
  act(() => hook.result.current.undo(true)); expect(hook.result.current.doc!.analysis!.positions).toBe(changed);
  hook.unmount();
});

test('a track length change is never shared and invalid tracking still fails parser validation', async () => {
  const hook = await mountTracked();
  const previous = hook.result.current.doc!;
  const next = annotate({ ...previous, analysis: { ...previous.analysis!, positions: previous.analysis!.positions.slice(0, -1) } }, 1);
  act(() => hook.result.current.change(next, 'Track menor'));
  expect(hook.result.current.doc!.analysis!.positions).not.toBe(previous.analysis!.positions);
  const valid = hook.result.current.doc;
  expect(() => hook.result.current.change({ ...next, analysis: { ...next.analysis!, positions: [{ time: 1, x: 2, y: 0.5 }] } }, 'Inválido')).toThrow();
  expect(hook.result.current.doc).toBe(valid); hook.unmount();
});
