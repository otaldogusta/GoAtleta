import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assertSessionIdentity, getSessionIdentity } from '../../../auth/session';
import { getScoutingVideoDocument, saveScoutingVideoDocument, VideoDocumentSyncError, type VideoDocumentRecord } from '../../../api/scouting-video-documents';
import { editVideo, newVideoDocument, parseVideoDocument, undoVideo, videoDraftKey, type VideoDocument, type VideoHistory, type VideoMedia } from '../../../core/scouting-video';
import { reconcileVideoDocuments, videoDocumentSignature, type VideoSyncBaseline } from '../../../core/scouting-video-sync';
import { createClientId } from '../../../core/client-id';
import { matchingOriginalDocument } from './video-source-selection';
import { parseStoredVideoDraft, persistVideoDraft, serializeVideoDraft, type StoredVideoDraft, type VideoDraftSync } from './video-draft-storage';

type SyncStatus = 'loading' | 'synced' | 'pending' | 'offline' | 'unavailable' | 'conflict' | 'forbidden' | 'error';
type Conflict = { local: VideoDocument; remote: VideoDocumentRecord };
type Pending = { id: string; expectedRevision: number; document: VideoDocument; signature: string };
type Context = {
    scope: string; active: boolean; epoch: number; history: VideoHistory | null; saved: string; loadedSignature: string;
    known: boolean; baseline: VideoSyncBaseline | null; pending: Pending | null; storedSync?: VideoDraftSync;
    loading: boolean; status: SyncStatus; error: string; conflict: Conflict | null; task: Promise<boolean> | null;
};
type View = { scope: string; history: VideoHistory | null; saved: string; loading: boolean; status: SyncStatus; error: string; conflict: Conflict | null; saving: boolean };
const emptyView = (scope: string): View => ({ scope, history: null, saved: '', loading: true, status: 'loading', error: '', conflict: null, saving: false });
const emptyContext = (scope: string): Context => ({ ...emptyView(scope), active: true, epoch: 0, loadedSignature: '', known: false, baseline: null, pending: null, task: null });

export function useVideoDraft(org: string, user: string, session: string, readOnlyDocument?: VideoDocument, writable = true) {
    const scope = JSON.stringify([org, user, session, !!readOnlyDocument]);
    const [view, setView] = useState<View>(() => emptyView(scope));
    const state = useRef<Context>(emptyContext(scope));
    const readOnlyHistory = useMemo<VideoHistory | null>(() => readOnlyDocument ? { present: parseVideoDocument(readOnlyDocument), past: [], future: [] } : null, [readOnlyDocument]);
    const valid = useCallback((ctx: Context, epoch = ctx.epoch) => ctx.active && state.current === ctx && ctx.scope === scope && ctx.epoch === epoch, [scope]);
    const identity = useCallback(() => {
        const value = getSessionIdentity(); assertSessionIdentity(value);
        if (value.userId !== user) throw new VideoDocumentSyncError('permission');
        return value;
    }, [user]);
    const publish = useCallback((ctx: Context) => {
        if (valid(ctx)) setView({ scope: ctx.scope, history: ctx.history, saved: ctx.saved, loading: ctx.loading,
            status: ctx.status, error: ctx.error, conflict: ctx.conflict, saving: !!ctx.task });
    }, [valid]);
    const failure = useCallback((ctx: Context, error: unknown) => {
        if (!valid(ctx)) return;
        const code = error instanceof VideoDocumentSyncError ? error.code : 'unavailable';
        ctx.status = code === 'missing-backend' ? 'unavailable' : code === 'permission' ? 'forbidden' : code === 'offline' ? 'offline' : 'error';
        ctx.error = error instanceof VideoDocumentSyncError ? error.message : 'Não foi possível sincronizar agora. Seu rascunho foi preservado neste aparelho.';
        publish(ctx);
    }, [publish, valid]);
    const localMeta = useCallback((ctx: Context, history: VideoHistory): VideoDraftSync | undefined => {
        const signature = videoDocumentSignature(history.present);
        if (!ctx.known) return ctx.storedSync ? { ...ctx.storedSync,
            dirty: ctx.storedSync.dirty || signature !== ctx.loadedSignature,
            ...(ctx.storedSync.pending ? { pending: { ...ctx.storedSync.pending,
                matchesCurrent: ctx.storedSync.pending.matchesCurrent && signature === ctx.loadedSignature } } : {}) } : undefined;
        return { revision: ctx.baseline?.revision ?? 0, dirty: signature !== ctx.baseline?.signature,
            ...(ctx.pending ? { pending: { id: ctx.pending.id, expectedRevision: ctx.pending.expectedRevision, matchesCurrent: ctx.pending.signature === signature } } : {}) };
    }, []);
    const persist = useCallback(async (ctx: Context, history: VideoHistory) => {
        const auth = identity(), signature = videoDocumentSignature(history.present);
        const meta = localMeta(ctx, history);
        await persistVideoDraft(videoDraftKey(user, org, session, history.present.media.fingerprint), serializeVideoDraft(history, meta));
        assertSessionIdentity(auth);
        if (valid(ctx) && ctx.history === history) { ctx.saved = signature; ctx.storedSync = meta; publish(ctx); }
    }, [identity, localMeta, org, publish, session, user, valid]);
    const mergeRemote = useCallback((ctx: Context, stored: StoredVideoDraft | null, remote: VideoDocumentRecord | null) => {
        const local = stored?.history.present ?? null, metadata = stored?.sync;
        let baseline = ctx.baseline;
        if (metadata?.revision && remote && !baseline) {
            baseline = { revision: metadata.revision, signature: !metadata.dirty || videoDocumentSignature(local!) === videoDocumentSignature(remote.document) ? videoDocumentSignature(local!) :
                remote.revision === metadata.revision ? videoDocumentSignature(remote.document) : '' };
        }
        if (metadata?.pending && remote?.mutationId === metadata.pending.id && remote.revision === metadata.pending.expectedRevision + 1)
            baseline = { revision: remote.revision, signature: videoDocumentSignature(remote.document) };
        const resolution = reconcileVideoDocuments({ local, remote, baseline });
        ctx.known = true; ctx.storedSync = metadata; ctx.pending = null; ctx.conflict = null;
        if (resolution.source === 'conflict') {
            ctx.history = stored?.history ?? ctx.history;
            if (local && remote) { ctx.conflict = { local, remote }; ctx.status = 'conflict'; ctx.error = ''; }
            else { ctx.status = 'error'; ctx.error = 'A versão sincronizada não está disponível. O rascunho local foi preservado.'; }
            return;
        }
        ctx.history = resolution.source === 'remote' ? { present: remote!.document, past: [], future: [] } : stored?.history ?? null;
        ctx.baseline = resolution.baseline; ctx.status = resolution.needsUpload ? 'pending' : ctx.history ? 'synced' : 'pending'; ctx.error = '';
        if (metadata?.pending?.matchesCurrent && local && resolution.needsUpload)
            ctx.pending = { id: metadata.pending.id, expectedRevision: metadata.pending.expectedRevision, document: local, signature: videoDocumentSignature(local) };
    }, []);
    const refresh = useCallback(async (ctx: Context) => {
        const auth = identity(), epoch = ctx.epoch;
        const remote = await getScoutingVideoDocument({ org, userId: user, sessionId: session }, ctx.history?.present.media.fingerprint);
        assertSessionIdentity(auth); if (!valid(ctx, epoch)) return;
        if (remote && ctx.baseline && remote.revision < ctx.baseline.revision) return;
        const stored = ctx.history ? { history: ctx.history, savedAt: '', sync: localMeta(ctx, ctx.history) } : null;
        mergeRemote(ctx, stored, remote);
        if (ctx.history) await persist(ctx, ctx.history);
        publish(ctx);
    }, [identity, localMeta, mergeRemote, org, persist, publish, session, user, valid]);
    const save = useCallback(async (): Promise<boolean> => {
        const ctx = state.current;
        if (readOnlyDocument || !valid(ctx) || !ctx.history || ctx.loading) return false;
        if (ctx.task) return ctx.task;
        const epoch = ctx.epoch;
        const work = async () => {
            try { await persist(ctx, ctx.history!); }
            catch { if (valid(ctx, epoch)) { ctx.error = 'Não foi possível salvar neste aparelho. Mantenha o estúdio aberto e tente novamente.'; publish(ctx); } return false; }
            if (!writable || !valid(ctx, epoch) || ctx.conflict) return true;
            try {
                if (!ctx.known) await refresh(ctx);
                if (!valid(ctx, epoch) || ctx.conflict || !ctx.history || ctx.status === 'error') return true;
                const signature = videoDocumentSignature(ctx.history.present);
                if (signature === ctx.baseline?.signature && !ctx.pending) { ctx.status = 'synced'; ctx.error = ''; publish(ctx); return true; }
                const pending = ctx.pending ?? { id: createClientId(), expectedRevision: ctx.baseline?.revision ?? 0, document: ctx.history.present, signature };
                ctx.pending = pending; ctx.status = 'pending'; publish(ctx);
                await persist(ctx, ctx.history);
                const record = await saveScoutingVideoDocument({ org, userId: user, sessionId: session }, pending.document, pending.expectedRevision, pending.id);
                if (!valid(ctx, epoch)) return true;
                if (ctx.baseline && record.revision < ctx.baseline.revision) return true;
                ctx.baseline = { revision: record.revision, signature: videoDocumentSignature(record.document) };
                ctx.pending = null; ctx.error = '';
                ctx.status = videoDocumentSignature(ctx.history!.present) === ctx.baseline.signature ? 'synced' : 'pending';
                await persist(ctx, ctx.history!); publish(ctx); return true;
            } catch (error) {
                if (!valid(ctx, epoch)) return true;
                if (error instanceof VideoDocumentSyncError && error.code === 'conflict') {
                    ctx.pending = null; try { await refresh(ctx); } catch (next) { failure(ctx, next); }
                } else failure(ctx, error);
                return true;
            }
        };
        const task = work(); ctx.task = task; publish(ctx);
        try { return await task; } finally { if (ctx.task === task) { ctx.task = null; if (valid(ctx)) publish(ctx); } }
    }, [failure, org, persist, publish, readOnlyDocument, refresh, session, user, valid, writable]);
    const open = useCallback(async (media: VideoMedia) => {
        const ctx = state.current;
        if (readOnlyDocument || !valid(ctx)) return;
        const auth = identity(), epoch = ++ctx.epoch;
        ctx.task = null; ctx.loading = true; publish(ctx);
        let stored: StoredVideoDraft | null;
        try {
            const raw = await AsyncStorage.getItem(videoDraftKey(user, org, session, media.fingerprint));
            assertSessionIdentity(auth); if (!valid(ctx, epoch)) return;
            stored = raw ? parseStoredVideoDraft(raw, media) : null;
        } catch (error) { if (valid(ctx, epoch)) { ctx.loading = false; publish(ctx); } throw error; }
        ctx.baseline = null; ctx.pending = null; ctx.storedSync = stored?.sync; ctx.known = false; ctx.conflict = null;
        ctx.history = stored?.history ?? { present: newVideoDocument(media, createClientId()), past: [], future: [] };
        ctx.saved = stored ? videoDocumentSignature(stored.history.present) : ''; ctx.error = ''; ctx.loading = true; publish(ctx);
        ctx.loadedSignature = ctx.saved;
        try {
            const remote = await getScoutingVideoDocument({ org, userId: user, sessionId: session }, media.fingerprint, media);
            assertSessionIdentity(auth); if (!valid(ctx, epoch)) return;
            mergeRemote(ctx, stored, remote);
            if (!ctx.history) ctx.history = { present: newVideoDocument(media, createClientId()), past: [], future: [] };
        } catch (error) { if (valid(ctx, epoch)) failure(ctx, error); }
        finally { if (valid(ctx, epoch)) { ctx.loading = false; publish(ctx); } }
    }, [failure, identity, mergeRemote, org, publish, readOnlyDocument, session, user, valid]);
    useEffect(() => {
        const ctx = emptyContext(scope); state.current = ctx;
        if (readOnlyDocument) return () => { ctx.active = false; };
        const auth = getSessionIdentity();
        void (async () => {
            try {
                const prefix = videoDraftKey(user, org, session, '_').slice(0, -1);
                const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
                const candidates = await Promise.all(keys.map(async key => {
                    const raw = await AsyncStorage.getItem(key);
                    try { return raw ? parseStoredVideoDraft(raw) : null; } catch { return null; }
                }));
                assertSessionIdentity(auth); if (auth.userId !== user || !valid(ctx, 0)) return;
                const stored = candidates.filter((value): value is StoredVideoDraft => !!value).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
                ctx.history = stored?.history ?? null; ctx.saved = stored ? videoDocumentSignature(stored.history.present) : ''; ctx.storedSync = stored?.sync;
                ctx.loadedSignature = ctx.saved;
                try {
                    let remote = await getScoutingVideoDocument({ org, userId: user, sessionId: session });
                    assertSessionIdentity(auth); if (!valid(ctx, 0)) return;
                    const associated = stored && remote && matchingOriginalDocument(remote.document, stored.history.present.media);
                    if (stored && remote && stored.history.present.media.fingerprint !== remote.fingerprint && !associated)
                        remote = await getScoutingVideoDocument({ org, userId: user, sessionId: session }, stored.history.present.media.fingerprint);
                    assertSessionIdentity(auth); if (!valid(ctx, 0)) return;
                    // Select the explicitly linked YouTube analysis; the separate original draft remains untouched.
                    mergeRemote(ctx, associated ? null : stored, remote);
                    if (ctx.history) await persist(ctx, ctx.history);
                } catch (error) { if (valid(ctx, 0)) failure(ctx, error); }
            } catch {
                if (valid(ctx, 0)) { ctx.status = 'error'; ctx.error = 'Não foi possível recuperar o vídeo salvo neste aparelho. Tente abrir o vídeo novamente.'; }
            } finally { if (valid(ctx, 0)) { ctx.loading = false; publish(ctx); } }
        })();
        return () => { ctx.active = false; ctx.epoch++; };
    }, [failure, mergeRemote, org, persist, publish, readOnlyDocument, scope, session, user, valid]);
    const change = useCallback((doc: VideoDocument, label: string) => {
        const ctx = state.current;
        if (readOnlyDocument || !writable || !valid(ctx) || !ctx.history || ctx.loading || ctx.conflict) return;
        ctx.history = editVideo(ctx.history, parseVideoDocument(doc), label); ctx.status = 'pending'; publish(ctx);
    }, [publish, readOnlyDocument, valid, writable]);
    const undo = useCallback((redo = false) => {
        const ctx = state.current;
        if (readOnlyDocument || !writable || !valid(ctx) || !ctx.history || ctx.loading || ctx.conflict) return;
        ctx.history = undoVideo(ctx.history, redo); ctx.status = 'pending'; publish(ctx);
    }, [publish, readOnlyDocument, valid, writable]);
    const retrySync = useCallback(async () => {
        const ctx = state.current;
        if (readOnlyDocument || !valid(ctx) || ctx.loading || ctx.task || ctx.conflict) return false;
        try { await refresh(ctx); } catch (error) { failure(ctx, error); return false; }
        return save();
    }, [failure, readOnlyDocument, refresh, save, valid]);
    const resolveConflict = useCallback(async (choice: 'local' | 'remote') => {
        const ctx = state.current, conflict = ctx.conflict;
        if (readOnlyDocument || !writable || !valid(ctx) || !conflict || ctx.task) return false;
        const auth = identity(), epoch = ctx.epoch;
        const previous = { history: ctx.history, baseline: ctx.baseline, pending: ctx.pending, known: ctx.known };
        const work = async () => { try {
            const backup = 'goatleta:scouting-video-backup:v1:' + [user, org, session, createClientId()].map(encodeURIComponent).join(':');
            await persistVideoDraft(backup, JSON.stringify({ local: conflict.local, remote: conflict.remote, savedAt: new Date().toISOString() }));
            assertSessionIdentity(auth); if (!valid(ctx, epoch)) return false;
            ctx.history = choice === 'remote' ? { present: conflict.remote.document, past: [], future: [] } : ctx.history;
            ctx.baseline = { revision: conflict.remote.revision, signature: videoDocumentSignature(conflict.remote.document) };
            ctx.known = true; ctx.pending = null;
            await persist(ctx, ctx.history!);
            if (!valid(ctx, epoch)) return false;
            ctx.conflict = null; ctx.error = ''; ctx.status = choice === 'remote' ? 'synced' : 'pending'; publish(ctx);
            return true;
        } catch {
            if (valid(ctx, epoch)) { Object.assign(ctx, previous); ctx.error = 'Não foi possível preservar as duas versões. Mantenha o estúdio aberto e tente novamente.'; publish(ctx); }
            return false;
        } };
        const task = work(); ctx.task = task; publish(ctx);
        let resolved = false;
        try { resolved = await task; } finally { if (ctx.task === task) { ctx.task = null; if (valid(ctx)) publish(ctx); } }
        return resolved && choice === 'local' ? save() : resolved;
    }, [identity, org, persist, publish, readOnlyDocument, save, session, user, valid, writable]);
    useEffect(() => {
        if (readOnlyDocument || !writable || view.scope !== scope || view.loading || view.saving || !view.history || view.status !== 'pending') return;
        const timer = setTimeout(() => { void save(); }, 800);
        return () => clearTimeout(timer);
    }, [readOnlyDocument, save, scope, view, writable]);
    useEffect(() => {
        if (readOnlyDocument || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        const resume = () => { void retrySync(); };
        window.addEventListener('online', resume); window.addEventListener('focus', resume);
        return () => { window.removeEventListener('online', resume); window.removeEventListener('focus', resume); };
    }, [readOnlyDocument, retrySync]);
    const setError = useCallback((value: string) => { const ctx = state.current; if (valid(ctx)) { ctx.error = value; publish(ctx); } }, [publish, valid]);
    const visible = view.scope === scope ? view : emptyView(scope);
    const history = readOnlyHistory ?? visible.history;
    return { history, doc: history?.present ?? null, open, change, undo, save, retrySync, resolveConflict,
        saving: !readOnlyDocument && visible.saving, loading: !readOnlyDocument && visible.loading,
        syncStatus: readOnlyDocument ? 'synced' as const : visible.status, conflict: readOnlyDocument ? null : visible.conflict,
        error: readOnlyDocument ? '' : visible.error, setError,
        dirty: !readOnlyDocument && !!history && videoDocumentSignature(history.present) !== visible.saved };
}
