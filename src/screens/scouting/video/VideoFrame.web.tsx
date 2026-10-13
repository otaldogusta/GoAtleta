import { memo, useEffect, useRef, type RefObject } from 'react';
import { presentVideoFrames } from './video-frame.web';

export const VideoFrame = memo(function VideoFrame({ video, source, width, height }: {
    video: RefObject<HTMLVideoElement | null>; source: string; width: number; height: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (video.current && canvas.current) return presentVideoFrames(video.current, canvas.current);
    }, [video, source]);
    return <canvas ref={canvas} className="sv-video-frame" aria-hidden="true" style={{ position: 'absolute', width, height, pointerEvents: 'none' }} />;
});
