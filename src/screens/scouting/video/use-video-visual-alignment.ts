import { useEffect, useMemo, useRef, useState } from 'react';
import { requestLocalVideoAi } from '../../../api/scouting-video-ai';
import type { VideoMedia } from '../../../core/scouting-video';
import { parseVisualAlignmentCache, parseVisualAlignmentResult, planVisualAlignment, uncoveredVisualAlignmentRequests, visualRalliesForTeam, type VisualAlignmentInput, type VisualAlignmentCacheEntry as Entry, type VisualAlignmentResult } from '../../../core/scouting-video-visual-alignment';
import { analysisCheckpointScope } from './video-analysis-checkpoints';
import { compareAndPersistVideoDraft, getVideoDraft } from './video-draft-storage';

const emptyEntries: Entry[] = [];

/** Paid visual verification is explicit, capped at eight new minutes per run and resumable. */
export function useVideoVisualAlignment(user: string, org: string, session: string, media: VideoMedia, sides?: Record<string, '' | 'near' | 'far'>) {
    const scope = `${analysisCheckpointScope(user, org, session, media.fingerprint)}:visual-alignment:v1`;
    const { youtubeId, duration } = media;
    const identity = JSON.stringify([scope, youtubeId, duration]);
    const [entryState, setEntryState] = useState<{ identity: string; entries: Entry[] }>({ identity, entries: [] });
    const entries = entryState.identity === identity ? entryState.entries : emptyEntries;
    const [loading, setLoading] = useState(false), [error, setError] = useState('');
    const [processedSeconds, setProcessedSeconds] = useState(0);
    const [message, setMessage] = useState('');
    const state = useRef<{ identity: string; alive: boolean; raw: string | null; entries: Entry[]; ready: boolean } | null>(null);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => {
        const context = { identity, alive: true, raw: null as string | null, entries: [] as Entry[], ready: false };
        state.current = context;
        void Promise.resolve().then(() => {
            if (!context.alive) return;
            setEntryState({ identity, entries: [] }); setError(''); setMessage(''); setLoading(false); setProcessedSeconds(0);
        });
        void getVideoDraft(scope).then(raw => {
            const saved = parseVisualAlignmentCache(raw, { youtubeId, duration });
            if (!context.alive) return;
            context.raw = raw; context.entries = saved; context.ready = true; setEntryState({ identity, entries: saved });
        }).catch(() => { if (context.alive) setError('Não foi possível recuperar a revisão visual. Vínculos e recortes foram preservados.'); });
        return () => { context.alive = false; controller.current?.abort(); };
    }, [scope, identity, youtubeId, duration]);
    const run = async (input: VisualAlignmentInput) => {
        const context = state.current;
        if (!context?.alive || context.identity !== identity || controller.current) return;
        const requestController = new AbortController(); controller.current = requestController;
        setLoading(true); setError(''); setMessage(''); setProcessedSeconds(0);
        try {
            if (!context.ready) {
                const raw = await getVideoDraft(scope), restored = parseVisualAlignmentCache(raw, media);
                if (!context.alive || requestController.signal.aborted) return;
                context.raw = raw; context.entries = restored; context.ready = true; setEntryState({ identity, entries: restored });
            }
            const windows = planVisualAlignment(media, input);
            const saved = context.entries.filter(entry => entry.sessionId === input.sessionId && entry.setNumber === input.setNumber && (!input.retryFailed || entry.result !== null)).map(entry => entry.request);
            const pending = uncoveredVisualAlignmentRequests(windows,saved);
            for (const request of pending.slice(0, 8)) {
                if (!context.alive || requestController.signal.aborted) break;
                let result: VisualAlignmentResult | null = null, readingError: string | undefined;
                try { result = parseVisualAlignmentResult(await requestLocalVideoAi('align', request, requestController.signal), request); }
                catch (failure) {
                    if (requestController.signal.aborted) throw failure;
                    const text = failure instanceof Error ? failure.message : '';
                    if (!/observações inválidas|dados inválidos|conferência visual válida/.test(text)) throw failure;
                    // A bad visual answer is a manual-review gap, not permission to guess or retry indefinitely.
                    readingError = 'Sem leitura visual confiável. Confira este trecho manualmente.';
                }
                if (!context.alive || requestController.signal.aborted) break;
                // Reanalysis of the same window replaces only its experimental observations.
                const next = [...context.entries.filter(entry => entry.sessionId !== input.sessionId || entry.setNumber !== input.setNumber || entry.request.start !== request.start || entry.request.end !== request.end), { sessionId: input.sessionId, setNumber: input.setNumber, request, result, ...(readingError ? {error:readingError} : {}) }];
                const raw = JSON.stringify({ version: 1, entries: next });
                await compareAndPersistVideoDraft(scope, context.raw, raw);
                if (!context.alive) break;
                context.raw = raw; context.entries = next; setEntryState({ identity, entries: next });
                if (result) setProcessedSeconds(seconds => seconds + request.end-request.start);
            }
            if (context.alive && !requestController.signal.aborted && pending.length > 8) setMessage('Oito trechos revisados e salvos. Inicie novamente para continuar os trechos restantes.');
            else if (context.alive && !windows.length) setMessage('Falta uma referência deste set para delimitar a revisão, ou todos os pontos já foram resolvidos.');
            else if (context.alive && !requestController.signal.aborted) {
                const failed = context.entries.filter(entry => entry.sessionId === input.sessionId && entry.setNumber === input.setNumber && !entry.result).length;
                setMessage(`Set ${input.setNumber}: ${failed ? `${failed} trecho(s) sem leitura confiável; confira manualmente. Demais resultados salvos.` : pending.length ? 'Conferência visual concluída. Revise as sugestões.' : 'Trechos salvos reaproveitados. Confira as sugestões.'}`);
            }
        } catch (failure) {
            if (context.alive && !requestController.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível revisar o trecho. Progresso anterior preservado.');
        } finally {
            if (controller.current === requestController) controller.current = null;
            if (context.alive) { setLoading(false); if (requestController.signal.aborted) setMessage('Conferência pausada. Trechos concluídos preservados.'); }
        }
    };
    const visualRallies = useMemo(() => entries.flatMap(entry => {
        const side = sides ? sides[JSON.stringify([entry.sessionId,entry.setNumber])] : entry.request.ourSide;
        return side && entry.result ? visualRalliesForTeam(entry.result,side) : [];
    }), [entries,sides]);
    const failedWindows = entries.filter(entry => !entry.result).length;
    return { visualRallies, failedWindows, loading, error, message, processedSeconds, run, cancel: () => controller.current?.abort() };
}
