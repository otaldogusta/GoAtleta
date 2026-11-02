import { useEffect, useMemo, useRef, useState } from 'react';
import { parseVideoDocument, videoTime, type VideoAnalysis, type VideoDocument, type VideoMedia } from '../../../core/scouting-video';
import { attachYoutubeTracking } from '../../../core/scouting-video-tracking';
import { inspectVideo } from './video-media.web';
import { processLongVideo, trackingSyncPreview } from './long-video-tracking';
import type { TrackingPreview } from './video-processing.web';
import { StudioAction, StudioDialog } from './StudioUI.web';

type Candidate = { media: VideoMedia; analysis?: VideoAnalysis; file?: File; preview?: string };

/** Only the original selected on this device is decoded; the iframe is never read. */
export function YouTubeTrackingSetup({ doc, scope, onApply, onClose, onDrive, inline = false }: {
    doc: VideoDocument; scope: string; onApply: (next: VideoDocument, original?: File, full?: VideoAnalysis) => void; onClose: () => void; onDrive?: () => void; inline?: boolean;
}) {
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [confirmed, setConfirmed] = useState(false), [offset, setOffset] = useState(String(doc.analysis?.source?.offsetSeconds ?? 0));
    const [model, setModel] = useState<'v2b' | 'v4c'>('v2b');
    const [error, setError] = useState(''), [status, setStatus] = useState(''), [progress, setProgress] = useState<number | null>(null);
    const [expanded, setExpanded] = useState(true), [previewTime, setPreviewTime] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const preview = useRef<HTMLCanvasElement>(null), previewAt = useRef(0);
    const attached = useMemo(() => {
        const saved = doc.analysis, provenance = saved?.source;
        if (!saved || !provenance) return false;
        if (!candidate) return true;
        if (!candidate.analysis || !offset.trim() || !Number.isFinite(Number(offset))) return false;
        if (provenance.fingerprint !== candidate.media.fingerprint || provenance.name !== candidate.media.name
            || provenance.duration !== candidate.media.duration || provenance.width !== candidate.media.width
            || provenance.height !== candidate.media.height || provenance.offsetSeconds !== Number(offset)) return false;
        const expected = trackingSyncPreview(candidate.analysis), shift = Number(offset);
        if (saved.model !== expected.model || saved.sampledFps !== expected.sampledFps) return false;
        if (shift === 0 && saved.positions === expected.positions && saved.cuts === expected.cuts) return true;
        let index = 0;
        for (const position of expected.positions) {
            const time = position.time + shift;
            if (time < 0 || time >= doc.media.duration) continue;
            const actual = saved.positions[index++];
            if (!actual || actual.time !== time || actual.x !== position.x || actual.y !== position.y) return false;
        }
        if (index !== saved.positions.length) return false;
        index = 0;
        for (const cut of expected.cuts) {
            const time = cut + shift;
            if (time > 0 && time < doc.media.duration && saved.cuts[index++] !== time) return false;
        }
        return index === saved.cuts.length;
    }, [candidate, doc.analysis, doc.media.duration, offset]);
    const ready = !!candidate?.analysis && !status && !attached;
    const drawPreview = ({ time, x, y, score, frame }: TrackingPreview) => {
        const target = preview.current, now = performance.now();
        if (!target || now - previewAt.current < 200) return;
        previewAt.current = now;
        const context = target.getContext('2d');
        if (!context) return;
        context.drawImage(frame, 0, 0, target.width, target.height);
        if (score >= .5 && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
            context.strokeStyle = getComputedStyle(target).getPropertyValue('--sv-green').trim();
            context.lineWidth = 3; context.beginPath(); context.arc(x * target.width, y * target.height, 8, 0, Math.PI * 2); context.stroke();
        }
        setPreviewTime(time);
    };
    const videoInput = useRef<HTMLInputElement>(null), analysisInput = useRef<HTMLInputElement>(null);
    const controller = useRef<AbortController | null>(null), alive = useRef(true), loading = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
    useEffect(() => () => { if (candidate?.preview) URL.revokeObjectURL(candidate.preview); }, [candidate?.preview]);
    const select = async (file: File, processed: boolean) => {
        if (loading.current || controller.current) return;
        loading.current = true; setError(''); setStatus('Conferindo arquivo…'); setCandidate(null); setConfirmed(false);
        try {
            if (processed) {
                if (file.size > 5000000) throw new Error('Escolha uma análise de até 5 MB.');
                const original = parseVideoDocument(JSON.parse(await file.text()));
                if (original.media.youtubeId || !original.analysis?.positions.length || original.analysis.source) throw new Error('Escolha a análise do arquivo original, com posições da bola.');
                if (alive.current) setCandidate({ media: original.media, analysis: original.analysis });
            } else {
                const media = await inspectVideo(file);
                if (media.duration > 7200) throw new Error('Escolha um jogo de até 2 horas.');
                if (alive.current) setCandidate({ media, file, preview: URL.createObjectURL(file) });
            }
        } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir este arquivo.'); }
        finally { loading.current = false; if (alive.current) setStatus(''); }
    };
    const analyze = async () => {
        if (!candidate?.file || controller.current || !confirmed) return;
        const run = new AbortController(); controller.current = run; setProcessing(true); setError(''); setProgress(0); setStatus('Preparando rastreio…');
        try {
            const analysis = await processLongVideo(candidate.file, candidate.media, scope, model, run.signal, (done, total, text) => {
                if (alive.current && !run.signal.aborted) { setProgress(done / total); setStatus(text); }
            }, drawPreview);
            if (alive.current && !run.signal.aborted) setCandidate({ ...candidate, analysis });
        } catch (failure) { if (alive.current && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao rastrear a bola.'); }
        finally { controller.current = null; if (alive.current) { setProcessing(false); setProgress(null); setStatus(''); } }
    };
    const validOffset = offset.trim() !== '' && Number.isFinite(Number(offset)) && Math.abs(Number(offset)) <= 1800;
    const apply = () => {
        if (!candidate?.analysis || !confirmed || !validOffset || status) return;
        try {
            const next = attachYoutubeTracking(doc, { media: candidate.media, analysis: trackingSyncPreview(candidate.analysis) }, Number(offset));
            onApply(next, candidate.file, candidate.analysis);
        }
        catch (failure) { setError((failure as Error).message); }
    };
    const content = <>
      <input ref={videoInput} type="file" accept="video/*,.mp4,.mov,.webm" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void select(file, false); }}/>
      <input ref={analysisInput} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void select(file, true); }}/>
      <details className="sv-disclosure" open={!attached && (!candidate || !confirmed)}><summary>{candidate ? 'Original e ajustes' : 'Selecionar original'}</summary>
      <div className="sv-wrap">
        <StudioAction label="Escolher original para tracking" disabled={!!status} onPress={() => videoInput.current?.click()}>Escolher original</StudioAction>
        <StudioAction label="Reutilizar tracking processado" disabled={!!status} onPress={() => analysisInput.current?.click()}>Importar análise do original</StudioAction>
        {onDrive ? <StudioAction label="Usar vídeo do Drive para tracking" disabled={!!status} onPress={onDrive}>Usar Drive</StudioAction> : null}
      </div>
      <p className="sv-section-meta">Progresso salvo por minuto neste aparelho. Retomar reutiliza os trechos concluídos.</p>
      {candidate ? <>
        <div className="sv-job-file"><b>{candidate.media.name}</b><small>{videoTime(candidate.media.duration)} · {candidate.analysis ? `${candidate.analysis.positions.length} posições disponíveis` : status ? 'Em processamento' : 'Original selecionado'}</small></div>
        {candidate.preview && !status ? <video className="sv-tracking-preview" src={candidate.preview} controls preload="metadata" playsInline/> : null}
        {candidate.file && !candidate.analysis ? <label className="sv-field">Modelo de tracking<span><select aria-label="Modelo de tracking" value={model} disabled={!!status} onChange={e => setModel(e.target.value === 'v4c' ? 'v4c' : 'v2b')}><option value="v2b">VballNet GridV2b · recomendado</option><option value="v4c">VballNet V4c · comparar</option></select></span></label> : null}
        <label className="sv-tracking-confirm"><input type="checkbox" checked={confirmed} disabled={!!status} onChange={e => setConfirmed(e.target.checked)}/>É o mesmo vídeo, com a mesma edição</label>
        <details className="sv-disclosure"><summary>Sincronização</summary><label className="sv-field">Ajuste · segundos<span><input aria-label="Ajuste de sincronização do tracking" type="number" min={-1800} max={1800} step={0.001} value={offset} disabled={!!status} onChange={e => { setOffset(e.target.value); setError(''); }}/></span></label>
        <small>Use 0 quando os vídeos começam juntos.</small></details>
      </> : null}
      </details>
      {candidate && !candidate.analysis && !status ? <StudioAction label="Processar tracking neste aparelho" primary disabled={processing || !confirmed || !validOffset} onPress={() => { void analyze(); }}>Rastrear bola</StudioAction> : null}
      {ready ? <div className="sv-tracking-result" role="status"><strong>Rastreio concluído</strong><p className="sv-section-meta">{candidate!.analysis!.positions.length.toLocaleString('pt-BR')} posições estimadas · pronto para associar ao vídeo</p><StudioAction label="Aplicar tracking ao YouTube" primary disabled={!confirmed || !validOffset} onPress={apply}>Salvar rastreio no vídeo</StudioAction></div> : null}
      {attached ? <div className="sv-tracking-result" role="status"><strong>Rastreio associado ao vídeo</strong><p className="sv-section-meta">{doc.analysis!.positions.length.toLocaleString('pt-BR')} posições na prévia · marcações preservadas</p></div> : null}
      {error ? <p role="alert">{error}</p> : null}
    </>;
    const live = <div className="sv-job-preview" hidden={previewTime === null || !processing}><canvas ref={preview} width={768} height={432} role="img" aria-label="Quadro sendo analisado pelo detector de bola"/><p className="sv-section-meta">Prévia do detector · {videoTime(previewTime ?? 0)} · posição candidata</p></div>;
    const progressView = <>{status ? <p className="sv-job-status" role="status">{status}</p> : null}{progress !== null ? <div className="sv-job-progress"><progress value={progress} max={1} aria-label="Progresso do tracking"/><span>{(progress * 100).toFixed(1)}%</span></div> : null}{progress !== null ? <div className="sv-job-actions"><StudioAction label="Cancelar tracking" onPress={() => { controller.current?.abort(); setStatus(''); setProgress(null); }}>Pausar rastreio</StudioAction></div> : null}</>;
    return inline ? <section className="sv-tracking-job" aria-label={processing ? 'Rastreio da bola em andamento' : ready ? 'Rastreio da bola concluído' : attached ? 'Rastreio da bola associado ao vídeo' : 'Rastreio da bola'}><div className="sv-row"><h3>Rastreio da bola</h3><StudioAction label={expanded ? 'Recolher rastreio' : 'Expandir rastreio'} icon={expanded ? 'chevronUp' : 'chevronDown'} onPress={() => setExpanded(value => !value)}/></div>{progressView}<div hidden={!expanded}>{live}{content}</div></section>
      : <StudioDialog title="Trajetória da bola" className="sv-tracking-setup sv-source-dialog" onClose={onClose}>{progressView}{live}{content}</StudioDialog>;
}
