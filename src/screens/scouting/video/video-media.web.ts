import type { VideoMedia } from '../../../core/scouting-video';
export async function inspectVideo(file: File): Promise<VideoMedia> {
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(file.name))
        throw new Error('Escolha um arquivo de vídeo.');
    const url = URL.createObjectURL(file), video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    try {
        const meta = await new Promise<{
            duration: number;
            width: number;
            height: number;
        }>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('O vídeo demorou para responder. Tente novamente.')), 15000);
            video.onloadedmetadata = () => { clearTimeout(timer); resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }); };
            video.onerror = () => { clearTimeout(timer); reject(new Error('Este formato não pôde ser reproduzido. Use MP4 ou WebM compatível.')); };
            video.preload = 'metadata';
            video.src = url;
        });
        if (!Number.isFinite(meta.duration) || meta.duration <= 0 || meta.duration > 86400 || !meta.width || !meta.height)
            throw new Error('Duração ou imagem do vídeo inválida.');
        // Bounded identity sampling avoids holding a multi-GB video in memory.
        const sample = await new Blob([`${file.size}:`, file.slice(0, 1048576), file.slice(Math.max(0, file.size - 1048576))]).arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', sample);
        return { fingerprint: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''), name: file.name, ...meta };
    }
    finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
    }
}
export function downloadVideoBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
let thumbnailQueue = Promise.resolve();
const thumbnailCache = new Map<string, string>();
export function videoThumbnail(source: string, time: number, signal: AbortSignal): Promise<string> {
    const key = `${source}:${time}`;
    const cached = thumbnailCache.get(key);
    if (cached) return Promise.resolve(cached);
    // One auxiliary decoder at a time, instead of competing with playback for every card.
    const result = thumbnailQueue.then(async () => {
        if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        const image = thumbnailCache.get(key) ?? await generateVideoThumbnail(source, time, signal);
        thumbnailCache.set(key, image);
        if (thumbnailCache.size > 160) thumbnailCache.delete(thumbnailCache.keys().next().value!);
        return image;
    });
    thumbnailQueue = result.then(() => undefined, () => undefined);
    return result;
}
async function generateVideoThumbnail(source: string, time: number, signal: AbortSignal): Promise<string> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (value?: string) => { if (settled)
            return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); video.onloadeddata = video.onseeked = video.onerror = null; video.removeAttribute('src'); video.load(); if (value) resolve(value); else reject(new Error('Miniatura indisponível')); };
        const abort = () => done();
        const timer = setTimeout(abort, 10000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }
        video.onloadeddata = () => { video.currentTime = Math.min(time + .05, video.duration - .01); };
        video.onseeked = () => { const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = Math.round(240 * video.videoHeight / video.videoWidth); const ctx = canvas.getContext('2d'); if (!ctx)
            return done(); ctx.drawImage(video, 0, 0, canvas.width, canvas.height); done(canvas.toDataURL('image/jpeg', .65)); };
        video.onerror = abort;
        video.src = source;
    });
}
export async function recordVideoClip(source: string, start: number, end: number, onProgress: (value: number) => void, signal: AbortSignal): Promise<Blob> {
    const video = document.createElement('video') as HTMLVideoElement & {
        captureStream?: () => MediaStream;
    };
    if (typeof MediaRecorder === 'undefined' || !video.captureStream)
        throw new Error('Este navegador não permite exportar recortes. Baixe o vídeo completo.');
    // A separate offscreen player keeps analysis playback and annotations untouched.
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    video.playsInline = true;
    video.volume = 0;
    document.body.append(video);
    let recorder: MediaRecorder | undefined, stream: MediaStream | undefined, timer: ReturnType<typeof setInterval> | undefined;
    const chunks: Blob[] = [];
    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Não foi possível ler o vídeo.')), 15000);
            video.onloadedmetadata = () => { video.currentTime = start; };
            video.onseeked = () => { clearTimeout(timeout); resolve(); };
            video.onerror = () => { clearTimeout(timeout); reject(new Error('Vídeo indisponível.')); };
            video.src = source;
        });
        if (signal.aborted)
            throw new Error('Exportação cancelada.');
        stream = video.captureStream();
        const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
        if (!mimeType)
            throw new Error('Formato de exportação indisponível neste navegador.');
        recorder = new MediaRecorder(stream, { mimeType });
        const recording = recorder;
        const result = new Promise<Blob>((resolve, reject) => {
            const abort = () => { if (recording.state !== 'inactive')
                recording.stop(); reject(new Error('Exportação cancelada.')); };
            signal.addEventListener('abort', abort, { once: true });
            recording.ondataavailable = e => { if (e.data.size)
                chunks.push(e.data); };
            recording.onerror = () => reject(new Error('Não foi possível exportar o recorte.'));
            recording.onstop = () => { signal.removeEventListener('abort', abort); resolve(new Blob(chunks, { type: mimeType })); };
            recording.start(250);
            const deadline = Date.now() + (end - start + 30) * 1000;
            timer = setInterval(() => { onProgress(Math.min(1, (video.currentTime - start) / (end - start))); if (video.currentTime >= end || video.ended) {
                video.pause();
                recording.stop();
                clearInterval(timer);
            }
            else if (Date.now() > deadline) {
                clearInterval(timer);
                abort();
            } }, 30);
        });
        // Attach rejection handlers to both operations immediately (including aborts).
        const [, blob] = await Promise.all([video.play(), result]);
        return blob;
    }
    finally {
        if (timer)
            clearInterval(timer);
        if (recorder?.state !== 'inactive' && recorder?.state)
            recorder.stop();
        stream?.getTracks().forEach(t => t.stop());
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
    }
}
