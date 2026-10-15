import { videoRange, type VideoContact, type VideoDocument } from '../../../core/scouting-video';

/** Match the contact/point markers visible in the timeline, including an unsaved preview. */
export function timelineNavigationMarks(doc: VideoDocument, focus: string | null, draftContact?: VideoContact | null) {
    const [start, end] = videoRange(doc, focus);
    const contacts = draftContact ? [...doc.contacts.filter(c => c.id !== draftContact.id), draftContact] : doc.contacts;
    return [...new Set([
        ...contacts.map(c => c.time),
        ...doc.rallies.flatMap(r => r.pointTime === undefined ? [] : [r.pointTime]),
    ])].filter(time => Number.isFinite(time) && time >= start && time < end).sort((a, b) => a - b);
}

export function adjacentTimelineMark(marks: number[], time: number, direction: number) {
    // Media clocks can round a requested timestamp by less than a millisecond.
    return (direction < 0 ? marks.findLast(mark => mark < time - .001) : marks.find(mark => mark > time + .001)) ?? null;
}

// Keep dense contacts reachable at the full-video scale without moving their timestamps.
export function timelineContactGroups(contacts: VideoContact[], start: number, end: number, width: number, spacing = 24) {
    const span = Math.max(.001, end - start);
    const groups: { contacts: VideoContact[]; position: number }[] = [];
    for (const contact of contacts) {
        const position = (contact.time - start) / span;
        const last = groups.at(-1);
        if (last && (position - last.position) * width < spacing) last.contacts.push(contact);
        else groups.push({ contacts: [contact], position });
    }
    return groups;
}
