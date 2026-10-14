import { useEffect, useMemo, useRef, useState } from 'react';
import { getSessionIdentity, isSessionIdentityCurrent } from '../../../auth/session';
import { configureDriveTrackingCredential, getDriveTrackingHealth, inspectDriveVideo, trackDriveVideo, type DriveTrackingScope, type DriveVideoCandidate } from '../../../api/scouting-video-drive';
import { attachDriveTracking, parseDriveTrackingResult, type DriveTrackingResult } from '../../../core/scouting-video-drive';
import { videoTime, type VideoAnalysis, type VideoDocument, type VideoMedia } from '../../../core/scouting-video';
import { attachYoutubeTracking } from '../../../core/scouting-video-tracking';
import { processScoutingVideoUrl } from './video-processing.web';
import { StudioAction, StudioDialog } from './StudioUI.web';

type DriveTrackingProps = {
    doc: VideoDocument; scope: DriveTrackingScope;
    inputLink?: string; embedded?: boolean; onBusyChange?: (busy: boolean) => void;
    onApply: (analysis: VideoAnalysis, media: VideoMedia, playbackUrl: string) => void;
    onPlayback?: (media: VideoMedia, playbackUrl: string) => void;
    onClose: () => void;
};

/** A new studio context unmounts all pending work and transient credentials. */
export function DriveTrackingSetup(props: DriveTrackingProps) {
    return <DriveTrackingContext key={`${JSON.stringify(props.scope)}:${props.doc.media.fingerprint}`} {...props}/>;
}

function DriveTrackingContext({ doc, scope, onApply, onPlayback, onClose, inputLink, embedded, onBusyChange }: DriveTrackingProps) {
    const [localLink, setLink] = useState('');
    const link = inputLink ?? localLink;
    const [checked, setChecked] = useState<{ link: string; value: DriveVideoCandidate } | null>(null);
    const candidate = checked?.link === link ? checked.value : null;
    const setCandidate = (value: DriveVideoCandidate | null) => setChecked(value ? { link, value } : null);
    const [result, setResult] = useState<DriveTrackingResult | null>(null), [confirmed, setConfirmed] = useState(false);
    const [browserAnalysis, setBrowserAnalysis] = useState<VideoAnalysis | null>(null), [progress, setProgress] = useState<number | null>(null);
    const [offset, setOffset] = useState(String(doc.analysis?.source?.offsetSeconds ?? 0));
    const [linkError, setLinkError] = useState<{ link: string; message: string } | null>(null), [status, setStatus] = useState('');
    const error = linkError?.link === link ? linkError.message : '';
    const setError = (message: string) => setLinkError(message ? { link, message } : null);
    useEffect(() => { onBusyChange?.(!!status); }, [status, onBusyChange]);
    useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
    const [cloudReady, setCloudReady] = useState<boolean | null>(null), [hasCredential, setHasCredential] = useState(false);
    const credentialInput = useRef<HTMLInputElement>(null);
    const previewVideo = useRef<HTMLVideoElement>(null);
    const controller = useRef<AbortController | null>(null), alive = useRef(true);
    const cloudRunning = useRef(false);
    const identity = useRef(getSessionIdentity());
    useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
    const validOffset = offset.trim() !== '' && Number.isFinite(Number(offset)) && Math.abs(Number(offset)) <= 1800;
    const validContext = () => alive.current && isSessionIdentityCurrent(identity.current) && scope.targetFingerprint === doc.media.fingerprint;
    useEffect(() => {
        const run = new AbortController();
        void getDriveTrackingHealth(scope, run.signal, validContext).then(health => {
            if (validContext() && !run.signal.aborted) setCloudReady(health.ready);
        }).catch(() => { if (validContext() && !run.signal.aborted) setCloudReady(null); });
        return () => run.abort();
    // Readiness is scoped to the same stable studio context as the job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const close = () => { controller.current?.abort(); if (credentialInput.current) credentialInput.current.value = ''; onClose(); };
    const configure = async () => {
        if (controller.current || !credentialInput.current || !validContext()) return;
        const key = credentialInput.current.value; credentialInput.current.value = ''; setHasCredential(false);
        const run = new AbortController(); controller.current = run; setError(''); setStatus('Conectando tracking na nuvem…');
        try {
            await configureDriveTrackingCredential(key, scope, run.signal, validContext);
            if (validContext() && !run.signal.aborted) setCloudReady(true);
        } catch (failure) { if (validContext() && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível conectar o tracking.'); }
        finally { if (controller.current === run) { controller.current = null; if (validContext()) setStatus(''); } }
    };
    const inspect = async () => {
        if (controller.current || !link.trim() || !validContext()) return;
        const run = new AbortController(); controller.current = run; setStatus('Conferindo acesso e reprodução…'); setError(''); setCandidate(null); setResult(null); setBrowserAnalysis(null); setConfirmed(false);
        try {
            const next = await inspectDriveVideo(link, scope, run.signal, validContext);
            if (validContext() && !run.signal.aborted) setCandidate(next);
        } catch (failure) { if (validContext() && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível abrir este vídeo.'); }
        finally { if (controller.current === run) { controller.current = null; if (validContext()) setStatus(''); } }
    };
    const analyze = async () => {
        if (!candidate || !confirmed || !validOffset || controller.current || !validContext()) return;
        const run = new AbortController(); controller.current = run; cloudRunning.current = true; setError(''); setResult(null); setBrowserAnalysis(null); setStatus('Rastreando a bola na nuvem…');
        try {
            const next = await trackDriveVideo(candidate, scope, run.signal, validContext);
            if (validContext() && !run.signal.aborted) setResult(next);
        } catch (failure) { if (validContext() && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha no tracking da nuvem.'); }
        finally { if (controller.current === run) { controller.current = null; cloudRunning.current = false; if (validContext()) setStatus(''); } }
    };
    const analyzeBrowser = async () => {
        if (!candidate || !confirmed || !validOffset || controller.current || !validContext()) return;
        const run = new AbortController(); controller.current = run; setError(''); setResult(null); setBrowserAnalysis(null); setProgress(0); setStatus('Rastreando neste aparelho por streaming…');
        // Release the preview's range connection before the analysis decoder
        // starts. The preview source is restored only after that decoder exits.
        const preview = previewVideo.current;
        if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); }
        try {
            const source = candidate.media;
            const resumeScope = JSON.stringify([scope.userId, scope.org, scope.classId, scope.sessionId, scope.targetFingerprint,
                identity.current.generation, source.fingerprint, source.duration, source.width, source.height, 'v2b']);
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resumeScope));
            if (!validContext() || run.signal.aborted) return;
            const resumeKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            const next = await processScoutingVideoUrl(candidate.playbackUrl, candidate.media.duration, run.signal, (done, total, stage) => {
                if (validContext() && !run.signal.aborted) { setProgress(total > 0 ? Math.min(1, done / total) : 0); setStatus(stage); }
            }, { resumeKey });
            if (validContext() && !run.signal.aborted) {
                if (!next.positions.length) throw new Error('Nenhuma posição da bola foi encontrada. As marcações foram preservadas.');
                setBrowserAnalysis(next);
            }
        } catch (failure) { if (validContext() && !run.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha no tracking por streaming.'); }
        finally { if (controller.current === run) { controller.current = null; if (validContext()) { setStatus(''); setProgress(null); } } }
    };
    const source = doc.analysis?.source;
    const existingMatch = !!candidate && !!source && !!doc.analysis?.positions.length && source.width === candidate.media.width && source.height === candidate.media.height && Math.abs(source.duration - candidate.media.duration) <= .1;
    const converted = useMemo(() => result ? parseDriveTrackingResult(result) : null, [result]);
    const analysis = browserAnalysis ?? converted?.analysis;
    const apply = () => {
        if (!candidate || !analysis || !confirmed || !validOffset || status || !validContext()) return;
        try {
            const next = browserAnalysis ? attachYoutubeTracking(doc, { media: candidate.media, analysis: browserAnalysis }, Number(offset), candidate.media.fingerprint) : attachDriveTracking(doc, result, Number(offset), candidate.media.fingerprint);
            if (next.analysis) onApply(next.analysis, candidate.media, candidate.playbackUrl);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Tracking incompatível com este vídeo.'); }
    };
    const content = <>
        {!embedded ? <label className="sv-field">Link do vídeo<span><input aria-label="Link do vídeo no Drive" type="url" value={link} disabled={!!status} placeholder="drive.google.com/file/d/…" onChange={event => { setLink(event.target.value); setCandidate(null); setResult(null); setBrowserAnalysis(null); setConfirmed(false); setError(''); }}/></span></label> : null}
        {!candidate ? <StudioAction label="Conferir vídeo do Drive" primary disabled={!link.trim() || !!status} onPress={() => { void inspect(); }}>Continuar</StudioAction> : null}
        {candidate ? <>
            <p className="sv-section-meta">{!embedded ? 'Google Drive · ' : null}{videoTime(candidate.media.duration)} · {candidate.media.width} × {candidate.media.height}</p>
            <label className="sv-tracking-confirm"><input type="checkbox" checked={confirmed} disabled={!!status} onChange={event => setConfirmed(event.target.checked)}/>Mesmo vídeo, com a mesma edição</label>
            <details className="sv-disclosure">
                <summary>Opções da trajetória</summary>
                {progress === null ? <video ref={previewVideo} className="sv-tracking-preview" src={candidate.playbackUrl} crossOrigin="anonymous" controls preload="metadata" playsInline/> : null}
                <label className="sv-field">Sincronização · segundos<span><input aria-label="Ajuste de sincronização do Drive" type="number" min={-1800} max={1800} step={0.001} value={offset} disabled={!!status} onChange={event => { setOffset(event.target.value); setError(''); }}/></span></label>
                <small>Use 0 quando os vídeos começam juntos.</small>
                {cloudReady === false ? <><label className="sv-field">Chave do Roboflow<span><input ref={credentialInput} aria-label="Chave do Roboflow nesta sessão" type="password" autoComplete="off" disabled={!!status} onChange={event => setHasCredential(event.target.value.trim().length >= 10)}/></span></label><StudioAction label="Usar chave nesta sessão" disabled={!hasCredential || !!status} onPress={() => { void configure(); }}>Conectar Roboflow</StudioAction><small>Chave temporária, apenas nesta sessão.</small></> : null}
            {existingMatch && !analysis && !status ? <StudioAction label="Processar neste aparelho sem salvar vídeo" primary={!existingMatch} disabled={!confirmed || !validOffset} onPress={() => { void analyzeBrowser(); }}>{existingMatch ? 'Gerar nova trajetória' : 'Gerar trajetória'}</StudioAction> : null}
                <StudioAction label="Gerar tracking na nuvem pelo Drive" disabled={!confirmed || !validOffset || cloudReady !== true || !!status} onPress={() => { void analyze(); }}>Testar Roboflow · experimental</StudioAction>
            </details>
            {existingMatch && onPlayback && !analysis && !status ? <StudioAction label="Reproduzir Drive com tracking existente" primary disabled={!confirmed || !validOffset || Number(offset) !== source?.offsetSeconds} onPress={() => { if (confirmed && validContext() && existingMatch && Number(offset) === source?.offsetSeconds) onPlayback(candidate.media, candidate.playbackUrl); }}>Usar trajetória salva</StudioAction> : null}

            {!existingMatch && !analysis && !status ? <StudioAction label="Processar neste aparelho sem salvar vídeo" primary={!existingMatch} disabled={!confirmed || !validOffset} onPress={() => { void analyzeBrowser(); }}>{existingMatch ? 'Gerar nova trajetória' : 'Gerar trajetória'}</StudioAction> : null}
            {analysis ? <><p role="status">{analysis.positions.length.toLocaleString('pt-BR')} posições · trajetória revisável</p><StudioAction label="Aplicar tracking do Drive" primary disabled={!confirmed || !validOffset || !!status || !analysis.positions.length} onPress={apply}>Aplicar trajetória</StudioAction></> : null}
        </> : null}
        {status ? <div className="sv-progress"><p role="status">{status}</p>{progress !== null ? <><progress value={progress} max={1} aria-label="Progresso do tracking por streaming"/><small>{Math.floor(progress * 100)}% · {videoTime(progress * (candidate?.media.duration ?? 0))} / {videoTime(candidate?.media.duration ?? 0)}</small></> : null}<StudioAction label="Cancelar tracking do Drive" onPress={() => { controller.current?.abort(); if (cloudRunning.current) setError('Consulta interrompida. O processamento remoto pode continuar.'); }}>Cancelar</StudioAction></div> : null}
        {error ? <p className="sv-alert" role="alert">{error}</p> : null}
    </>;
    return embedded ? content : <StudioDialog title="Vídeo" className="sv-tracking-setup sv-source-dialog" onClose={close}>{content}</StudioDialog>;
}
