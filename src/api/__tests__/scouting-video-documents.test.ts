import { assertSessionIdentity, getSessionIdentity } from '../../auth/session';
import { supabasePost } from '../../db/client';
import { newVideoDocument, splitVideoRally } from '../../core/scouting-video';
import { getScoutingVideoDocument, saveScoutingVideoDocument, type VideoDocumentRecord } from '../scouting-video-documents';

jest.mock('../../auth/session', () => ({ getSessionIdentity: jest.fn(), assertSessionIdentity: jest.fn() }));
jest.mock('../../db/client', () => ({ supabasePost: jest.fn() }));
const scope = { org: 'org-a', sessionId: 'session-a', userId: 'coach' };
const identity = { userId: scope.userId, generation: 1 };
const media = { fingerprint: 'a'.repeat(64), name: 'partida.mp4', duration: 60, width: 1280, height: 720 };
const document = splitVideoRally(newVideoDocument(media, 'first'), 20, 'second');
const record = (changes: Partial<VideoDocumentRecord> = {}): VideoDocumentRecord => ({ organizationId: scope.org, sessionId: scope.sessionId,
    fingerprint: media.fingerprint, document, revision: 2, updatedAt: '2026-10-16T14:00:00.000Z', mutationId: 'mutation-a', ...changes });

beforeEach(() => {
    jest.clearAllMocks();
    (getSessionIdentity as jest.Mock).mockReturnValue(identity);
    (assertSessionIdentity as jest.Mock).mockImplementation(() => undefined);
    (supabasePost as jest.Mock).mockResolvedValue(record());
});

test('latest and exact reads include the session scope and captured account identity', async () => {
    expect(await getScoutingVideoDocument(scope)).toEqual(record());
    expect(supabasePost).toHaveBeenLastCalledWith('/rpc/get_scouting_video_document', {
        p_org: scope.org, p_session: scope.sessionId, p_fingerprint: null,
    }, undefined, identity);
    expect(await getScoutingVideoDocument(scope, media.fingerprint, media)).toEqual(record());
    expect(supabasePost).toHaveBeenLastCalledWith('/rpc/get_scouting_video_document', expect.objectContaining({ p_fingerprint: media.fingerprint }), undefined, identity);
});

test('a successful empty cloud read is distinct from a missing backend', async () => {
    (supabasePost as jest.Mock).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Supabase POST error: 404 PGRST202'));
    expect(await getScoutingVideoDocument(scope)).toBeNull();
    await expect(getScoutingVideoDocument(scope)).rejects.toMatchObject({ code: 'missing-backend' });
});

test('save keeps the original media identity, scoped CAS and fixed mutation ID', async () => {
    const unsafe = { ...document, permission: 'editor', media: { ...media, url: 'blob:private-source' } };
    expect(await saveScoutingVideoDocument(scope, unsafe, 1, 'mutation-a')).toEqual(record());
    expect(supabasePost).toHaveBeenCalledWith('/rpc/save_scouting_video_document', {
        p_org: scope.org, p_session: scope.sessionId, p_fingerprint: media.fingerprint,
        p_document: document, p_expected_revision: 1, p_mutation_id: 'mutation-a',
    }, undefined, identity);
    expect((supabasePost as jest.Mock).mock.calls[0][1].p_document.media).not.toHaveProperty('url');
});

test('idempotent retry uses the same request and accepts the original receipt', async () => {
    (supabasePost as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(record());
    await expect(saveScoutingVideoDocument(scope, document, 1, 'mutation-a')).rejects.toMatchObject({ code: 'offline' });
    await expect(saveScoutingVideoDocument(scope, document, 1, 'mutation-a')).resolves.toEqual(record());
    expect((supabasePost as jest.Mock).mock.calls[1]).toEqual((supabasePost as jest.Mock).mock.calls[0]);
});

test.each([
    ['Supabase POST error: 400 40001', 'conflict'],
    ['Supabase POST error: 400 22023', 'invalid'],
    ['Supabase POST error: 403 42501', 'permission'],
    ['Supabase POST error: 400 55000', 'permission'],
    ['Supabase POST error: 401 REQUEST_FAILED', 'permission'],
    ['Supabase POST error: 404 42883', 'missing-backend'],
    ['Supabase POST error: 404 42P01', 'missing-backend'],
    ['Supabase POST error: 500 REQUEST_FAILED', 'unavailable'],
])('maps the sanitized transport failure %s without treating it as empty', async (message, code) => {
    (supabasePost as jest.Mock).mockRejectedValueOnce(new Error(message));
    await expect(getScoutingVideoDocument(scope)).rejects.toMatchObject({ code });
});

test.each([
    { organizationId: 'org-b' }, { sessionId: 'session-b' }, { fingerprint: 'other-file' },
    { revision: 0 }, { revision: 1.2 }, { mutationId: '' }, { updatedAt: 'invalid' },
    { document: { ...document, media: { ...media, fingerprint: 'different-document' } } },
    { document: { ...document, contacts: [{ id: 'invalid', time: 70 }] } },
])('rejects malformed or cross-context record %#', async changes => {
    (supabasePost as jest.Mock).mockResolvedValueOnce({ ...record(), ...changes });
    await expect(getScoutingVideoDocument(scope, media.fingerprint)).rejects.toMatchObject({ code: 'invalid' });
});

test('exact file reads reject duration or provider mismatch despite matching fingerprint', async () => {
    await expect(getScoutingVideoDocument(scope, media.fingerprint, { ...media, duration: 90 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(getScoutingVideoDocument(scope, media.fingerprint, { ...media, youtubeId: 'abcdefghijk' })).rejects.toMatchObject({ code: 'invalid' });
});

test.each([{ revision: 3 }, { mutationId: 'other-mutation' }, { document: newVideoDocument(media, 'replacement') }])('never accepts a receipt for a different snapshot %#', async changes => {
    (supabasePost as jest.Mock).mockResolvedValueOnce(record(changes));
    await expect(saveScoutingVideoDocument(scope, document, 1, 'mutation-a')).rejects.toMatchObject({ code: 'invalid' });
});

test('wrong initiating account or invalid write never reaches the transport', async () => {
    (getSessionIdentity as jest.Mock).mockReturnValue({ userId: 'other', generation: 2 });
    await expect(getScoutingVideoDocument(scope)).rejects.toMatchObject({ code: 'permission' });
    await expect(saveScoutingVideoDocument(scope, document, 0, 'mutation-a')).rejects.toMatchObject({ code: 'permission' });
    (getSessionIdentity as jest.Mock).mockReturnValue(identity);
    await expect(saveScoutingVideoDocument(scope, document, -1, 'mutation-a')).rejects.toMatchObject({ code: 'invalid' });
    await expect(saveScoutingVideoDocument(scope, document, 1, '')).rejects.toMatchObject({ code: 'invalid' });
    expect(supabasePost).not.toHaveBeenCalled();
});

test('an account switch after the request discards the response without wrapping the identity error', async () => {
    const failure = Object.assign(new Error('Sessão alterada.'), { name: 'SessionIdentityChangedError' });
    (supabasePost as jest.Mock).mockImplementationOnce(async () => {
        (assertSessionIdentity as jest.Mock).mockImplementation(() => { throw failure; });
        return record();
    });
    await expect(getScoutingVideoDocument(scope)).rejects.toBe(failure);
});
