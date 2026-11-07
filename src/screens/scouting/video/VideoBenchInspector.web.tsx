import type { ReactNode } from 'react';
import { StudioDialog } from './StudioUI.web';

/** The existing inspector is an on-demand tool, without moving playback ownership. */
export function VideoBenchInspector({ bench, open, onClose, toolbar, children }: {
    bench?: boolean;
    open: boolean;
    onClose: () => void;
    toolbar: ReactNode;
    children: ReactNode;
}) {
    if (!bench) return children;
    if (!open) return null;
    return <StudioDialog title="Ferramentas do vídeo" className="sv-bench-tools" onClose={onClose}>
        {toolbar}{children}
    </StudioDialog>;
}
