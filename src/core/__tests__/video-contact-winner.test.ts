import { newVideoDocument, saveVideoContact, parseVideoDocument, type VideoContact } from '../scouting-video';
const doc = () => newVideoDocument({ fingerprint: 'test', name: 'test', duration: 60, width: 640, height: 360 }, 'r1');
const contact: VideoContact = { id: 'c1', time: 5, skill: 'Saque', team: 'us', athlete: '', studentId: null, outcome: 'Erro' };
test.each([['us', 'Erro', 'them'], ['them', 'Erro', 'us'], ['us', 'Ace', 'us'], ['them', 'Ace', 'them']] as const)('result %s %s awards %s', (team, outcome, winner) => {
    expect(saveVideoContact(doc(), { ...contact, team, outcome }).rallies[0].winner).toBe(winner);
});
test('editing or deleting the source clears only its automatic winner', () => {
    const saved = saveVideoContact(doc(), contact);
    expect(saveVideoContact(saved, { ...contact, outcome: 'Em jogo' }).rallies[0].winner).toBeNull();
    expect(saveVideoContact(saved, null, contact.id).rallies[0].winner).toBeNull();
    saved.rallies[0] = { ...saved.rallies[0], winner: 'us', winnerContactId: undefined };
    expect(saveVideoContact(saved, null, contact.id).rallies[0].winner).toBe('us');
});
test('moving a terminal contact updates its actual rally and preserves point times', () => {
    const d = doc(); d.rallies.push({ id: 'r2', start: 30, winner: null, reviewed: false });
    d.rallies[0].pointTime = 9;
    const saved = saveVideoContact(saveVideoContact(d, contact), { ...contact, time: 35 });
    expect(saved.rallies.map(r => r.winner)).toEqual([null, 'them']);
    expect(saved.rallies[0].pointTime).toBe(9);
});
test('non-terminal results preserve manually recorded points', () => {
    const d = doc(); d.rallies[0].winner = 'us';
    expect(saveVideoContact(d, { ...contact, outcome: 'Em jogo' }).rallies[0].winner).toBe('us');
});

test('automatic winner reference survives save/reopen without duplicate contact rejection', () => {
    const saved = saveVideoContact(doc(), contact);
    const reopened = parseVideoDocument(JSON.parse(JSON.stringify(saved)));
    expect(reopened.contacts).toEqual([contact]);
    expect(reopened.rallies[0]).toMatchObject({ winner: 'them', winnerContactId: contact.id });
    expect(parseVideoDocument(JSON.parse(JSON.stringify(saveVideoContact(reopened, null, contact.id)))).rallies[0].winner).toBeNull();
});
