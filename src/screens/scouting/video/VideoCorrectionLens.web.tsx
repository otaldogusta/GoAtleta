import { useRef, useState, type RefObject } from 'react';

/** A paused source frame, magnified around the pointer without another decoder. */
export function VideoCorrectionLens({ video, width, height }: {
    video: RefObject<HTMLVideoElement | null>; width: number; height: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [hover, setHover] = useState(false);
    return <div aria-label="Corrigir bola no vídeo" style={{ position: 'absolute', width, height, cursor: 'crosshair' }}
      onPointerLeave={() => setHover(false)} onPointerMove={event => {
        const media = video.current, context = canvas.current?.getContext('2d');
        if (!media || media.readyState < 2 || media.seeking || !context) { setHover(false); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * media.videoWidth;
        const y = (event.clientY - rect.top) / rect.height * media.videoHeight;
        const crop = Math.max(1, media.videoWidth / rect.width * 48);
        context.fillStyle = '#121c30'; context.fillRect(0, 0, 160, 160);
        context.drawImage(media, x - crop / 2, y - crop / 2, crop, crop, 0, 0, 160, 160);
        context.strokeStyle = '#fff'; context.lineWidth = 1;
        context.beginPath(); context.moveTo(72, 80); context.lineTo(88, 80);
        context.moveTo(80, 72); context.lineTo(80, 88); context.stroke();
        setHover(true);
      }}>
      <canvas ref={canvas} width={160} height={160} aria-label="Zoom da posição da bola"
        style={{ display: hover ? 'block' : 'none', position: 'absolute', top: 12, right: 12, width: 160, height: 160, border: '1px solid currentColor', borderRadius: 12, pointerEvents: 'none' }}/>
    </div>;
}
