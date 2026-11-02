import { useEffect, useRef, useState } from 'react';
import { compareAndPersistVideoDraft, getVideoDraft } from './video-draft-storage';
import { parseVideoReviewPreferences, type VideoReviewPreferences } from '../../../core/scouting-video-review-preferences';
export { parseVideoReviewPreferences, type VideoReviewPreferences } from '../../../core/scouting-video-review-preferences';

const empty = (): VideoReviewPreferences => ({ version: 1, format: '', sides: {} });
type Context = { key: string; alive: boolean; ready: boolean; blocked: boolean; raw: string | null; prefs: VideoReviewPreferences; writes: Promise<boolean>; revision: number };

/** Small scoped settings, stored separately from reviewed links and official scouting. */
export function useVideoReviewPreferences(linksKey: string) {
    const key = `${linksKey}:preferences:v1`;
    const [state, setState] = useState({ key: '', attempt: -1, prefs: empty(), loading: true, error: '' });
    const [attempt, setAttempt] = useState(0);
    const current = useRef<Context | null>(null);
    useEffect(() => {
        const context: Context = { key, alive: true, ready: false, blocked: false, raw: null, prefs: empty(), writes: Promise.resolve(true), revision: 0 };
        current.current = context;
        void Promise.resolve().then(() => { if (context.alive) setState({ key, attempt, prefs: context.prefs, loading: true, error: '' }); });
        void getVideoDraft(key).then(raw => {
            const prefs = raw === null ? empty() : parseVideoReviewPreferences(JSON.parse(raw));
            if (!context.alive) return;
            context.raw = raw; context.prefs = prefs; context.ready = true;
            setState({ key, attempt, prefs, loading: false, error: '' });
        }).catch(() => {
            if (!context.alive) return;
            context.ready = true; context.blocked = true;
            setState({ key, attempt, prefs: context.prefs, loading: false, error: 'Preferências indisponíveis. A seleção manual continua disponível.' });
        });
        return () => { context.alive = false; };
    }, [key, attempt]);
    const update = (change: (prefs: VideoReviewPreferences) => VideoReviewPreferences): Promise<boolean> => {
        const context = current.current;
        if (!context?.alive || context.key !== key || !context.ready) return Promise.resolve(false);
        let next: VideoReviewPreferences;
        try { next = parseVideoReviewPreferences(change(context.prefs)); }
        catch { setState(previous => ({ ...previous, error: 'Preferências de revisão inválidas.' })); return Promise.resolve(false); }
        context.prefs = next; const revision = ++context.revision;
        setState(previous => ({ ...previous, prefs: next }));
        // A failed read never authorizes replacing settings that could not be recovered.
        if (context.blocked) return Promise.resolve(false);
        const write = context.writes.then(async () => {
            if (!context.alive || context.blocked) return false;
            try {
                const raw = JSON.stringify(next);
                await compareAndPersistVideoDraft(key, context.raw, raw);
                context.raw = raw;
                if (context.alive && context.revision === revision) setState(previous => ({ ...previous, error: '' }));
                return true;
            } catch {
                context.blocked = true;
                if (context.alive) setState(previous => ({ ...previous, error: 'Preferências não salvas. Recarregue para tentar novamente.' }));
                return false;
            }
        });
        context.writes = write; return write;
    };
    const displayed = state.key === key && state.attempt === attempt ? state : { prefs: empty(), loading: true, error: '' };
    return {
        ...displayed.prefs, loading: displayed.loading, error: displayed.error,
        setFormat: (format: VideoReviewPreferences['format']) => update(prefs => ({ ...prefs, format })),
        setSide: (sideKey: string, side: '' | 'near' | 'far') => update(prefs => {
            const sides = { ...prefs.sides }; if (side) sides[sideKey] = side; else delete sides[sideKey];
            return { ...prefs, sides };
        }),
        retry: () => setAttempt(value => value + 1),
    };
}
