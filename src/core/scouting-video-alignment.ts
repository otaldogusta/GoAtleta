import type { ScoutingRally } from './models';
import type { VideoDocument, VideoSkill } from './scouting-video';
import type { VideoAiResult } from './scouting-video-ai';
import { parseScoutingVideoLinks, pointLinkKey, type ScoutingVideoLinks } from './scouting-video-links';

export type VideoAlignmentDocument = Pick<VideoDocument, 'media' | 'rallies' | 'contacts'>;
export type ScoutingVideoVisualRally = { start: number; end: number | null; winner: 'us' | 'them' | null; evidence: string };
export type ScoutingVideoRegulation = { pointsToWin: number; cap: number };
export type ScoutingVideoAlignmentSuggestion = {
    sessionId: string; rallyId: string; videoRallyId: string; time: number;
    confidence: 'high' | 'review'; reasons: string[];
};
export type ScoutingVideoAlignmentReport = {
    suggestions: ScoutingVideoAlignmentSuggestion[];
    unresolved: { sessionId: string; rallyId: string; reason: string }[];
    preserved: number;
};
type Contact = { time: number; skill: VideoSkill; ours: boolean };
type Clip = { id: string; index: number; start: number; end: number; winner: 'us' | 'them' | null; contacts: Contact[]; reviewed: boolean; visual: ScoutingVideoVisualRally[] };
type Anchor = { point: ScoutingRally; index: number; clip: number; time: number };
type Context = { point: ScoutingRally; index: number; lower: number; upper: number; before?: Anchor; after?: Anchor; expected: number | null; stableClock: boolean; compressed: boolean; manual: VideoSkill[] };
type Evidence = { score: number; clock: boolean; semantic: boolean; reasons: string[] };
const fundamentals: Record<string, VideoSkill | undefined> = {
    saque: 'Saque', recepcao: 'Recepção', levantamento: 'Levantamento', ataque: 'Ataque', bloqueio: 'Bloqueio', defesa: 'Defesa', cobertura: 'Cobertura de ataque',
};
const key = (point: Pick<ScoutingRally, 'sessionId' | 'id'>) => pointLinkKey(point.sessionId, point.id);
const seconds = (point: ScoutingRally) => Date.parse(point.createdAt) / 1000;

function sequenceMatches(manual: VideoSkill[], observed: VideoSkill[]) {
    let previous = new Uint16Array(observed.length + 1);
    for (const skill of manual) {
        const current = new Uint16Array(observed.length + 1);
        for (let j = 1; j <= observed.length; j++) current[j] = skill === observed[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
        previous = current;
    }
    return previous[observed.length];
}

function clipEvidence(context: Context, clip: Clip): Evidence | null {
    if (clip.index <= context.lower || clip.index >= context.upper) return null;
    const winner = clip.reviewed ? clip.winner : null;
    if (winner && (winner === 'us') !== context.point.won) return null;
    const ours = clip.contacts.filter(contact => contact.ours).map(contact => contact.skill);
    const observed = clip.contacts.map(contact => contact.skill);
    const matches = sequenceMatches(context.manual, observed), oursMatches = sequenceMatches(context.manual, ours);
    const teamSequence = oursMatches >= 2 && new Set(context.manual).size >= 2 && oursMatches === context.manual.length;
    const visualWinnerMatch = clip.visual.some(rally => rally.winner && (rally.winner === 'us') === context.point.won);
    const visualWinnerConflict = !visualWinnerMatch && clip.visual.some(rally => rally.winner) && !clip.visual.some(rally => !rally.winner);
    const semantic = !visualWinnerConflict && (!!winner || (clip.reviewed && teamSequence));
    // A plausible clock is never evidence that there is actually a rally in the clip.
    if (!clip.contacts.length && !clip.visual.length && !clip.reviewed) return null;
    const distance = context.expected === null ? null : Math.max(clip.start - context.expected, context.expected - clip.end, 0);
    // A far-away semantic resemblance is not evidence that the recording clock is correct.
    if (distance !== null && distance > 45 && !context.compressed) return null;
    const clock = distance !== null && distance <= 5 && clip.end - clip.start <= 120 && !context.compressed;
    const temporal = distance === null || context.compressed ? 0 : distance <= 5 ? 4 : distance <= 15 ? 2 : distance <= 45 ? 1 : 0;
    const semanticScore = (winner ? 6 : 0) + (visualWinnerMatch ? 4 : 0) + (clip.visual.length ? 1 : 0) - (visualWinnerConflict ? 6 : 0);
    const sequenceScore = teamSequence ? 5 : matches >= 2 ? 3 : matches ? 1.5 : 0;
    // A clip boundary alone does not establish that a point occurred there.
    const score = semanticScore + sequenceScore + temporal;
    if (score <= 0 || (!temporal && !semanticScore && !sequenceScore)) return null;
    const reasons: string[] = [];
    if (winner) reasons.push('Vencedor revisado no vídeo coincide com o registro.');
    if (visualWinnerMatch) reasons.push('Vencedor sugerido na conferência visual coincide; ainda precisa de revisão.');
    if (visualWinnerConflict) reasons.push('O vencedor sugerido no vídeo diverge do registro; confira esta correspondência.');
    if (clip.visual.length) reasons.push('Há um rally observado neste recorte.');
    if (teamSequence) reasons.push('Sequência de fundamentos da nossa equipe compatível com o registro.');
    else if (matches) reasons.push(`${matches} ${matches === 1 ? 'fundamento observado compatível' : 'fundamentos observados compatíveis'}; a equipe não foi presumida.`);
    if (clock) reasons.push('Horário compatível com as referências revisadas.');
    else if (temporal) reasons.push('Horário aproximado; confira o início e o fim do lance.');
    if (context.before && context.after) reasons.push('Entre dois pontos já associados do mesmo set.');
    if (context.compressed) reasons.push('Registros muito próximos ou fora de ordem no relógio; horário descartado.');
    if (!context.stableClock) reasons.push('Sem duas referências de horário consistentes neste trecho.');
    return { score, clock, semantic, reasons };
}

function buildClips(video: VideoAlignmentDocument, observations: VideoAiResult[], visualRallies: ScoutingVideoVisualRally[]): Clip[] {
    const contacts: Contact[] = video.contacts.map(contact => ({ time: contact.time, skill: contact.skill, ours: contact.team === 'us' }));
    for (const observation of observations) {
        if (!video.media.youtubeId || observation.videoId !== video.media.youtubeId) continue;
        for (const contact of observation.contacts) {
            if (!Number.isFinite(contact.time) || contact.time < observation.start || contact.time >= observation.end || contact.time < 0 || contact.time >= video.media.duration) continue;
            // near/far is a camera observation, not an identification of our team.
            contacts.push({ time: contact.time, skill: contact.skill, ours: false });
        }
    }
    contacts.sort((a, b) => a.time - b.time || Number(b.ours) - Number(a.ours));
    // Checkpoint overlaps can repeat a contact; count each skill/time once without a quadratic scan.
    const unique: Contact[] = [], lastSkill = new Map<VideoSkill, Contact>();
    for (const contact of contacts) {
        const previous = lastSkill.get(contact.skill);
        if (previous && contact.time - previous.time < .5) { if (contact.ours) previous.ours = true; continue; }
        const copy = { ...contact }; unique.push(copy); lastSkill.set(copy.skill, copy);
    }
    const visuals = visualRallies.filter(rally => Number.isFinite(rally.start) && rally.start >= 0 && rally.start < video.media.duration
        && (rally.end === null || (Number.isFinite(rally.end) && rally.end > rally.start && rally.end <= video.media.duration))
        && (rally.winner === null || rally.winner === 'us' || rally.winner === 'them')).map(rally => ({ ...rally })).sort((a, b) => a.start - b.start);
    let cursor = 0, visualCursor = 0;
    return video.rallies.map((rally, index) => {
        const end = video.rallies[index + 1]?.start ?? video.media.duration, observed: Contact[] = [], visual: ScoutingVideoVisualRally[] = [];
        while (cursor < unique.length && unique[cursor].time < rally.start) cursor++;
        while (cursor < unique.length && unique[cursor].time < end) observed.push(unique[cursor++]);
        while (visualCursor < visuals.length && visuals[visualCursor].start < rally.start) visualCursor++;
        while (visualCursor < visuals.length && visuals[visualCursor].start < end) visual.push(visuals[visualCursor++]);
        return { id: rally.id, index, start: rally.start, end, winner: rally.winner, reviewed: rally.reviewed, contacts: observed, visual };
    });
}

function suggestedTime(context: Context, clip: Clip) {
    const compatible = clip.visual.filter(rally => !rally.winner || (rally.winner === 'us') === context.point.won);
    const rally = (compatible.length ? compatible : clip.visual).slice().sort((a, b) => Math.abs(a.start - (context.expected ?? clip.start)) - Math.abs(b.start - (context.expected ?? clip.start)))[0];
    if (rally) return context.expected !== null && context.expected >= rally.start && context.expected < Math.min(rally.end ?? clip.end, clip.end) ? context.expected : rally.start;
    const contact = clip.contacts.findLast(observed => context.manual.includes(observed.skill)) ?? clip.contacts[0];
    if (contact) return contact.time;
    return context.expected !== null && context.expected >= clip.start && context.expected < clip.end ? context.expected : clip.start;
}

function pointsAfterSetEnd(group: ScoutingRally[], regulation?: ScoutingVideoRegulation) {
    const excluded = new Set<string>();
    if (!regulation) return excluded;
    if (!Number.isInteger(regulation.pointsToWin) || !Number.isInteger(regulation.cap) || regulation.pointsToWin < 1 || regulation.cap < regulation.pointsToWin || regulation.cap > 100) throw new Error('Regra de pontuação inválida.');
    let ended = false;
    for (const point of group) {
        const max = Math.max(point.scoreUs, point.scoreThem);
        if (ended || max > regulation.cap || Math.min(point.scoreUs, point.scoreThem) >= regulation.cap) excluded.add(key(point));
        if (max >= regulation.pointsToWin && (Math.abs(point.scoreUs - point.scoreThem) >= 2 || max >= regulation.cap)) ended = true;
    }
    return excluded;
}

/** Monotone matching permits missing records and extra cuts; equal counts never prove a match. */
function matchSequence(contexts: Context[], clips: Clip[]) {
    const columns = clips.length + 1, directions = new Uint8Array((contexts.length + 1) * columns);
    let previous = new Float64Array(columns);
    for (let i = 1; i <= contexts.length; i++) {
        const row = new Float64Array(columns);
        for (let j = 1; j < columns; j++) {
            const evidence = clipEvidence(contexts[i - 1], clips[j - 1]);
            const paired = evidence ? previous[j - 1] + evidence.score : -Infinity;
            if (paired > previous[j] && paired > row[j - 1]) { row[j] = paired; directions[i * columns + j] = 1; }
            else if (previous[j] >= row[j - 1]) { row[j] = previous[j]; directions[i * columns + j] = 2; }
            else { row[j] = row[j - 1]; directions[i * columns + j] = 3; }
        }
        previous = row;
    }
    const matches: { context: Context; clip: Clip }[] = [];
    let i = contexts.length, j = clips.length;
    while (i && j) {
        const direction = directions[i * columns + j];
        if (direction === 1) { matches.push({ context: contexts[i - 1], clip: clips[j - 1] }); i--; j--; }
        else if (direction === 2) i--;
        else j--;
    }
    return matches.reverse();
}

/** Read-only reconciliation. Existing links, missing flags, video and official records are immutable inputs. */
export function buildScoutingVideoAlignment({ video, points, links, observations = [], visualRallies = [], regulation }: {
    video: VideoAlignmentDocument; points: ScoutingRally[]; links: ScoutingVideoLinks; observations?: VideoAiResult[];
    visualRallies?: ScoutingVideoVisualRally[]; regulation?: ScoutingVideoRegulation;
}): ScoutingVideoAlignmentReport {
    const current = parseScoutingVideoLinks(links, video.media.duration);
    if (points.length > 2000 || video.rallies.length > 2000 || observations.length > 500 || visualRallies.length > 2000) throw new Error('Há registros demais para alinhar este trecho.');
    const report: ScoutingVideoAlignmentReport = { suggestions: [], unresolved: [], preserved: current.links.length };
    const included = points.filter(point => current.sessionIds.includes(point.sessionId));
    if (new Set(included.map(key)).size !== included.length) throw new Error('Há registros repetidos na seleção.');
    const linked = new Map(current.links.map(link => [pointLinkKey(link.sessionId, link.rallyId), link]));
    const occupied = new Set(current.links.flatMap(link => link.videoRallyId ? [link.videoRallyId] : []));
    const clips = buildClips(video, observations, visualRallies), allAnchors = included.flatMap(point => {
        const link = linked.get(key(point)), clip = clips.find(candidate => candidate.id === link?.videoRallyId);
        return link && !link.missing && link.time !== null && clip && link.time >= clip.start && link.time < clip.end ? [{ point, clip: clip.index, time: link.time }] : [];
    });
    const groups = new Map<string, ScoutingRally[]>();
    for (const point of included) {
        const groupKey = JSON.stringify([point.setNumber, point.sessionId]);
        const group = groups.get(groupKey) ?? []; group.push(point); groups.set(groupKey, group);
    }
    for (const group of [...groups.values()].sort((a, b) => a[0].setNumber - b[0].setNumber || a[0].sessionId.localeCompare(b[0].sessionId))) {
        group.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
        const anchors: Anchor[] = group.flatMap((point, index) => {
            const anchor = allAnchors.find(item => key(item.point) === key(point));
            return anchor ? [{ ...anchor, index }] : [];
        });
        const afterEnd = pointsAfterSetEnd(group, regulation);
        const pending = group.filter(point => !linked.has(key(point)) && !afterEnd.has(key(point)));
        report.unresolved.push(...group.filter(point => !linked.has(key(point)) && afterEnd.has(key(point))).map(point => ({ sessionId: point.sessionId, rallyId: point.id,
            reason: `Registro posterior ao fim do set ou acima do teto de ${regulation!.cap} pontos; confira o placar original.` })));
        if (group.some(point => { const link = linked.get(key(point)); return link && !link.missing && !anchors.some(anchor => key(anchor.point) === key(point)); })) {
            report.unresolved.push(...pending.map(point => ({ sessionId: point.sessionId, rallyId: point.id, reason: 'Uma referência revisada ficou fora do recorte após uma edição; confira-a antes de sugerir outros vínculos.' })));
            continue;
        }
        if (anchors.some((anchor, index) => index > 0 && anchor.clip <= anchors[index - 1].clip)) {
            report.unresolved.push(...pending.map(point => ({ sessionId: point.sessionId, rallyId: point.id, reason: 'As referências revisadas deste set estão fora de ordem; confira-as antes de sugerir outros vínculos.' })));
            continue;
        }
        const priorSets = allAnchors.filter(anchor => anchor.point.setNumber < group[0].setNumber).map(anchor => anchor.clip);
        const laterSets = allAnchors.filter(anchor => anchor.point.setNumber > group[0].setNumber).map(anchor => anchor.clip);
        const contexts: Context[] = pending.map(point => {
            const index = group.indexOf(point), before = anchors.findLast(anchor => anchor.index < index), after = anchors.find(anchor => anchor.index > index);
            const at = seconds(point), adjacent = [group[index - 1], group[index + 1]].filter((item): item is ScoutingRally => !!item);
            const compressed = !Number.isFinite(at) || adjacent.some(item => {
                const delta = seconds(item) - at;
                return Number.isFinite(delta) && (Math.abs(delta) < 3 || (group.indexOf(item) < index ? delta >= 0 : delta <= 0));
            });
            const timed = [before, after].filter((anchor): anchor is Anchor => !!anchor && Number.isFinite(seconds(anchor.point)) && Math.abs(at - seconds(anchor.point)) <= 300);
            const stableClock = !compressed && timed.length === 2 && seconds(timed[1].point) > seconds(timed[0].point)
                && Math.abs((timed[0].time - seconds(timed[0].point)) - (timed[1].time - seconds(timed[1].point))) <= 12;
            // An offset discontinuity denotes an edit/pause; interpolation would invent a clock.
            const discontinuity = timed.length === 2 && !stableClock;
            const expected = compressed || discontinuity || !timed.length ? null : timed.reduce((sum, anchor) => sum + anchor.time + at - seconds(anchor.point), 0) / timed.length;
            return { point, index, before, after, lower: before?.clip ?? (priorSets.length ? Math.max(...priorSets) : -1), upper: after?.clip ?? (laterSets.length ? Math.min(...laterSets) : clips.length), expected, stableClock, compressed,
                manual: point.contacts.map(contact => fundamentals[contact.fundamental]).filter((skill): skill is VideoSkill => !!skill) };
        });
        const available = clips.filter(clip => !occupied.has(clip.id));
        const matches = matchSequence(contexts, available), matched = new Set<string>();
        for (const { context, clip } of matches) {
            const evidence = clipEvidence(context, clip)!;
            const alternatives = available.filter(other => other.id !== clip.id).flatMap(other => { const candidate = clipEvidence(context, other); return candidate ? [candidate.score] : []; });
            const margin = evidence.score - (alternatives.length ? Math.max(...alternatives) : -Infinity);
            const high = evidence.semantic && evidence.clock && context.stableClock && margin >= 2.5;
            const reasons = [...evidence.reasons];
            if (!high) reasons.push(margin < 2.5 ? 'Há outras correspondências parecidas; confirme pelo vídeo.' : 'Correspondência sugerida para conferência visual.');
            report.suggestions.push({ sessionId: context.point.sessionId, rallyId: context.point.id, videoRallyId: clip.id,
                time: suggestedTime(context, clip), confidence: high ? 'high' : 'review', reasons });
            matched.add(key(context.point)); occupied.add(clip.id);
        }
        for (const context of contexts) if (!matched.has(key(context.point))) report.unresolved.push({ sessionId: context.point.sessionId, rallyId: context.point.id,
            reason: context.before || context.after ? 'Nenhum recorte livre tem evidência suficiente entre as referências revisadas.' : 'Falta uma referência revisada deste set ou uma observação visual compatível.' });
    }
    return report;
}

/** Explicit acceptance adds references only; a stale proposal can never replace a reviewed/missing link. */
export function acceptScoutingVideoSuggestions(current: ScoutingVideoLinks, video: VideoAlignmentDocument, points: ScoutingRally[],
    suggestions: ScoutingVideoAlignmentSuggestion[], observations: VideoAiResult[] = [], visualRallies: ScoutingVideoVisualRally[] = [], regulation?: ScoutingVideoRegulation): ScoutingVideoLinks {
    const validated = parseScoutingVideoLinks(current, video.media.duration);
    if (new Set(suggestions.map(suggestion => pointLinkKey(suggestion.sessionId, suggestion.rallyId))).size !== suggestions.length) throw new Error('Há sugestões repetidas na seleção.');
    const proposals = buildScoutingVideoAlignment({ video, points, links: validated, observations, visualRallies, regulation }).suggestions;
    const additions = suggestions.flatMap(suggestion => {
        const existing = validated.links.find(link => link.sessionId === suggestion.sessionId && link.rallyId === suggestion.rallyId);
        if (existing) {
            if (!existing.missing && existing.videoRallyId === suggestion.videoRallyId && existing.time === suggestion.time) return [];
            throw new Error('Este ponto já tem uma associação revisada. Atualize as sugestões.');
        }
        const fresh = proposals.find(proposal => proposal.sessionId === suggestion.sessionId && proposal.rallyId === suggestion.rallyId);
        if (!fresh || fresh.videoRallyId !== suggestion.videoRallyId || fresh.time !== suggestion.time || fresh.confidence !== suggestion.confidence) throw new Error('Esta sugestão mudou. Atualize e confira novamente.');
        return [{ sessionId: fresh.sessionId, rallyId: fresh.rallyId, videoRallyId: fresh.videoRallyId, time: fresh.time, missing: false }];
    });
    return parseScoutingVideoLinks({ ...validated, links: [...validated.links, ...additions] }, video.media.duration);
}
