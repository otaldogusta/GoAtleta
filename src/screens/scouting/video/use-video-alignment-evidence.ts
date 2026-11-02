import { useEffect, useState } from 'react';
import type { VideoMedia } from '../../../core/scouting-video';
import type { VideoAiResult } from '../../../core/scouting-video-ai';
import { analysisCheckpointScope, loadAiCheckpoints } from './video-analysis-checkpoints';

/** Reuse visual observations already processed for this account, game and video. No API calls. */
export function useVideoAlignmentEvidence(user: string, org: string, session: string, media: VideoMedia) {
    const [state, setState] = useState<{ scope: string; observations: VideoAiResult[]; loading: boolean; error: string }>({ scope: '', observations: [], loading: true, error: '' });
    const [attempt, setAttempt] = useState(0);
    const scope = analysisCheckpointScope(user, org, session, media.fingerprint);
    const { youtubeId, duration } = media;
    useEffect(() => {
        let alive = true;
        setState({ scope, observations: [], loading: true, error: '' });
        void (youtubeId ? loadAiCheckpoints(scope, youtubeId, duration) : Promise.resolve([])).then(observations => {
            if (alive) setState({ scope, observations, loading: false, error: '' });
        }).catch(() => {
            if (alive) setState({ scope, observations: [], loading: false, error: 'Não foi possível carregar as observações do vídeo. Seus vínculos foram preservados.' });
        });
        return () => { alive = false; };
    }, [scope, youtubeId, duration, attempt]);
    const current = state.scope === scope ? state : { observations: [], loading: true, error: '' };
    return { observations: current.observations, loading: current.loading, error: current.error, retry: () => setAttempt(value => value + 1) };
}
