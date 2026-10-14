import { assertSessionIdentity, getSessionIdentity } from '../auth/session';
import type { VideoMedia } from '../core/scouting-video';
import { parseDriveTrackingResult, type DriveTrackingResult } from '../core/scouting-video-drive';

export type DriveTrackingScope = { userId: string; org: string; classId: string; sessionId: string; targetFingerprint: string };
export type DriveVideoCandidate = { fileId: string; media: VideoMedia; playbackUrl: string };
const service = 'http://127.0.0.1:8095';
const headers = { 'Content-Type': 'application/json', 'X-GoAtleta-Tracking': '1' };
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
const jobPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const healthUrl = (scope: DriveTrackingScope) => `${service}/health?${new URLSearchParams({ userId: scope.userId, org: scope.org }).toString()}`;

export function driveTrackingAvailable() {
    return __DEV__ && typeof window !== 'undefined' && window.location.origin === 'http://localhost:8081';
}

export async function getDriveTrackingHealth(scope: DriveTrackingScope, signal: AbortSignal, isCurrent: () => boolean = () => true): Promise<{ ready: boolean }> {
    const check = context(scope, signal, isCurrent); check();
    const response = await fetch(healthUrl(scope), { signal, headers }); check();
    const value = await response.json(); check();
    if (!response.ok || value.provider !== 'roboflow' || value.model !== 'volleyball_v2/3' || typeof value.ready !== 'boolean')
        throw new Error('Serviço de tracking desconectado. Inicie o companion do Drive.');
    return { ready: value.ready };
}

/** Session-only companion memory. Never localStorage, document JSON or logs. */
export async function configureDriveTrackingCredential(apiKey: string, scope: DriveTrackingScope, signal: AbortSignal, isCurrent: () => boolean = () => true): Promise<void> {
    const check = context(scope, signal, isCurrent); check();
    if (typeof apiKey !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(apiKey.trim()))
        throw new Error('Informe uma chave válida do Roboflow.');
    const response = await fetch(`${service}/credential`, { method: 'POST', signal, headers, body: JSON.stringify({ apiKey: apiKey.trim(), scope }) }); check();
    if (!response.ok) throw new Error('Não foi possível configurar a chave nesta sessão.');
    const value = await response.json(); check();
    if (value.ready !== true) throw new Error('Não foi possível configurar a chave nesta sessão.');
}

/** Only public Drive file links; folders are intentionally not crawled. */
export function parseDriveVideoLink(value: string): { fileId: string; playbackUrl: string } {
    let link: URL;
    try { link = new URL(value.trim()); } catch { throw new Error('Cole o link de um arquivo de vídeo do Drive.'); }
    if (link.protocol !== 'https:' || link.hostname !== 'drive.google.com' || link.username || link.password || link.port)
        throw new Error('Use um link HTTPS de arquivo do Google Drive.');
    if (/\/folders(?:\/|$)/.test(link.pathname)) throw new Error('Este link é de uma pasta. Abra o vídeo no Drive e copie o link do arquivo.');
    const fileId = link.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/view|\/preview)?\/?$/)?.[1] ??
        (link.pathname === '/open' || link.pathname === '/uc' ? link.searchParams.get('id') : null);
    if (!fileId || !idPattern.test(fileId)) throw new Error('Cole o link de um arquivo de vídeo do Drive.');
    const url = new URL('https://drive.usercontent.google.com/download');
    url.searchParams.set('id', fileId); url.searchParams.set('export', 'download'); url.searchParams.set('confirm', 't');
    return { fileId, playbackUrl: url.toString() };
}

function context(scope: DriveTrackingScope, signal: AbortSignal, isCurrent: () => boolean) {
    if (!driveTrackingAvailable()) throw new Error('A conexão com o tracking na nuvem está disponível neste ambiente de desenvolvimento.');
    const identity = getSessionIdentity();
    const scopeKeys: (keyof DriveTrackingScope)[] = ['userId', 'org', 'classId', 'sessionId', 'targetFingerprint'];
    if (scopeKeys.some(key => typeof scope[key] !== 'string' || !scope[key].trim() || scope[key].length > 500) || identity.userId !== scope.userId)
        throw new Error('Sessão de scouting inválida. Reabra o estúdio.');
    return () => {
        signal.throwIfAborted(); assertSessionIdentity(identity);
        if (!isCurrent()) throw new Error('O contexto do estúdio mudou. Reabra o tracking.');
    };
}

function readMetadata(url: string, signal: AbortSignal): Promise<{ duration: number; width: number; height: number }> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; video.preload = 'metadata'; video.muted = true;
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (failure?: Error) => {
            if (settled) return; settled = true;
            clearTimeout(timer); signal.removeEventListener('abort', abort);
            const meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
            video.onloadedmetadata = video.onerror = null; video.removeAttribute('src'); video.load();
            if (failure) reject(failure);
            else if (!Number.isFinite(meta.duration) || meta.duration <= 0 || meta.duration > 1800 || !meta.width || !meta.height)
                reject(new Error('Use um vídeo compatível de até 30 minutos.'));
            else resolve(meta);
        };
        const abort = () => finish(new DOMException('Cancelado', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('O Drive demorou para responder. Confira o acesso ao arquivo.')), 20000);
        video.onloadedmetadata = () => finish();
        video.onerror = () => finish(new Error('Não foi possível reproduzir este arquivo público do Drive. Use MP4 compatível.'));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort(); else video.src = url;
    });
}

function gatewayPlaybackUrl(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Resposta inválida da conexão com o Drive.');
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Resposta inválida da conexão com o Drive.'); }
    const id = url.pathname.match(/^\/media\/([^/]+)$/)?.[1];
    if (url.origin !== service || url.username || url.password || url.hash || !id || !jobPattern.test(id) ||
        [...url.searchParams.keys()].length !== 1 || !/^[a-f0-9]{64}$/.test(url.searchParams.get('token') ?? ''))
        throw new Error('Resposta inválida da conexão com o Drive.');
    return url.toString();
}

/** The companion streams bounded ranges without creating a saved media file. */
export async function inspectDriveVideo(link: string, scope: DriveTrackingScope, signal: AbortSignal, isCurrent: () => boolean = () => true): Promise<DriveVideoCandidate> {
    const check = context(scope, signal, isCurrent); check();
    const { fileId } = parseDriveVideoLink(link);
    let playbackUrl = '';
    try {
        const response = await fetch(`${service}/media`, { method: 'POST', signal, headers, body: JSON.stringify({ fileId, scope }) });
        const value = await response.json();
        if (response.ok) playbackUrl = gatewayPlaybackUrl(value.playbackUrl);
        check();
        const size = value.size;
        if (!response.ok || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > 3000000000 ||
            typeof value.mimeType !== 'string' || !/^video\/(mp4|quicktime)(?:;|$)/i.test(value.mimeType) ||
            (value.lastModified != null && (typeof value.lastModified !== 'string' || value.lastModified.length > 100)))
            throw new Error('O Drive não liberou um vídeo público compatível. Confira o acesso de leitura e download do arquivo.');
        const meta = await readMetadata(playbackUrl, signal); check();
        const version = `${fileId}:${size}:${value.lastModified ?? ''}`;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(version)); check();
        // Opaque metadata identity, not a byte-for-byte content hash.
        const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        return { fileId, playbackUrl, media: { fingerprint, name: 'Vídeo do Drive.mp4', ...meta } };
    } catch (failure) {
        if (playbackUrl) void fetch(playbackUrl, { method: 'DELETE', headers, body: JSON.stringify({ scope }) }).catch(() => undefined);
        if (failure instanceof TypeError) throw new Error('Conexão com o Drive indisponível. Confira o companion de tracking.');
        throw failure;
    }
}

const sameScope = (value: unknown, scope: DriveTrackingScope) => !!value && typeof value === 'object' &&
    (Object.keys(scope) as (keyof DriveTrackingScope)[]).every(key => (value as DriveTrackingScope)[key] === scope[key]);

function delay(signal: AbortSignal, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Cancelado', 'AbortError')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
        signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    });
}

/** No media transfer to the companion and no browser/local inference fallback. */
export async function trackDriveVideo(candidate: DriveVideoCandidate, scope: DriveTrackingScope, signal: AbortSignal, isCurrent: () => boolean = () => true): Promise<DriveTrackingResult> {
    const check = context(scope, signal, isCurrent); check();
    if (!idPattern.test(candidate.fileId)) throw new Error('Arquivo do Drive inválido.');
    let jobId = '', cancelled = false, postStarted = false, postDeclined = false;
    const cancel = () => {
        if (!jobId || cancelled) return;
        cancelled = true;
        void fetch(`${service}/jobs/${jobId}`, { method: 'DELETE', headers, body: JSON.stringify({ scope }) }).catch(() => undefined);
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        const healthResponse = await fetch(healthUrl(scope), { signal, headers }); check();
        const health = await healthResponse.json(); check();
        if (!healthResponse.ok || health.ready !== true || health.provider !== 'roboflow' || health.model !== 'volleyball_v2/3')
            throw new Error('O serviço de tracking na nuvem não está configurado. Seu rascunho foi preservado.');
        postStarted = true;
        let response = await fetch(`${service}/jobs`, { method: 'POST', signal, headers, body: JSON.stringify({ fileId: candidate.fileId, media: candidate.media, scope }) });
        // Preserve the safe cancellation handle even when the studio/session
        // changes while this mutating request is in flight. Never apply it then.
        let job = await response.json();
        if (typeof job?.id === 'string' && jobPattern.test(job.id)) jobId = job.id;
        if (!response.ok) postDeclined = true;
        check();
        if (!response.ok) throw new Error(typeof job.error === 'string' ? job.error : 'Não foi possível iniciar o tracking na nuvem.');
        if (typeof job.id !== 'string' || !jobPattern.test(job.id)) throw new Error('Resposta inválida do serviço de tracking.');
        jobId = job.id;
        const deadline = Date.now() + 3600000;
        for (;;) {
            if (job.id !== jobId || !sameScope(job.scope, scope)) throw new Error('O tracking recebido pertence a outro contexto.');
            if (job.status === 'failed' || job.status === 'cancelled') throw new Error(typeof job.error === 'string' ? job.error : 'Tracking cancelado ou indisponível.');
            if (job.status === 'complete') {
                parseDriveTrackingResult(job.result);
                const result = job.result as DriveTrackingResult;
                if (result.media.fingerprint !== candidate.media.fingerprint || result.media.duration !== candidate.media.duration || result.media.width !== candidate.media.width || result.media.height !== candidate.media.height)
                    throw new Error('O resultado não corresponde ao vídeo selecionado.');
                check(); return result;
            }
            if (job.status !== 'running') throw new Error('Estado inválido do serviço de tracking.');
            if (Date.now() > deadline) throw new Error('O tracking excedeu o tempo de espera. Consulte o serviço antes de iniciar novamente.');
            await delay(signal, 2000); check();
            response = await fetch(`${service}/jobs/${jobId}?${new URLSearchParams({ userId: scope.userId, org: scope.org }).toString()}`, { signal, headers }); check();
            job = await response.json(); check();
            if (!response.ok) throw new Error(typeof job.error === 'string' ? job.error : 'Não foi possível consultar o tracking.');
        }
    } catch (failure) {
        cancel();
        if (postStarted && !postDeclined && !jobId)
            throw new Error('Não foi possível confirmar se o tracking começou. Ele pode continuar na nuvem; nenhuma nova tentativa foi iniciada.');
        if (failure instanceof TypeError) throw new Error('Serviço de tracking desconectado. Inicie o companion do Drive.');
        throw failure;
    } finally { signal.removeEventListener('abort', cancel); }
}
