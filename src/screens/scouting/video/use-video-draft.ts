import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { editVideo, newVideoDocument, parseVideoDocument, undoVideo, videoDraftKey, type VideoDocument, type VideoHistory, type VideoMedia } from '../../../core/scouting-video';
import { createClientId } from '../../../core/client-id';
export function useVideoDraft(org: string, user: string, session: string, readOnlyDocument?: VideoDocument) {
    const [history, setHistory] = useState<VideoHistory | null>(null);
    const readOnlyHistory = useMemo<VideoHistory | null>(() => readOnlyDocument ? { present: parseVideoDocument(readOnlyDocument), past: [], future: [] } : null, [readOnlyDocument]);
    const [saved, setSaved] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const current = useRef(history);
    const alive = useRef(true), generation = useRef(0), lock = useRef(false);
    const invalidate = useCallback(() => { alive.current = false; generation.current++; }, []);
    useEffect(() => { alive.current = true; return invalidate; }, [invalidate]);
    const open = useCallback(async (media: VideoMedia) => {
        if (readOnlyDocument) return;
        const token = ++generation.current, identity = getSessionIdentity();
        const raw = await AsyncStorage.getItem(videoDraftKey(user, org, session, media.fingerprint));
        assertSessionIdentity(identity);
        if (!alive.current || token !== generation.current)
            return;
        let doc = newVideoDocument(media, createClientId());
        let past: VideoHistory['past'] = [];
        if (raw) {
            const stored = JSON.parse(raw);
            doc = parseVideoDocument(stored.document ?? stored, media);
            if (stored.past != null) {
                if (!Array.isArray(stored.past) || stored.past.length > 20)
                    throw new Error('Histórico local inválido.');
                past = stored.past.map((entry: VideoHistory['past'][number]) => {
                    if (typeof entry.label !== 'string' || typeof entry.at !== 'string')
                        throw new Error('Histórico local inválido.');
                    return { label: entry.label.slice(0, 120), at: entry.at, before: parseVideoDocument(entry.before, media), after: parseVideoDocument(entry.after, media) };
                });
            }
        }
        const next = { present: doc, past, future: [] };
        current.current = next;
        setHistory(next);
        setSaved(JSON.stringify(doc));
        setError('');
    }, [org, user, session, readOnlyDocument]);
    const change = (doc: VideoDocument, label: string) => {
        if (readOnlyDocument || !current.current)
            return;
        const next = editVideo(current.current, parseVideoDocument(doc), label);
        current.current = next;
        setHistory(next);
    };
    const undo = (redo = false) => {
        if (readOnlyDocument || !current.current)
            return;
        const next = undoVideo(current.current, redo);
        current.current = next;
        setHistory(next);
    };
    const save = async () => {
        if (readOnlyDocument || !current.current || lock.current)
            return false;
        lock.current = true;
        setSaving(true);
        const identity = getSessionIdentity(), doc = current.current.present, snapshot = JSON.stringify(doc);
        try {
            assertSessionIdentity(identity);
            if (!identity.userId || identity.userId !== user)
                throw new Error('Sessão alterada.');
            const past = current.current.past.slice(-20);
            let data = JSON.stringify({ document: doc, past });
            // Bound the persisted history, keeping the current document in full.
            while (data.length > 1500000 && past.length) {
                past.shift();
                data = JSON.stringify({ document: doc, past });
            }
            await AsyncStorage.setItem(videoDraftKey(user, org, session, doc.media.fingerprint), data);
            assertSessionIdentity(identity);
            if (alive.current) {
                setSaved(snapshot);
                setError('');
            }
            return true;
        }
        catch {
            if (alive.current)
                setError('Não foi possível salvar neste aparelho. Mantenha o estúdio aberto e tente novamente.');
            return false;
        }
        finally {
            lock.current = false;
            if (alive.current)
                setSaving(false);
        }
    };
    const document = history?.present;
    const serialized = useMemo(() => document ? JSON.stringify(document) : null, [document]);
    const visibleHistory = readOnlyHistory ?? history;
    return { history: visibleHistory, doc: visibleHistory?.present ?? null, open, change, undo, save, saving, error, setError, dirty: !readOnlyDocument && !!history && serialized !== saved };
}
