/** Live captures are independent local material, never mutations of official scouting. */
export type LiveClockMessage = { kind: 'clock'; recordingId: string; startEpochMs: number; timeMs: number; senderEpochMs: number; recording: boolean; segmentId: string };
export type LiveClockCalibration = { offsetMs: number; roundTripMs: number; updatedAtHostEpochMs: number };
export type LiveVideoStamp = { timeMs: number; uncertaintyMs: number; mode: 'frame' | 'estimated' };
export type LivePoint = { id: string; recordingId: string; timeMs: number; won: boolean; setNumber: number; scoreUs: number; scoreThem: number; uncertaintyMs: number; clockMode: 'frame' | 'estimated'; createdAtHostEpochMs: number };
const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const bounded = (value: unknown, max: number): value is number => finite(value) && value >= 0 && value <= max;
const MAX_RECORDING_MS = 7200000;

export function liveStorageScope(user: string, org: string, classId: string): string {
    if (![user,org,classId].every(validId)) throw new Error('Escopo do modo ao vivo inválido.');
    return `goatleta:scouting-live:v1:${[user,org,classId].map(encodeURIComponent).join(':')}`;
}

export function parseLiveClockMessage(value: unknown): LiveClockMessage {
    const v = value as LiveClockMessage & { sourceTimeMs?: number };
    const timeMs = v?.timeMs ?? v?.sourceTimeMs;
    if (!v || v.kind !== 'clock' || !validId(v.recordingId) || !validId(v.segmentId) || !bounded(v.startEpochMs,Number.MAX_SAFE_INTEGER)
        || !bounded(v.senderEpochMs,Number.MAX_SAFE_INTEGER) || !bounded(timeMs,MAX_RECORDING_MS) || typeof v.recording !== 'boolean'
        || v.senderEpochMs < v.startEpochMs || Math.abs((v.senderEpochMs-v.startEpochMs)-timeMs) > 2000) throw new Error('Relógio da câmera inválido.');
    return { kind:'clock', recordingId:v.recordingId, segmentId:v.segmentId, startEpochMs:v.startEpochMs, senderEpochMs:v.senderEpochMs, timeMs, recording:v.recording };
}

/** Offset is camera clock minus notebook clock. A slow round trip cannot prove precision. */
export function calibrateLiveClock(hostSentEpochMs: number, hostReceivedEpochMs: number, cameraEpochMs: number): LiveClockCalibration {
    if (![hostSentEpochMs,hostReceivedEpochMs,cameraEpochMs].every(finite) || hostReceivedEpochMs < hostSentEpochMs || hostReceivedEpochMs-hostSentEpochMs > 3000) throw new Error('A conexão não permitiu sincronizar os relógios.');
    return { offsetMs:cameraEpochMs-(hostSentEpochMs+hostReceivedEpochMs)/2, roundTripMs:hostReceivedEpochMs-hostSentEpochMs, updatedAtHostEpochMs:hostReceivedEpochMs };
}

export function resolveLiveVideoTime({ clock, calibration, hostNowEpochMs, lastFrameHostEpochMs, captureHostEpochMs, playoutDelayMs = 0 }: {
    clock: LiveClockMessage | null; calibration: LiveClockCalibration | null; hostNowEpochMs: number; lastFrameHostEpochMs: number;
    captureHostEpochMs?: number; playoutDelayMs?: number;
}): LiveVideoStamp | null {
    if (!clock || !calibration || !clock.recording || !finite(hostNowEpochMs) || !finite(lastFrameHostEpochMs)) return null;
    const age = hostNowEpochMs-(clock.senderEpochMs-calibration.offsetMs);
    if (hostNowEpochMs-calibration.updatedAtHostEpochMs > 15000 || hostNowEpochMs < calibration.updatedAtHostEpochMs-1000
        || hostNowEpochMs-lastFrameHostEpochMs > 1500 || hostNowEpochMs < lastFrameHostEpochMs-1000 || age > 3000 || age < -1000
        || !bounded(calibration.roundTripMs,3000) || !finite(calibration.offsetMs) || !bounded(playoutDelayMs,10000)) return null;
    const hasFrame = finite(captureHostEpochMs) && captureHostEpochMs <= hostNowEpochMs && captureHostEpochMs > hostNowEpochMs-10000;
    const sourceEpoch = hasFrame ? captureHostEpochMs!+calibration.offsetMs : hostNowEpochMs+calibration.offsetMs-playoutDelayMs-calibration.roundTripMs/2;
    const timeMs = sourceEpoch-clock.startEpochMs;
    const uncertaintyMs = Math.ceil(hasFrame ? Math.max(34,calibration.roundTripMs/2+34) : Math.max(500,calibration.roundTripMs+playoutDelayMs+250));
    if (!bounded(timeMs,MAX_RECORDING_MS) || timeMs > clock.timeMs+Math.max(0,age)+uncertaintyMs) return null;
    return { timeMs:Math.round(timeMs), uncertaintyMs, mode:hasFrame?'frame':'estimated' };
}

export function parseLivePoint(value: unknown): LivePoint {
    const v = value as LivePoint;
    if (!v || !validId(v.id) || !validId(v.recordingId) || !bounded(v.timeMs,MAX_RECORDING_MS) || typeof v.won !== 'boolean'
        || !Number.isSafeInteger(v.setNumber) || v.setNumber < 1 || v.setNumber > 99
        || !Number.isSafeInteger(v.scoreUs) || !bounded(v.scoreUs,999) || !Number.isSafeInteger(v.scoreThem) || !bounded(v.scoreThem,999)
        || !bounded(v.uncertaintyMs,60000) || !['frame','estimated'].includes(v.clockMode) || !bounded(v.createdAtHostEpochMs,Number.MAX_SAFE_INTEGER)) throw new Error('Ponto da gravação inválido.');
    return { id:v.id, recordingId:v.recordingId, timeMs:v.timeMs, won:v.won, setNumber:v.setNumber, scoreUs:v.scoreUs, scoreThem:v.scoreThem, uncertaintyMs:v.uncertaintyMs, clockMode:v.clockMode, createdAtHostEpochMs:v.createdAtHostEpochMs };
}

export function createLivePoint({ id, clock, stamp, won, setNumber, points, hostNowEpochMs }: {
    id: string; clock: LiveClockMessage; stamp: LiveVideoStamp; won: boolean; setNumber: number; points: readonly LivePoint[]; hostNowEpochMs: number;
}): LivePoint {
    if (!clock.recording || points.some(point=>point.id===id)) throw new Error('A gravação não está pronta para este ponto.');
    const previous = points.filter(point=>point.recordingId===clock.recordingId).at(-1);
    if (previous && stamp.timeMs < previous.timeMs) throw new Error('Volte ao vídeo ao vivo antes de marcar o próximo ponto.');
    const last = points.filter(point=>point.recordingId===clock.recordingId && point.setNumber===setNumber).at(-1);
    return parseLivePoint({ id, recordingId:clock.recordingId, timeMs:stamp.timeMs, won, setNumber, scoreUs:(last?.scoreUs??0)+(won?1:0), scoreThem:(last?.scoreThem??0)+(won?0:1), uncertaintyMs:stamp.uncertaintyMs, clockMode:stamp.mode, createdAtHostEpochMs:hostNowEpochMs });
}
