import { useEffect, useState } from 'react';
import type { BallPosition, VideoDocument } from '../../../core/scouting-video';
import { loadFullTracking, matchingFullTracking } from './long-video-tracking';

/** Never replace a differently edited/imported track with a local checkpoint. */
export function useFullVideoTracking(scope: string | null, doc: VideoDocument | null) {
    const analysis = doc?.analysis;
    const [loaded, setLoaded] = useState<{ scope: string; analysis: typeof analysis; positions: BallPosition[] } | null>(null);
    useEffect(() => {
        let alive = true;
        if (!scope || !analysis?.source || !['vballnet-v2b-browser-1', 'vballnet-v4c-browser-1'].includes(analysis.model)) return;
        const { offsetSeconds, ...media } = analysis.source;
        void loadFullTracking(scope, media, analysis.model === 'vballnet-v4c-browser-1' ? 'v4c' : 'v2b').then(full => {
            if (!alive || !full) return;
            const normalized = matchingFullTracking(full, analysis.positions, offsetSeconds, doc!.media.duration);
            if (!normalized) return;
            setLoaded({ scope, analysis, positions: normalized });
        }).catch(() => { /* The synchronized preview remains usable if this device has no full checkpoint. */ });
        return () => { alive = false; };
    }, [scope, analysis, doc?.media.duration]);
    return loaded?.scope === scope && loaded?.analysis === analysis ? loaded?.positions : undefined;
}
