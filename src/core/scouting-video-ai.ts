import type { VideoDocument, VideoSide, VideoSkill } from './scouting-video';
import { videoSkills } from './scouting-video';

export type VideoAiContact = { time: number; skill: VideoSkill; side: 'near' | 'far' | 'unknown'; evidence: string };
export type VideoAiResult = { videoId: string; start: number; end: number; model: string; rallies: { start: number; end: number | null; evidence: string }[]; contacts: VideoAiContact[]; limitations: string[] };

export function parseVideoAiResult(value: unknown, videoId: string, start: number, end: number): VideoAiResult {
    const v = value as VideoAiResult;
    const time = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= start && n < end;
    const text = (s: unknown): s is string => typeof s === 'string' && s.length <= 600;
    if (!v || v.videoId !== videoId || v.start !== start || v.end !== end || !text(v.model) ||
        !Array.isArray(v.rallies) || v.rallies.length > 100 || !Array.isArray(v.contacts) || v.contacts.length > 500 ||
        !Array.isArray(v.limitations) || v.limitations.length > 20 || !v.limitations.every(text) ||
        v.rallies.some(r => !r || !time(r.start) || !(r.end === null || (typeof r.end === 'number' && Number.isFinite(r.end) && r.end > r.start && r.end <= end)) || !text(r.evidence)) ||
        v.contacts.some(c => !c || !time(c.time) || !videoSkills.includes(c.skill) || !['near', 'far', 'unknown'].includes(c.side) || !text(c.evidence))) {
        throw new Error('A IA retornou sugestões inválidas. Nenhuma marcação foi alterada.');
    }
    return { videoId, start, end, model: v.model, rallies: v.rallies.map(r => ({ start: r.start, end: r.end, evidence: r.evidence })), contacts: v.contacts.map(c => ({ time: c.time, skill: c.skill, side: c.side, evidence: c.evidence })), limitations: [...v.limitations] };
}

/** Suggestions never overwrite human marks, scores, identities or tracking. */
export function applyVideoAi(doc: VideoDocument, results: VideoAiResult[], near: VideoSide, id: () => string): VideoDocument {
    let rallies = [...doc.rallies], contacts = [...doc.contacts];
    for (const result of results) {
        if (result.end > doc.media.duration || result.start < 0 || result.end <= result.start) throw new Error('Trecho fora deste vídeo.');
        const r = parseVideoAiResult(result, doc.media.youtubeId ?? '', result.start, result.end);
        for (const cut of r.rallies) {
            if (cut.start <= 0 || rallies.some(x => Math.abs(x.start - cut.start) < 1)) continue;
            // Do not divide an already scored/reviewed rally automatically.
            const current = [...rallies].sort((a,b) => a.start-b.start).findLast(x => x.start < cut.start);
            if (current && (current.reviewed || current.winner || current.pointTime !== undefined)) continue;
            rallies.push({ id: id(), start: cut.start, winner: null, reviewed: false });
        }
        for (const c of r.contacts) {
            if (c.side === 'unknown') continue;
            const team = c.side === 'near' ? near : near === 'us' ? 'them' : 'us';
            if (!contacts.some(x => x.team === team && x.skill === c.skill && Math.abs(x.time - c.time) < 1))
                contacts.push({ id: id(), time: c.time, skill: c.skill, team, athlete: '', studentId: null, outcome: '' });
        }
    }
    if (rallies.length > 2000 || contacts.length > 20000) throw new Error('Limite de marcações excedido.');
    rallies = rallies.sort((a,b) => a.start-b.start); contacts = contacts.sort((a,b) => a.time-b.time);
    return { ...doc, rallies, contacts };
}
