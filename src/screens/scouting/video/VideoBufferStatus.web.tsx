import { useEffect, useState, useRef, type RefObject } from 'react';
import { ActivityIndicator } from 'react-native';
import { StudioAction } from './StudioUI.web';

/** Keep recovery local to the media element; never reopen or replace the draft. */
export function VideoBufferStatus({ video, source }: { video: RefObject<HTMLVideoElement | null>; source: string }) {
    const retryTime = useRef<number | null>(null);
    const cancelRetry = useRef<(() => void) | null>(null);
    const [waiting, setWaiting] = useState(false), [retry, setRetry] = useState(false);
    useEffect(() => {
        const node = video.current;
        if (!node) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const check = () => {
            const pending = node.readyState < 2 || node.seeking;
            setWaiting(pending);
            if (!pending) { clearTimeout(timer); timer = undefined; setRetry(false); }
            else if (!timer) timer = setTimeout(() => setRetry(true), 8000);
        };
        const events = ['waiting', 'stalled', 'seeking', 'seeked', 'loadeddata', 'canplay', 'playing', 'error', 'emptied'] as const;
        events.forEach(event => node.addEventListener(event, check)); check();
        return () => { cancelRetry.current?.(); clearTimeout(timer); events.forEach(event => node.removeEventListener(event, check)); };
    }, [video, source]);
    if (!waiting) return null;
    return <div className="sv-buffer-status" role="status"><ActivityIndicator size="small"/><span>Carregando vídeo…</span>{retry ? <StudioAction label="Retomar carregamento do vídeo" onPress={() => {
        const node = video.current;
        if (!node) return;
        const time = retryTime.current ?? node.currentTime;
        retryTime.current = time;
        cancelRetry.current?.();
        const restore = () => {
            node.currentTime = time;
            retryTime.current = null;
            void node.play().catch(() => undefined);
        };
        node.addEventListener('loadedmetadata', restore, { once: true });
        cancelRetry.current = () => node.removeEventListener('loadedmetadata', restore);
        node.pause();
        node.load();
    }}>Tentar novamente</StudioAction> : null}</div>;
}
