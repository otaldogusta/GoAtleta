import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Each inspector tab keeps its own scroll position for this video session. */
export function StudioPanel({ tab, children }: { tab: string; children: ReactNode }) {
    const panel = useRef<HTMLElement>(null);
    const positions = useRef<Record<string, number>>({});
    useLayoutEffect(() => {
        if (panel.current) panel.current.scrollTop = positions.current[tab] ?? 0;
    }, [tab]);
    return <section className="sv-panel" ref={panel} onScroll={event => {
        positions.current[tab] = event.currentTarget.scrollTop;
    }}>{children}</section>;
}
