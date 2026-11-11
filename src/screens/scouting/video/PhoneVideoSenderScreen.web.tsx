import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppTheme } from '../../../ui/app-theme';
import { markRender, measureAsync } from '../../../observability/perf';
import { StudioAction } from './StudioUI.web';
import { studioStyles } from './studio-styles';
import { connectPhoneVideoSender } from './phone-video-pairing.web';
import { phoneVideoOffer, sendPhoneVideo } from './phone-video-transfer.web';

type Access = { id: string; code: string };
type Phase = 'idle' | 'connecting' | 'transferring' | 'done';

// The router can remount the sender while initializing the same document.
const accessByDocument = new WeakMap<Document, Access>();

function readPhoneVideoAccess(hash: string): Access | null {
    const match = /^#id=([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})&code=([0-9a-f]{64})$/.exec(hash);
    return match ? { id: match[1], code: match[2] } : null;
}

export default function PhoneVideoSenderScreen() {
    markRender('screen.scouting.phone-video.render.web');
    const { colors } = useAppTheme();
    const [access, setAccess] = useState<Access | null | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [percent, setPercent] = useState(0);
    const [error, setError] = useState('');
    const savedAccess = useRef<Access | null | undefined>(undefined);
    const active = useRef<AbortController | null>(null);
    const fileInput = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const read = () => {
            const entry = window as Window & { __goAtletaPhoneVideoFragment?: string };
            const locationHash = window.location.hash;
            const hash = locationHash || entry.__goAtletaPhoneVideoFragment;
            delete entry.__goAtletaPhoneVideoFragment;
            if (hash) {
                const scanned = readPhoneVideoAccess(hash);
                if (scanned) accessByDocument.set(window.document, scanned);
                else accessByDocument.delete(window.document);
            }
            if (locationHash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
            const nextAccess = accessByDocument.get(window.document) ?? null;
            if (savedAccess.current === nextAccess) return;
            savedAccess.current = nextAccess;
            active.current?.abort(); active.current = null;
            setAccess(nextAccess); setFile(null); setPhase('idle'); setError(''); setPercent(0);
        };
        read();
        window.addEventListener('hashchange', read);
        return () => { active.current?.abort(); active.current = null; window.removeEventListener('hashchange', read); };
    }, []);

    const send = async () => {
        if (!access || !file || active.current) return;
        const task = new AbortController();
        active.current = task;
        setPhase('connecting'); setError(''); setPercent(0);
        let channel: RTCDataChannel | undefined;
        try {
            channel = await measureAsync('screen.scouting.phone-video.load.web', () => connectPhoneVideoSender(access.id, access.code, task.signal));
            task.signal.throwIfAborted();
            await sendPhoneVideo(channel, file, {
                signal: task.signal,
                onProgress: (bytes, total) => {
                    if (task.signal.aborted) return;
                    setPhase('transferring'); setPercent(Math.floor(bytes / total * 100));
                },
            });
            if (!task.signal.aborted) { setPhase('done'); setFile(null); }
        } catch (failure) {
            if (!task.signal.aborted) {
                setPhase('idle');
                setError(failure instanceof Error ? failure.message : 'Não foi possível enviar. Abra um novo QR no Estúdio.');
            }
        } finally {
            channel?.close();
            if (active.current === task) active.current = null;
        }
    };

    const pending = phase === 'connecting' || phase === 'transferring';
    const themes = {
        '--sv-bg': colors.background, '--sv-panel': colors.card, '--sv-text': colors.text,
        '--sv-muted': colors.muted, '--sv-line': colors.border, '--sv-green': colors.primaryBg,
    } as CSSProperties;
    return <main className="sv sv-shared-status sv-phone-sender" style={themes}>
        <style>{studioStyles}</style>
        <section aria-label="Enviar MP4 ao Estúdio">
            <h1>Enviar vídeo ao Estúdio</h1>
            {access === undefined ? <p role="status">Abrindo conexão…</p> : !access ? <p role="alert">Abra um novo QR em Adicionar vídeo no Estúdio.</p> :
                phase === 'done' ? <p role="status">Original entregue ao Estúdio. Você pode fechar esta página.</p> : <>
                    <p>Escolha o MP4 original. Mantenha o celular e o notebook na mesma rede Wi‑Fi.</p>
                    <input ref={fileInput} type="file" accept="video/mp4,.mp4" hidden onChange={event => {
                        const picked = event.target.files?.[0]; event.target.value = '';
                        if (!picked) return;
                        try { phoneVideoOffer(picked); setFile(picked); setError(''); }
                        catch (failure) { setFile(null); setError(failure instanceof Error ? failure.message : 'Escolha um MP4 válido.'); }
                    }}/>
                    {file ? <p className="sv-media-meta">{file.name}</p> : null}
                    {phase === 'connecting' ? <p role="status">Aguardando confirmação no notebook…</p> : null}
                    {phase === 'transferring' ? <><p role="status">Enviando o original · {percent}%</p><progress value={percent} max={100} aria-label="Progresso do envio"/></> : null}
                    {error ? <p role="alert" className="sv-alert">{error}</p> : null}
                    <div className="sv-wrap">{pending ? <StudioAction label="Cancelar envio" onPress={() => {
                        active.current?.abort(); active.current = null; setPhase('idle'); setError('Envio cancelado. Abra um novo QR para tentar novamente.');
                    }}>Cancelar envio</StudioAction> : <>
                        <StudioAction label="Escolher MP4" primary={!file} icon="video" onPress={() => fileInput.current?.click()}>Escolher MP4</StudioAction>
                        {file ? <StudioAction label="Enviar MP4" primary onPress={() => { void send(); }}>Enviar MP4</StudioAction> : null}
                    </>}</div>
                </>}
        </section>
    </main>;
}
