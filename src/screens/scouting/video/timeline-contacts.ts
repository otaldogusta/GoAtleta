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
export function timelineContactGroups<T extends { time: number }>(contacts: readonly T[], start: number, end: number, width: number, spacing = 24, edgeInset = 0) {
    const span = Math.max(.001, end - start);
    const groups: { contacts: T[]; position: number }[] = [];
    const safeWidth = Math.max(1, width), inset = Math.min(edgeInset, safeWidth / 2);
    for (const contact of contacts) {
        const relative = (contact.time - start) / span;
        const position = edgeInset ? Math.max(inset, Math.min(safeWidth - inset, relative * safeWidth)) / safeWidth : relative;
        const last = groups.at(-1);
        if (last && (position - last.position) * width < spacing) last.contacts.push(contact);
        else groups.push({ contacts: [contact], position });
    }
    return groups;
}

/** Legends share one row with the rally context; crowded labels stay in the marker preview. */
export function timelineLegendIndexes(positions: readonly number[], width: number, labelWidth: number, contextWidth: number, active = -1) {
    const selected: number[] = [];
    const candidates = positions.map((_, index) => index);
    if (active >= 0 && active < positions.length) candidates.unshift(...candidates.splice(active, 1));
    for (const index of candidates) {
        const x = positions[index] * width;
        if (x - labelWidth / 2 < contextWidth + 12 || x + labelWidth / 2 > width - 4) continue;
        if (selected.every(other => Math.abs(positions[other] * width - x) >= labelWidth + 16)) selected.push(index);
    }
    return new Set(selected);
}
