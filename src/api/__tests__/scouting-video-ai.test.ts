import { analyzeYouTube } from '../scouting-video-ai';
const originalFetch = global.fetch;
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeEach(() => { Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://localhost:8081' } } }); });
afterEach(() => { global.fetch = originalFetch; if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window'); });
test('polls accepted job before parsing final suggestions', async () => {
    const jobId = '12345678-1234-1234-1234-123456789012';
    const result = { videoId: 'mdfgd1K3HTc', start: 0, end: 60, model: 'test', rallies: [], contacts: [], limitations: [] };
    global.fetch = jest.fn().mockResolvedValueOnce({ status: 202, ok: true, json: async () => ({ jobId }) }).mockResolvedValueOnce({ status: 200, ok: true, json: async () => result });
    expect(await analyzeYouTube(result.videoId, 0, 60, new AbortController().signal)).toEqual(result);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(`http://127.0.0.1:8094/jobs/${jobId}`, expect.objectContaining({ signal: expect.anything() }));
});
test('rejects malformed job identifiers instead of fetching arbitrary paths', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 202, ok: true, json: async () => ({ jobId: 'https://evil.invalid' }) });
    await expect(analyzeYouTube('mdfgd1K3HTc', 0, 60, new AbortController().signal)).rejects.toThrow('Resposta inválida');
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
