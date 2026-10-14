import { parseVideoAiResult } from '../core/scouting-video-ai';

export function localVideoAiAvailable() {
    return __DEV__ && typeof window !== 'undefined' && window.location.origin === 'http://localhost:8081';
}
export async function analyzeYouTube(videoId: string, start: number, end: number, signal: AbortSignal) {
    if (!localVideoAiAvailable()) throw new Error('A análise pelo link está disponível neste computador de desenvolvimento.');
    let response: Response, jobId: string | undefined;
    const headers = { 'Content-Type': 'application/json', 'X-GoAtleta-Analysis': '1' };
    const cancel = () => { if (jobId) void fetch(`http://127.0.0.1:8094/jobs/${jobId}`, { method: 'DELETE', headers }).catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        response = await fetch('http://127.0.0.1:8094/analyze', { method: 'POST', signal, headers, body: JSON.stringify({ videoId, start, end }) });
        let result = await response.json();
        const deadline = Date.now() + 90000;
        while (response.status === 202) {
            if (typeof result.jobId !== 'string' || !/^[a-f0-9-]{36}$/.test(result.jobId)) throw new Error('Resposta inválida do serviço de análise.');
            jobId = result.jobId;
            if (Date.now() > deadline) { cancel(); throw new Error('A análise excedeu o tempo de resposta.'); }
            await new Promise<void>((resolve, reject) => {
                if (signal.aborted) { reject(new Error('Cancelado')); return; }
                const stop = () => { clearTimeout(timer); reject(new Error('Cancelado')); };
                const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, 1000);
                signal.addEventListener('abort', stop, { once: true });
            });
            response = await fetch(`http://127.0.0.1:8094/jobs/${jobId}`, { signal, headers });
            result = await response.json();
        }
        if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Não foi possível analisar o vídeo.');
        return parseVideoAiResult(result, videoId, start, end);
    } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof Error && error.name !== 'TypeError') throw error;
        throw new Error('Serviço de análise desconectado. Inicie o serviço local do Gemini neste computador.');
    } finally { signal.removeEventListener('abort', cancel); }
}
