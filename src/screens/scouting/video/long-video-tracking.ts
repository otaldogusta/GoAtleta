import { newVideoDocument, parseVideoDocument, type BallPosition, type VideoAnalysis, type VideoMedia } from '../../../core/scouting-video';
import { getVideoDraft, persistVideoDraft } from './video-draft-storage';
import { TrackingWorkerSession, processScoutingVideo, type ScoutingTrackingModel, type TrackingPreview } from './video-processing.web';

const key = (scope: string, media: VideoMedia, model: ScoutingTrackingModel, start: number, end: number) => `${scope}:tracking-v1:${media.fingerprint}:${model}:${start}:${end}`;
export function trackingRanges(duration: number) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > 7200) throw new Error('Escolha um jogo de até 2 horas.');
    return Array.from({ length: Math.ceil(duration / 60) }, (_, i) => ({ start: i * 60, end: Math.min(duration, (i + 1) * 60) }));
}
function parseChunk(raw: string, media: VideoMedia, start: number, end: number, model: ScoutingTrackingModel) {
    const doc = parseVideoDocument(JSON.parse(raw), media), analysis = doc.analysis;
    if (!analysis || analysis.model !== (model === 'v4c' ? 'vballnet-v4c-browser-1' : 'vballnet-v2b-browser-1') || analysis.source
        || analysis.positions.some(p => p.time < start || p.time >= end) || analysis.cuts.some(t => t <= start || t >= end)) throw new Error('Trecho de tracking salvo inválido.');
    return analysis;
}
export async function loadFullTracking(scope: string, media: VideoMedia, model: ScoutingTrackingModel): Promise<VideoAnalysis | null> {
    const chunks: VideoAnalysis[] = [];
    for (const { start, end } of trackingRanges(media.duration)) {
        const raw = await getVideoDraft(key(scope, media, model, start, end));
        if (!raw) return null;
        chunks.push(parseChunk(raw, media, start, end, model));
    }
    return mergeTracking(chunks, model);
}
function mergeTracking(chunks: VideoAnalysis[], model: ScoutingTrackingModel): VideoAnalysis {
    return { model: model === 'v4c' ? 'vballnet-v4c-browser-1' : 'vballnet-v2b-browser-1', sampledFps: 30,
        positions: chunks.flatMap(c => c.positions), cuts: chunks.flatMap(c => c.cuts) };
}
/** Full precision is retained per minute in IDB. Only the synchronized preview is bounded. */
export function trackingSyncPreview(analysis: VideoAnalysis): VideoAnalysis {
    if (analysis.positions.length <= 54000) return analysis;
    const step = Math.ceil(analysis.positions.length / 54000);
    return { ...analysis, positions: analysis.positions.filter((_, index) => index % step === 0) };
}
export async function processLongVideo(file: File, media: VideoMedia, scope: string, model: ScoutingTrackingModel, signal: AbortSignal,
    progress: (done: number, total: number, text: string) => void, onPreview?: (preview: TrackingPreview) => void): Promise<VideoAnalysis> {
    const chunks: VideoAnalysis[] = [];
    const workerSession = new TrackingWorkerSession();
    try {
    for (const { start, end } of trackingRanges(media.duration)) {
        signal.throwIfAborted();
        const chunkKey = key(scope, media, model, start, end), raw = await getVideoDraft(chunkKey);
        let analysis: VideoAnalysis;
        if (raw) analysis = parseChunk(raw, media, start, end, model);
        else {
            analysis = await processScoutingVideo(file, media.duration, signal, (done, _total, text) => progress(Math.max(Math.ceil(start * 30), done), Math.ceil(media.duration * 30), text), { model, range: { start, end }, onPreview, workerSession });
            // Commit completed work even if cancellation arrives just after inference.
            await persistVideoDraft(chunkKey, JSON.stringify({ ...newVideoDocument(media, 'tracking-checkpoint'), analysis }));
        }
        chunks.push(analysis);
        progress(Math.ceil(end * 30), Math.ceil(media.duration * 30), `Trecho salvo · ${Math.floor(end / 60)} min · ${raw ? 'reutilizado' : 'processado'}`);
    }
    return mergeTracking(chunks, model);
    } finally { workerSession.dispose(); }
}

/** Verify the synchronized preview before exposing full local precision. */
export function matchingFullTracking(full: VideoAnalysis, expected: readonly BallPosition[], offset: number, duration: number): BallPosition[] | null {
 const step = full.positions.length <= 54000 ? 1 : Math.ceil(full.positions.length / 54000);
 let at = 0;
 for (let i = 0; i < full.positions.length; i += step) {
  const point = full.positions[i], time = point.time + offset;
  if (time < 0 || time >= duration) continue;
  const row = expected[at++];
  if (!row || row.time !== time || row.x !== point.x || row.y !== point.y) return null;
 }
 if (at !== expected.length) return null;
 if (offset === 0 && full.positions.every(p => p.time >= 0 && p.time < duration)) return full.positions;
 const normalized: BallPosition[] = [];
 for (const point of full.positions) {
  const time = point.time + offset;
  if (time >= 0 && time < duration) normalized.push(offset === 0 ? point : { ...point, time });
 }
 return normalized;
}
