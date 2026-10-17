import { assertSessionIdentity, getSessionIdentity } from '../auth/session';
import { supabasePost } from '../db/client';
import { parseVideoDocument, type VideoDocument, type VideoMedia } from '../core/scouting-video';

export type VideoDocumentScope = { org: string; sessionId: string; userId: string };
export type VideoDocumentRecord = {
    organizationId: string;
    sessionId: string;
    fingerprint: string;
    revision: number;
    document: VideoDocument;
    updatedAt: string;
    mutationId: string;
};
export type VideoDocumentSyncErrorCode = 'conflict' | 'missing-backend' | 'offline' | 'permission' | 'invalid' | 'unavailable';
export class VideoDocumentSyncError extends Error {
    constructor(public code: VideoDocumentSyncErrorCode) {
        const messages: Record<VideoDocumentSyncErrorCode, string> = {
            conflict: 'Esta análise mudou em outro aparelho. Escolha a versão que deseja manter.',
            'missing-backend': 'A sincronização das análises ainda precisa ser ativada no servidor. Seu rascunho foi preservado.',
            offline: 'Sem conexão para sincronizar. Seu rascunho foi preservado neste aparelho.',
            permission: 'Sua conta não pode sincronizar esta análise.',
            invalid: 'A análise recebida não corresponde a esta sessão ou vídeo. Seu rascunho foi preservado.',
            unavailable: 'Não foi possível sincronizar agora. Seu rascunho foi preservado neste aparelho.',
        };
        super(messages[code]);
        this.name = 'VideoDocumentSyncError';
    }
}

const boundedText = (value: unknown, limit: number): value is string =>
    typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

function requestContext(scope: VideoDocumentScope) {
    const identity = getSessionIdentity();
    if (!boundedText(scope.org, 200) || !boundedText(scope.sessionId, 200) || !boundedText(scope.userId, 200) || identity.userId !== scope.userId)
        throw new VideoDocumentSyncError('permission');
    assertSessionIdentity(identity);
    return identity;
}

function syncFailure(failure: unknown): never {
    if (failure instanceof VideoDocumentSyncError || (failure instanceof Error && failure.name === 'SessionIdentityChangedError')) throw failure;
    const message = failure instanceof Error ? failure.message : '';
    if (/\b40001\b/.test(message)) throw new VideoDocumentSyncError('conflict');
    if (/\b(?:PGRST202|PGRST205|42P01|42883)\b/.test(message)) throw new VideoDocumentSyncError('missing-backend');
    if (/\b(?:42501|28000|55000|PGRST301)\b|(?:error:\s*)(?:401|403)\b/.test(message)) throw new VideoDocumentSyncError('permission');
    if (/\b(?:22023|23514)\b/.test(message)) throw new VideoDocumentSyncError('invalid');
    if (failure instanceof TypeError || (failure instanceof Error && failure.name === 'SupabaseRequestTimeoutError') || /Network request failed|Failed to fetch|fetch failed|NetworkError|offline|Timed out/i.test(message))
        throw new VideoDocumentSyncError('offline');
    throw new VideoDocumentSyncError('unavailable');
}

function parseRecord(value: unknown, scope: VideoDocumentScope, fingerprint?: string, media?: VideoMedia): VideoDocumentRecord {
    const row = value as VideoDocumentRecord | null;
    if (!row || row.organizationId !== scope.org || row.sessionId !== scope.sessionId || !boundedText(row.fingerprint, 256) ||
        (fingerprint !== undefined && row.fingerprint !== fingerprint) || !validRevision(row.revision) ||
        !boundedText(row.mutationId, 128) || !boundedText(row.updatedAt, 100) || !Number.isFinite(Date.parse(row.updatedAt)))
        throw new VideoDocumentSyncError('invalid');
    let document: VideoDocument;
    try { document = parseVideoDocument(row.document, media); } catch { throw new VideoDocumentSyncError('invalid'); }
    if (document.media.fingerprint !== row.fingerprint) throw new VideoDocumentSyncError('invalid');
    return { organizationId: row.organizationId, sessionId: row.sessionId, fingerprint: row.fingerprint,
        revision: row.revision, document, updatedAt: row.updatedAt, mutationId: row.mutationId };
}

/** An omitted fingerprint restores the latest analysis in this authorized session. */
export async function getScoutingVideoDocument(scope: VideoDocumentScope, fingerprint?: string, media?: VideoMedia): Promise<VideoDocumentRecord | null> {
    const identity = requestContext(scope);
    if ((fingerprint !== undefined && !boundedText(fingerprint, 256)) || (media && media.fingerprint !== fingerprint))
        throw new VideoDocumentSyncError('invalid');
    try {
        const result = await supabasePost<unknown>('/rpc/get_scouting_video_document', {
            p_org: scope.org, p_session: scope.sessionId, p_fingerprint: fingerprint ?? null,
        }, undefined, identity);
        assertSessionIdentity(identity);
        return result === null ? null : parseRecord(result, scope, fingerprint, media);
    } catch (failure) { return syncFailure(failure); }
}

/** Mutation IDs identify a fixed snapshot and expected revision; retries reuse all three. */
export async function saveScoutingVideoDocument(scope: VideoDocumentScope, document: VideoDocument, expectedRevision: number, mutationId: string): Promise<VideoDocumentRecord> {
    const identity = requestContext(scope);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !boundedText(mutationId, 128)) throw new VideoDocumentSyncError('invalid');
    let normalized: VideoDocument;
    try { normalized = parseVideoDocument(document); } catch { throw new VideoDocumentSyncError('invalid'); }
    if (!boundedText(normalized.media.fingerprint, 256)) throw new VideoDocumentSyncError('invalid');
    try {
        const result = await supabasePost<unknown>('/rpc/save_scouting_video_document', {
            p_org: scope.org, p_session: scope.sessionId, p_fingerprint: normalized.media.fingerprint,
            p_document: normalized, p_expected_revision: expectedRevision, p_mutation_id: mutationId,
        }, undefined, identity);
        assertSessionIdentity(identity);
        const record = parseRecord(result, scope, normalized.media.fingerprint, normalized.media);
        // A stale/lost acknowledgment cannot mark another snapshot as synchronized.
        if (record.revision !== expectedRevision + 1 || record.mutationId !== mutationId || JSON.stringify(record.document) !== JSON.stringify(normalized))
            throw new VideoDocumentSyncError('invalid');
        return record;
    } catch (failure) { return syncFailure(failure); }
}
