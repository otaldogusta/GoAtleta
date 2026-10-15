import { useRef, useState, type PointerEvent } from 'react';

/** Keep pointer feedback local; decoding a video frame is committed on release. */
export function useTimelineScrub({ time, start, end, scope, onSeek }: {
    time: number; start: number; end: number; scope: string; onSeek: (time: number) => void;
}) {
    const context = `${scope}:${start}:${end}`;
    const gesture = useRef<{ context: string; pointerId: number; time: number } | null>(null);
    const [preview, setPreview] = useState<{ context: string; time: number } | null>(null);
    const active = preview?.context === context;
    const cancel = () => { gesture.current = null; setPreview(null); };
    const onChange = (value: number) => {
        if (!Number.isFinite(value)) return;
        const position = Math.max(start, Math.min(end - .001, value));
        if (gesture.current) {
            if (gesture.current.context !== context) return;
            gesture.current.time = position;
            setPreview({ context, time: position });
        } else { cancel(); onSeek(position); }
    };
    return {
        active, time: active ? preview.time : time,
        onChange,
        onPointerDown: (event: PointerEvent<HTMLInputElement>) => {
            if (event.button !== 0 || gesture.current?.context === context) return;
            gesture.current = { context, pointerId: event.pointerId, time };
            setPreview({ context, time });
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerUp: (event: PointerEvent<HTMLInputElement>) => {
            const current = gesture.current;
            if (!current || current.pointerId !== event.pointerId) return;
            cancel();
            if (current.context === context) onSeek(current.time);
        },
        onPointerCancel: cancel,
    };
}
