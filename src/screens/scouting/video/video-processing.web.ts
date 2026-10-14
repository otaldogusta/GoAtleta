import type { VideoAnalysis } from '../../../core/scouting-video';
import { sceneCuts } from '../../../core/scouting-video-playback';
import { selectBallTracking, type BallTrackingCandidate } from '../../../core/scouting-ball-tracking';

export type ScoutingTrackingModel = 'v2b' | 'v4c';
type TrackingOptions = { model?: ScoutingTrackingModel; resumeKey?: string };
type TrackingProgress = (done: number, total: number, stage: string) => void;
type StreamCheckpoint = {
  duration: number; model: ScoutingTrackingModel; width: number; height: number;
  completed: number; candidates: BallTrackingCandidate[]; scores: number[]; previous: Uint8Array;
  expiresAt: number;
};
// Explicitly scoped opaque keys only. No URLs, files, full frames or annotations.
const streamCheckpoints = new Map<string, StreamCheckpoint>();
const checkpointLifetime = 2 * 60 * 60 * 1000;
class MediaReadError extends Error {
  constructor() { super('A leitura do vídeo foi interrompida. Confira a conexão e tente novamente.'); this.name = 'MediaReadError'; }
}
function checkpoint(key: string, value: StreamCheckpoint) {
  const now = Date.now();
  for (const [storedKey, stored] of streamCheckpoints) if (stored.expiresAt <= now) streamCheckpoints.delete(storedKey);
  streamCheckpoints.delete(key); streamCheckpoints.set(key, value);
  while (streamCheckpoints.size > 2) streamCheckpoints.delete(streamCheckpoints.keys().next().value!);
}

/** Bounded batches; the file and decoded pixels never leave this device. */
export async function processScoutingVideo(file: File, duration: number, signal: AbortSignal, progress: TrackingProgress, options: TrackingOptions = {}): Promise<VideoAnalysis> {
  const url = URL.createObjectURL(file);
  try { return await processVideoSource(url, duration, signal, progress, options); }
  finally { URL.revokeObjectURL(url); }
}

/** Stream a Drive original directly or through its development gateway, never a saved File/Blob. */
export async function processScoutingVideoUrl(url: string, duration: number, signal: AbortSignal, progress: TrackingProgress, options: TrackingOptions = {}): Promise<VideoAnalysis> {
  let source: URL;
  try { source = new URL(url); } catch { throw new Error('Use o vídeo público do Drive conferido neste estúdio.'); }
  if (source.username || source.password || source.hash)
    throw new Error('Use o vídeo público do Drive conferido neste estúdio.');
  // Never pass the arbitrary input URL through to a media element.
  let canonical: URL;
  if (source.protocol === 'https:' && source.hostname === 'drive.usercontent.google.com' && source.pathname === '/download' && !source.port) {
    const allowed = ['id', 'export', 'confirm'];
    if ([...source.searchParams.keys()].some(key => !allowed.includes(key)) || allowed.some(key => source.searchParams.getAll(key).length !== 1) ||
        source.searchParams.get('export') !== 'download' || source.searchParams.get('confirm') !== 't' ||
        !/^[A-Za-z0-9_-]{10,200}$/.test(source.searchParams.get('id') ?? ''))
      throw new Error('Use o vídeo público do Drive conferido neste estúdio.');
    canonical = new URL('https://drive.usercontent.google.com/download');
    canonical.searchParams.set('id', source.searchParams.get('id')!);
    canonical.searchParams.set('export', 'download'); canonical.searchParams.set('confirm', 't');
  } else if (source.protocol === 'http:' && source.hostname === '127.0.0.1' && source.port === '8095' &&
      /^\/media\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(source.pathname) &&
      [...source.searchParams.keys()].every(key => key === 'token') && source.searchParams.getAll('token').length === 1 &&
      /^[a-f0-9]{64}$/.test(source.searchParams.get('token') ?? '')) {
    canonical = new URL(source.pathname, 'http://127.0.0.1:8095');
    canonical.searchParams.set('token', source.searchParams.get('token')!);
  } else throw new Error('Use o vídeo público do Drive conferido neste estúdio.');
  if (options.resumeKey !== undefined && (typeof options.resumeKey !== 'string' || !/^[a-f0-9]{64}$/.test(options.resumeKey)))
    throw new Error('Contexto de retomada do tracking inválido.');
  let failures = 0, resumeCompleted = 0;
  for (;;) {
    try { return await processVideoSource(canonical.toString(), duration, signal,
      (done, total, stage) => progress(Math.max(done, resumeCompleted), total, stage), options, options.resumeKey, true); }
    catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof MediaReadError) || !options.resumeKey) throw error;
      if (++failures >= 3)
        throw new Error('A conexão com o vídeo falhou três vezes. Confira a conexão e tente novamente. O avanço concluído continua nesta aba.');
      const saved = streamCheckpoints.get(options.resumeKey);
      const completed = saved && saved.expiresAt > Date.now() && saved.duration === duration && saved.model === (options.model ?? 'v2b') ? saved.completed : 0;
      resumeCompleted = completed;
      progress(completed, Math.ceil(duration * 30), 'Trecho interrompido; retomando…');
    }
  }
}

async function processVideoSource(url: string, duration: number, signal: AbortSignal, progress: TrackingProgress, options: TrackingOptions, resumeKey?: string, streamed = false): Promise<VideoAnalysis> {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1800) throw new Error('Analise um vídeo de até 30 minutos por vez.');
  signal.throwIfAborted();
  const model = options.model ?? 'v2b';
  if (model !== 'v2b' && model !== 'v4c') throw new Error('Modelo de tracking não suportado.');
  const width = model === 'v4c' ? 512 : 768, height = model === 'v4c' ? 288 : 432, frameSize = width * height;
  const worker = new Worker('/scouting-ai/worker.js', { type: 'module' });
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; video.preload = 'metadata';
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const total = Math.ceil(duration * 30), candidates: BallTrackingCandidate[] = [], scores: number[] = [];
  const scene = document.createElement('canvas'); scene.width = 160; scene.height = 90;
  const sceneContext = scene.getContext('2d', { willReadFrequently: true });
  const check = () => { if (signal.aborted) throw new DOMException('Cancelado', 'AbortError'); };
  type Reply = { type: string; error?: string; backend?: string; model?: string; width?: number; height?: number; frames?: number; predictions?: {score: number; x: number; y: number}[] };
  const call = (message: object, transfer: Transferable[] = []) => new Promise<Reply>((resolve, reject) => {
    const finish = (error?: Error, result?: Reply) => { clearTimeout(timer); signal.removeEventListener('abort', cancel); worker.onmessage = null; worker.onerror = null; if (error) reject(error); else resolve(result!); };
    const cancel = () => finish(new DOMException('Cancelado', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('O processamento demorou para responder. Tente o modo manual.')), 90000);
    worker.onmessage = ({ data }: MessageEvent<Reply>) => data.type === 'error' ? finish(new Error(data.error)) : finish(undefined, data);
    worker.onerror = () => finish(new Error('Não foi possível carregar o processador neste navegador.'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel();
    worker.postMessage(message, transfer);
  });
  const waitVideo = (event: 'loadeddata' | 'seeked', action: () => void) => new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener('error', fail); signal.removeEventListener('abort', cancel); if (error) reject(error); else resolve(); };
    // Initial load failures can be CORS/access/format problems. Retry only frame
    // reads after metadata and the source binding have already been verified.
    const ready = () => finish(), fail = () => finish(streamed && event === 'seeked' && video.error?.code === 2 ? new MediaReadError() : new Error('Não foi possível ler os quadros deste vídeo.'));
    const cancel = () => finish(new DOMException('Cancelado', 'AbortError'));
    const timer = setTimeout(() => finish(streamed && event === 'seeked' ? new MediaReadError() : new Error('Não foi possível ler os quadros deste vídeo.')), streamed ? 60000 : 15000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener('error', fail, { once: true }); signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel(); action();
  });
  let previous: Uint8Array | null = null;
  try {
    check(); if (!context || !sceneContext) throw new Error('Este navegador não permite analisar imagens.');
    progress(0, total, 'Carregando modelo neste aparelho…');
    const ready = await call({ type: 'init', model }); check();
    if (ready.model !== model || ready.width !== width || ready.height !== height || ready.frames !== 9) throw new Error('O modelo não corresponde à configuração de tracking.');
    video.muted = true; video.playsInline = true;
    await waitVideo('loadeddata', () => { video.src = url; });
    if (!Number.isFinite(video.duration) || Math.abs(video.duration - duration) > .1 || !video.videoWidth || !video.videoHeight) {
      if (resumeKey) streamCheckpoints.delete(resumeKey);
      throw new Error('O vídeo mudou desde a conferência. Abra a mídia novamente antes de analisar.');
    }
    let firstFrame = 0;
    if (resumeKey) {
      const saved = streamCheckpoints.get(resumeKey);
      if (saved && saved.expiresAt <= Date.now()) streamCheckpoints.delete(resumeKey);
      else if (saved) {
        if (saved.duration !== duration || saved.model !== model || saved.width !== video.videoWidth || saved.height !== video.videoHeight ||
            !Number.isInteger(saved.completed) || saved.completed <= 0 || saved.completed > total || (saved.completed !== total && saved.completed % 9 !== 0) ||
            saved.scores.length !== saved.completed || saved.candidates.length > saved.completed || saved.previous.length !== 160 * 90) {
          streamCheckpoints.delete(resumeKey);
          throw new Error('A mídia ou o modelo do tracking mudou. Inicie uma nova análise.');
        }
        firstFrame = saved.completed; candidates.push(...saved.candidates); scores.push(...saved.scores); previous = saved.previous.slice();
        progress(firstFrame, total, 'Retomando tracking neste aparelho…');
      }
    }
    for (let base = firstFrame; base < total; base += 9) {
      const input = new Float32Array(9 * frameSize), count = Math.min(9, total - base);
      const batchScores: number[] = [];
      for (let f = 0; f < count; f++) {
        check(); const time = Math.min((base + f + .1) / 30, duration - .001);
        await waitVideo('seeked', () => { video.currentTime = time; });
        context.drawImage(video, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data, small = new Uint8Array(160 * 90);
        for (let i = 0; i < frameSize; i++) input[f * frameSize + i] = Math.round(.299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2]) / 255;
        sceneContext.drawImage(video, 0, 0, 160, 90);
        const scenePixels = sceneContext.getImageData(0, 0, 160, 90).data;
        for (let i = 0; i < small.length; i++) small[i] = Math.round(.299 * scenePixels[i * 4] + .587 * scenePixels[i * 4 + 1] + .114 * scenePixels[i * 4 + 2]);
        if (previous) {
          let difference = 0; for (let i = 0; i < small.length; i++) difference += Math.abs(small[i] - previous[i]);
          batchScores.push(difference / small.length);
        } else batchScores.push(0);
        previous = small;
      }
      for (let f = count; f < 9; f++) input.copyWithin(f * frameSize, (count - 1) * frameSize, count * frameSize);
      const reply = await call({ type: 'run', input }, [input.buffer]); check();
      if (!reply.predictions || reply.predictions.length !== 9) throw new Error('O modelo retornou um lote incompleto.');
      reply.predictions.slice(0, count).forEach((p, f) => { const time = (base + f) / 30;
        if (time < duration) candidates.push({ time, x: p.x, y: p.y, score: p.score }); });
      scores.push(...batchScores);
      if (resumeKey) checkpoint(resumeKey, { duration, model, width: video.videoWidth, height: video.videoHeight,
        completed: base + count, candidates, scores, previous: previous!.slice(), expiresAt: Date.now() + checkpointLifetime });
      progress(Math.min(base + count, total), total, `Analisando vídeo · ${ready.backend === 'webgpu' ? 'GPU' : 'CPU'}`);
    }
    const cuts = sceneCuts(scores);
    const { positions, metrics } = selectBallTracking(candidates, { cuts, sampledFps: 30 });
    check();
    progress(total, total, `Trajetória revisável · ${metrics.accepted} posições · ${metrics.isolatedSpikes} saltos isolados removidos · ${metrics.belowConfidence + metrics.invalid} candidatos sem evidência suficiente`);
    check();
    if (resumeKey) streamCheckpoints.delete(resumeKey);
    return { model: model === 'v4c' ? 'vballnet-v4c-browser-1' : 'vballnet-v2b-browser-1', positions, cuts, sampledFps: 30 };
  } finally { worker.terminate(); video.removeAttribute('src'); video.load(); canvas.width = canvas.height = scene.width = scene.height = 0; }
}
