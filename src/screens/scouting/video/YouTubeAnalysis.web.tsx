import { useEffect, useRef, useState } from 'react';
import { analyzeYouTube } from '../../../api/scouting-video-ai';
import { applyVideoAi, type VideoAiResult } from '../../../core/scouting-video-ai';
import { videoTime, type VideoDocument, type VideoSide } from '../../../core/scouting-video';
import { createClientId } from '../../../core/client-id';
import { StudioAction, StudioDialog } from './StudioUI.web';

export function YouTubeAnalysis({ doc, onApply, onClose }: { doc: VideoDocument; onApply: (doc: VideoDocument) => void; onClose: () => void }) {
    const [results, setResults] = useState<VideoAiResult[]>([]), [error, setError] = useState(''), [job, setJob] = useState('');
    const [whole, setWhole] = useState(false), [near, setNear] = useState<VideoSide | ''>('');
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    const total = Math.min(doc.media.duration, whole ? 1800 : 60);
    const run = async () => {
        if (controller.current || !doc.media.youtubeId) return;
        const request = new AbortController(); controller.current = request; setError('');
        const accumulated: VideoAiResult[] = []; setResults([]);
        try {
            for (let start = 0; start < total; start += 60) {
                const end = Math.min(total, start + 60);
                setJob(`Analisando ${videoTime(start)} – ${videoTime(end)}`);
                const result = await analyzeYouTube(doc.media.youtubeId, start, end, request.signal);
                if (request.signal.aborted) return;
                accumulated.push(result); setResults([...accumulated]);
            }
        } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha na análise.'); }
        finally { if (controller.current === request) { controller.current = null; setJob(''); } }
    };
    const rallyCount = results.reduce((n,r) => n+r.rallies.length,0), contactCount = results.reduce((n,r) => n+r.contacts.length,0);
    return <StudioDialog title="Analisar vídeo do YouTube" onClose={() => { controller.current?.abort(); onClose(); }}>
        <p>Sugestões experimentais de rallies e contatos para revisão. A análise não identifica atletas nem confirma pontos.</p>
        <label><input type="checkbox" checked={whole} disabled={!!job} onChange={e => { setWhole(e.target.checked); setResults([]); }}/>{' '}Analisar vídeo completo (até 30 minutos)</label>
        <p><small>{whole ? videoTime(total) : 'Primeiro minuto'} · Gemini 3.1 Flash Lite · processamento pelo link</small></p>
        {job ? <><p role="status">{job}</p><progress aria-label="Progresso da análise do YouTube" value={results.at(-1)?.end ?? 0} max={total}/><StudioAction label="Cancelar análise do YouTube" onPress={() => controller.current?.abort()}>Cancelar</StudioAction></> : <StudioAction label="Iniciar análise do YouTube" primary onPress={() => { void run(); }}>Analisar pelo link</StudioAction>}
        {error ? <p role="alert">{error}</p> : null}
        {results.length ? <>
            <p role="status">{videoTime(results.at(-1)!.end)} analisados · {rallyCount} rallies · {contactCount} contatos sugeridos{results.at(-1)!.end < total ? ' · parcial' : ''}</p>
            <details><summary>Ver sugestões e limitações</summary>{results.map(r => <section key={r.start}><h3>{videoTime(r.start)} – {videoTime(r.end)}</h3>{r.rallies.map((s,i) => <p key={i}>Rally {videoTime(s.start)}{s.end !== null ? ` – ${videoTime(s.end)}` : ''}: {s.evidence}</p>)}{r.contacts.map((c,i) => <p key={i}>{videoTime(c.time)} · {c.skill} · {c.side === 'near' ? 'perto da câmera' : c.side === 'far' ? 'fundo da quadra' : 'lado incerto'}: {c.evidence}</p>)}{r.limitations.map((s,i) => <p key={i}><small>{s}</small></p>)}</section>)}</details>
            <label className="sv-field">Nossa equipe no trecho analisado<span><select aria-label="Lado da nossa equipe" value={near} disabled={!!job} onChange={e => setNear(e.target.value as VideoSide | '')}><option value="">Selecione o lado</option><option value="us">Perto da câmera</option><option value="them">Fundo da quadra</option></select></span></label>
            <p><small>Confira se as equipes trocaram de lado. Contatos com lado incerto são ignorados. Marcações existentes são preservadas; você pode desfazer a aplicação.</small></p>
            <StudioAction label="Aplicar sugestões do YouTube" disabled={!!job || !near || (!rallyCount && !contactCount)} onPress={() => { try { if (near) onApply(applyVideoAi(doc, results, near, createClientId)); } catch (failure) { setError((failure as Error).message); } }}>Aplicar sugestões</StudioAction>
        </> : null}
    </StudioDialog>;
}
