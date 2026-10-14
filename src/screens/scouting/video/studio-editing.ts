import type { VideoContact } from '../../../core/scouting-video';

export function contactChanged(contact: VideoContact, baseline?: VideoContact): boolean {
    if (!baseline) return true;
    return contact.time !== baseline.time || contact.skill !== baseline.skill ||
        contact.team !== baseline.team || contact.studentId !== baseline.studentId ||
        contact.athlete.trim() !== baseline.athlete.trim() || contact.outcome !== baseline.outcome;
}

/** Recognition only; each provider still validates its URL before accessing it. */
export function videoLinkKind(value: string): 'youtube' | 'drive' | null {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        if (url.hostname === 'drive.google.com') return 'drive';
        if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return 'youtube';
    } catch { /* Incomplete input is not an error while typing. */ }
    return null;
}
