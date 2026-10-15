import { parseVideoDocument, type VideoDocument } from './scouting-video';

export type VideoShareAudience = 'team' | 'link';
export type VideoStudioPermissions = { annotate: boolean; saveDraft: boolean; manageSharing: boolean; importMedia: boolean; download: boolean };
export const videoViewerPermissions: VideoStudioPermissions = Object.freeze({ annotate: false, saveDraft: false, manageSharing: false, importMedia: false, download: false });
export function videoStudioPermissions(shared: boolean, preview: boolean, editable: boolean): VideoStudioPermissions {
    if (shared || preview) return videoViewerPermissions;
    return { annotate: editable, saveDraft: editable, manageSharing: true, importMedia: true, download: true };
}

/** Published review snapshot. Never includes draft history or linked student identities. */
export function publishableVideoDocument(value: VideoDocument): VideoDocument {
    const doc = parseVideoDocument(value);
    return { ...doc, ...(doc.analysis ? { analysis: { model: doc.analysis.model, sampledFps: doc.analysis.sampledFps, positions: doc.analysis.positions, cuts: doc.analysis.cuts } } : {}), media: { ...doc.media, fingerprint: 'shared', name: 'Vídeo da análise' },
        rallies: doc.rallies.map((r, i) => ({ ...r, id: `rally-${i + 1}` })),
        contacts: doc.contacts.map((c, i) => ({ ...c, id: `contact-${i + 1}`, studentId: null })),
    };
}

export const videoShareCodePattern = /^[a-f0-9]{64}$/;
export function videoShareLink(id: string, code: string, origin: string) {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || !videoShareCodePattern.test(code)) throw new Error('Link inválido.');
    const url = new URL(origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Endereço inválido.');
    // Proof remains in the fragment, outside HTTP paths, referrers and navigation telemetry.
    const publicOrigin = ['localhost', '127.0.0.1'].includes(url.hostname) ? 'https://goatleta.com' : url.origin;
    return `${publicOrigin}/scouting/shared#id=${id}&code=${code}`;
}
