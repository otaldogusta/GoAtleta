import { useEffect, useRef, useState } from 'react';
import type { ScoutingSession } from '../../../core/models';
import { emptyScoutingVideoLinks, parseScoutingVideoLinks, type ScoutingVideoLinks } from '../../../core/scouting-video-links';
import { loadScoutingDetail, loadScoutingOverview, type ScoutingDetail } from '../../../db/scouting-collection';
import { compareAndPersistVideoDraft, getVideoDraft } from './video-draft-storage';

export async function loadReviewSource(org: string, classId: string, id: string) {
    const source = await loadScoutingDetail(org, id);
    if (source.session.organizationId !== org || source.session.classId !== classId || source.session.id !== id) throw new Error('Análise fora desta turma.');
    return source;
}
/** Sidecar references only. Official sessions, points and video annotations remain untouched. */
export function useVideoScoutingLinks(key: string, org: string, classId: string, sessionId: string, duration: number) {
    const [links, setLinks] = useState(emptyScoutingVideoLinks), [available, setAvailable] = useState<ScoutingSession[]>([]), [sources, setSources] = useState<ScoutingDetail[]>([]);
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const writing = useRef(false);
    const identity = JSON.stringify([key, org, classId, sessionId, duration]);
    const active = useRef<{ identity: string; alive: boolean; raw: string | null; links: ScoutingVideoLinks } | null>(null);
    useEffect(() => {
        const context = { identity, alive: true, raw: null as string | null, links: emptyScoutingVideoLinks() };
        active.current = context;
        let alive = true;
        void Promise.resolve().then(() => {
            if (!alive) return;
            setLoading(true); setSaving(false); setError(''); setLinks(context.links); setSources([]); setAvailable([]);
        });
        void (async () => {
            const [raw, overview] = await Promise.all([getVideoDraft(key), loadScoutingOverview(org, classId)]);
            const restored = raw ? parseScoutingVideoLinks(JSON.parse(raw), duration) : emptyScoutingVideoLinks();
            if (restored.sessionIds.includes(sessionId)) throw new Error('A revisão não pode ser vinculada a ela mesma.');
            const details = await Promise.all(restored.sessionIds.map(id => loadReviewSource(org, classId, id)));
            if (!alive) return;
            context.raw = raw; context.links = restored;
            setLinks(restored); setSources(details);
            setAvailable(overview.rows.map(r => r.session).filter(s => s.organizationId === org && s.classId === classId && s.id !== sessionId && s.type !== 'treino'));
        })().catch(failure => { if (alive) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o scouting.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; context.alive = false; };
    }, [key, org, classId, sessionId, duration, identity, attempt]);
    const save = async (next: ScoutingVideoLinks) => {
        const context = active.current;
        if (writing.current || loading || !context?.alive || context.identity !== identity || context.links !== links) return false;
        writing.current = true;
        setSaving(true); setError('');
        try {
            const validated = parseScoutingVideoLinks(next, duration);
            if (validated.sessionIds.includes(sessionId)) throw new Error('Escolha as análises originais do jogo.');
            const allowed = new Set([...available.map(s => s.id), ...sources.map(s => s.session.id)]);
            if (validated.sessionIds.some(id => !allowed.has(id))) throw new Error('Selecione uma análise desta turma.');
            const details = await Promise.all(validated.sessionIds.map(id => sources.find(s => s.session.id === id) ?? loadReviewSource(org, classId, id)));
            const points = new Set(details.flatMap(source => source.rallies.map(r => JSON.stringify([source.session.id, r.id]))));
            if (validated.links.some(link => !points.has(JSON.stringify([link.sessionId, link.rallyId])))) throw new Error('Ponto de origem não encontrado.');
            if (!context.alive || active.current !== context) return false;
            const raw = JSON.stringify(validated);
            await compareAndPersistVideoDraft(key, context.raw, raw);
            if (!context.alive || active.current !== context) return false;
            context.raw = raw; context.links = validated;
            setLinks(validated); setSources(details); return true;
        } catch (failure) { if (context.alive && active.current === context) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar o vínculo.'); return false; }
        finally { writing.current = false; if (context.alive && active.current === context) setSaving(false); }
    };
    return { links, available, sources, loading, saving, error, save, retry: () => setAttempt(value => value + 1) };
}
