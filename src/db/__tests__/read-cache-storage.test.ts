import * as nativeStorage from '../read-cache-storage';
import { getReadCacheItem, setReadCacheItem, removeReadCacheItem, clearReadCacheStorage } from '../read-cache-storage.web';

const mockLegacy = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => mockLegacy.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { mockLegacy.set(key, value); });
const mockRemove = jest.fn(async (key: string) => { mockLegacy.delete(key); });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (key: string) => mockGet(key), setItem: (key: string, value: string) => mockSet(key, value),
  removeItem: (key: string) => mockRemove(key),
} }));

type Request = { result: unknown; error: Error | null; onsuccess?: () => void; onerror?: () => void };
type Transaction = { error: Error | null; oncomplete?: () => void; onerror?: () => void; onabort?: () => void;
  complete: () => void; abort: jest.Mock; objectStore: () => unknown };
type OpenRequest = Request & { onblocked?: () => void; onupgradeneeded?: () => void; transaction: { abort: jest.Mock } };
const later = (callback: () => void) => { void Promise.resolve().then(callback); };

// Same event-controlled transaction boundary as the existing video draft tests.
// A successful request only stages changes; COMMIT applies them atomically.
function controlledIdb() {
  const records = new Map<string, unknown>(), transactions: Transaction[] = [], opens: OpenRequest[] = [];
  const state = { autoCommit: true, fail: '' as '' | 'read' | 'put' | 'delete' | 'clear',
    open: 'success' as 'success' | 'error' | 'blocked' | 'hang' | 'throw', upgrade: false };
  const connection = {
    close: jest.fn(), onversionchange: undefined as (() => void) | undefined, onclose: undefined as (() => void) | undefined,
    objectStoreNames: { contains: jest.fn(() => !state.upgrade) }, createObjectStore: jest.fn(),
    transaction: jest.fn(() => {
      let aborted = false, completed = false;
      const pending: (() => void)[] = [];
      const transaction: Transaction = {
        error: null,
        complete: () => { if (aborted || completed) return; completed = true; pending.forEach(apply => apply()); transaction.oncomplete?.(); },
        abort: jest.fn(() => { if (aborted || completed) return; aborted = true; later(() => transaction.onabort?.()); }),
        objectStore: () => {
          const request = (kind: typeof state.fail, key?: string, value?: unknown) => {
            const response: Request = { result: undefined, error: null };
            later(() => {
              if (aborted) return;
              if (state.fail === kind) { response.error = new Error(`${kind} failed`); response.onerror?.(); return; }
              if (kind === 'put') { pending.push(() => records.set(key!, value)); response.result = key; }
              else if (kind === 'delete') pending.push(() => { records.delete(key!); });
              else if (kind === 'clear') pending.push(() => records.clear());
              else response.result = records.has(key!) ? [records.get(key!)] : [];
              response.onsuccess?.(); if (state.autoCommit) later(transaction.complete);
            });
            return response;
          };
          return { getAll: (key: string) => request('read', key), put: (value: unknown, key: string) => request('put', key, value),
            delete: (key: string) => request('delete', key), clear: () => request('clear') };
        },
      };
      transactions.push(transaction); return transaction;
    }),
  };
  const factory = { open: jest.fn(() => {
    if (state.open === 'throw') throw new Error('IndexedDB unavailable');
    const request: OpenRequest = { result: connection, error: null, transaction: { abort: jest.fn() } };
    opens.push(request);
    later(() => {
      if (state.open === 'error') { request.error = new Error('Open failed'); request.onerror?.(); }
      else if (state.open === 'blocked') request.onblocked?.();
      else if (state.open === 'success') { if (state.upgrade) request.onupgradeneeded?.(); request.onsuccess?.(); }
    });
    return request;
  }) };
  return { records, transactions, state, connection, factory, opens };
}

const key = 'read-cache:v2:user-a:org-a:cache_students_v1';
const other = 'read-cache:v2:user-b:org-b:cache_students_v1';
const auth = 'supabase.auth.token', pending = 'pending_writes_v1';
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const flush = async () => { for (let step = 0; step < 30; step++) await Promise.resolve(); };
let idb: ReturnType<typeof controlledIdb>;
beforeEach(() => {
  idb?.connection.onversionchange?.(); idb = controlledIdb(); mockLegacy.clear(); jest.clearAllMocks();
  mockRemove.mockImplementation(async key => { mockLegacy.delete(key); });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: idb.factory });
});
afterEach(() => {
  idb.connection.onversionchange?.(); jest.useRealTimers();
  if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb); else Reflect.deleteProperty(globalThis, 'indexedDB');
});

test('native get/set/remove retain AsyncStorage and native clear is a no-op', async () => {
  await nativeStorage.setReadCacheItem(key, 'native'); expect(await nativeStorage.getReadCacheItem(key)).toBe('native');
  await nativeStorage.removeReadCacheItem(key); expect(mockLegacy.has(key)).toBe(false);
  mockGet.mockClear(); mockSet.mockClear(); mockRemove.mockClear(); await nativeStorage.clearReadCacheStorage();
  expect(mockGet).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(idb.factory.open).not.toHaveBeenCalled();
});

test('write resolves only after commit and then removes only the same legacy key', async () => {
  idb.records.set(key, 'old'); mockLegacy.set(key, 'legacy'); mockLegacy.set(auth, 'auth'); mockLegacy.set(pending, 'pending'); mockLegacy.set(other, 'other');
  idb.state.autoCommit = false; let resolved = false;
  const writing = setReadCacheItem(key, 'new').then(() => { resolved = true; });
  await flush(); expect(resolved).toBe(false); expect(idb.records.get(key)).toBe('old'); expect(mockRemove).not.toHaveBeenCalled();
  idb.transactions[0].complete(); await writing;
  expect(idb.records.get(key)).toBe('new'); expect(mockRemove).toHaveBeenCalledTimes(1); expect(mockRemove).toHaveBeenCalledWith(key);
  expect(mockLegacy.has(key)).toBe(false); expect(mockLegacy.get(auth)).toBe('auth'); expect(mockLegacy.get(pending)).toBe('pending'); expect(mockLegacy.get(other)).toBe('other');
  expect(mockSet).not.toHaveBeenCalled();
});

test('request success followed by abort rejects without overwriting IDB or removing legacy data', async () => {
  idb.records.set(key, 'old'); mockLegacy.set(key, 'legacy'); idb.state.autoCommit = false;
  const writing = setReadCacheItem(key, 'new'); const rejected = expect(writing).rejects.toThrow('cancelada');
  await flush(); idb.transactions[0].abort(); await rejected;
  expect(idb.records.get(key)).toBe('old'); expect(mockLegacy.get(key)).toBe('legacy'); expect(mockRemove).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});

test('transactional write failures propagate without falling back to AsyncStorage writes', async () => {
  idb.state.fail = 'put'; mockLegacy.set(key, 'legacy');
  await expect(setReadCacheItem(key, 'new')).rejects.toThrow('put failed');
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled(); expect(mockLegacy.get(key)).toBe('legacy');
  idb.state.fail = ''; await setReadCacheItem(key, 'retry'); expect(await getReadCacheItem(key)).toBe('retry');
});

test('an absent IDB key reads legacy without promoting, deleting or writing anything', async () => {
  mockLegacy.set(key, 'legacy'); expect(await getReadCacheItem(key)).toBe('legacy');
  expect(idb.records.has(key)).toBe(false); expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(idb.connection.transaction).toHaveBeenCalledWith('read-caches', 'readonly');
  expect(idb.factory.open).toHaveBeenCalledWith('goatleta-read-cache-v1', 1);
});

test.each(['current', ''])('a present IDB string %p is authoritative over an older legacy value', async value => {
  idb.records.set(key, value); mockLegacy.set(key, 'legacy');
  expect(await getReadCacheItem(key)).toBe(value); expect(mockGet).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});

test('a corrupt present IDB value never falls back to stale legacy data', async () => {
  idb.records.set(key, undefined); mockLegacy.set(key, 'legacy');
  await expect(getReadCacheItem(key)).rejects.toThrow('inválido'); expect(mockGet).not.toHaveBeenCalled();
});

test('a failed IDB read propagates and cannot revive legacy data', async () => {
  idb.state.fail = 'read'; mockLegacy.set(key, 'legacy');
  await expect(getReadCacheItem(key)).rejects.toThrow('read failed'); expect(mockGet).not.toHaveBeenCalled();
});

test('a successful read request waits for commit and rejects on later abort', async () => {
  idb.records.set(key, 'current'); mockLegacy.set(key, 'legacy'); idb.state.autoCommit = false;
  const reading = getReadCacheItem(key); const rejected = expect(reading).rejects.toThrow('cancelada');
  await flush(); idb.transactions[0].abort(); await rejected; expect(mockGet).not.toHaveBeenCalled();
});

test('failure of same-key legacy cleanup cannot undo a committed IDB write', async () => {
  mockRemove.mockRejectedValueOnce(new Error('Legacy denied'));
  await setReadCacheItem(key, 'committed'); expect(await getReadCacheItem(key)).toBe('committed'); expect(mockSet).not.toHaveBeenCalled();
});

test('delete waits for commit before removing only the matching legacy key', async () => {
  idb.records.set(key, 'current'); idb.records.set(other, 'other'); mockLegacy.set(key, 'legacy'); mockLegacy.set(auth, 'auth');
  idb.state.autoCommit = false;
  const removing = removeReadCacheItem(key); await flush(); expect(mockRemove).not.toHaveBeenCalled();
  idb.transactions[0].complete(); await removing;
  expect(idb.records.has(key)).toBe(false); expect(idb.records.get(other)).toBe('other');
  expect(mockRemove).toHaveBeenCalledWith(key); expect(mockLegacy.get(auth)).toBe('auth');
});

test('aborted delete preserves IDB and does not remove its legacy fallback', async () => {
  idb.records.set(key, 'current'); mockLegacy.set(key, 'legacy'); idb.state.autoCommit = false;
  const removing = removeReadCacheItem(key); const rejected = expect(removing).rejects.toThrow('cancelada');
  await flush(); idb.transactions[0].abort(); await rejected;
  expect(idb.records.get(key)).toBe('current'); expect(mockLegacy.get(key)).toBe('legacy'); expect(mockRemove).not.toHaveBeenCalled();
});

test('a failed legacy deletion propagates so successful removal is never falsely reported', async () => {
  mockLegacy.set(key, 'legacy'); mockRemove.mockRejectedValueOnce(new Error('Legacy denied'));
  await expect(removeReadCacheItem(key)).rejects.toThrow('Legacy denied'); expect(mockLegacy.get(key)).toBe('legacy');
});

test('clear commits only the read-cache store and leaves auth, pending writes and legacy cleanup to their owners', async () => {
  idb.records.set(key, 'current'); idb.records.set(other, 'other'); mockLegacy.set(key, 'legacy'); mockLegacy.set(auth, 'auth'); mockLegacy.set(pending, 'pending');
  idb.state.autoCommit = false;
  const clearing = clearReadCacheStorage(); await flush(); expect(idb.records.size).toBe(2);
  idb.transactions[0].complete(); await clearing;
  expect(idb.records.size).toBe(0); expect(idb.connection.transaction).toHaveBeenCalledWith('read-caches', 'readwrite');
  expect(mockLegacy.get(key)).toBe('legacy'); expect(mockLegacy.get(auth)).toBe('auth'); expect(mockLegacy.get(pending)).toBe('pending');
  expect(mockRemove).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});

test('clear failure propagates without clearing unrelated storage or claiming completion', async () => {
  idb.records.set(key, 'current'); idb.state.fail = 'clear'; mockLegacy.set(auth, 'auth');
  await expect(clearReadCacheStorage()).rejects.toThrow('clear failed');
  expect(idb.records.get(key)).toBe('current'); expect(mockLegacy.get(auth)).toBe('auth'); expect(mockRemove).not.toHaveBeenCalled();
});

test('missing IndexedDB permits legacy reads but web writes/removal/clear reject without localStorage writes', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined }); mockLegacy.set(key, 'legacy');
  expect(await getReadCacheItem(key)).toBe('legacy');
  await expect(setReadCacheItem(key, 'new')).rejects.toThrow('indisponível');
  await expect(removeReadCacheItem(key)).rejects.toThrow('indisponível'); await expect(clearReadCacheStorage()).rejects.toThrow('indisponível');
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
});

test.each(['error', 'blocked', 'throw'] as const)('open %s allows readonly legacy fallback, rejects writes and resets for a later recovery', async failure => {
  idb.state.open = failure; mockLegacy.set(key, 'legacy');
  expect(await getReadCacheItem(key)).toBe('legacy'); await expect(setReadCacheItem(key, 'new')).rejects.toThrow();
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  idb.state.open = 'success'; await setReadCacheItem(key, 'recovered'); expect(await getReadCacheItem(key)).toBe('recovered');
});

test('late success after a blocked open closes the obsolete connection', async () => {
  idb.state.open = 'blocked'; mockLegacy.set(key, 'legacy'); expect(await getReadCacheItem(key)).toBe('legacy');
  idb.opens[0].onsuccess?.(); expect(idb.connection.close).toHaveBeenCalledTimes(1);
});

test('late upgrade after blocked open aborts without creating a store, even if abort itself throws', async () => {
  idb.state.open = 'blocked'; expect(await getReadCacheItem(key)).toBeNull();
  idb.opens[0].transaction.abort.mockImplementation(() => { throw new Error('Already aborted'); });
  expect(() => idb.opens[0].onupgradeneeded?.()).not.toThrow(); expect(idb.connection.createObjectStore).not.toHaveBeenCalled();
});

test('a real upgrade failure propagates and does not read an older legacy value', async () => {
  idb.state.upgrade = true; idb.connection.createObjectStore.mockImplementationOnce(() => { throw new Error('Upgrade failed'); }); mockLegacy.set(key, 'legacy');
  await expect(getReadCacheItem(key)).rejects.toThrow('Upgrade failed'); expect(mockGet).not.toHaveBeenCalled();
  expect(idb.opens[0].transaction.abort).toHaveBeenCalled(); expect(idb.connection.close).toHaveBeenCalled();
});

test('open timeout reads legacy, closes a late connection, and can retry on a later call', async () => {
  jest.useFakeTimers(); idb.state.open = 'hang'; mockLegacy.set(key, 'legacy');
  const reading = getReadCacheItem(key); await flush(); await jest.advanceTimersByTimeAsync(10000);
  expect(await reading).toBe('legacy'); idb.opens[0].onsuccess?.(); expect(idb.connection.close).toHaveBeenCalledTimes(1);
  idb.state.open = 'success'; await setReadCacheItem(key, 'retry'); expect(await getReadCacheItem(key)).toBe('retry');
});

test('transaction timeout rejects and aborts instead of using stale legacy data', async () => {
  jest.useFakeTimers(); idb.state.autoCommit = false; mockLegacy.set(key, 'legacy');
  const reading = getReadCacheItem(key); const rejected = expect(reading).rejects.toThrow('Tempo esgotado');
  await flush(); await jest.advanceTimersByTimeAsync(10000); await rejected;
  expect(idb.transactions[0].abort).toHaveBeenCalled(); expect(mockGet).not.toHaveBeenCalled();
});

test('version changes release the connection and a later call opens a new one', async () => {
  await setReadCacheItem(key, 'first'); expect(idb.factory.open).toHaveBeenCalledTimes(1);
  idb.connection.onversionchange?.(); expect(idb.connection.close).toHaveBeenCalledTimes(1);
  expect(await getReadCacheItem(key)).toBe('first'); expect(idb.factory.open).toHaveBeenCalledTimes(2);
});
