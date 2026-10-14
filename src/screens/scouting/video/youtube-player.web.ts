import { youtubePlayerError } from '../../../core/scouting-video-youtube';

export type VideoPlayback = Pick<HTMLVideoElement, 'currentTime' | 'paused' | 'playbackRate' | 'play' | 'pause'>;
type YouTubePlayer = {
    getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
    getPlaybackRate(): number; setPlaybackRate(rate: number): void;
    seekTo(time: number, allow: boolean): void; playVideo(): void; pauseVideo(): void; destroy(): void;
};
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
    width: string; height: string; videoId: string; playerVars: Record<string, string | number>;
    events: { onReady(): void; onStateChange(): void; onError(event: { data: number }): void };
}) => YouTubePlayer };
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void };
let loading: Promise<YouTubeAPI> | undefined;
function loadAPI(): Promise<YouTubeAPI> {
    const host = window as YouTubeWindow;
    if (host.YT?.Player) return Promise.resolve(host.YT);
    if (loading) return loading;
    loading = new Promise<YouTubeAPI>((resolve, reject) => {
        const script = document.createElement('script'), prior = host.onYouTubeIframeAPIReady;
        const timer = setTimeout(() => fail(), 15000);
        const cleanup = () => { clearTimeout(timer); host.onYouTubeIframeAPIReady = prior; };
        const fail = () => { cleanup(); script.remove(); reject(new Error('Não foi possível conectar ao YouTube. Tente novamente.')); };
        host.onYouTubeIframeAPIReady = () => { cleanup(); prior?.(); if (host.YT?.Player) resolve(host.YT); else fail(); };
        script.src = 'https://www.youtube.com/iframe_api'; script.onerror = fail; document.head.appendChild(script);
    }).catch(error => { loading = undefined; throw error; });
    return loading;
}
export function youtubePlayback(player: YouTubePlayer): VideoPlayback {
    return {
        get currentTime() { return player.getCurrentTime(); },
        set currentTime(time) { const paused = player.getPlayerState() !== 1; player.seekTo(time, true); if (paused) player.pauseVideo(); },
        get paused() { return player.getPlayerState() !== 1; },
        get playbackRate() { return player.getPlaybackRate(); },
        set playbackRate(rate) { player.setPlaybackRate(rate); },
        async play() { player.playVideo(); }, pause() { player.pauseVideo(); },
    };
}
export function mountYouTube(container: HTMLElement, id: string, callbacks: {
    ready(playback: VideoPlayback): void; metadata(duration: number): void; tick(): void; state(playing: boolean): void; error(message: string): void;
}) {
    let disposed = false, failed = false, player: YouTubePlayer | undefined, timer: ReturnType<typeof setInterval> | undefined;
    const watchdog = setTimeout(() => { if (!disposed) { failed = true; callbacks.error('O YouTube demorou para responder. Verifique a conexão e tente novamente.'); } }, 20000);
    void loadAPI().then(api => {
        if (disposed) return;
        const element = document.createElement('div'); container.appendChild(element);
        let announced = false;
        const update = () => {
            if (!player || disposed || failed) return;
            const duration = player.getDuration();
            if (!announced && Number.isFinite(duration) && duration > 0) { announced = true; clearTimeout(watchdog); callbacks.metadata(duration); }
            callbacks.tick();
        };
        player = new api.Player(element, { width: '100%', height: '100%', videoId: id,
            playerVars: { playsinline: 1, controls: 1, origin: window.location.origin },
            events: {
                onReady: () => { if (!disposed && player) { callbacks.ready(youtubePlayback(player)); update(); timer = setInterval(update, 200); } },
                onStateChange: () => { if (!disposed && player) { callbacks.state(player.getPlayerState() === 1); update(); } },
                onError: event => { if (!disposed) { failed = true; clearTimeout(watchdog); callbacks.state(false); callbacks.error(youtubePlayerError(event.data)); } },
            },
        });
    }).catch(error => { clearTimeout(watchdog); if (!disposed) callbacks.error(error.message); });
    return () => { disposed = true; clearTimeout(watchdog); clearInterval(timer); player?.destroy(); container.replaceChildren(); };
}
