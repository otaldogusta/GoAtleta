import { parseVideoDocument, type VideoDocument } from './scouting-video';

export type VideoSyncBaseline = { revision: number; signature: string };
export type VideoSyncSnapshot = { document: VideoDocument; revision: number };
export type VideoSyncResolution = {
    source: 'empty' | 'local' | 'remote' | 'conflict';
    needsUpload: boolean;
    baseline: VideoSyncBaseline | null;
};

/** Normalize before comparing so imports cannot add hidden URLs or access fields. */
export function videoDocumentSignature(document: VideoDocument): string {
    return JSON.stringify(parseVideoDocument(document));
}

/** Only call after a successful cloud read: a failed read is never an empty cloud. */
export function reconcileVideoDocuments({ local, remote, baseline }: {
    local: VideoDocument | null;
    remote: VideoSyncSnapshot | null;
    baseline?: VideoSyncBaseline | null;
}): VideoSyncResolution {
    const previous = baseline ?? null;
    const conflict: VideoSyncResolution = { source: 'conflict', needsUpload: false, baseline: previous };
    if (previous && (!Number.isSafeInteger(previous.revision) || previous.revision < 1 || !previous.signature)) return conflict;
    const localSignature = local ? videoDocumentSignature(local) : null;
    if (!remote) {
        if (previous) return conflict;
        return { source: local ? 'local' : 'empty', needsUpload: !!local, baseline: null };
    }
    if (!Number.isSafeInteger(remote.revision) || remote.revision < 1 || (previous && remote.revision < previous.revision)) return conflict;
    const remoteSignature = videoDocumentSignature(remote.document);
    const nextBaseline = { revision: remote.revision, signature: remoteSignature };
    if (!local) return { source: 'remote', needsUpload: false, baseline: nextBaseline };
    try { parseVideoDocument(local, remote.document.media); } catch { return conflict; }
    if (localSignature === remoteSignature) return { source: 'local', needsUpload: false, baseline: nextBaseline };
    if (!previous) return conflict;
    if (localSignature === previous.signature) return { source: 'remote', needsUpload: false, baseline: nextBaseline };
    if (remoteSignature === previous.signature) return { source: 'local', needsUpload: true, baseline: nextBaseline };
    return conflict;
}
