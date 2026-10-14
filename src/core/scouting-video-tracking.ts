import { newVideoDocument, parseVideoDocument, type VideoAnalysis, type VideoDocument, type VideoMedia } from './scouting-video';

export type OriginalVideoTracking = VideoDocument | { media: VideoMedia; analysis: VideoAnalysis };

/**
 * Attach only tracking after the caller explicitly confirms the same video/edit.
 * Duration similarity is never evidence of identity. Coordinates remain normalized
 * to the original frame. A separately authorized original can display the overlay;
 * the YouTube iframe itself never exposes frames to the tracker.
 */
export function attachYoutubeTracking(
    doc: VideoDocument,
    original: OriginalVideoTracking,
    offsetSeconds: number,
    expectedSourceFingerprint?: string,
): VideoDocument {
    const target = parseVideoDocument(doc);
    if (!target.media.youtubeId || target.media.fingerprint !== `youtube:${target.media.youtubeId}`)
        throw new Error('Abra o vídeo do YouTube para vincular o tracking.');
    if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > 1800)
        throw new Error('O ajuste de tempo deve estar entre -1.800 e 1.800 segundos.');
    if (!original || !original.media)
        throw new Error('Arquivo de tracking original inválido.');
    const input = parseVideoDocument('version' in original ? original : {
        ...newVideoDocument(original.media, 'tracking-source'), analysis: original.analysis,
    });
    if (input.media.youtubeId || input.media.fingerprint.startsWith('youtube:') || input.analysis?.source)
        throw new Error('Use o tracking do arquivo original, sem vínculo anterior ao YouTube.');
    if (expectedSourceFingerprint !== undefined && input.media.fingerprint !== expectedSourceFingerprint)
        throw new Error('Este tracking pertence a outro arquivo original.');
    if (!input.analysis?.positions.length)
        throw new Error('O arquivo original não contém posições de tracking.');
    const positions = input.analysis.positions.map(({ time, x, y }) => ({ time: time + offsetSeconds, x, y }))
        .filter(p => p.time >= 0 && p.time < target.media.duration);
    if (!positions.length)
        throw new Error('O tracking não coincide com o intervalo do YouTube. Confira o ajuste de tempo.');
    const cuts = input.analysis.cuts.map(time => time + offsetSeconds).filter(time => time > 0 && time < target.media.duration);
    return parseVideoDocument({ ...target, analysis: {
        model: input.analysis.model,
        sampledFps: input.analysis.sampledFps,
        positions,
        cuts,
        source: { fingerprint: input.media.fingerprint, name: input.media.name, duration: input.media.duration,
            width: input.media.width, height: input.media.height, offsetSeconds },
    } }, target.media);
}
