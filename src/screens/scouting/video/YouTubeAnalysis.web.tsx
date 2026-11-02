import { useEffect, useRef, useState } from 'react';
import { analyzeYouTube } from '../../../api/scouting-video-ai';
import { applyVideoAi, type VideoAiResult } from '../../../core/scouting-video-ai';
import { videoTime, type VideoDocument, type VideoSide } from '../../../core/scouting-video';
import { createClientId } from '../../../core/client-id';
import { StudioAction } from './StudioUI.web';
import { loadAiCheckpoints, saveAiCheckpoints } from './video-analysis-checkpoints';
import { YouTubeTrackingSetup } from './YouTubeTrackingSetup.web';
import { GoAtletaIcon } from '../../../ui/icon-registry';

export function YouTubeAnalysis({ doc, scope, onApply, onCuts, onTracking, onSeek, onReview, trackingRequested = false }: { doc: VideoDocument; scope: string; onApply: (doc: VideoDocument) => void; onClose?: () => void; onCuts: (result: VideoAiResult) => void; onTracking: (next: VideoDocument, original?: File) => void; onSeek?: (time: number) => void; onReview?: () => void; trackingRequested?: boolean }) {
    const [results, setResults] = useState<VideoAiResult[]>([]), [error, setError] = useState(''), [job, setJob] = useState('');
    const [whole, setWhole] = useState(true), [near, setNear] = useState<VideoSide | ''>('');
    const [loading, setLoading] = useState(true);
    const [trackingOpen, setTrackingOpen] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [activeStart, setActiveStart] = useState(0);
    useEffect(() => {
        let current = true;
        void Promise.resolve().then(() => { if (current && trackingRequested) setTrackingOpen(true); });
        return () => { current = false; };
    }, [trackingRequested]);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        let alive = true;
        void loadAiCheckpoints(scope, doc.media.youtubeId!, doc.media.duration).then(saved => { if (alive) setResults(saved); })
            .catch(failure => { if (alive) setError((failure as Error).message); }).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [scope, doc.media.youtubeId, doc.media.duration]);
    const total = Math.min(doc.media.duration, whole ? 7200 : 60);
    const run = async () => {
        if (controller.current || loading || !doc.media.youtubeId) return;
        const request = new AbortController(); controller.current = request; setError('');
        const accumulated = [...results];
        try {
            for (let start = 0; start < total; start += 60) {
                const end = Math.min(total, start + 60);
                const existing = accumulated.find(result => result.start === start && result.end === end);
                if (existing) { onCuts(existing); continue; }
                setJob(`Analisando ${videoTime(start)} – ${videoTime(end)}`);
                setActiveStart(start);
                const result = await analyzeYouTube(doc.media.youtubeId, start, end, request.signal);
                if (request.signal.aborted) return;
                accumulated.push(result); accumulated.sort((a,b) => a.start-b.start); setResults([...accumulated]);
                await saveAiCheckpoints(scope, accumulated);
                onCuts(result);
            }
        } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha na análise.'); }
        finally { if (controller.current === request) { controller.current = null; setJob(''); } }
    };
    const rallyCount = results.reduce((n,r) => n+r.rallies.length,0), contactCount = results.reduce((n,r) => n+r.contacts.length,0);
    const done = results.filter(r => r.end <= total).reduce((n,r) => n+r.end-r.start,0);
    const complete = !loading && !job && !error && done >= total;
    const recent = results.flatMap(result => result.rallies).slice(-4).reverse();
    return <section className="sv-analysis-job" aria-label="Análise automática do jogo">
        <div className="sv-row"><h2>Recortes do jogo</h2><StudioAction label={expanded ? 'Recolher análise automática' : 'Expandir análise automática'} icon={expanded ? 'chevronUp' : 'chevronDown'} onPress={() => setExpanded(value => !value)}/></div>
        {complete ? <div className="sv-job-complete" role="status"><div className="sv-row"><GoAtletaIcon name="checkmarkCircle" size={20} color="currentColor"/><strong>{rallyCount ? 'Recortes prontos para revisar' : 'Análise finalizada'}</strong></div><p>{rallyCount ? `${rallyCount} sugestões · ${videoTime(total)} analisados` : 'Nenhum recorte sugerido. Confira o vídeo manualmente.'}</p><StudioAction label={rallyCount ? 'Revisar recortes gerados' : 'Revisar vídeo analisado'} primary onPress={() => onReview?.()}>{rallyCount ? 'Revisar recortes' : 'Revisar vídeo'}</StudioAction></div> : <>
        <p className="sv-job-status" role="status">{job || (loading ? 'Recuperando progresso…' : results.length ? 'Análise pausada' : 'Pronto para analisar')}</p>
        <div className="sv-job-progress"><progress aria-label="Progresso da análise do YouTube" value={done} max={total}/><span>{Math.floor(done / total * 100)}%</span></div>
        <p className="sv-section-meta">{videoTime(done)} / {videoTime(total)} · {rallyCount} rallies · {contactCount} contatos sugeridos</p>
        </>}
        <div className="sv-wrap sv-job-actions">{job ? <><StudioAction label="Cancelar análise do YouTube" onPress={() => controller.current?.abort()}>Pausar</StudioAction>{onSeek ? <StudioAction label="Ver trecho em análise" onPress={() => onSeek(activeStart)}>Ver trecho</StudioAction> : null}</> : !complete ? <StudioAction label="Iniciar análise do YouTube" disabled={loading} primary onPress={() => { void run(); }}>{results.length ? 'Retomar análise' : 'Analisar pelo link'}</StudioAction> : null}</div>
        {error ? <p className="sv-alert" role="alert">{error}</p> : null}
        {trackingOpen ? <YouTubeTrackingSetup inline doc={doc} scope={scope} onClose={() => setTrackingOpen(false)} onApply={(next, original) => { onTracking(next, original); }}/>: null}
        <div hidden={!expanded}>
        {recent.length ? <div className="sv-job-recent"><h3>Últimos recortes</h3>{recent.map((r,i) => <StudioAction key={`${r.start}:${i}`} label={`Ver recorte em ${videoTime(r.start)}`} onPress={() => onSeek?.(r.start)}><time>{videoTime(r.start)}</time><span>Ver no vídeo</span></StudioAction>)}</div> : null}
        <details className="sv-disclosure"><summary>Opções e revisão de contatos</summary>
        <label><input type="checkbox" checked={whole} disabled={!!job || loading} onChange={e => setWhole(e.target.checked)}/>{' '}Analisar jogo inteiro (até 2 horas)</label>
        <p className="sv-section-meta">Recortes são sugestões para revisão. Atletas e pontos não são identificados. Progresso salvo neste aparelho.</p>
        {results.length ? <>
            <label className="sv-field">Nossa equipe no trecho analisado<span><select aria-label="Lado da nossa equipe" value={near} disabled={!!job} onChange={e => setNear(e.target.value as VideoSide | '')}><option value="">Selecione o lado</option><option value="us">Perto da câmera</option><option value="them">Fundo da quadra</option></select></span></label>
            <p className="sv-section-meta">Confira as trocas de lado antes de atribuir contatos. Marcações existentes são preservadas.</p>
            <StudioAction label="Aplicar sugestões do YouTube" disabled={!!job || !near || (!rallyCount && !contactCount)} onPress={() => { try { if (near) onApply(applyVideoAi(doc, results, near, createClientId)); } catch (failure) { setError((failure as Error).message); } }}>Aplicar sugestões</StudioAction>
            <details className="sv-disclosure"><summary>Ver sugestões e limitações</summary>{results.map(r => <section key={r.start}><h3>{videoTime(r.start)} – {videoTime(r.end)}</h3>{r.rallies.map((s,i) => <p key={i}>Rally {videoTime(s.start)}: {s.evidence}</p>)}{r.limitations.map((s,i) => <p key={i}><small>{s}</small></p>)}</section>)}</details>
        </> : null}
        </details>
        {!trackingOpen ? <StudioAction label="Rastrear bola do jogo inteiro" onPress={() => setTrackingOpen(true)}>Rastrear bola pelo original</StudioAction> : null}
        </div>
    </section>;
}
