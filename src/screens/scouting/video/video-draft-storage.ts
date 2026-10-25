import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { parseVideoDocument, type VideoHistory, type VideoMedia } from '../../../core/scouting-video';

export type VideoDraftSync = {
    revision: number;
    dirty: boolean;
    pending?: { id: string; expectedRevision: number; matchesCurrent: boolean };
};
export type StoredVideoDraft = { history: VideoHistory; savedAt: string; sync?: VideoDraftSync };

export function parseStoredVideoDraft(raw: string, media?: VideoMedia): StoredVideoDraft {
    const stored = JSON.parse(raw);
    const document = parseVideoDocument(stored.document ?? stored, media);
    if (stored.past != null && (!Array.isArray(stored.past) || stored.past.length > 20)) throw new Error('Histórico local inválido.');
    const past = (stored.past ?? []).map((entry: VideoHistory['past'][number]) => {
        if (typeof entry.label !== 'string' || typeof entry.at !== 'string') throw new Error('Histórico local inválido.');
        return { label: entry.label.slice(0, 120), at: entry.at,
            before: parseVideoDocument(entry.before, document.media), after: parseVideoDocument(entry.after, document.media) };
    });
    const sync = stored.sync as VideoDraftSync | undefined;
    if (sync && (!Number.isSafeInteger(sync.revision) || sync.revision < 0 || typeof sync.dirty !== 'boolean' ||
        (sync.pending && (typeof sync.pending.id !== 'string' || !sync.pending.id || sync.pending.id.length > 128 ||
            !Number.isSafeInteger(sync.pending.expectedRevision) || sync.pending.expectedRevision < 0 || typeof sync.pending.matchesCurrent !== 'boolean'))))
        throw new Error('Sincronização local inválida.');
    return { history: { present: document, past, future: [] }, savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : '', sync };
}

/** Keep one full current document; cloud baselines/receipts never duplicate tracking. */
export function serializeVideoDraft(history: VideoHistory, sync?: VideoDraftSync): string {
    const savedAt = new Date().toISOString();
    const head = `{"document":${JSON.stringify(history.present)},"past":[`;
    const tail = `],"savedAt":${JSON.stringify(savedAt)}${sync ? `,"sync":${JSON.stringify(sync)}` : ''}}`;
    let size = head.length + tail.length;
    const entries: string[] = [];
    // Keep the largest contiguous suffix. Never serialize history at all when
    // the complete current document already exceeds the history budget.
    if (size <= 1500000) for (let index = history.past.length - 1; index >= Math.max(0, history.past.length - 20); index--) {
        const entry = JSON.stringify(history.past[index]) ?? 'null';
        const nextSize = size + entry.length + (entries.length ? 1 : 0);
        if (nextSize > 1500000) break;
        entries.push(entry); size = nextSize;
    }
    return head + entries.reverse().join(',') + tail;
}

const DATABASE = 'goatleta-scouting-video-drafts-v1';
const STORE = 'drafts';
const STORAGE_TIMEOUT_MS = 10000;
let database: Promise<IDBDatabase> | null = null;

function openDraftDatabase(): Promise<IDBDatabase> {
    if (database) return database;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
        let settled = false;
        const fail = (error: unknown) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
        const timer = setTimeout(() => fail(new Error('Tempo esgotado ao abrir o rascunho local.')), STORAGE_TIMEOUT_MS);
        try {
            const request = globalThis.indexedDB.open(DATABASE, 1);
            request.onerror = () => fail(request.error ?? new Error('Armazenamento local indisponível.'));
            request.onblocked = () => fail(new Error('Armazenamento local bloqueado.'));
            request.onupgradeneeded = () => {
                const abortUpgrade = () => { try { request.transaction?.abort(); } catch { /* The failed upgrade may already be aborted. */ } };
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
        } catch (error) { fail(error); }
    });
    database = opening;
    void opening.catch(() => { if (database === opening) database = null; });
    return opening;
}

async function draftTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const connection = await openDraftDatabase();
    return new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction | undefined, settled = false, succeeded = false, result: T;
        const fail = (error: unknown) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            try { transaction?.abort(); } catch { /* A completed/aborted transaction cannot be aborted again. */ }
            reject(error);
        };
        const timer = setTimeout(() => fail(new Error('Tempo esgotado ao gravar ou ler o rascunho local.')), STORAGE_TIMEOUT_MS);
        try {
            transaction = connection.transaction(STORE, mode);
            transaction.onerror = () => fail(transaction?.error ?? new Error('Falha no armazenamento local.'));
            transaction.onabort = () => fail(transaction?.error ?? new Error('Gravação ou leitura local cancelada.'));
            transaction.oncomplete = () => {
                if (settled) return;
                if (!succeeded) { fail(new Error('Armazenamento local incompleto.')); return; }
                settled = true; clearTimeout(timer); resolve(result);
            };
            const request = operation(transaction.objectStore(STORE));
            request.onsuccess = () => { result = request.result; succeeded = true; };
            request.onerror = () => fail(request.error ?? new Error('Falha no armazenamento local.'));
        } catch (error) { fail(error); }
    });
}

/** IDB is authoritative on web. A failed read must never revive an older legacy draft. */
export async function getVideoDraft(key: string): Promise<string | null> {
    if (Platform.OS !== 'web') return AsyncStorage.getItem(key);
    // getAll distinguishes an absent key from a corrupt present `undefined` value.
    const values: unknown[] = await draftTransaction('readonly', store => store.getAll(key, 1));
    if (!values.length) return AsyncStorage.getItem(key);
    const value = values[0];
    if (typeof value !== 'string' || !value.length) throw new Error('Rascunho local inválido.');
    return value;
}

export async function getVideoDraftKeys(prefix: string): Promise<string[]> {
    const legacy = async () => (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
    if (Platform.OS !== 'web') return legacy();
    const keys = await draftTransaction('readonly', store => store.getAllKeys());
    return [...new Set([...keys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix)), ...await legacy()])];
}

const writes = new Map<string, Promise<void>>();
/** A slower earlier autosave may not overwrite a later snapshot of the same draft. */
export async function persistVideoDraft(key: string, data: string): Promise<void> {
    const previous = writes.get(key) ?? Promise.resolve();
    const write = previous.catch(() => undefined).then(async () => {
        if (Platform.OS === 'web') await draftTransaction('readwrite', store => store.put(data, key));
        else await AsyncStorage.setItem(key, data);
    });
    writes.set(key, write);
    try { await write; } finally { if (writes.get(key) === write) writes.delete(key); }
}
