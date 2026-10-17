import type { VideoDocument, VideoMedia } from '../../../core/scouting-video';
import { matchesTrackingOriginal } from './original-playback.web';

/** Recognize playback for an explicitly associated original, without changing its analysis. */
export function matchingOriginalDocument(document: VideoDocument | null, media: VideoMedia): VideoDocument | null {
    return document?.media.youtubeId && document.analysis?.source && matchesTrackingOriginal(media, document.analysis.source)
        ? document : null;
}
