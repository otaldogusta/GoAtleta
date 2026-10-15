import type { VideoContact, VideoDocument } from '../../../core/scouting-video';
import { adjacentTimelineMark, timelineNavigationMarks } from '../video/timeline-contacts';

const contact = (id: string, time: number, skill: VideoContact['skill'] = 'Saque'): VideoContact => ({
    id, time, skill, team: 'us', athlete: '', studentId: null, outcome: '',
});
const doc: VideoDocument = {
    version: 1, media: { fingerprint: 'fixture', name: 'fixture.mp4', duration: 40, width: 1280, height: 720 },
    rallies: [{ id: 'r1', start: 0, winner: null, reviewed: false }, { id: 'r2', start: 17.5, winner: null, reviewed: false }],
    contacts: [contact('a', 21.6, 'Ataque'), contact('s', 17.5), contact('p', 18.85, 'Recepção'), contact('l', 20.35, 'Levantamento'), contact('first', 4.5)],
    corrections: [],
};

test('steps through the exact marked instants in both directions, including milliseconds', () => {
    const marks = timelineNavigationMarks(doc, 'r2');
    let time = 17.5;
    const forward = [1, 1, 1].map(direction => time = adjacentTimelineMark(marks, time, direction)!);
    expect(forward).toEqual([18.85, 20.35, 21.6]);
    expect(adjacentTimelineMark(marks, time, 1)).toBeNull();
    const backward = [-1, -1, -1].map(direction => time = adjacentTimelineMark(marks, time, direction)!);
    expect(backward).toEqual([20.35, 18.85, 17.5]);
    expect(adjacentTimelineMark(marks, time, -1)).toBeNull();
});

test('between marks, each arrow chooses the closest mark in its own direction', () => {
    const marks = timelineNavigationMarks(doc, 'r2');
    expect(adjacentTimelineMark(marks, 19.7, -1)).toBe(18.85);
    expect(adjacentTimelineMark(marks, 19.7, 1)).toBe(20.35);
    expect(adjacentTimelineMark(marks, 20.3500001, -1)).toBe(18.85);
    expect(adjacentTimelineMark(marks, 20.3499999, 1)).toBe(21.6);
});

test('rally navigation respects its range; full video reaches contacts across rallies', () => {
    expect(timelineNavigationMarks(doc, 'r1')).toEqual([4.5]);
    expect(timelineNavigationMarks(doc, 'r2')).toEqual([17.5, 18.85, 20.35, 21.6]);
    expect(adjacentTimelineMark(timelineNavigationMarks(doc, null), 4.5, 1)).toBe(17.5);
});

test('point markers participate without duplicate stops or synthetic one-second steps', () => {
    const document = { ...doc, rallies: doc.rallies.map(r => ({ ...r, pointTime: r.id === 'r1' ? 4.5 : 27.125 })) };
    expect(timelineNavigationMarks(document, null)).toEqual([4.5, 17.5, 18.85, 20.35, 21.6, 27.125]);
    const empty = timelineNavigationMarks({ ...doc, contacts: [] }, null);
    expect(adjacentTimelineMark(empty, 10, -1)).toBeNull();
    expect(adjacentTimelineMark(empty, 10, 1)).toBeNull();
});

test('draft preview replaces the old timestamp without mutating or saving the document', () => {
    const before = JSON.stringify(doc);
    const draft = { ...doc.contacts[2], time: 19.125 };
    expect(timelineNavigationMarks(doc, 'r2', draft)).toEqual([17.5, 19.125, 20.35, 21.6]);
    expect(timelineNavigationMarks(doc, 'r2', { ...draft, time: 10 })).toEqual([17.5, 20.35, 21.6]);
    expect(timelineNavigationMarks(doc, 'r2', contact('new', 22.333))).toEqual([17.5, 18.85, 20.35, 21.6, 22.333]);
    expect(JSON.stringify(doc)).toBe(before);
});
