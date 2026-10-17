import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const past = history.past.slice(-20);
    const record = () => JSON.stringify({ document: history.present, past, savedAt: new Date().toISOString(), ...(sync ? { sync } : {}) });
    let data = record();
    while (data.length > 1500000 && past.length) { past.shift(); data = record(); }
    return data;
}

const writes = new Map<string, Promise<void>>();
/** A slower earlier autosave may not overwrite a later snapshot of the same draft. */
export async function persistVideoDraft(key: string, data: string): Promise<void> {
    const previous = writes.get(key) ?? Promise.resolve();
    const write = previous.catch(() => undefined).then(() => AsyncStorage.setItem(key, data));
    writes.set(key, write);
    try { await write; } finally { if (writes.get(key) === write) writes.delete(key); }
}
