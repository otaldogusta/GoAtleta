import { courtShareLink, parseCourtShareHash, publishableCourt } from '../court-sharing';
import { newCourtBoard } from '../visual-court-editor';
import { configureCourtSimulation } from '../court-simulation';

describe('court sharing', () => {
  it('preserves animation and simulation without publishing personal links or mutating the editor', () => {
    const source = configureCourtSimulation(newCourtBoard('Ataque'), 0, { mode: 'attack' });
    const id = source.actors[0].id;
    source.editor!.actorMeta[id] = { ...source.editor!.actorMeta[id], studentId: 'private-student' };
    source.editor!.lessonLink = { date: '2026-10-27', block: 'private', revision: 'private' };
    source.editor!.folder = 'private-folder';
    const shared = publishableCourt(source);
    expect(shared.editor!.actorMeta[id].studentId).toBeUndefined();
    expect(shared.editor!.lessonLink).toBeUndefined();
    expect(shared.editor!.folder).toBe('');
    expect(shared.timeline.steps[0].simulation).toEqual(source.timeline.steps[0].simulation);
    expect(source.editor!.actorMeta[id].studentId).toBe('private-student');
    expect(shared.actors.map(actor => actor.id)).toEqual(source.actors.map(actor => actor.id));
  });
  it('keeps the access code in the fragment and rejects malformed access', () => {
    const id = '11111111-1111-4111-8111-111111111111', code = 'a'.repeat(64);
    const url = new URL(courtShareLink(id, code, 'https://example.test'));
    expect(url.search).toBe('');
    expect(parseCourtShareHash(url.hash)).toEqual({ id, code });
    expect(parseCourtShareHash('#id=bad&code=bad')).toBeNull();
  });
});
