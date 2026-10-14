import { getSessionIdentity, assertSessionIdentity, getValidAccessToken } from '../../../auth/session';
import { readSharedVideo } from '../../../api/scouting-video-sharing';
jest.mock('../../../api/config', () => ({ SUPABASE_URL: 'https://share-test.supabase.co', SUPABASE_ANON_KEY: 'test-anon' }));
jest.mock('../../../db/client', () => ({ supabasePost: jest.fn() }));
jest.mock('../../../auth/session', () => ({ getSessionIdentity: jest.fn(), assertSessionIdentity: jest.fn(), getValidAccessToken: jest.fn() }));
const identity = { userId: 'viewer', generation: 1 };
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks(); global.fetch = jest.fn();
  (getSessionIdentity as jest.Mock).mockReturnValue(identity);
  (getValidAccessToken as jest.Mock).mockResolvedValue('test-token');
  (assertSessionIdentity as jest.Mock).mockImplementation(() => undefined);
});
afterAll(() => { global.fetch = originalFetch; });
test('account change during token refresh refuses the request before sending the proof', async () => {
  (getValidAccessToken as jest.Mock).mockImplementation(async () => {
    (getSessionIdentity as jest.Mock).mockReturnValue({ userId: 'other', generation: 2 });
    (assertSessionIdentity as jest.Mock).mockImplementation(current => { if (current === identity) throw new Error('changed'); });
    return 'old-token';
  });
  await expect(readSharedVideo('id', 'proof', new AbortController().signal)).rejects.toThrow('changed');
  expect(fetch).not.toHaveBeenCalled();
});
test('denied access never yields a playable document', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'ACCESS_DENIED' }) });
  await expect(readSharedVideo('id', 'proof', new AbortController().signal)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
});
test('external media URLs are refused before the studio can load them', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ permission: 'viewer', mediaUrl: 'https://external.invalid/video' }) });
  await expect(readSharedVideo('id', 'proof', new AbortController().signal)).rejects.toMatchObject({ code: 'MEDIA_UNAVAILABLE' });
});

test('YouTube source uses only validated ID and rejects provider mismatch', async () => {
  const document = { version: 1, media: { youtubeId: 'M7lc1UVf-VE', fingerprint: 'shared', name: 'Video', duration: 20, width: 1280, height: 720 }, rallies: [{ id: 'r', start: 0, winner: null, reviewed: false }], contacts: [], corrections: [] };
  const response = { permission: 'viewer', mediaProvider: 'youtube', youtubeId: 'M7lc1UVf-VE', mediaUrl: 'https://untrusted.invalid', document };
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => response });
  expect((await readSharedVideo('id', 'proof', new AbortController().signal)).mediaUrl).toBe('youtube:M7lc1UVf-VE');
  response.youtubeId = 'abcdefghijk';
  await expect(readSharedVideo('id', 'proof', new AbortController().signal)).rejects.toMatchObject({ code: 'MEDIA_UNAVAILABLE' });
});
