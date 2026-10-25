import { act, renderHook } from '@testing-library/react-native';
import { useVideoDraft } from '../video/use-video-draft';
import { newVideoDocument, splitVideoRally, videoDraftKey } from '../../../core/scouting-video';
import * as videoSync from '../../../core/scouting-video-sync';
const mockStored = new Map<string, string>();
const mockSet = jest.fn(async (key: string, value: string) => { mockStored.set(key, value); });
const mockIdentity = jest.fn();
jest.mock('../../../db/client', () => ({ supabasePost: jest.fn() }));
jest.mock('../../../api/scouting-video-documents', () => {
  const actual = jest.requireActual('../../../api/scouting-video-documents');
  return { ...actual, getScoutingVideoDocument: jest.fn(async () => null),
    saveScoutingVideoDocument: jest.fn(async (scope, document, revision, mutationId) => ({
      organizationId: scope.org, sessionId: scope.sessionId, fingerprint: document.media.fingerprint,
      document, revision: revision + 1, updatedAt: new Date().toISOString(), mutationId,
    })) };
});
jest.mock('../../../auth/session', () => ({ getSessionIdentity: () => ({ userId: 'user', generation: 1 }), assertSessionIdentity: () => mockIdentity() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getAllKeys: async () => [...mockStored.keys()], getItem: async (key: string) => mockStored.get(key) ?? null, setItem: (...args: [string, string]) => mockSet(...args) } }));
const media = { fingerprint: 'file-a', duration: 20, width: 1202, height: 676, name: 'jogo.mp4' };
beforeEach(() => { mockStored.clear(); mockSet.mockClear(); mockIdentity.mockReset(); });
test('save and reopen retain cuts and contacts only in the exact user/org/session/video scope', async () => {
  const { result, unmount } = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await result.current.open(media); });
  act(() => result.current.change(splitVideoRally(result.current.doc!, 5, 'second'), 'Divisão'));
  expect(result.current.dirty).toBe(true);
  await act(async () => { expect(await result.current.save()).toBe(true); });
  expect(result.current.dirty).toBe(false); unmount();
  const reopened = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await reopened.result.current.open(media); });
  expect(reopened.result.current.doc?.rallies).toHaveLength(2);
  expect(reopened.result.current.history?.past[0].label).toBe('Divisão');
  act(() => reopened.result.current.undo());
  expect(reopened.result.current.doc?.rallies).toHaveLength(1);
  act(() => reopened.result.current.undo(true));
  expect(reopened.result.current.doc?.rallies).toHaveLength(2);
  const another = renderHook(() => useVideoDraft('another-org', 'user', 'session'));
  await act(async () => { await another.result.current.open(media); });
  expect(another.result.current.doc?.rallies).toHaveLength(1);
  expect(mockStored.has(videoDraftKey('user', 'org', 'session', 'file-a'))).toBe(true);
});
test('storage failure preserves the dirty document and a subsequent save can recover', async () => {
  const { result } = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await result.current.open(media); });
  act(() => result.current.change(splitVideoRally(result.current.doc!, 5, 'second'), 'Divisão'));
  mockSet.mockRejectedValueOnce(new Error('quota'));
  await act(async () => { expect(await result.current.save()).toBe(false); });
  expect(result.current.dirty).toBe(true); expect(result.current.doc?.rallies).toHaveLength(2);
  await act(async () => { expect(await result.current.save()).toBe(true); });
  expect(result.current.error).toBe('');
});

test('playback rerenders reuse the unchanged document signature while edits, undo and saves keep dirty accurate', async () => {
  const hook = renderHook(({ clock }: { clock: number }) => {
    void clock;
    return useVideoDraft('org', 'user', 'session');
  }, { initialProps: { clock: 0 } });
  await act(async () => { await hook.result.current.open(media); await hook.result.current.save(); });
  const document = hook.result.current.doc;
  const signature = jest.spyOn(videoSync, 'videoDocumentSignature');
  try {
    for (let clock = 1; clock <= 10; clock++) hook.rerender({ clock });
    expect(hook.result.current.doc).toBe(document);
    expect(hook.result.current.dirty).toBe(false);
    expect(signature).not.toHaveBeenCalled();

    act(() => hook.result.current.change(splitVideoRally(hook.result.current.doc!, 5, 'second'), 'Divisão'));
    expect(hook.result.current.dirty).toBe(true);
    act(() => hook.result.current.undo());
    expect(hook.result.current.dirty).toBe(false);
    act(() => hook.result.current.undo(true));
    expect(hook.result.current.dirty).toBe(true);
    await act(async () => { expect(await hook.result.current.save()).toBe(true); });
    expect(hook.result.current.dirty).toBe(false);

    signature.mockClear();
    for (let clock = 11; clock <= 20; clock++) hook.rerender({ clock });
    expect(hook.result.current.dirty).toBe(false);
    expect(signature).not.toHaveBeenCalled();
  } finally { signature.mockRestore(); hook.unmount(); }
});
test('changed authentication refuses a save before writing storage', async () => {
  const { result } = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await result.current.open(media); });
  mockIdentity.mockImplementation(() => { throw new Error('session changed'); });
  await act(async () => { expect(await result.current.save()).toBe(false); });
  expect(mockSet).not.toHaveBeenCalled();
});
test('corrupt saved data is reported, never silently replaced with an empty draft', async () => {
  mockStored.set(videoDraftKey('user', 'org', 'session', 'file-a'), '{broken');
  const { result } = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await expect(result.current.open(media)).rejects.toThrow(); });
  expect(result.current.doc).toBeNull(); expect(mockSet).not.toHaveBeenCalled();
});

test('shared studio never opens local drafts or persists edits, including direct mutation calls', async () => {
  const snapshot = newVideoDocument(media, 'shared-rally');
  const { result, rerender } = renderHook(({ document }) => useVideoDraft('', '', '', document), { initialProps: { document: snapshot } });
  act(() => { result.current.change(splitVideoRally(snapshot, 4, 'forbidden'), 'Edit'); result.current.undo(); });
  await act(async () => { await result.current.open({ ...media, fingerprint: 'other' }); expect(await result.current.save()).toBe(false); });
  expect(result.current.doc).toEqual(snapshot);
  expect(result.current.dirty).toBe(false);
  expect(mockSet).not.toHaveBeenCalled(); expect(mockIdentity).not.toHaveBeenCalled();
  const refreshed = splitVideoRally(snapshot, 6, 'published-later');
  rerender({ document: refreshed });
  expect(result.current.doc).toEqual(refreshed);
  expect(result.current.history?.past).toEqual([]);
});

test('YouTube and local drafts remain independent across source changes', async () => {
  const { result } = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await result.current.open(media); });
  act(() => result.current.change(splitVideoRally(result.current.doc!, 5, 'local-cut'), 'Local'));
  await act(async () => { await result.current.save(); });
  const youtube = { ...media, youtubeId: 'M7lc1UVf-VE', fingerprint: 'youtube:M7lc1UVf-VE' };
  await act(async () => { await result.current.open(youtube); });
  expect(result.current.doc?.rallies).toHaveLength(1);
  act(() => result.current.change(splitVideoRally(result.current.doc!, 8, 'youtube-cut'), 'YouTube'));
  await act(async () => { await result.current.save(); await result.current.open(media); });
  expect(result.current.doc?.rallies[1].id).toBe('local-cut');
  await act(async () => { await result.current.open(youtube); });
  expect(result.current.doc?.media.youtubeId).toBe('M7lc1UVf-VE');
  expect(result.current.doc?.rallies[1].id).toBe('youtube-cut');
});

 test('reopening a session automatically restores its saved video and contacts', async () => {
  const document = newVideoDocument({ ...media, youtubeId: 'M7lc1UVf-VE', fingerprint: 'youtube:M7lc1UVf-VE' }, 'rally');
  mockStored.set(videoDraftKey('user', 'org', 'session', document.media.fingerprint), JSON.stringify({ document, past: [] }));
  const reopened = renderHook(() => useVideoDraft('org', 'user', 'session'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(reopened.result.current.doc).toEqual(document);
  expect(reopened.result.current.dirty).toBe(false);
});
