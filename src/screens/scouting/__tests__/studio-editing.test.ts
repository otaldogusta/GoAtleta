import { contactChanged, videoLinkKind } from '../video/studio-editing';
import type { VideoContact } from '../../../core/scouting-video';

const contact: VideoContact = { id: 'contact', time: 4.5, team: 'us', skill: 'Saque', studentId: null, athlete: '', outcome: '' };
test('opening an existing contact and reverting edits leave Save disabled', () => {
    expect(contactChanged({ ...contact }, contact)).toBe(false);
    expect(contactChanged({ ...contact, athlete: '  ' }, contact)).toBe(false);
    expect(contactChanged({ ...contact, athlete: '14' }, contact)).toBe(true);
    expect(contactChanged({ ...contact, time: 5 }, contact)).toBe(true);
    expect(contactChanged({ ...contact, team: 'them' }, contact)).toBe(true);
    expect(contactChanged({ ...contact, outcome: 'Em jogo' }, contact)).toBe(true);
    expect(contactChanged(contact, contact)).toBe(false);
    expect(contactChanged(contact)).toBe(true);
});
test.each([
    ['https://www.youtube.com/watch?v=abcdefghijk', 'youtube'],
    ['https://youtu.be/abcdefghijk', 'youtube'],
    ['https://drive.google.com/file/d/exampleVideoIdentifier/view', 'drive'],
    ['https://drive.google.com.evil.example/file', null],
    ['https://user:password@drive.google.com/file', null],
    ['http://drive.google.com/file', null],
    ['javascript:alert(1)', null],
    ['https://', null],
])('recognizes %s without authorizing or fetching its contents', (link, expected) => {
    expect(videoLinkKind(link)).toBe(expected);
});
