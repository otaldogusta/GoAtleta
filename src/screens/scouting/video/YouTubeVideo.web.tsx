import { useEffect, useRef, type RefObject } from 'react';
import { mountYouTube, type VideoPlayback } from './youtube-player.web';

export function YouTubeVideo(props: { id: string; playback?: RefObject<VideoPlayback | null>; onReady?: (value: VideoPlayback) => void; onMetadata?: (duration: number) => void; onTick?: () => void; onState?: (playing: boolean) => void; onError: (message: string) => void }) {
    const container = useRef<HTMLDivElement>(null), latest = useRef(props);
    useEffect(() => { latest.current = props; });
    useEffect(() => {
        if (!container.current) return;
        const playback = props.playback;
        let owned: VideoPlayback | null = null;
        const dispose = mountYouTube(container.current, props.id, {
            ready: value => { owned = value; if (playback) playback.current = value; latest.current.onReady?.(value); },
            metadata: duration => latest.current.onMetadata?.(duration), tick: () => latest.current.onTick?.(),
            state: playing => latest.current.onState?.(playing), error: message => latest.current.onError(message),
        });
        return () => { if (playback?.current === owned) playback.current = null; dispose(); };
    }, [props.id, props.playback]);
    return <div className="sv-youtube" ref={container} aria-label="Player do YouTube"/>;
}
