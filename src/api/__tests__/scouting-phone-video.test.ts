import { createHash, webcrypto } from 'node:crypto';
import { assertSessionIdentity, getSessionIdentity } from '../../auth/session';
import { getActiveOrganizationId, supabasePost } from '../../db/client';
import { answerPhoneVideoPairing, createPhoneVideoPairing, readPhoneVideoAnswer, readPhoneVideoOffer } from '../scouting-phone-video';

jest.mock('../../auth/session', () => ({ getSessionIdentity: jest.fn(), assertSessionIdentity: jest.fn() }));
jest.mock('../../db/client', () => ({ getActiveOrganizationId: jest.fn(), supabasePost: jest.fn() }));
jest.mock('../config', () => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'fixture-public-key' }));

const scope = { org: '20000000-0000-0000-0000-000000000001', classId: 'class', sessionId: 'match' };
const id = '30000000-0000-0000-0000-000000000001';
const identity = { userId: 'coach', generation: 1 };
const description = 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
const code = 'a'.repeat(64);
const expiry = '2026-11-09T18:10:00.000Z';
const fetchBefore = globalThis.fetch;
const cryptoBefore = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    (getSessionIdentity as jest.Mock).mockReturnValue(identity);
    (assertSessionIdentity as jest.Mock).mockImplementation(() => undefined);
    (getActiveOrganizationId as jest.Mock).mockResolvedValue(scope.org);
    (supabasePost as jest.Mock).mockResolvedValue(expiry);
    globalThis.fetch = jest.fn();
});

afterEach(() => {
    globalThis.fetch = fetchBefore;
    if (cryptoBefore) Object.defineProperty(globalThis, 'crypto', cryptoBefore);
    else Reflect.deleteProperty(globalThis, 'crypto');
});

test('creates a scoped room and sends only the SHA-256 proof for the QR', async () => {
    const pair = await createPhoneVideoPairing(scope, description, new AbortController().signal);
    expect(pair).toEqual({ id: expect.stringMatching(/^[a-f0-9-]{36}$/), code: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: Date.parse(expiry) });
    expect(supabasePost).toHaveBeenCalledWith('/rpc/scouting_phone_video_create', {
        p_org: scope.org, p_class: scope.classId, p_session: scope.sessionId, p_id: pair.id,
        p_proof_hash: createHash('sha256').update(pair.code).digest('hex'), p_offer: description,
    }, undefined, identity, expect.any(Function));
});

test('does not read an answer after an organization switch, even if the server returned it', async () => {
    (supabasePost as jest.Mock).mockResolvedValueOnce({ answer: description });
    (getActiveOrganizationId as jest.Mock).mockResolvedValueOnce(scope.org).mockResolvedValueOnce('other');
    await expect(readPhoneVideoAnswer(scope, id, new AbortController().signal)).rejects.toThrow('organização mudou');
});

test('a canceled create closes the room by its previously generated id', async () => {
    const operation = new AbortController();
    (supabasePost as jest.Mock).mockImplementationOnce(async () => { operation.abort(); return expiry; });
    await expect(createPhoneVideoPairing(scope, description, operation.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const [, request] = (supabasePost as jest.Mock).mock.calls[0];
    expect(supabasePost).toHaveBeenCalledWith('/rpc/scouting_phone_video_close', {
        p_org: scope.org, p_class: scope.classId, p_session: scope.sessionId, p_id: request.p_id,
    }, undefined, identity, expect.any(Function));
});

test('uses anonymous POST with proof only in the body and no scope disclosure', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => description })
        .mockResolvedValueOnce({ ok: true, json: async () => true });
    const signal = new AbortController().signal;
    await expect(readPhoneVideoOffer(id, code, signal)).resolves.toBe(description);
    await expect(answerPhoneVideoPairing(id, code, description, signal)).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, 'https://example.supabase.co/rest/v1/rpc/scouting_phone_video_offer', expect.objectContaining({
        method: 'POST', cache: 'no-store', referrerPolicy: 'no-referrer', body: JSON.stringify({ p_id: id, p_proof: code }),
    }));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://example.supabase.co/rest/v1/rpc/scouting_phone_video_answer', expect.objectContaining({
        body: JSON.stringify({ p_id: id, p_proof: code, p_answer: description }),
    }));
    expect(supabasePost).not.toHaveBeenCalled();
});
