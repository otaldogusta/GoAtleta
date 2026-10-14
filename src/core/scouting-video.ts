// Video annotations are review material, not official scouting actions or points.
export const videoSkills = ['Saque', 'Recepção', 'Levantamento', 'Ataque', 'Bloqueio', 'Defesa', 'Bola de graça', 'Cobertura de ataque'] as const;
export type VideoSkill = typeof videoSkills[number];
export type VideoSide = 'us' | 'them';
export const videoOutcomes: Record<VideoSkill, readonly string[]> = {
    Saque: ['Em jogo', 'Ace', 'Erro'], Recepção: ['Controlada', 'Limitou o ataque', 'Bola devolvida direto', 'Erro'],
    Levantamento: ['Atacável', 'Fora de condição', 'Bola enviada ao adversário', 'Erro'],
    Ataque: ['Em jogo', 'Ponto de ataque', 'Bloqueado', 'Erro'], Bloqueio: ['Bola segue em jogo', 'Ponto de bloqueio', 'Erro'],
    Defesa: ['Controlada', 'Bola segue em jogo', 'Erro'], 'Bola de graça': ['Em jogo', 'Ponto direto', 'Erro'],
    'Cobertura de ataque': ['Controlada', 'Bola segue em jogo', 'Erro'],
};
export const videoSkillLetters: Record<VideoSkill, string> = { Saque: 'S', Recepção: 'P', Levantamento: 'L', Ataque: 'A', Bloqueio: 'B', Defesa: 'D', 'Bola de graça': 'F', 'Cobertura de ataque': 'C' };
export type VideoMedia = {
    youtubeId?: string;
    fingerprint: string;
    name: string;
    duration: number;
    width: number;
    height: number;
};
export type VideoContact = {
    id: string;
    time: number;
    skill: VideoSkill;
    team: VideoSide;
    athlete: string;
    studentId: string | null;
    outcome: string;
};
export type VideoRally = {
    id: string;
    start: number;
    winner: VideoSide | null;
    reviewed: boolean;
    pointTime?: number;
};
export type BallPosition = {
    time: number;
    x: number;
    y: number;
};
/** Identity of an explicitly matched original; never a playable URL or local path. */
export type VideoAnalysisSource = {
    fingerprint: string;
    name: string;
    duration: number;
    width: number;
    height: number;
    /** youtubeTime = originalTime + offsetSeconds. */
    offsetSeconds: number;
};
export type VideoAnalysis = { model: 'vballnet-v2b-browser-1' | 'vballnet-v2b-local' | 'vballnet-v4c-browser-1' | 'roboflow-volleyball-v2-3'; sampledFps: 30; positions: BallPosition[]; cuts: number[]; source?: VideoAnalysisSource };
export type VideoDocument = {
    analysis?: VideoAnalysis;
    version: 1;
    media: VideoMedia;
    rallies: VideoRally[];
    contacts: VideoContact[];
    corrections: BallPosition[];
};
export type VideoEdit = {
    label: string;
    at: string;
    before: VideoDocument;
    after: VideoDocument;
};
export type VideoHistory = {
    present: VideoDocument;
    past: VideoEdit[];
    future: VideoEdit[];
};
export function videoDraftKey(user: string, org: string, session: string, fingerprint: string) {
    if (![user, org, session, fingerprint].every(Boolean))
        throw new Error('Escopo da análise incompleto.');
    return `goatleta:scouting-video:v1:${[user, org, session, fingerprint].map(encodeURIComponent).join(':')}`;
}
export function newVideoDocument(media: VideoMedia, rallyId: string): VideoDocument {
    return { version: 1, media, rallies: [{ id: rallyId, start: 0, winner: null, reviewed: false }], contacts: [], corrections: [] };
}
/** Explicit acceptance may initialize a blank timeline, never replace human edits. */
export function acceptVideoAnalysis(doc: VideoDocument, analysis: VideoAnalysis): VideoDocument {
    const blank = doc.rallies.length === 1 && !doc.rallies[0].winner && doc.rallies[0].pointTime === undefined && !doc.rallies[0].reviewed && !doc.contacts.length && !doc.corrections.length;
    if (blank && analysis.cuts.length >= 2000) throw new Error('A análise excede o limite de 2.000 rallies.');
    return { ...doc, analysis, rallies: blank ? [doc.rallies[0], ...analysis.cuts.map((start, i) => {
        const id = `suggested-cut-${i}`;
        return { id: id === doc.rallies[0].id ? `${id}-new` : id, start, winner: null, reviewed: false };
    })] : doc.rallies };
}
export function videoRallyIndex(doc: VideoDocument, time: number) {
    // Media elements round currentTime; tolerate sub-millisecond seek precision.
    return Math.max(0, doc.rallies.findLastIndex(r => r.start <= time + .001));
}
export function videoRange(doc: VideoDocument, id: string | null): [
    number,
    number
] {
    const i = doc.rallies.findIndex(r => r.id === id);
    return i < 0 ? [0, doc.media.duration] : [doc.rallies[i].start, doc.rallies[i + 1]?.start ?? doc.media.duration];
}
export function videoContacts(doc: VideoDocument, id: string) {
    const [start, end] = videoRange(doc, id);
    return doc.contacts.filter(c => c.time >= start && c.time < end).sort((a, b) => a.time - b.time);
}
export function markVideoPoint(doc: VideoDocument, id: string, time: number | null): VideoDocument {
    const [start, end] = videoRange(doc, id);
    if (!doc.rallies.some(r => r.id === id) || (time !== null && (!Number.isFinite(time) || time < start || time >= end)))
        throw new Error('Marque o ponto dentro do rally.');
    return { ...doc, rallies: doc.rallies.map(r => r.id === id ? { ...r, pointTime: time ?? undefined } : r) };
}
export function splitVideoRally(doc: VideoDocument, time: number, id: string): VideoDocument {
    if (!Number.isFinite(time) || time <= 0 || time >= doc.media.duration || doc.rallies.some(r => Math.abs(r.start - time) < .1))
        throw new Error('Escolha outro instante para iniciar o rally.');
    // Splitting a scored segment requires reconfirming both results.
    const current = videoRallyIndex(doc, time);
    return { ...doc, rallies: [...doc.rallies.map((r, i) => i === current ? { ...r, winner: null, pointTime: undefined, reviewed: false } : r), { id, start: time, winner: null, reviewed: false }].sort((a, b) => a.start - b.start) };
}
export function mergeVideoRally(doc: VideoDocument, id: string): VideoDocument {
    const i = doc.rallies.findIndex(r => r.id === id);
    if (i <= 0)
        throw new Error('Este rally não tem um recorte anterior.');
    return { ...doc, rallies: doc.rallies.filter(r => r.id !== id).map((r, index) => index === i - 1 ? { ...r, winner: null, pointTime: undefined, reviewed: false } : r) };
}
export function editVideo(history: VideoHistory, next: VideoDocument, label: string): VideoHistory {
    if (JSON.stringify(next) === JSON.stringify(history.present))
        return history;
    return { present: next, past: [...history.past.slice(-49), { label, at: new Date().toISOString(), before: history.present, after: next }], future: [] };
}
export function undoVideo(history: VideoHistory, redo = false): VideoHistory {
    const source = redo ? history.future : history.past, edit = source.at(-1);
    if (!edit)
        return history;
    return redo ? { present: edit.after, past: [...history.past, edit], future: source.slice(0, -1) } : { present: edit.before, past: source.slice(0, -1), future: [...history.future, edit] };
}
export function videoTime(time: number, precise = false) {
    const ms = Math.max(0, Math.round(time * 1000));
    return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${precise ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
function parseAnalysisSource(value: unknown, media: VideoMedia): VideoAnalysisSource {
    const s = value as VideoAnalysisSource;
    if (!media.youtubeId || media.fingerprint !== `youtube:${media.youtubeId}` || !s ||
        typeof s.fingerprint !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(s.fingerprint) ||
        typeof s.name !== 'string' || !s.name.trim() || s.name.length > 300 || /[\\/:\u0000-\u001f\u007f]/.test(s.name) ||
        !finite(s.duration) || s.duration <= 0 || s.duration > 86400 ||
        !Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width <= 0 || s.height <= 0 || s.width > 16384 || s.height > 16384 ||
        !finite(s.offsetSeconds) || Math.abs(s.offsetSeconds) > 1800)
        throw new Error('Fonte original do tracking inválida.');
    return { fingerprint: s.fingerprint, name: s.name, duration: s.duration, width: s.width, height: s.height, offsetSeconds: s.offsetSeconds };
}
export function parseVideoDocument(value: unknown, media?: VideoMedia): VideoDocument {
    const d = value as VideoDocument;
    if (!d || d.version !== 1 || !d.media || typeof d.media.fingerprint !== 'string' || !d.media.fingerprint || typeof d.media.name !== 'string' || d.media.name.length > 300 || !finite(d.media.duration) || d.media.duration <= 0 || d.media.duration > 86400 || !finite(d.media.width) || !finite(d.media.height) || d.media.width <= 0 || d.media.height <= 0)
        throw new Error('Arquivo de análise inválido.');
    if (d.media.youtubeId !== undefined && (typeof d.media.youtubeId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(d.media.youtubeId))) throw new Error('Vídeo do YouTube inválido.');
    if (media && (d.media.youtubeId !== media.youtubeId || d.media.fingerprint !== media.fingerprint || Math.abs(d.media.duration - media.duration) > .1))
        throw new Error('Esta análise pertence a outro vídeo.');
    if (!Array.isArray(d.rallies) || !d.rallies.length || d.rallies.length > 2000 || !Array.isArray(d.contacts) || d.contacts.length > 20000 || !Array.isArray(d.corrections) || d.corrections.length > 20000)
        throw new Error('Limites da análise inválidos.');
    const ids = new Set<string>();
    const validId = (id: string) => typeof id === 'string' && id.length > 0 && id.length <= 120 && !ids.has(id) && !!ids.add(id);
    if (d.rallies.some((r, i) => !r || !validId(r.id) || !finite(r.start) || (i === 0 ? r.start !== 0 : r.start <= d.rallies[i - 1].start) || r.start >= d.media.duration || ![null, 'us', 'them'].includes(r.winner) || typeof r.reviewed !== 'boolean'))
        throw new Error('Rallies inválidos.');
    if (d.rallies.some((r, i) => r.pointTime !== undefined && (!finite(r.pointTime) || r.pointTime < r.start || r.pointTime >= (d.rallies[i + 1]?.start ?? d.media.duration))))
        throw new Error('Instante do ponto inválido.');
    if (d.contacts.some(c => !c || !validId(c.id) || !finite(c.time) || c.time < 0 || c.time >= d.media.duration || !videoSkills.includes(c.skill) || !['us', 'them'].includes(c.team) || typeof c.athlete !== 'string' || c.athlete.length > 80 || !(c.studentId === null || typeof c.studentId === 'string') || (c.outcome !== '' && !videoOutcomes[c.skill].includes(c.outcome))))
        throw new Error('Contatos inválidos.');
    if (d.corrections.some(p => !p || !finite(p.time) || p.time < 0 || p.time >= d.media.duration || !finite(p.x) || !finite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))
        throw new Error('Posições inválidas.');
    if (d.analysis && (!['vballnet-v2b-browser-1', 'vballnet-v2b-local', 'vballnet-v4c-browser-1', 'roboflow-volleyball-v2-3'].includes(d.analysis.model) || d.analysis.sampledFps !== 30 ||
        !Array.isArray(d.analysis.positions) || d.analysis.positions.length > 54000 ||
        d.analysis.positions.some((p, i, rows) => !p || !finite(p.time) || p.time < 0 || p.time >= d.media.duration || (i > 0 && p.time <= rows[i - 1].time) || !finite(p.x) || !finite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) ||
        !Array.isArray(d.analysis.cuts) || d.analysis.cuts.length > 2000 || d.analysis.cuts.some((t, i, rows) => !finite(t) || t <= 0 || t >= d.media.duration || (i > 0 && t <= rows[i - 1]))))
        throw new Error('Invalid automatic analysis');
    const source = d.analysis?.source !== undefined ? parseAnalysisSource(d.analysis.source, d.media) : undefined;
    if (source && [...d.analysis!.positions.map(p => p.time), ...d.analysis!.cuts].some(time => {
        const originalTime = time - source.offsetSeconds;
        // Addition and subtraction of the offset can round at a frame boundary.
        return originalTime < -1e-6 || originalTime >= source.duration;
    })) throw new Error('Tracking fora do intervalo do vídeo original.');
    // Pick fields explicitly: imported data cannot introduce source URLs or access grants.
    return { ...(d.analysis ? { analysis: { model: d.analysis.model, sampledFps: d.analysis.sampledFps, positions: d.analysis.positions.map(({time, x, y}) => ({time, x, y})), cuts: [...d.analysis.cuts], ...(source ? { source } : {}) } } : {}), version: 1, media: { ...(d.media.youtubeId ? { youtubeId: d.media.youtubeId } : {}), fingerprint: d.media.fingerprint, name: d.media.name, duration: d.media.duration, width: d.media.width, height: d.media.height }, rallies: d.rallies.map(({ id, start, winner, reviewed, pointTime }) => ({ id, start, winner, reviewed, ...(pointTime !== undefined ? { pointTime } : {}) })), contacts: d.contacts.map(({ id, time, skill, team, athlete, studentId, outcome }) => ({ id, time, skill, team, athlete, studentId, outcome })), corrections: d.corrections.map(({ time, x, y }) => ({ time, x, y })) };
}
