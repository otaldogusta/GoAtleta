import type { ScoutingRally } from './models';
import type { VideoDocument } from './scouting-video';

export type ScoutingVideoLink = { sessionId: string; rallyId: string; videoRallyId: string | null; time: number | null; missing: boolean };
export type ScoutingVideoLinks = { version: 1; sessionIds: string[]; links: ScoutingVideoLink[] };
export const emptyScoutingVideoLinks = (): ScoutingVideoLinks => ({ version: 1, sessionIds: [], links: [] });
export const pointLinkKey = (session: string, rally: string) => JSON.stringify([session, rally]);
export function scoutingVideoLinksKey(user: string, org: string, classId: string, session: string, fingerprint: string) {
    if (![user, org, classId, session, fingerprint].every(Boolean)) throw new Error('Escopo do vínculo incompleto.');
    return `goatleta:scouting-video-links:v1:${[user, org, classId, session, fingerprint].map(encodeURIComponent).join(':')}`;
}
export function parseScoutingVideoLinks(value: unknown, duration: number): ScoutingVideoLinks {
    const v = value as ScoutingVideoLinks;
    const id = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 200;
    if (!v || v.version !== 1 || !Array.isArray(v.sessionIds) || v.sessionIds.length > 50 || !v.sessionIds.every(id)
        || new Set(v.sessionIds).size !== v.sessionIds.length || !Array.isArray(v.links) || v.links.length > 2000) throw new Error('Vínculos locais inválidos.');
    const points = new Set<string>(), videos = new Set<string>();
    for (const link of v.links) {
        const key = pointLinkKey(link?.sessionId, link?.rallyId);
        if (!link || !id(link.rallyId) || !v.sessionIds.includes(link.sessionId) || points.has(key) || typeof link.missing !== 'boolean'
            || (link.missing ? link.time !== null || link.videoRallyId !== null : !id(link.videoRallyId) || !Number.isFinite(link.time) || link.time! < 0 || link.time! >= duration || videos.has(link.videoRallyId!))) throw new Error('Correspondência de ponto inválida.');
        points.add(key); if (link.videoRallyId) videos.add(link.videoRallyId);
    }
    return { version: 1, sessionIds: [...v.sessionIds], links: v.links.map(l => ({ sessionId: l.sessionId, rallyId: l.rallyId, videoRallyId: l.videoRallyId, time: l.time, missing: l.missing })) };
}
export function savePointVideoLink(current: ScoutingVideoLinks, point: ScoutingRally, video: VideoDocument, time: number | null): ScoutingVideoLinks {
    if (!current.sessionIds.includes(point.sessionId)) throw new Error('Vincule a análise de origem primeiro.');
    const rally = time === null ? null : video.rallies.findLast(r => r.start <= time);
    if (time !== null && (!Number.isFinite(time) || time < 0 || time >= video.media.duration || !rally)) throw new Error('Escolha um instante deste vídeo.');
    const key = pointLinkKey(point.sessionId, point.id);
    const links = current.links.filter(l => pointLinkKey(l.sessionId, l.rallyId) !== key);
    if (rally && links.some(l => l.videoRallyId === rally.id)) throw new Error('Este recorte já está ligado a outro ponto. Revise o vínculo existente.');
    return parseScoutingVideoLinks({ ...current, links: [...links, { sessionId: point.sessionId, rallyId: point.id, time, videoRallyId: rally?.id ?? null, missing: time === null }] }, video.media.duration);
}
/** A nearby clock anchor offers a navigation hint, never a confirmed match or a score. */
export function suggestPointVideoTime(point: ScoutingRally, points: ScoutingRally[], links: ScoutingVideoLinks, duration: number): number | null {
    const target = Date.parse(point.createdAt);
    if (!Number.isFinite(target)) return null;
    const anchors = links.links.flatMap(link => {
        const source = points.find(p => p.id === link.rallyId && p.sessionId === link.sessionId);
        const at = source ? Date.parse(source.createdAt) : NaN;
        return !link.missing && link.time !== null && source?.sessionId === point.sessionId && source.setNumber === point.setNumber && Number.isFinite(at)
            ? [{ time: link.time, delta: (target - at) / 1000 }] : [];
    }).sort((a,b) => Math.abs(a.delta)-Math.abs(b.delta));
    // Long gaps/pause edits and neighboring sets cannot establish a usable clock offset.
    if (!anchors[0] || Math.abs(anchors[0].delta) > 300) return null;
    const time = anchors[0].time + anchors[0].delta;
    return time >= 0 && time < duration ? time : null;
}
