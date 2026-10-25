import AsyncStorage from '@react-native-async-storage/async-storage';

const DATABASE = 'goatleta-read-cache-v1';
const STORE = 'read-caches';
const STORAGE_TIMEOUT_MS = 10000;
let database: Promise<IDBDatabase> | null = null;

class ReadCacheStorageUnavailableError extends Error {}

function openReadCacheDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const unavailable = (message: string) => fail(new ReadCacheStorageUnavailableError(message));
    const fail = (error: unknown) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(error); }
    };
    const timer = setTimeout(() => unavailable('Tempo esgotado ao abrir o cache de leitura.'), STORAGE_TIMEOUT_MS);
    try {
      if (!globalThis.indexedDB) { unavailable('Cache IndexedDB indisponível.'); return; }
      const request = globalThis.indexedDB.open(DATABASE, 1);
      request.onerror = () => unavailable('Não foi possível abrir o cache IndexedDB.');
      request.onblocked = () => unavailable('Cache IndexedDB bloqueado.');
      request.onupgradeneeded = () => {
        const abortUpgrade = () => { try { request.transaction?.abort(); } catch { /* Already aborted or completed. */ } };
        if (settled) { abortUpgrade(); return; }
        try { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }
        catch (error) { abortUpgrade(); fail(error); }
      };
      request.onsuccess = () => {
        const connection = request.result;
        if (settled) { connection.close(); return; }
        settled = true; clearTimeout(timer);
        const release = () => { connection.close(); if (database === opening) database = null; };
        connection.onversionchange = release;
        connection.onclose = () => { if (database === opening) database = null; };
        resolve(connection);
      };
    } catch { unavailable('Cache IndexedDB indisponível.'); }
  });
  database = opening;
  void opening.catch(() => { if (database === opening) database = null; });
  return opening;
}

async function cacheTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const connection = await openReadCacheDatabase();
  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction | undefined, settled = false, succeeded = false, result: T;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      try { transaction?.abort(); } catch { /* A transaction may already have finished. */ }
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error('Tempo esgotado na transação do cache de leitura.')), STORAGE_TIMEOUT_MS);
    try {
      transaction = connection.transaction(STORE, mode);
      transaction.onerror = () => fail(transaction?.error ?? new Error('Falha na transação do cache de leitura.'));
      transaction.onabort = () => fail(transaction?.error ?? new Error('Transação do cache de leitura cancelada.'));
      transaction.oncomplete = () => {
        if (settled) return;
        if (!succeeded) { fail(new Error('Transação do cache de leitura incompleta.')); return; }
        settled = true; clearTimeout(timer); resolve(result);
      };
      const request = operation(transaction.objectStore(STORE));
      request.onsuccess = () => { result = request.result; succeeded = true; };
      request.onerror = () => fail(request.error ?? new Error('Falha no cache de leitura.'));
    } catch (error) { fail(error); }
  });
}

/** Legacy reads never promote data or write localStorage, including on open failure. */
export async function getReadCacheItem(key: string): Promise<string | null> {
  let values: unknown[];
  try { values = await cacheTransaction('readonly', store => store.getAll(key, 1)); }
  catch (error) {
    if (error instanceof ReadCacheStorageUnavailableError) return AsyncStorage.getItem(key);
    throw error;
  }
  if (!values.length) return AsyncStorage.getItem(key);
  if (typeof values[0] !== 'string') throw new Error('Valor inválido no cache de leitura.');
  return values[0];
}

/** New web cache writes require IDB commit; they never fall back to localStorage. */
export async function setReadCacheItem(key: string, value: string): Promise<void> {
  await cacheTransaction('readwrite', store => store.put(value, key));
  // The committed IDB value is authoritative even if legacy cleanup is unavailable.
  try { await AsyncStorage.removeItem(key); } catch { /* Best-effort same-key cleanup only. */ }
}

export async function removeReadCacheItem(key: string): Promise<void> {
  await cacheTransaction('readwrite', store => store.delete(key));
  // A successful removal must not allow an older legacy value to reappear.
  await AsyncStorage.removeItem(key);
}

/** Only this adapter's store is cleared. client.ts clears legacy cache prefixes independently. */
export async function clearReadCacheStorage(): Promise<void> {
  await cacheTransaction('readwrite', store => store.clear());
}
