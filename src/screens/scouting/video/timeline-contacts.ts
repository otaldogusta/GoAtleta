import type { VideoContact } from '../../../core/scouting-video';

// Keep dense contacts reachable at the full-video scale without moving their timestamps.
export function timelineContactGroups(contacts: VideoContact[], start: number, end: number, width: number) {
    const span = Math.max(.001, end - start);
    const groups: { contacts: VideoContact[]; position: number }[] = [];
    for (const contact of contacts) {
        const position = (contact.time - start) / span;
        const last = groups.at(-1);
        if (last && (position - last.position) * width < 24) last.contacts.push(contact);
        else groups.push({ contacts: [contact], position });
    }
    return groups;
}
