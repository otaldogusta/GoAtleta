import { parseVideoAiResult, type VideoAiResult } from '../../../core/scouting-video-ai';
import { getVideoDraft, persistVideoDraft } from './video-draft-storage';

export function analysisCheckpointScope(user: string, org: string, session: string, fingerprint: string) {
    if (![user, org, session, fingerprint].every(Boolean)) throw new Error('Escopo da análise incompleto.');
    return `goatleta:video-analysis:v1:${[user, org, session, fingerprint].map(encodeURIComponent).join(':')}`;
}
export async function loadAiCheckpoints(scope: string, videoId: string, duration: number): Promise<VideoAiResult[]> {
    const raw = await getVideoDraft(`${scope}:youtube`);
    if (!raw) return [];
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 120) throw new Error('Progresso local inválido.');
    return values.map(value => {
        if (value.end > duration || value.start % 60 !== 0 || value.end !== Math.min(duration, value.start + 60)) throw new Error('Progresso de outro trecho.');
        return parseVideoAiResult(value, videoId, value.start, value.end);
    });
}
export const saveAiCheckpoints = (scope: string, values: VideoAiResult[]) => persistVideoDraft(`${scope}:youtube`, JSON.stringify(values));
