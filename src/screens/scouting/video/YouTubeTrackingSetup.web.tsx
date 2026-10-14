import { useEffect, useRef, useState } from 'react';
import { parseVideoDocument, videoTime, type VideoAnalysis, type VideoDocument, type VideoMedia } from '../../../core/scouting-video';
import { attachYoutubeTracking } from '../../../core/scouting-video-tracking';
import { inspectVideo } from './video-media.web';
import { processScoutingVideo } from './video-processing.web';
import { StudioAction, StudioDialog } from './StudioUI.web';

type Candidate = { media: VideoMedia; analysis?: VideoAnalysis; file?: File; preview?: string };

/** Only the original selected on this device is decoded; the iframe is never read. */
export function YouTubeTrackingSetup({ doc, onApply, onClose, onDrive }: {
    doc: VideoDocument; onApply: (next: VideoDocument, original?: File) => void; onClose: () => void; onDrive?: () => void;
}) {
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [confirmed, setConfirmed] = useState(false), [offset, setOffset] = useState(String(doc.analysis?.source?.offsetSeconds ?? 0));
    const [model, setModel] = useState<'v2b' | 'v4c'>('v2b');
    const [error, setError] = useState(''), [status, setStatus] = useState(''), [progress, setProgress] = useState<number | null>(null);
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
                if (media.duration > 1800) throw new Error('Escolha um vídeo de até 30 minutos para processar neste aparelho.');
                if (alive.current) setCandidate({ media, file, preview: URL.createObjectURL(file) });
            }
        } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir este arquivo.'); }
        finally { loading.current = false; if (alive.current) setStatus(''); }
    };
    const analyze = async () => {
        if (!candidate?.file || controller.current || !confirmed) return;
        const run = new AbortController(); controller.current = run; setError(''); setProgress(0);
        try {
            const analysis = await processScoutingVideo(candidate.file, candidate.media.duration, run.signal, (done, total, text) => {
                if (alive.current && !run.signal.aborted) { setProgress(done / total); setStatus(text); }
            }, { model });
            if (alive.current && !run.signal.aborted) setCandidate({ ...candidate, analysis });
        } catch (failure) { if (alive.current && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao rastrear a bola.'); }
        finally { controller.current = null; if (alive.current) { setProgress(null); setStatus(''); } }
    };
    const validOffset = offset.trim() !== '' && Number.isFinite(Number(offset)) && Math.abs(Number(offset)) <= 1800;
    const apply = () => {
        if (!candidate?.analysis || !confirmed || !validOffset || status) return;
        try { onApply(attachYoutubeTracking(doc, { media: candidate.media, analysis: candidate.analysis }, Number(offset)), candidate.file); }
        catch (failure) { setError((failure as Error).message); }
    };
    return <StudioDialog title="Trajetória da bola" className="sv-tracking-setup sv-source-dialog" onClose={onClose}>
      <input ref={videoInput} type="file" accept="video/*,.mp4,.mov,.webm" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void select(file, false); }}/>
      <input ref={analysisInput} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void select(file, true); }}/>
      <div className="sv-wrap">
        <StudioAction label="Escolher original para tracking" disabled={!!status} onPress={() => videoInput.current?.click()}>Escolher original</StudioAction>
        <StudioAction label="Reutilizar tracking processado" disabled={!!status} onPress={() => analysisInput.current?.click()}>Importar análise do original</StudioAction>
        {onDrive ? <StudioAction label="Usar vídeo do Drive para tracking" disabled={!!status} onPress={onDrive}>Usar Drive</StudioAction> : null}
      </div>
      {candidate ? <>
        <div className="sv-import-current"><b>{candidate.media.name}</b><small>{videoTime(candidate.media.duration)} · {candidate.analysis ? `${candidate.analysis.positions.length} posições disponíveis` : 'Pronto para processar'}</small></div>
        {candidate.preview ? <video className="sv-tracking-preview" src={candidate.preview} controls preload="metadata" playsInline/> : null}
        {candidate.file && !candidate.analysis ? <label className="sv-field">Modelo de tracking<span><select aria-label="Modelo de tracking" value={model} disabled={!!status} onChange={e => setModel(e.target.value === 'v4c' ? 'v4c' : 'v2b')}><option value="v2b">VballNet GridV2b · recomendado</option><option value="v4c">VballNet V4c · comparar</option></select></span></label> : null}
        <label className="sv-tracking-confirm"><input type="checkbox" checked={confirmed} disabled={!!status} onChange={e => setConfirmed(e.target.checked)}/>É o mesmo vídeo, com a mesma edição</label>
        <details className="sv-disclosure"><summary>Sincronização</summary><label className="sv-field">Ajuste · segundos<span><input aria-label="Ajuste de sincronização do tracking" type="number" min={-1800} max={1800} step={0.001} value={offset} disabled={!!status} onChange={e => { setOffset(e.target.value); setError(''); }}/></span></label>
        <small>Use 0 quando os vídeos começam juntos.</small></details>
        {!candidate.analysis && !status ? <StudioAction label="Processar tracking neste aparelho" primary disabled={!confirmed || !validOffset} onPress={() => { void analyze(); }}>Rastrear bola</StudioAction> : null}
        {candidate.analysis && !status ? <><p><small>Estimativas revisáveis · marcações preservadas.</small></p><StudioAction label="Aplicar tracking ao YouTube" primary disabled={!confirmed || !validOffset} onPress={apply}>Aplicar tracking</StudioAction></> : null}
      </> : null}
      {status ? <p role="status">{status}</p> : null}
      {progress !== null ? <><progress value={progress} max={1} aria-label="Progresso do tracking"/><StudioAction label="Cancelar tracking" onPress={() => controller.current?.abort()}>Cancelar</StudioAction></> : null}
      {error ? <p role="alert">{error}</p> : null}
    </StudioDialog>;
}
