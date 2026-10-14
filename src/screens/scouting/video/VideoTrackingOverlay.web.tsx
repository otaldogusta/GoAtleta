import { memo, useEffect, useRef, type RefObject } from 'react';
import type { BallPosition, VideoRally } from '../../../core/scouting-video';
import { trackingIndex, trackingTrail } from '../../../core/scouting-video-playback';

const EMPTY_CUTS: readonly number[] = [];

/** Frame drawing is isolated from the editor/gallery React tree. */
export const VideoTrackingOverlay = memo(function VideoTrackingOverlay({ video, source, positions, corrections, rallies, cuts = EMPTY_CUTS, timeOffset = 0, width, height, color, correctionColor, visible }: {
    video: RefObject<HTMLVideoElement | null>; source: string; positions: BallPosition[]; corrections: BallPosition[]; rallies: VideoRally[];
    cuts?: readonly number[]; timeOffset?: number; width: number; height: number; color: string; correctionColor: string; visible: boolean;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const node = video.current, layer = canvas.current;
        if (!node || !layer || !width || !height) return;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        layer.width = Math.round(width * ratio); layer.height = Math.round(height * ratio);
        const ctx = layer.getContext('2d'); if (!ctx) return;
        ctx.scale(ratio, ratio);
        let handle = 0, animation = 0, stopped = false;
        const draw = (mediaTime: number) => {
            ctx.clearRect(0, 0, width, height);
            if (!visible) return;
            const time = mediaTime + timeOffset;
            const corrected = corrections.findLast(p => Math.abs(p.time - time) < .025);
            const index = trackingIndex(positions, time), point = corrected ?? positions[index];
            if (!point) return;
            const cut = Math.max(rallies.findLast(r => r.start <= time + .001)?.start ?? 0, cuts.findLast(c => c <= time + .001) ?? 0);
            if (point.time < cut) return;
            if (!corrected) {
                const trail = trackingTrail(positions, index, cut);
                ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(p.x * width, p.y * height) : ctx.moveTo(p.x * width, p.y * height));
                ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.strokeStyle = corrected ? correctionColor : color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(point.x * width, point.y * height, 11, 0, Math.PI * 2); ctx.stroke();
        };
        const refresh = () => draw(node.currentTime);
        const frame = (_now: number, meta: VideoFrameCallbackMetadata) => { if (stopped) return; draw(meta.mediaTime); handle = node.requestVideoFrameCallback(frame); };
        const fallback = () => { if (stopped) return; if (!node.paused) refresh(); animation = requestAnimationFrame(fallback); };
        if (node.requestVideoFrameCallback) handle = node.requestVideoFrameCallback(frame);
        else animation = requestAnimationFrame(fallback);
        node.addEventListener('seeked', refresh); node.addEventListener('loadeddata', refresh); node.addEventListener('pause', refresh); refresh();
        return () => { stopped = true; if (handle) node.cancelVideoFrameCallback(handle); cancelAnimationFrame(animation); node.removeEventListener('seeked', refresh); node.removeEventListener('loadeddata', refresh); node.removeEventListener('pause', refresh); };
    }, [video, source, positions, corrections, rallies, cuts, timeOffset, width, height, color, correctionColor, visible]);
    return <canvas ref={canvas} aria-label="Posição da bola" role="img" style={{ position: 'absolute', width, height, pointerEvents: 'none' }} />;
});
