import { Upload } from 'tus-js-client';
import { SUPABASE_URL } from './config';
import { assertSessionIdentity, getSessionIdentity, getValidAccessToken, subscribeSession } from '../auth/session';
import { videoContentType, type VideoShareAsset } from './scouting-video-sharing';

export function uploadSharedVideo(file: File, asset: VideoShareAsset, signal: AbortSignal, onProgress: (value: number) => void) {
  if (asset.uploaded) return Promise.resolve();
  const identity = getSessionIdentity();
  const base = new URL(SUPABASE_URL);
  if (base.hostname.endsWith('.supabase.co')) base.hostname = base.hostname.replace('.supabase.co', '.storage.supabase.co');
  const endpoint = `${base.origin}/storage/v1/upload/resumable`;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      signal.removeEventListener('abort', abort); unsubscribe();
      if (error) { void upload.abort(); reject(error); } else resolve();
    };
    const abort = () => finish(new DOMException('Envio cancelado.', 'AbortError'));
    const unsubscribe = subscribeSession(() => { try { assertSessionIdentity(identity); } catch { abort(); } });
    const upload = new Upload(file, {
      endpoint, chunkSize: 6 * 1024 * 1024, retryDelays: [0, 1000, 3000, 5000], uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async () => `goatleta-video:${identity.userId}:${asset.assetId}`,
      metadata: { bucketName: 'scouting-videos', objectName: asset.objectPath, contentType: videoContentType(file), cacheControl: '300' },
      onBeforeRequest: async req => {
        assertSessionIdentity(identity); signal.throwIfAborted();
        const token = await getValidAccessToken(); assertSessionIdentity(identity); signal.throwIfAborted();
        if (!token) throw new Error('Sessão expirada.');
        // Never send a bearer token to a resumed URL with another origin.
        if (new URL(req.getURL()).origin !== base.origin) throw new Error('Destino do envio inválido.');
        req.setHeader('Authorization', `Bearer ${token}`);
      },
      onProgress: (sent, total) => { if (!settled) onProgress(sent / total); },
      onSuccess: () => { try { assertSessionIdentity(identity); finish(); } catch { abort(); } },
      onError: error => {
        const status = 'originalResponse' in error ? (error.originalResponse as { getStatus: () => number } | null)?.getStatus() : 0;
        finish(new Error(status === 413 ? 'Este vídeo excede o limite de hospedagem do projeto. Use um arquivo menor ou ajuste o armazenamento antes de compartilhar.' : 'O envio não terminou. Tente novamente para retomar.'));
      },
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void upload.findPreviousUploads().then(previous => {
      if (settled) return;
      const recent = previous.find(p => p.uploadUrl && new URL(p.uploadUrl).origin === base.origin && Date.now() - Date.parse(p.creationTime) < 23 * 3600000);
      if (recent) upload.resumeFromPreviousUpload(recent);
      upload.start();
    }).catch(() => finish(new Error('Não foi possível iniciar o envio.')));
  });
}
