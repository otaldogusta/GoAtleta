import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { getVideoDraft, getVideoDraftKeys, parseStoredVideoDraft, persistVideoDraft, serializeVideoDraft } from '../video/video-draft-storage';
import { useVideoDraft } from '../video/use-video-draft';
import { newVideoDocument, splitVideoRally, videoDraftKey } from '../../../core/scouting-video';

const mockLegacy = new Map<string, string>();
const mockLegacyGet = jest.fn(async (key: string) => mockLegacy.get(key) ?? null);
const mockLegacyKeys = jest.fn(async () => [...mockLegacy.keys()]);
const mockLegacySet = jest.fn(async (key: string, value: string) => { mockLegacy.set(key, value); });
let mockUser = 'user', mockGeneration = 1;
const mockCloudGet = jest.fn(async () => null);
const mockCloudSave = jest.fn(async (scope, document, revision, mutationId) => ({
    organizationId: scope.org, sessionId: scope.sessionId, fingerprint: document.media.fingerprint,
    document, revision: revision + 1, updatedAt: '2026-10-24T12:00:00.000Z', mutationId,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
    getItem: (...args: [string]) => mockLegacyGet(...args), getAllKeys: () => mockLegacyKeys(),
    setItem: (...args: [string, string]) => mockLegacySet(...args),
} }));
jest.mock('../../../auth/session', () => ({
    getSessionIdentity: () => ({ userId: mockUser, generation: mockGeneration }),
    assertSessionIdentity: (identity: { userId: string; generation: number }) => {
        if (identity.userId !== mockUser || identity.generation !== mockGeneration) throw new Error('Session identity changed');
    },
}));
jest.mock('../../../api/scouting-video-documents', () => ({
    getScoutingVideoDocument: (...args: unknown[]) => mockCloudGet(...args),
    saveScoutingVideoDocument: (...args: unknown[]) => mockCloudSave(...args),
    VideoDocumentSyncError: class extends Error {},
}));

// Event-controlled IDB boundary, not a replacement parser or hook. Successful
// requests do not commit: only complete() exposes writes, abort preserves old data.
type Request = { result: unknown; error: Error | null; onsuccess?: () => void; onerror?: () => void };
type Transaction = {
    error: Error | null; oncomplete?: () => void; onabort?: () => void; onerror?: () => void;
    complete: () => void; abort: jest.Mock; objectStore: () => unknown;
};
function controlledIdb() {
    const records = new Map<string, unknown>(), transactions: Transaction[] = [];
    const state = { autoCommit: true, fail: '' as '' | 'read' | 'keys' | 'put', open: 'success' as 'success' | 'blocked' | 'error' | 'hang' | 'throw' };
    const connection = {
        close: jest.fn(), onversionchange: undefined as (() => void) | undefined, onclose: undefined as (() => void) | undefined,
        objectStoreNames: { contains: () => true }, createObjectStore: jest.fn(),
        transaction: jest.fn(() => {
            let aborted = false, completed = false;
            const pending: [string, unknown][] = [];
            const transaction: Transaction = {
                error: null,
                complete: () => {
                    if (aborted || completed) return;
                    completed = true; pending.forEach(([key, value]) => records.set(key, value)); transaction.oncomplete?.();
                },
                abort: jest.fn(() => { if (completed || aborted) return; aborted = true; queueMicrotask(() => transaction.onabort?.()); }),
                objectStore: () => {
                    const request = (kind: 'read' | 'keys' | 'put', key?: string, value?: unknown) => {
                        const response: Request = { result: undefined, error: null };
                        queueMicrotask(() => {
                            if (aborted) return;
                            if (state.fail === kind) {
                                response.error = new Error(kind === 'put' ? 'QuotaExceededError' : 'IDB read failed');
                                response.onerror?.(); return;
                            }
                            if (kind === 'put') { pending.push([key!, value]); response.result = key; }
                            else response.result = kind === 'keys' ? [...records.keys()] : records.has(key!) ? [records.get(key!)] : [];
                            response.onsuccess?.();
                            if (state.autoCommit) queueMicrotask(transaction.complete);
                        });
                        return response;
                    };
                    return { getAll: (key: string) => request('read', key), getAllKeys: () => request('keys'), put: (value: unknown, key: string) => request('put', key, value) };
                },
            };
            transactions.push(transaction); return transaction;
        }),
    };
    const opens: (Request & { onblocked?: () => void; onupgradeneeded?: () => void; transaction?: { abort: jest.Mock } })[] = [];
    const factory = { open: jest.fn(() => {
        if (state.open === 'throw') throw new Error('IDB unavailable');
        const response = { result: connection, error: null as Error | null, transaction: { abort: jest.fn() } } as (typeof opens)[number];
        opens.push(response);
        queueMicrotask(() => {
            if (state.open === 'blocked') response.onblocked?.();
            else if (state.open === 'error') { response.error = new Error('IDB open failed'); response.onerror?.(); }
            else if (state.open === 'success') response.onsuccess?.();
        });
        return response;
    }) };
    return { records, transactions, state, connection, factory, opens };
}
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const media = { fingerprint: 'file', name: 'FICTICIO.mp4', duration: 10, width: 960, height: 540 };
const key = videoDraftKey('user', 'org', 'session', media.fingerprint);
const prefix = videoDraftKey('user', 'org', 'session', '_').slice(0, -1);
const flush = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
let idb: ReturnType<typeof controlledIdb>;
beforeEach(() => {
    idb?.connection.onversionchange?.();
    idb = controlledIdb();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: idb.factory });
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockLegacy.clear(); mockLegacyGet.mockClear(); mockLegacyKeys.mockClear();
    mockLegacySet.mockReset().mockImplementation(async (key: string, value: string) => { mockLegacy.set(key, value); });
    mockCloudGet.mockClear(); mockCloudSave.mockClear(); mockUser = 'user'; mockGeneration = 1;
});
afterEach(() => {
    idb.connection.onversionchange?.(); jest.useRealTimers();
    if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
    Object.defineProperty(Platform, 'OS', originalPlatform);
});

test('complete current tracking saves and reopens in IDB while legacy localStorage writes are unavailable', async () => {
    mockLegacySet.mockRejectedValue(new Error('QuotaExceededError'));
    const document = { ...newVideoDocument(media, 'rally'), analysis: { model: 'vballnet-v2b-browser-1' as const, sampledFps: 30 as const,
        cuts: [], positions: Array.from({ length: 45000 }, (_, i) => ({ time: i / 5000, x: 0.123456789, y: 0.987654321 })) } };
    const data = serializeVideoDraft({ present: document, past: [], future: [] }, { revision: 1, dirty: true });
    expect(data.length).toBeGreaterThan(1500000);
    await persistVideoDraft(key, data);
    idb.connection.onversionchange?.();
    expect(parseStoredVideoDraft((await getVideoDraft(key))!, media).history.present).toEqual(document);
    expect(mockLegacySet).not.toHaveBeenCalled();
});

test('a successful request followed by transaction abort rejects and preserves the previous committed snapshot', async () => {
    idb.records.set(key, 'previous'); idb.state.autoCommit = false;
    let done = false;
    const saving = persistVideoDraft(key, 'new').then(() => { done = true; });
    const failed = expect(saving).rejects.toThrow('cancelada');
    await flush(); expect(done).toBe(false); expect(idb.records.get(key)).toBe('previous');
    idb.transactions.at(-1)!.abort(); await failed;
    expect(idb.records.get(key)).toBe('previous'); expect(mockLegacySet).not.toHaveBeenCalled();
});

test('read request success also waits for completion and cannot return after an abort', async () => {
    idb.records.set(key, 'current'); idb.state.autoCommit = false;
    const failed = expect(getVideoDraft(key)).rejects.toThrow('cancelada');
    await flush(); idb.transactions.at(-1)!.abort(); await failed;
    expect(mockLegacyGet).not.toHaveBeenCalled();
});

test('only an absent IDB key can fall back to the same legacy key', async () => {
    mockLegacy.set(key, 'legacy'); expect(await getVideoDraft(key)).toBe('legacy');
    idb.records.set(key, 'newer'); mockLegacyGet.mockClear();
    expect(await getVideoDraft(key)).toBe('newer'); expect(mockLegacyGet).not.toHaveBeenCalled();
    expect(mockLegacy.get(key)).toBe('legacy');
});

test.each(['', undefined, null, 42])('a present corrupt IDB value %p never revives a legacy draft', async value => {
    mockLegacy.set(key, 'old'); idb.records.set(key, value);
    await expect(getVideoDraft(key)).rejects.toThrow('inválido'); expect(mockLegacyGet).not.toHaveBeenCalled();
    expect(mockLegacy.get(key)).toBe('old'); expect(idb.records.has(key)).toBe(true);
});

test.each(['read', 'keys'] as const)('IDB %s failure propagates without consulting older legacy data', async failure => {
    mockLegacy.set(key, 'legacy'); idb.state.fail = failure;
    await expect(failure === 'read' ? getVideoDraft(key) : getVideoDraftKeys(prefix)).rejects.toThrow('IDB read failed');
    expect(mockLegacyGet).not.toHaveBeenCalled(); expect(mockLegacyKeys).not.toHaveBeenCalled();
});

test('listing unions and deduplicates only this user/org/session across IDB and untouched legacy keys', async () => {
    const otherOrg = videoDraftKey('user', 'other', 'session', 'file'), otherUser = videoDraftKey('other', 'org', 'session', 'file');
    const otherSession = videoDraftKey('user', 'org', 'other', 'file'), legacyOnly = `${prefix}older`;
    [key, otherOrg, otherUser, otherSession].forEach(value => idb.records.set(value, 'record'));
    [key, legacyOnly, otherUser, 'auth_session_v1'].forEach(value => mockLegacy.set(value, 'legacy'));
    expect(await getVideoDraftKeys(prefix)).toEqual([key, legacyOnly]);
    expect(idb.records.size).toBe(4); expect(mockLegacy.size).toBe(4);
});

test('same-key writes queue through commit and retry after quota without poisoning the queue', async () => {
    idb.state.autoCommit = false;
    const first = persistVideoDraft(key, 'first'), next = persistVideoDraft(key, 'next');
    await flush(); expect(idb.transactions).toHaveLength(1);
    idb.transactions[0].complete(); await first; await flush();
    expect(idb.records.get(key)).toBe('first'); expect(idb.transactions).toHaveLength(2);
    idb.state.autoCommit = true; idb.transactions[1].complete(); await next;
    idb.state.fail = 'put'; await expect(persistVideoDraft(key, 'failed')).rejects.toThrow('QuotaExceededError');
    expect(idb.records.get(key)).toBe('next'); idb.state.fail = '';
    await persistVideoDraft(key, 'recovered'); expect(idb.records.get(key)).toBe('recovered');
});

test('conflict backups use the same durable store without replacing either version', async () => {
    const backup = 'goatleta:scouting-video-backup:v1:user:org:session:mutation';
    idb.records.set(key, 'local'); const versions = JSON.stringify({ local: 'local', remote: 'remote' });
    await persistVideoDraft(backup, versions);
    expect(idb.records.get(backup)).toBe(versions); expect(idb.records.get(key)).toBe('local');
    expect(mockLegacySet).not.toHaveBeenCalled();
});

test.each(['blocked', 'error', 'throw'] as const)('opening %s rejects and the next attempt can recover', async state => {
    idb.state.open = state;
    await expect(persistVideoDraft(key, 'blocked')).rejects.toThrow();
    expect(mockLegacySet).not.toHaveBeenCalled(); idb.state.open = 'success';
    await persistVideoDraft(key, 'recovered'); expect(idb.records.get(key)).toBe('recovered');
});

test('blocked open arriving late closes its connection and cannot create a store after failure', async () => {
    idb.state.open = 'blocked'; await expect(getVideoDraft(key)).rejects.toThrow('bloqueado');
    idb.opens[0].onupgradeneeded?.(); expect(idb.opens[0].transaction!.abort).toHaveBeenCalled();
    idb.opens[0].onsuccess?.(); expect(idb.connection.close).toHaveBeenCalled(); expect(mockLegacyGet).not.toHaveBeenCalled();
});

test('a failed schema creation still rejects its original error when abort also throws', async () => {
    idb.state.open = 'hang'; idb.connection.objectStoreNames.contains = () => false;
    idb.connection.createObjectStore.mockImplementation(() => { throw new Error('Schema quota failure'); });
    const failed = expect(persistVideoDraft(key, 'new')).rejects.toThrow('Schema quota failure'); await flush();
    idb.opens[0].transaction!.abort.mockImplementation(() => { throw new Error('Already aborted'); });
    expect(() => idb.opens[0].onupgradeneeded?.()).not.toThrow(); await failed;
    idb.opens[0].onsuccess?.(); expect(idb.connection.close).toHaveBeenCalled();
    expect(mockLegacySet).not.toHaveBeenCalled();
});

test.each(['open', 'transaction'] as const)('a stalled %s times out instead of hanging or publishing stale data', async stalled => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    if (stalled === 'open') idb.state.open = 'hang'; else idb.state.autoCommit = false;
    const failed = expect(getVideoDraft(key)).rejects.toThrow('Tempo esgotado'); await flush();
    jest.advanceTimersByTime(10000); await failed; expect(mockLegacyGet).not.toHaveBeenCalled();
    if (stalled === 'transaction') expect(idb.transactions[0].abort).toHaveBeenCalled();
    else { idb.opens[0].onsuccess?.(); expect(idb.connection.close).toHaveBeenCalled(); }
});

test('native keeps the same AsyncStorage behavior and never opens IDB', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    await persistVideoDraft(key, 'native');
    expect(await getVideoDraft(key)).toBe('native'); expect(await getVideoDraftKeys(prefix)).toEqual([key]);
    expect(mockLegacySet).toHaveBeenCalledWith(key, 'native'); expect(idb.factory.open).not.toHaveBeenCalled();
});

test('IDB boot read failure stops cloud discovery and preserves the old legacy draft', async () => {
    const old = serializeVideoDraft({ present: newVideoDocument(media, 'old'), past: [], future: [] });
    mockLegacy.set(key, old); idb.state.fail = 'keys';
    const hook = renderHook(() => useVideoDraft('org', 'user', 'session')); await act(flush);
    expect(hook.result.current.syncStatus).toBe('error'); expect(hook.result.current.doc).toBeNull();
    expect(mockCloudGet).not.toHaveBeenCalled(); expect(mockCloudSave).not.toHaveBeenCalled();
    expect(mockLegacy.get(key)).toBe(old); expect(idb.records.size).toBe(0); hook.unmount();
});

test('no cloud mutation or clean confirmation precedes durable current and pending-intent commits', async () => {
    const hook = renderHook(() => useVideoDraft('org', 'user', 'session')); await act(flush);
    await act(async () => { await hook.result.current.open(media); });
    act(() => hook.result.current.change(splitVideoRally(hook.result.current.doc!, 3, 'new'), 'FICTICIO'));
    idb.state.autoCommit = false; let saving!: Promise<boolean>;
    await act(async () => { saving = hook.result.current.save(); await flush(); });
    expect(hook.result.current.dirty).toBe(true); expect(mockCloudSave).not.toHaveBeenCalled();
    await act(async () => { idb.transactions.at(-1)!.complete(); await flush(); });
    expect(mockCloudSave).not.toHaveBeenCalled();
    await act(async () => { idb.state.autoCommit = true; idb.transactions.at(-1)!.complete(); expect(await saving).toBe(true); });
    expect(mockCloudSave).toHaveBeenCalledTimes(1); expect(hook.result.current.dirty).toBe(false);
    expect(hook.result.current.syncStatus).toBe('synced'); hook.unmount();
});

test('storage failure stops autosave retries, retains the dirty document, and manual retry recovers', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const hook = renderHook(() => useVideoDraft('org', 'user', 'session')); await act(flush);
    await act(async () => { await hook.result.current.open(media); });
    const changed = splitVideoRally(hook.result.current.doc!, 3, 'new');
    act(() => hook.result.current.change(changed, 'FICTICIO')); idb.state.fail = 'put';
    await act(async () => { jest.advanceTimersByTime(800); await flush(); });
    expect(hook.result.current.syncStatus).toBe('error'); expect(hook.result.current.dirty).toBe(true);
    const attempts = idb.connection.transaction.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(8000); await flush(); });
    expect(idb.connection.transaction).toHaveBeenCalledTimes(attempts); expect(mockCloudSave).not.toHaveBeenCalled();
    expect(hook.result.current.doc).toEqual(changed); expect(mockLegacySet).not.toHaveBeenCalled();
    idb.state.fail = '';
    await act(async () => { expect(await hook.result.current.save()).toBe(true); });
    expect(hook.result.current.syncStatus).toBe('synced'); expect(hook.result.current.dirty).toBe(false);
    expect(parseStoredVideoDraft(idb.records.get(key) as string).history.present).toEqual(changed); hook.unmount();
});

test('logout during a held commit preserves the captured-key draft but cannot save or publish for another identity', async () => {
    const hook = renderHook(() => useVideoDraft('org', 'user', 'session')); await act(flush);
    await act(async () => { await hook.result.current.open(media); });
    const changed = splitVideoRally(hook.result.current.doc!, 3, 'new'); act(() => hook.result.current.change(changed, 'FICTICIO'));
    idb.state.autoCommit = false; let saving!: Promise<boolean>;
    await act(async () => { saving = hook.result.current.save(); await flush(); });
    mockUser = 'other'; mockGeneration++;
    await act(async () => { idb.transactions.at(-1)!.complete(); expect(await saving).toBe(false); });
    expect(mockCloudSave).not.toHaveBeenCalled(); expect(hook.result.current.dirty).toBe(true);
    expect(parseStoredVideoDraft(idb.records.get(key) as string).history.present).toEqual(changed);
    expect(idb.records.has(videoDraftKey('other', 'org', 'session', 'file'))).toBe(false); hook.unmount();
});
