import { act, renderHook } from '@testing-library/react-native';
import { useVideoDraft } from '../video/use-video-draft';
import { newVideoDocument, splitVideoRally, videoDraftKey, type VideoDocument } from '../../../core/scouting-video';
import { VideoDocumentSyncError, type VideoDocumentRecord, type VideoDocumentScope } from '../../../api/scouting-video-documents';

// Each device has independent browser storage. Only the simulated authorized RPC
// store is shared, reproducing desktop -> phone rather than reopening one cache.
const mockDevices = { desktop: new Map<string, string>(), phone: new Map<string, string>() };
let mockStorage = mockDevices.desktop;
let mockUser = 'user';
let mockGeneration = 1;
let mockSequence = 0;
const mockCloud = new Map<string, VideoDocumentRecord>();
const mockReceipts = new Map<string, VideoDocumentRecord>();
const mockGet = jest.fn();
const mockSave = jest.fn();
const mockSet = jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); });
jest.mock('../../../auth/session', () => ({
    getSessionIdentity: () => ({ userId: mockUser, generation: mockGeneration }),
    assertSessionIdentity: (identity: { userId: string; generation: number }) => {
        if (identity.userId !== mockUser || identity.generation !== mockGeneration) throw new Error('Session identity changed');
    },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
    getAllKeys: async () => [...mockStorage.keys()],
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: (...args: [string, string]) => mockSet(...args),
} }));
jest.mock('../../../api/scouting-video-documents', () => ({
    getScoutingVideoDocument: (...args: unknown[]) => mockGet(...args),
    saveScoutingVideoDocument: (...args: unknown[]) => mockSave(...args),
    VideoDocumentSyncError: class extends Error {
        code: string;
        constructor(code: string) { super(`Sync failure: ${code}`); this.code = code; }
    },
}));

const media = { fingerprint: 'original-file', duration: 20, width: 1280, height: 720, name: 'synthetic.mp4' };
const scope: VideoDocumentScope = { org: 'org', userId: 'user', sessionId: 'session' };
const key = (value: VideoDocumentScope, fingerprint: string) => JSON.stringify([value.org, value.sessionId, fingerprint]);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cloudGet = async (value: VideoDocumentScope, fingerprint?: string) => fingerprint === undefined
    ? clone([...mockCloud.values()].filter(row => row.organizationId === value.org && row.sessionId === value.sessionId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null)
    : clone(mockCloud.get(key(value, fingerprint)) ?? null);
const cloudSave = async (value: VideoDocumentScope, document: VideoDocument, expectedRevision: number, mutationId: string) => {
    const recordKey = key(value, document.media.fingerprint), receiptKey = `${recordKey}:${mutationId}`;
    const receipt = mockReceipts.get(receiptKey);
    if (receipt) return clone(receipt);
    const current = mockCloud.get(recordKey);
    if ((current?.revision ?? 0) !== expectedRevision) throw new VideoDocumentSyncError('conflict');
    const record: VideoDocumentRecord = { organizationId: value.org, sessionId: value.sessionId,
        fingerprint: document.media.fingerprint, revision: expectedRevision + 1, document: clone(document),
        updatedAt: new Date(Date.UTC(2026, 9, 16, 12, 0, ++mockSequence)).toISOString(), mutationId };
    mockCloud.set(recordKey, record); mockReceipts.set(receiptKey, record); return clone(record);
};
const annotated = (youtube = false): VideoDocument => {
    const source = youtube ? { ...media, fingerprint: 'youtube:M7lc1UVf-VE', youtubeId: 'M7lc1UVf-VE' } : media;
    const document = splitVideoRally(newVideoDocument(source, 'rally-one'), 8, 'rally-two');
    return { ...document, rallies: document.rallies.map((rally, i) => i ? { ...rally, winner: 'us', reviewed: true, pointTime: 17 } : rally),
        contacts: [{ id: 'contact', time: 10, skill: 'Ataque', team: 'us', athlete: 'Atleta', studentId: 'student', outcome: 'Ponto de ataque' }],
        corrections: [{ time: 6, x: 0.3, y: 0.7 }],
        analysis: { model: 'vballnet-v4c-browser-1', sampledFps: 30, positions: [{ time: 2, x: 0.4, y: 0.6 }], cuts: [8],
            ...(youtube ? { source: { ...media, offsetSeconds: 0 } } : {}) } };
};
const settle = async () => { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); }); };
const mount = async (writable = true) => {
    const hook = renderHook(() => useVideoDraft(scope.org, scope.userId, scope.sessionId, undefined, writable));
    await settle(); return hook;
};
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
};
const originalAddListener = Object.getOwnPropertyDescriptor(window, 'addEventListener');
const originalRemoveListener = Object.getOwnPropertyDescriptor(window, 'removeEventListener');
beforeAll(() => {
    Object.defineProperty(window, 'addEventListener', { configurable: true, value: jest.fn() });
    Object.defineProperty(window, 'removeEventListener', { configurable: true, value: jest.fn() });
});
afterAll(() => {
    if (originalAddListener) Object.defineProperty(window, 'addEventListener', originalAddListener);
    else Reflect.deleteProperty(window, 'addEventListener');
    if (originalRemoveListener) Object.defineProperty(window, 'removeEventListener', originalRemoveListener);
    else Reflect.deleteProperty(window, 'removeEventListener');
});
beforeEach(() => {
    jest.useFakeTimers(); mockDevices.desktop.clear(); mockDevices.phone.clear(); mockStorage = mockDevices.desktop;
    mockCloud.clear(); mockReceipts.clear(); mockSequence = 0; mockUser = 'user'; mockGeneration = 1;
    mockGet.mockReset().mockImplementation(cloudGet); mockSave.mockReset().mockImplementation(cloudSave); mockSet.mockClear();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test.each([false, true])('desktop annotations restore on a phone with no local cache (YouTube=%s)', async youtube => {
    const document = annotated(youtube);
    const desktop = await mount();
    await act(async () => { await desktop.result.current.open(document.media); });
    act(() => desktop.result.current.change(document, 'Análise revisada'));
    await act(async () => { expect(await desktop.result.current.save()).toBe(true); });
    expect(desktop.result.current.syncStatus).toBe('synced');
    const desktopData = mockDevices.desktop.get(videoDraftKey('user', 'org', 'session', document.media.fingerprint));
    expect(desktopData).toBeTruthy(); expect(mockDevices.phone.size).toBe(0); desktop.unmount();
    mockStorage = mockDevices.phone;
    const phone = await mount();
    expect(phone.result.current.doc).toEqual(document);
    expect(phone.result.current.syncStatus).toBe('synced'); expect(phone.result.current.dirty).toBe(false);
    expect(phone.result.current.history?.past).toEqual([]);
    // Reattaching the physical original must retain the canonical annotations.
    await act(async () => { await phone.result.current.open(document.media); });
    expect(phone.result.current.doc).toEqual(document);
    expect(mockDevices.phone.get(videoDraftKey('user', 'org', 'session', document.media.fingerprint))).toBeTruthy();
    expect(mockDevices.desktop.get(videoDraftKey('user', 'org', 'session', document.media.fingerprint))).toBe(desktopData);
    phone.unmount();
});

test('a phone legacy original cache selects its explicitly associated canonical YouTube analysis without rewriting the original draft', async () => {
    const youtube = annotated(true); const desktop = await mount();
    await act(async () => { await desktop.result.current.open(youtube.media); });
    act(() => desktop.result.current.change(youtube, 'YouTube revisado no computador'));
    await act(async () => { await desktop.result.current.save(); }); desktop.unmount();
    const originalKey = videoDraftKey('user', 'org', 'session', media.fingerprint);
    const legacyOriginal = JSON.stringify({ document: annotated(), past: [], savedAt: '2026-10-16T12:10:00.000Z' });
    mockDevices.phone.set(originalKey, legacyOriginal); mockStorage = mockDevices.phone; mockSet.mockClear();
    const previousUploads = mockSave.mock.calls.length; const phone = await mount();
    expect(phone.result.current.doc).toEqual(youtube); expect(phone.result.current.syncStatus).toBe('synced');
    expect(phone.result.current.conflict).toBeNull(); expect(phone.result.current.dirty).toBe(false);
    expect(mockDevices.phone.get(originalKey)).toBe(legacyOriginal);
    expect(mockSet.mock.calls.some(([storageKey]) => storageKey === originalKey)).toBe(false);
    expect(JSON.parse(mockDevices.phone.get(videoDraftKey('user', 'org', 'session', youtube.media.fingerprint))!).document).toEqual(youtube);
    await act(async () => { jest.advanceTimersByTime(800); await Promise.resolve(); });
    expect(mockSave).toHaveBeenCalledTimes(previousUploads); expect(mockDevices.phone.get(originalKey)).toBe(legacyOriginal); phone.unmount();
});

test('a canonical YouTube analysis with a different original fingerprint does not adopt an unrelated phone draft', async () => {
    const youtube = annotated(true);
    youtube.analysis!.source!.fingerprint = 'different-original'; await cloudSave(scope, youtube, 0, 'youtube-desktop');
    const original = annotated(); const originalKey = videoDraftKey('user', 'org', 'session', media.fingerprint);
    mockDevices.phone.set(originalKey, JSON.stringify({ document: original, past: [] })); mockStorage = mockDevices.phone;
    const phone = await mount();
    expect(phone.result.current.doc).toEqual(original); expect(phone.result.current.doc?.media.youtubeId).toBeUndefined();
    expect(phone.result.current.syncStatus).toBe('pending');
    expect(mockCloud.get(key(scope, youtube.media.fingerprint))?.document).toEqual(youtube);
    expect(mockCloud.has(key(scope, original.media.fingerprint))).toBe(false); expect(mockSave).not.toHaveBeenCalled(); phone.unmount();
});

test('an existing pre-sync browser draft uploads automatically and is then discoverable on another device', async () => {
    const document = annotated();
    mockDevices.desktop.set(videoDraftKey('user', 'org', 'session', media.fingerprint), JSON.stringify({ document, past: [] }));
    const desktop = await mount(); expect(desktop.result.current.doc).toEqual(document);
    expect(desktop.result.current.syncStatus).toBe('pending');
    await act(async () => { jest.advanceTimersByTime(800); for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(mockSave).toHaveBeenCalledTimes(1); expect(desktop.result.current.syncStatus).toBe('synced'); desktop.unmount();
    mockStorage = mockDevices.phone;
    const phone = await mount(); expect(phone.result.current.doc).toEqual(document); phone.unmount();
});

test.each(['remote', 'local'] as const)('divergent device edits require explicit %s choice and preserve both versions in a backup', async choice => {
    const baseline = annotated(); await cloudSave(scope, baseline, 0, 'initial');
    const desktop = await mount();
    const local = splitVideoRally(desktop.result.current.doc!, 4, 'desktop-cut');
    act(() => desktop.result.current.change(local, 'Corte no computador'));
    const remote = splitVideoRally(baseline, 6, 'phone-cut'); await cloudSave(scope, remote, 1, 'phone-edit');
    await act(async () => { await desktop.result.current.save(); });
    expect(desktop.result.current.syncStatus).toBe('conflict'); expect(desktop.result.current.doc).toEqual(local);
    expect(desktop.result.current.conflict?.remote.document).toEqual(remote);
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(remote);
    await act(async () => { expect(await desktop.result.current.resolveConflict(choice)).toBe(true); });
    const backupEntry = [...mockDevices.desktop.entries()].find(([storageKey]) => storageKey.startsWith('goatleta:scouting-video-backup:v1:'));
    expect(backupEntry).toBeTruthy();
    const backup = JSON.parse(backupEntry![1]); expect(backup.local).toEqual(local); expect(backup.remote.document).toEqual(remote);
    const selected = choice === 'local' ? local : remote;
    expect(desktop.result.current.doc).toEqual(selected); expect(desktop.result.current.syncStatus).toBe('synced');
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(selected); desktop.unmount();
});

test.each(['offline', 'missing-backend'] as const)('%s keeps the local draft recoverable and does not invent an empty remote baseline', async code => {
    const document = annotated(); const draftKey = videoDraftKey('user', 'org', 'session', media.fingerprint);
    mockDevices.desktop.set(draftKey, JSON.stringify({ document, past: [] }));
    mockGet.mockRejectedValue(new VideoDocumentSyncError(code));
    const hook = await mount();
    expect(hook.result.current.doc).toEqual(document); expect(hook.result.current.syncStatus).toBe(code === 'offline' ? 'offline' : 'unavailable');
    const next = splitVideoRally(document, 4, 'offline-cut'); act(() => hook.result.current.change(next, 'Corte offline'));
    await act(async () => { expect(await hook.result.current.save()).toBe(true); });
    expect(mockSave).not.toHaveBeenCalled(); expect(JSON.parse(mockDevices.desktop.get(draftKey)!).document).toEqual(next);
    mockGet.mockImplementation(cloudGet);
    await act(async () => { await hook.result.current.retrySync(); });
    expect(hook.result.current.syncStatus).toBe('synced'); expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(next);
    hook.unmount();
});

test('a lost POST acknowledgement is recovered by mutation receipt without another upload or lost annotations', async () => {
    const document = annotated(); await cloudSave(scope, document, 0, 'initial');
    const hook = await mount(); const changed = splitVideoRally(document, 4, 'new-cut');
    act(() => hook.result.current.change(changed, 'Corte novo'));
    mockSave.mockImplementationOnce(async (...args: Parameters<typeof cloudSave>) => {
        await cloudSave(...args); throw new VideoDocumentSyncError('offline');
    });
    await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.syncStatus).toBe('offline'); expect(mockCloud.get(key(scope, media.fingerprint))?.revision).toBe(2);
    const pending = JSON.parse(mockDevices.desktop.get(videoDraftKey('user', 'org', 'session', media.fingerprint))!).sync.pending;
    expect(pending.matchesCurrent).toBe(true); hook.unmount();
    const reopened = await mount(); expect(reopened.result.current.doc).toEqual(changed); expect(reopened.result.current.syncStatus).toBe('synced');
    await act(async () => { jest.advanceTimersByTime(800); await Promise.resolve(); });
    expect(mockSave).toHaveBeenCalledTimes(1); reopened.unmount();
});

test('a failed conflict backup blocks replacement and preserves the local and remote versions', async () => {
    const document = annotated(); await cloudSave(scope, document, 0, 'initial'); const hook = await mount();
    const local = splitVideoRally(document, 4, 'local-cut'); act(() => hook.result.current.change(local, 'Local'));
    const remote = splitVideoRally(document, 6, 'remote-cut'); await cloudSave(scope, remote, 1, 'remote-change');
    await act(async () => { await hook.result.current.save(); }); expect(hook.result.current.syncStatus).toBe('conflict');
    mockSet.mockRejectedValueOnce(new Error('quota'));
    await act(async () => { expect(await hook.result.current.resolveConflict('remote')).toBe(false); });
    expect(hook.result.current.doc).toEqual(local); expect(hook.result.current.conflict?.remote.document).toEqual(remote);
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(remote); hook.unmount();
});

test('an edit made while the first POST waits survives its acknowledgement and uploads as the next revision', async () => {
    const document = annotated(); await cloudSave(scope, document, 0, 'initial');
    const hook = await mount();
    const firstEdit = splitVideoRally(document, 4, 'first-cut'); act(() => hook.result.current.change(firstEdit, 'Primeiro corte'));
    const gate = deferred<VideoDocumentRecord>();
    mockSave.mockImplementationOnce(async (value: VideoDocumentScope, valueDocument: VideoDocument, revision: number, mutationId: string) => {
        const accepted = await cloudSave(value, valueDocument, revision, mutationId);
        await gate.promise; return accepted;
    });
    let saving!: Promise<boolean>;
    await act(async () => { saving = hook.result.current.save(); for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const secondEdit = splitVideoRally(firstEdit, 6, 'later-cut'); act(() => hook.result.current.change(secondEdit, 'Edição durante envio'));
    await act(async () => { gate.resolve(mockCloud.get(key(scope, media.fingerprint))!); await saving; });
    expect(hook.result.current.doc).toEqual(secondEdit); expect(hook.result.current.syncStatus).toBe('pending');
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(firstEdit);
    await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.syncStatus).toBe('synced');
    expect(mockCloud.get(key(scope, media.fingerprint))?.revision).toBe(3);
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(secondEdit); hook.unmount();
});

test('offline edits of a previously clean revision conflict after another device advances the cloud', async () => {
    const baseline = annotated(); await cloudSave(scope, baseline, 0, 'initial');
    const clean = await mount(); expect(clean.result.current.syncStatus).toBe('synced'); clean.unmount();
    mockGet.mockRejectedValue(new VideoDocumentSyncError('offline'));
    const offline = await mount(); expect(offline.result.current.doc).toEqual(baseline);
    const local = splitVideoRally(baseline, 4, 'offline-cut'); act(() => offline.result.current.change(local, 'Corte sem rede'));
    await act(async () => { await offline.result.current.save(); });
    expect(JSON.parse(mockDevices.desktop.get(videoDraftKey('user', 'org', 'session', media.fingerprint))!).document).toEqual(local);
    offline.unmount();
    const remote = splitVideoRally(baseline, 6, 'phone-cut'); await cloudSave(scope, remote, 1, 'phone-online');
    mockGet.mockImplementation(cloudGet);
    const reopened = await mount();
    expect(reopened.result.current.doc).toEqual(local); expect(reopened.result.current.syncStatus).toBe('conflict');
    expect(reopened.result.current.conflict?.remote.document).toEqual(remote);
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(remote); reopened.unmount();
});

test('switching source during an old POST releases saving state and allows the new source to autosave', async () => {
    const document = annotated(); await cloudSave(scope, document, 0, 'original'); const hook = await mount();
    const originalEdit = splitVideoRally(document, 4, 'original-cut'); act(() => hook.result.current.change(originalEdit, 'Original'));
    const gate = deferred<VideoDocumentRecord>();
    mockSave.mockImplementationOnce(async (...args: Parameters<typeof cloudSave>) => {
        const accepted = await cloudSave(...args); await gate.promise; return accepted;
    });
    let originalSave!: Promise<boolean>;
    await act(async () => { originalSave = hook.result.current.save(); for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(hook.result.current.saving).toBe(true); expect(mockSave).toHaveBeenCalledTimes(1);
    const youtube = annotated(true);
    await act(async () => { await hook.result.current.open(youtube.media); });
    expect(hook.result.current.saving).toBe(false);
    act(() => hook.result.current.change(youtube, 'Análise YouTube'));
    await act(async () => { gate.resolve(mockCloud.get(key(scope, media.fingerprint))!); await originalSave; });
    expect(hook.result.current.doc).toEqual(youtube); expect(hook.result.current.saving).toBe(false);
    await act(async () => { jest.advanceTimersByTime(800); for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(hook.result.current.syncStatus).toBe('synced'); expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockCloud.get(key(scope, youtube.media.fingerprint))?.document).toEqual(youtube);
    expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(originalEdit); hook.unmount();
});

test('a stale GET arriving after a newer POST acknowledgement cannot rewind data or create a false conflict', async () => {
    const document = annotated(); const stale = await cloudSave(scope, document, 0, 'initial'); const hook = await mount();
    const gate = deferred<VideoDocumentRecord | null>(); mockGet.mockImplementationOnce(() => gate.promise);
    let refresh!: Promise<boolean>;
    await act(async () => { refresh = hook.result.current.retrySync(); await Promise.resolve(); });
    const changed = splitVideoRally(document, 4, 'saved-while-get-pending'); act(() => hook.result.current.change(changed, 'Mais recente'));
    await act(async () => { await hook.result.current.save(); });
    expect(mockCloud.get(key(scope, media.fingerprint))?.revision).toBe(2); expect(hook.result.current.syncStatus).toBe('synced');
    await act(async () => { gate.resolve(stale); await refresh; });
    expect(hook.result.current.doc).toEqual(changed); expect(hook.result.current.conflict).toBeNull();
    expect(hook.result.current.syncStatus).toBe('synced'); expect(hook.result.current.saving).toBe(false);
    expect(mockSave).toHaveBeenCalledTimes(1); expect(mockCloud.get(key(scope, media.fingerprint))?.document).toEqual(changed);
    hook.unmount();
});

test('a corrupt cache entry for another video is preserved without blocking healthy cloud discovery', async () => {
    const brokenKey = videoDraftKey('user', 'org', 'session', 'unrelated-file');
    mockDevices.desktop.set(brokenKey, '{broken');
    const document = annotated(); await cloudSave(scope, document, 0, 'initial');
    const hook = await mount();
    expect(hook.result.current.doc).toEqual(document); expect(hook.result.current.syncStatus).toBe('synced');
    expect(hook.result.current.loading).toBe(false); expect(hook.result.current.error).toBe('');
    expect(mockDevices.desktop.get(brokenKey)).toBe('{broken'); expect(mockSave).not.toHaveBeenCalled(); hook.unmount();
});

test('a read-only shared preview never queries cloud drafts or writes either device storage', async () => {
    const document = annotated();
    const hook = renderHook(() => useVideoDraft('', '', '', document)); await settle();
    act(() => { hook.result.current.change(splitVideoRally(document, 4, 'forbidden'), 'Forbidden'); hook.result.current.undo(); });
    await act(async () => { await hook.result.current.open(media); expect(await hook.result.current.save()).toBe(false); expect(await hook.result.current.retrySync()).toBe(false); });
    expect(hook.result.current.doc).toEqual(document); expect(mockGet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled(); hook.unmount();
});

test('a completed session can restore its analysis while refusing direct edits and cloud writes', async () => {
    const document = annotated(); await cloudSave(scope, document, 0, 'initial');
    const hook = await mount(false); expect(hook.result.current.doc).toEqual(document);
    act(() => hook.result.current.change(splitVideoRally(document, 4, 'forbidden'), 'Forbidden'));
    await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.doc).toEqual(document); expect(mockSave).not.toHaveBeenCalled(); hook.unmount();
});

test('a late discovery response from another session cannot populate the newly selected analysis', async () => {
    const document = annotated(); const pending = deferred<VideoDocumentRecord | null>();
    const record = await cloudSave(scope, document, 0, 'initial');
    mockGet.mockImplementationOnce(() => pending.promise);
    const hook = renderHook(({ session }) => useVideoDraft('org', 'user', session), { initialProps: { session: 'session' } });
    await settle(); hook.rerender({ session: 'new-session' }); await settle();
    await act(async () => { pending.resolve(record); await Promise.resolve(); });
    expect(hook.result.current.doc).toBeNull(); expect(mockSet).not.toHaveBeenCalled(); hook.unmount();
});

test('an authentication generation change discards a late cloud read before writing local storage', async () => {
    const document = annotated(); const pending = deferred<VideoDocumentRecord | null>();
    const record = await cloudSave(scope, document, 0, 'initial'); mockGet.mockImplementationOnce(() => pending.promise);
    const hook = renderHook(() => useVideoDraft('org', 'user', 'session')); await settle(); mockGeneration++;
    await act(async () => { pending.resolve(record); await Promise.resolve(); });
    expect(hook.result.current.doc).toBeNull(); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); hook.unmount();
});
