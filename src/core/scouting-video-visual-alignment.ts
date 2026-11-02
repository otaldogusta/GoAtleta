import type { ScoutingRally } from './models';
import type { ScoutingVideoLink } from './scouting-video-links';
import type { ScoutingVideoVisualRally } from './scouting-video-alignment';
import type { VideoMedia } from './scouting-video';

export type VisualAlignmentRequest = {
    videoId: string; start: number; end: number; ourSide: 'near' | 'far';
    points: { number: number; won: boolean; skills: string[] }[]; anchors: { number: number; time: number }[];
};
export type VisualAlignmentResult = {
    videoId: string; start: number; end: number; model: string;
    rallies: { start: number; end: number | null; winner: 'near' | 'far' | 'unknown'; evidence: string }[]; limitations: string[];
};
export type VisualAlignmentCacheEntry = { sessionId: string; setNumber: number; request: VisualAlignmentRequest; result: VisualAlignmentResult | null; error?: string };
export type VisualAlignmentInput = {
    ourSide: 'near' | 'far'; points: ScoutingRally[]; anchors: ScoutingVideoLink[]; setNumber: number; sessionId: string;
    regulation?: { pointsToWin: number; cap: number };
    retryFailed?: boolean;
};

/** Factual observations remain reusable when manual anchors or team-side preferences change. */
export function uncoveredVisualAlignmentRequests(requests: VisualAlignmentRequest[], saved: { start: number; end: number }[]): VisualAlignmentRequest[] {
    return requests.flatMap(request => {
        let ranges = [{ start: request.start, end: request.end }];
        for (const cached of saved) ranges = ranges.flatMap(range => {
            if (cached.end <= range.start || cached.start >= range.end) return [range];
            return [...(cached.start > range.start ? [{ start: range.start, end: cached.start }] : []), ...(cached.end < range.end ? [{ start: cached.end, end: range.end }] : [])];
        });
        return ranges.map(range => ({ ...request, ...range }));
    });
}
const skills: Record<string, string | undefined> = { saque: 'Saque', recepcao: 'Recepção', levantamento: 'Levantamento', ataque: 'Ataque', bloqueio: 'Bloqueio', defesa: 'Defesa' };

/** Analyze only gaps bounded by confirmed references; never send names, IDs or existing footage again. */
export function planVisualAlignment(media: VideoMedia, input: VisualAlignmentInput): VisualAlignmentRequest[] {
    if (!media.youtubeId) throw new Error('A revisão visual requer um vídeo do YouTube associado.');
    const points = input.points.filter(point => point.sessionId === input.sessionId && point.setNumber === input.setNumber).sort((a,b) => a.number - b.number);
    if (!points.length) return [];
    const current = points.flatMap(point => {
        const link = input.anchors.find(anchor => anchor.sessionId === point.sessionId && anchor.rallyId === point.id);
        return link && !link.missing && link.time !== null ? [{ number: point.number, time: link.time }] : [];
    });
    const limit = input.regulation;
    const terminal = limit ? points.find(point => Math.max(point.scoreUs, point.scoreThem) >= limit.cap || (Math.max(point.scoreUs, point.scoreThem) >= limit.pointsToWin && Math.abs(point.scoreUs-point.scoreThem) >= 2)) : undefined;
    const pending = points.filter(point => (!terminal || point.number <= terminal.number) && !input.anchors.some(anchor => anchor.sessionId === point.sessionId && anchor.rallyId === point.id));
    const other = input.anchors.flatMap(anchor => {
        const point = input.points.find(point => point.sessionId === anchor.sessionId && point.id === anchor.rallyId);
        return point && !anchor.missing && anchor.time !== null ? [{ set: point.setNumber, time: anchor.time }] : [];
    });
    const lower = Math.max(0, ...other.filter(anchor => anchor.set < input.setNumber).map(anchor => anchor.time));
    const later = other.filter(anchor => anchor.set > input.setNumber).map(anchor => anchor.time);
    const upper = later.length ? Math.min(...later) : media.duration;
    const gaps: { start: number; end: number }[] = [];
    for (const point of pending) {
        const before = current.findLast(anchor => anchor.number < point.number), after = current.find(anchor => anchor.number > point.number);
        if (!before && !after) continue; // Require a reference for this set instead of scanning an unrelated match.
        const start = Math.max(lower, before?.time ?? lower), end = Math.min(upper, after?.time ?? upper);
        if (end > start) gaps.push({ start, end });
    }
    const merged: { start: number; end: number }[] = [];
    for (const gap of gaps.sort((a,b) => a.start-b.start)) {
        const previous = merged[merged.length-1];
        if (previous && gap.start <= previous.end) previous.end = Math.max(previous.end,gap.end);
        else merged.push({ ...gap });
    }
    const windows = merged.flatMap(gap => {
        const slices: { start: number; end: number }[] = [];
        for (let start = gap.start; start < gap.end; start += 60) slices.push({ start, end: Math.min(gap.end,start+60) });
        return slices;
    });
    const contextual = points.filter(point => !terminal || point.number <= terminal.number).slice(0, 60).map(point => ({ number: point.number, won: point.won, skills: [...new Set(point.contacts.flatMap(contact => skills[contact.fundamental] ? [skills[contact.fundamental]!] : []))] }));
    return windows.map(({start,end}) => ({ videoId: media.youtubeId!, start, end, ourSide: input.ourSide, points: contextual, anchors: current.slice(0,60) }));
}

export function parseVisualAlignmentResult(value: unknown, request: Pick<VisualAlignmentRequest, 'videoId' | 'start' | 'end'>): VisualAlignmentResult {
    const v = value as VisualAlignmentResult;
    const text = (s: unknown): s is string => typeof s === 'string' && s.length <= 600;
    if (!v || v.videoId !== request.videoId || v.start !== request.start || v.end !== request.end || !text(v.model) || !Array.isArray(v.rallies) || v.rallies.length > 100
        || !Array.isArray(v.limitations) || v.limitations.length > 20 || !v.limitations.every(text)
        || v.rallies.some(rally => !rally || !Number.isFinite(rally.start) || rally.start < request.start || rally.start >= request.end
            || !(rally.end === null || Number.isFinite(rally.end) && rally.end > rally.start && rally.end <= request.end)
            || !['near','far','unknown'].includes(rally.winner) || !text(rally.evidence))) throw new Error('A revisão visual retornou dados inválidos. Seus vínculos foram preservados.');
    return { videoId: v.videoId, start: v.start, end: v.end, model: v.model, rallies: v.rallies.map(({start,end,winner,evidence}) => ({start,end,winner,evidence})), limitations: [...v.limitations] };
}

export function visualRalliesForTeam(result: VisualAlignmentResult, side: 'near' | 'far'): ScoutingVideoVisualRally[] {
    return result.rallies.map(rally => ({ start: rally.start, end: rally.end, winner: rally.winner === 'unknown' ? null : rally.winner === side ? 'us' : 'them', evidence: rally.evidence }));
}

export function parseVisualAlignmentCache(raw: string | null, media: Pick<VideoMedia,'youtubeId'|'duration'>): VisualAlignmentCacheEntry[] {
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 240) throw new Error('Revisão visual salva inválida.');
    return value.entries.map((entry: VisualAlignmentCacheEntry) => {
        const request = entry?.request;
        if (!request || typeof entry.sessionId !== 'string' || !entry.sessionId || entry.sessionId.length > 128 || !Number.isSafeInteger(entry.setNumber) || entry.setNumber < 1
            || request.videoId !== media.youtubeId || !Number.isFinite(request.start) || !Number.isFinite(request.end) || request.end > media.duration || request.start < 0 || request.start >= request.end || request.end - request.start > 60
            || !['near','far'].includes(request.ourSide)) throw new Error('Revisão visual de outro vídeo.');
        if (entry.result === null) {
            if (typeof entry.error !== 'string' || !entry.error || entry.error.length > 600) throw new Error('Trecho pendente inválido.');
            return { sessionId: entry.sessionId, setNumber: entry.setNumber, request, result: null, error: entry.error };
        }
        return { sessionId: entry.sessionId, setNumber: entry.setNumber, request, result: parseVisualAlignmentResult(entry.result, request) };
    });
}
