import { selectBallTracking, type BallTrackingCandidate } from './scouting-ball-tracking';
import { type VideoAnalysis, type VideoDocument, type VideoMedia } from './scouting-video';
import { attachYoutubeTracking } from './scouting-video-tracking';

/** The transport owns authorization, source resolution and temporary playback URLs. */
export type DriveTrackingResult = {
    media: VideoMedia;
    provider: 'roboflow';
    model: 'volleyball_v2/3';
    sampledFps: 30;
    /** Native source FPS, needed only when the provider omits explicit time_offset. */
    sourceFps?: number;
    predictions: unknown;
};
export type DriveTrackingMetrics = {
    frames: number;
    ballDetections: number;
    invalidDetections: number;
    belowConfidence: number;
    ambiguousFrames: number;
    duplicateDetections: number;
    isolatedSpikes: number;
    accepted: number;
};
export type DriveTrackingCandidate = {
    media: VideoMedia;
    analysis: VideoAnalysis;
    metrics: DriveTrackingMetrics;
};

type RecordValue = Record<string, unknown>;
type Detection = BallTrackingCandidate & { width: number; height: number };
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const maxFrames = 54000;

function parseMedia(value: unknown): VideoMedia {
    if (!record(value) || value.youtubeId !== undefined || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
        typeof value.name !== 'string' || !value.name.trim() || value.name.length > 300 || /[\\/:\u0000-\u001f\u007f]/.test(value.name) ||
        !finite(value.duration) || value.duration <= 0 || value.duration > 86400 ||
        !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
        !finite(value.width) || !finite(value.height) || value.width <= 0 || value.height <= 0 || value.width > 16384 || value.height > 16384)
        throw new Error('Metadados do vídeo do Drive inválidos.');
    // Persist only the transport's opaque candidate identity. It may hash source
    // metadata rather than all bytes; it is neither a content proof nor access grant.
    return { fingerprint: value.fingerprint, name: value.name, duration: value.duration, width: value.width, height: value.height };
}

function sameDetection(a: Detection, b: Detection): boolean {
    // Duplicate boxes around the same observed ball are not a second trajectory.
    const left = Math.max(a.x - a.width / 2, b.x - b.width / 2), right = Math.min(a.x + a.width / 2, b.x + b.width / 2);
    const top = Math.max(a.y - a.height / 2, b.y - b.height / 2), bottom = Math.min(a.y + a.height / 2, b.y + b.height / 2);
    const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
    return overlap / (a.width * a.height + b.width * b.height - overlap) >= .5;
}

/**
 * Convert the hosted Video Inference JSON, not workflow/stream or image outputs.
 * SDK contract: frame_offset plus one array keyed by dataset name; each frame has
 * predictions[]. Offsets are native frame indices, not the index of the result.
 * Never infer source FPS from requested inference FPS or interpolate absent balls.
 */
export function parseDriveTrackingResult(value: unknown): DriveTrackingCandidate {
    if (!record(value) || value.provider !== 'roboflow' || value.model !== 'volleyball_v2/3' || value.sampledFps !== 30 || !record(value.predictions))
        throw new Error('Resultado de tracking do Drive inválido.');
    const media = parseMedia(value.media), output = value.predictions;
    const offsets = output.frame_offset;
    const frames = output.volleyball_v2 ?? output['volleyball_v2/3'];
    if ((output.volleyball_v2 !== undefined && output['volleyball_v2/3'] !== undefined) ||
        !Array.isArray(offsets) || !Array.isArray(frames) || !offsets.length || offsets.length > maxFrames || frames.length !== offsets.length ||
        offsets.some((frame, i) => !Number.isSafeInteger(frame) || frame < 0 || (i > 0 && frame <= offsets[i - 1])))
        throw new Error('Quadros de tracking do Drive inválidos.');
    const explicitTimes = output.time_offset;
    if (explicitTimes !== undefined && (!Array.isArray(explicitTimes) || explicitTimes.length !== frames.length ||
        explicitTimes.some((time, i) => !finite(time) || time < 0 || time >= media.duration || (i > 0 && time <= explicitTimes[i - 1]))))
        throw new Error('Tempos de tracking do Drive inválidos.');
    if (value.sourceFps !== undefined && (!finite(value.sourceFps) || value.sourceFps <= 0 || value.sourceFps > 240))
        throw new Error('FPS do vídeo original inválido.');
    if (!explicitTimes && value.sourceFps === undefined)
        throw new Error('O tracking precisa de tempos explícitos ou do FPS real do vídeo original.');
    const times = explicitTimes as number[] | undefined;
    const sourceFps = value.sourceFps as number | undefined;
    const metrics: DriveTrackingMetrics = { frames: frames.length, ballDetections: 0, invalidDetections: 0, belowConfidence: 0, ambiguousFrames: 0, duplicateDetections: 0, isolatedSpikes: 0, accepted: 0 };
    const candidates: BallTrackingCandidate[] = [];
    let totalDetections = 0;
    frames.forEach((frame, index) => {
        const time = times ? times[index] : offsets[index] / sourceFps!;
        if (!finite(time) || time < 0 || time >= media.duration)
            throw new Error('Tracking fora do intervalo do vídeo original.');
        if (!record(frame) || !Array.isArray(frame.predictions) || frame.predictions.length > 1000)
            throw new Error('Detecções de tracking do Drive inválidas.');
        totalDetections += frame.predictions.length;
        if (totalDetections > 2000000) throw new Error('O tracking excede o limite de detecções.');
        if (frame.image !== undefined && (!record(frame.image) || frame.image.width !== media.width || frame.image.height !== media.height))
            throw new Error('As dimensões do tracking diferem do vídeo original.');
        const detections: Detection[] = [];
        for (const prediction of frame.predictions) {
            if (!record(prediction) || typeof prediction.class !== 'string' || !['ball', 'volleyball'].includes(prediction.class.trim().toLowerCase())) continue;
            metrics.ballDetections++;
            const { x, y, width, height, confidence } = prediction;
            if (!finite(x) || !finite(y) || !finite(width) || !finite(height) || !finite(confidence) || confidence < 0 || confidence > 1 ||
                x < 0 || x > media.width || y < 0 || y > media.height || width <= 0 || height <= 0 || width > media.width / 4 || height > media.height / 4) {
                metrics.invalidDetections++; continue;
            }
            if (confidence < .5) { metrics.belowConfidence++; continue; }
            detections.push({ time, x: x / media.width, y: y / media.height, width: width / media.width, height: height / media.height, score: confidence });
        }
        detections.sort((a, b) => b.score - a.score);
        const distinct: Detection[] = [];
        for (const detection of detections) {
            if (distinct.some(other => sameDetection(detection, other))) metrics.duplicateDetections++;
            else distinct.push(detection);
        }
        if (distinct.length > 1 && distinct[0].score - distinct[1].score < .15) {
            metrics.ambiguousFrames++; return;
        }
        if (distinct[0]) candidates.push(distinct[0]);
    });
    // Reuse the conservative local selector: only weak, isolated excursions with
    // four reliable adjacent observations are removed. It creates no new points.
    const selected = selectBallTracking(candidates, { sampledFps: 30, minConfidence: .5 });
    metrics.isolatedSpikes = selected.metrics.isolatedSpikes;
    metrics.accepted = selected.positions.length;
    if (!selected.positions.length) throw new Error('Nenhuma posição da bola com confiança suficiente. As marcações foram preservadas.');
    return { media, analysis: { model: 'roboflow-volleyball-v2-3', sampledFps: 30, positions: selected.positions, cuts: [] }, metrics };
}

/** Attach positions only; temporal annotations and manual corrections remain intact. */
export function attachDriveTracking(doc: VideoDocument, result: unknown, offsetSeconds: number, expectedSourceFingerprint?: string): VideoDocument {
    return attachYoutubeTracking(doc, parseDriveTrackingResult(result), offsetSeconds, expectedSourceFingerprint);
}
