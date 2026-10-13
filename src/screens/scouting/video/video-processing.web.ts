import type { VideoAnalysis } from '../../../core/scouting-video';
import { sceneCuts } from '../../../core/scouting-video-playback';

/** Bounded batches; the file and decoded pixels never leave this device. */
export async function processScoutingVideo(file: File, duration: number, signal: AbortSignal, progress: (done: number, total: number, stage: string) => void): Promise<VideoAnalysis> {
  if (duration > 1800) throw new Error('Analise um vídeo de até 30 minutos por vez.');
  const worker = new Worker('/scouting-ai/worker.js', { type: 'module' });
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 432;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const total = Math.ceil(duration * 30), positions: VideoAnalysis['positions'] = [], scores: number[] = [];
  const scene = document.createElement('canvas'); scene.width = 160; scene.height = 90;
  const sceneContext = scene.getContext('2d', { willReadFrequently: true });
  const check = () => { if (signal.aborted) throw new DOMException('Cancelado', 'AbortError'); };
  type Reply = { type: string; error?: string; backend?: string; predictions?: {score: number; x: number; y: number}[] };
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
    const ready = () => finish(), fail = () => finish(new Error('Não foi possível ler os quadros deste vídeo.'));
    const cancel = () => finish(new DOMException('Cancelado', 'AbortError'));
    const timer = setTimeout(fail, 15000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener('error', fail, { once: true }); signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel(); action();
  });
  let previous: Uint8Array | null = null;
  try {
    check(); if (!context || !sceneContext) throw new Error('Este navegador não permite analisar imagens.');
    progress(0, total, 'Carregando modelo neste aparelho…');
    const ready = await call({ type: 'init' }); check();
    video.muted = true; video.playsInline = true;
    await waitVideo('loadeddata', () => { video.src = url; });
    for (let base = 0; base < total; base += 9) {
      const input = new Float32Array(9 * 768 * 432), count = Math.min(9, total - base);
      for (let f = 0; f < count; f++) {
        check(); const time = Math.min((base + f + .1) / 30, duration - .001);
        await waitVideo('seeked', () => { video.currentTime = time; });
        context.drawImage(video, 0, 0, 768, 432);
        const pixels = context.getImageData(0, 0, 768, 432).data, small = new Uint8Array(160 * 90);
        for (let i = 0; i < 768 * 432; i++) input[f * 768 * 432 + i] = Math.round(.299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2]) / 255;
        sceneContext.drawImage(video, 0, 0, 160, 90);
        const scenePixels = sceneContext.getImageData(0, 0, 160, 90).data;
        for (let i = 0; i < small.length; i++) small[i] = Math.round(.299 * scenePixels[i * 4] + .587 * scenePixels[i * 4 + 1] + .114 * scenePixels[i * 4 + 2]);
        if (previous) {
          let difference = 0; for (let i = 0; i < small.length; i++) difference += Math.abs(small[i] - previous[i]);
          scores.push(difference / small.length);
        } else scores.push(0);
        previous = small;
      }
      for (let f = count; f < 9; f++) input.copyWithin(f * 768 * 432, (count - 1) * 768 * 432, count * 768 * 432);
      const reply = await call({ type: 'run', input }, [input.buffer]); check();
      if (!reply.predictions || reply.predictions.length !== 9) throw new Error('O modelo retornou um lote incompleto.');
      reply.predictions.slice(0, count).forEach((p, f) => { if (p.score >= .5 && Number.isFinite(p.x) && Number.isFinite(p.y)) positions.push({ time: (base + f) / 30, x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }); });
      progress(Math.min(base + count, total), total, `Analisando vídeo · ${ready.backend === 'webgpu' ? 'GPU' : 'CPU'}`);
    }
    return { model: 'vballnet-v2b-browser-1', positions, cuts: sceneCuts(scores), sampledFps: 30 };
  } finally { worker.terminate(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); canvas.width = canvas.height = scene.width = scene.height = 0; }
}
