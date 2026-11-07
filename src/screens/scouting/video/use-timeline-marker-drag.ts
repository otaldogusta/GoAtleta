import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import type { TimelineScrubPointerEnd, TimelineScrubPointerStart } from './use-timeline-scrub';

type MarkerPointer = Pick<PointerEvent<HTMLElement>, 'button' | 'pointerId' | 'currentTarget' | 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'> & { isPrimary?: boolean };
type Gesture = { context: string; pointerId: number; x: number; y: number; target: HTMLElement; dragging: boolean };

function releasePointer(gesture: Gesture) {
    try {
        if (!gesture.target.hasPointerCapture || gesture.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture?.(gesture.pointerId);
    } catch { /* The browser may already have released a disconnected target. */ }
}

/** A click still selects a marker; only an actual drag delegates to the existing scrub. */
export function useTimelineMarkerDrag({ start, end, scope, trackRef, onStart, onChange, onEnd, onCancel, beforeDrag }: {
    start: number;
    end: number;
    scope: string;
    trackRef: RefObject<HTMLElement | null>;
    onStart: (event: TimelineScrubPointerStart) => void;
    onChange: (time: number) => void;
    onEnd: (event: TimelineScrubPointerEnd) => void;
    onCancel: () => void;
    beforeDrag?: () => void;
}) {
    const context = `${scope}:${start}:${end}`;
    const gesture = useRef<Gesture | null>(null), suppressClick = useRef(false), clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearClick = () => {
        if (clickTimer.current !== null) clearTimeout(clickTimer.current);
        clickTimer.current = null; suppressClick.current = false;
    };
    const suppressReleaseClick = () => {
        clearClick(); suppressClick.current = true;
        // Native click follows pointerup in this task. Do not retain the block for later input.
        clickTimer.current = setTimeout(() => { clickTimer.current = null; suppressClick.current = false; }, 0);
    };
    const cancel = (event?: TimelineScrubPointerEnd) => {
        const current = gesture.current;
        if (!current || event && event.pointerId !== current.pointerId) return;
        gesture.current = null;
        if (current.dragging) {
            suppressReleaseClick();
            try { onCancel(); } finally { releasePointer(current); }
        }
    };
    const position = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || rect.width <= 0 || !Number.isFinite(clientX)) return null;
        return Math.max(start, Math.min(Math.max(start, end - .001), start + (clientX - rect.left) / rect.width * (end - start)));
    };
    useEffect(() => () => {
        const current = gesture.current; gesture.current = null;
        if (current?.dragging) releasePointer(current);
        if (clickTimer.current !== null) clearTimeout(clickTimer.current);
        clickTimer.current = null; suppressClick.current = false;
    }, []);

    return {
        onPointerDown: (event: MarkerPointer) => {
            if (event.button !== 0 || event.isPrimary === false || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
            if (gesture.current?.context === context) return;
            if (gesture.current) cancel();
            clearClick();
            gesture.current = { context, pointerId: event.pointerId, x: event.clientX, y: event.clientY, target: event.currentTarget, dragging: false };
        },
        onPointerMove: (event: MarkerPointer) => {
            const current = gesture.current;
            if (!current || current.pointerId !== event.pointerId) return;
            if (current.context !== context) { cancel(event); return; }
            if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
            if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return;
            const value = position(event.clientX);
            if (value === null) { cancel(event); return; }
            if (!current.dragging) {
                current.dragging = true; beforeDrag?.();
                onStart({ button: 0, pointerId: current.pointerId, currentTarget: current.target });
            }
            event.preventDefault(); event.stopPropagation(); onChange(value);
        },
        onPointerUp: (event: MarkerPointer) => {
            const current = gesture.current;
            if (!current || current.pointerId !== event.pointerId) return;
            if (current.context !== context) { cancel(event); return; }
            if (!current.dragging) { gesture.current = null; return; }
            const value = position(event.clientX);
            if (value === null) { cancel(event); return; }
            gesture.current = null; suppressReleaseClick();
            event.preventDefault(); event.stopPropagation();
            try { onChange(value); onEnd({ pointerId: current.pointerId }); } finally { releasePointer(current); }
        },
        onPointerCancel: cancel,
        onLostPointerCapture: cancel,
        consumeClick: (event?: { detail: number }) => {
            // Keyboard activation is never the compatibility click from a pointer drag.
            if (event?.detail === 0) { clearClick(); return false; }
            if (!suppressClick.current) return false;
            clearClick(); return true;
        },
    };
}
