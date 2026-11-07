import type { VideoAnalysisSource, VideoMedia } from '../../../core/scouting-video';
import type { VideoPlayback } from './youtube-player.web';

/** File names and timeline alignment do not identify the associated original. */
export function matchesTrackingOriginal(media: VideoMedia, source: VideoAnalysisSource): boolean {
    const tolerance = .1 + Number.EPSILON * Math.max(1, media.duration, source.duration);
    return media.fingerprint === source.fingerprint &&
        Number.isFinite(media.duration) && media.duration >= 0 && Number.isFinite(source.duration) && source.duration >= 0 &&
        Math.abs(media.duration - source.duration) <= tolerance &&
        media.width === source.width && media.height === source.height;
}

/** Keep the studio on the YouTube timeline while displaying the associated original. */
export function originalPlayback(video: HTMLVideoElement, offsetSeconds = 0, maxOffsetSeconds = 1800): VideoPlayback {
    if (!Number.isFinite(maxOffsetSeconds) || maxOffsetSeconds <= 0 || maxOffsetSeconds > 7200 || !Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > maxOffsetSeconds)
        throw new RangeError(maxOffsetSeconds === 1800 ? 'O alinhamento do vídeo original deve estar entre -1.800 e 1.800 segundos.' : 'O deslocamento da prévia local excede o limite permitido.');
    return {
        get currentTime() { return video.currentTime + offsetSeconds; },
        set currentTime(time) {
            if (!Number.isFinite(time)) return;
            const end = Number.isFinite(video.duration) ? Math.max(0, video.duration - .001) : Infinity;
            video.currentTime = Math.min(end, Math.max(0, time - offsetSeconds));
        },
        get paused() { return video.paused; },
        get playbackRate() { return video.playbackRate; },
        set playbackRate(rate) { video.playbackRate = rate; },
        play() { return video.play(); },
        pause() { video.pause(); },
    };
}
