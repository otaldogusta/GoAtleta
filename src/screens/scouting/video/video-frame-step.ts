import type { VideoPlayback } from './youtube-player.web';

// Fine adjustment at a 30 fps reference rate, not a claim about the source FPS.
// In particular, the YouTube iframe can round a seek to a buffered/key frame.
export function stepPlaybackFrame(player: VideoPlayback, direction: -1 | 1, start: number, end: number) {
    const current = player.currentTime;
    if (![current, start, end].every(Number.isFinite) || end <= start) return null;
    const target = Math.max(start, Math.min(end - .001, current + direction / 30));
    if (Math.abs(target - current) < .000001) return null;
    player.pause();
    player.currentTime = target;
    return player.currentTime;
}
