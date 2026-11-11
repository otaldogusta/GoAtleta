import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { liveQrSvg } from '../../../core/scouting-live-qr';
import { StudioAction } from './StudioUI.web';
import { startPhoneVideoReception } from './phone-video-pairing.web';
import type { PhoneVideoReceived } from './phone-video-transfer.web';

type Offer = { name: string; bytes: number };
type Scope = { org: string; classId: string; sessionId: string };

export function PhoneVideoReception({ scope, onReceive, clearError, error: importError, busy }: {
    scope: Scope;
    onReceive: (value: PhoneVideoReceived) => Promise<boolean>;
    clearError: () => void;
    error: string;
    busy: boolean;
}) {
    const { org, classId, sessionId } = scope;
    const [attempt, setAttempt] = useState(0);
    const [qr, setQr] = useState('');
    const [offer, setOffer] = useState<Offer | null>(null);
    const [percent, setPercent] = useState<number | null>(null);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState('');
    const panel = useRef<HTMLElement>(null);
    const receive = useRef(onReceive);
    const approval = useRef<((allowed: boolean) => void) | null>(null);
    useLayoutEffect(() => { receive.current = onReceive; }, [onReceive]);
    useLayoutEffect(() => { panel.current?.focus(); }, []);

    useEffect(() => {
        const task = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let senderReady = false;
        const pair = async () => {
            const reception = await startPhoneVideoReception({ org, classId, sessionId }, {
                signal: task.signal,
                accept: next => new Promise(resolve => {
                    if (task.signal.aborted || senderReady) { resolve(false); return; }
                    senderReady = true;
                    approval.current = resolve;
                    setQr(''); setOffer(next);
                }),
                onProgress: (bytes, total) => { if (!task.signal.aborted && total > 0) setPercent(Math.floor(bytes / total * 100)); },
            });
            // Register rejection handling even if the pane closed while pairing was created.
            void reception.file.catch(() => undefined);
            if (!task.signal.aborted) {
                const url = new URL(reception.url);
                if (url.origin !== window.location.origin || url.pathname !== '/scouting/enviar-video' || url.search)
                    throw new Error('O link para o celular é inválido.');
                if (!senderReady) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(liveQrSvg(url.href))}`);
                timer = setTimeout(() => {
                    if (senderReady) return;
                    setQr(''); setError('O QR expirou. Gere outro para enviar o vídeo.');
                    task.abort();
                }, Math.max(0, reception.expiresAt - Date.now()));
            }
            const original = await reception.file;
            if (task.signal.aborted) { await original.release(); return; }
            setOpening(true);
            let accepted = false;
            try { accepted = await receive.current(original); }
            finally { if (!accepted) await original.release(); }
            if (!accepted && !task.signal.aborted) throw new Error('Não foi possível abrir o MP4 nesta análise.');
        };
        void pair().catch(failure => {
            if (!task.signal.aborted) {
                setQr(''); setOffer(null); setPercent(null); setOpening(false);
                setError(current => current || (failure instanceof Error ? failure.message : 'Não foi possível receber o vídeo.'));
                task.abort();
            }
        });
        return () => {
            clearTimeout(timer);
            approval.current?.(false); approval.current = null;
            task.abort();
        };
    }, [org, classId, sessionId, attempt]);

    const respond = (allowed: boolean) => {
        const reply = approval.current;
        if (!reply) return;
        approval.current = null;
        setOffer(null);
        if (allowed) setPercent(0);
        else setError('Envio recusado. Gere outro QR para receber um vídeo.');
        reply(allowed);
    };
    const retry = () => {
        clearError(); setQr(''); setOffer(null); setPercent(null); setOpening(false); setError('');
        setAttempt(value => value + 1);
    };
    const feedback = importError || error;
    return <section ref={panel} className="sv-source-camera sv-phone-reception" tabIndex={-1} aria-label="Receber MP4 do celular">
        {feedback ? <><p className="sv-alert" role="alert">{feedback}</p><StudioAction label="Gerar outro QR" icon="qrCode" onPress={retry}>Gerar outro QR</StudioAction></> :
            opening ? <p role="status">{busy ? 'Reconhecendo o MP4…' : 'Abrindo o original…'}</p> :
            offer ? <><p>Receber <strong>{offer.name}</strong>?</p><div className="sv-wrap"><StudioAction label="Receber vídeo" primary onPress={() => respond(true)}>Receber vídeo</StudioAction><StudioAction label="Recusar envio" onPress={() => respond(false)}>Recusar</StudioAction></div></> :
            percent !== null ? <><p role="status">Recebendo o original · {percent}%</p><progress value={percent} max={100} aria-label="Progresso do recebimento"/></> :
            qr ? <><p>Escaneie o QR com o celular na mesma rede Wi‑Fi e escolha o MP4.</p><img className="sv-phone-qr" src={qr} alt="QR para enviar um MP4 pelo celular" width={196} height={196}/><p className="sv-section-meta">Mantenha esta análise e a página do celular abertas.</p></> :
            <p role="status">Preparando a conexão…</p>}
    </section>;
}
