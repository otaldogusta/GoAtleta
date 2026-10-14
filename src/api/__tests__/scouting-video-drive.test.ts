import { configureDriveTrackingCredential, getDriveTrackingHealth, inspectDriveVideo, parseDriveVideoLink, trackDriveVideo, type DriveTrackingScope } from '../scouting-video-drive';
import { assertSessionIdentity, getSessionIdentity } from '../../auth/session';
jest.mock('../../auth/session', () => ({ getSessionIdentity: jest.fn(() => ({ userId: 'coach', generation: 1 })), assertSessionIdentity: jest.fn() }));
const scope: DriveTrackingScope = { userId: 'coach', org: 'organization', classId: 'class', sessionId: 'session', targetFingerprint: 'youtube:abcdefghijk' };
const media = { fingerprint: 'a'.repeat(64), name: 'Vídeo do Drive.mp4', duration: 60, width: 640, height: 480 };
const fileId = 'exampleVideoFileIdentifier';
const candidate = { fileId, media, playbackUrl: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t` };
const id = '12345678-1234-1234-1234-123456789012';
const result = { media, provider: 'roboflow', model: 'volleyball_v2/3', sampledFps: 30, predictions: {
    frame_offset: [30], time_offset: [1], volleyball_v2: [{ predictions: [{ class: 'ball', confidence: .9, x: 100, y: 200, width: 8, height: 8 }] }],
} };
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const originalFetch = global.fetch, windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://localhost:8081' } } });
    (getSessionIdentity as jest.Mock).mockReturnValue({ userId: 'coach', generation: 1 });
    (assertSessionIdentity as jest.Mock).mockImplementation(() => undefined);
});
afterEach(() => { global.fetch = originalFetch; if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window'); jest.useRealTimers(); });

test('accepts file links and rejects folders, spoofed origins and arbitrary download URLs', () => {
    expect(parseDriveVideoLink(`https://drive.google.com/file/d/${fileId}/view?usp=sharing`)).toEqual(candidate && { fileId, playbackUrl: candidate.playbackUrl });
    expect(parseDriveVideoLink(`https://drive.google.com/open?id=${fileId}`).fileId).toBe(fileId);
    expect(() => parseDriveVideoLink('https://drive.google.com/drive/folders/anotherFolderIdentifier')).toThrow('pasta');
    for (const link of [`http://drive.google.com/open?id=${fileId}`, `https://drive.google.com.evil.invalid/open?id=${fileId}`, `https://user@drive.google.com/open?id=${fileId}`, 'https://localhost/secret', 'https://drive.google.com/open?id=../secret'])
        expect(() => parseDriveVideoLink(link)).toThrow();
});

test('sends only source identity and metadata to the companion and parses a cloud result without downloading media', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }))
        .mockResolvedValueOnce(response({ id, scope, status: 'complete', result }));
    expect(await trackDriveVideo(candidate, scope, new AbortController().signal)).toEqual(result);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.map(call => call[0])).toEqual(['http://127.0.0.1:8095/health?userId=coach&org=organization', 'http://127.0.0.1:8095/jobs']);
    expect(JSON.parse(calls[1][1].body)).toEqual({ fileId, media, scope });
    expect(calls[1][1].body).not.toContain('usercontent');
});

test('refuses results belonging to another studio or source and never constructs a foreign job URL', async () => {
    for (const job of [{ id: 'https://evil.invalid/jobs', scope, status: 'running' }, { id, scope: { ...scope, org: 'another' }, status: 'complete', result }, { id, scope, status: 'complete', result: { ...result, media: { ...media, fingerprint: 'b'.repeat(64) } } }]) {
        global.fetch = jest.fn().mockResolvedValueOnce(response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }))
            .mockResolvedValueOnce(response(job)).mockResolvedValue(response({ cancelled: true }));
        await expect(trackDriveVideo(candidate, scope, new AbortController().signal)).rejects.toThrow();
        expect((global.fetch as jest.Mock).mock.calls.every(call => call[0].startsWith('http://127.0.0.1:8095/'))).toBe(true);
    }
});

test('checks session and studio identity after network awaits before scheduling cloud work', async () => {
    let current = true;
    global.fetch = jest.fn().mockImplementation(async () => { current = false; return response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }); });
    await expect(trackDriveVideo(candidate, scope, new AbortController().signal, () => current)).rejects.toThrow('contexto');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch = jest.fn();
    await expect(trackDriveVideo(candidate, { ...scope, userId: 'other' }, new AbortController().signal)).rejects.toThrow('Sessão');
    expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects unsupported provisioned media before creating a video or reading any media body', async () => {
    const head = { ...response({ playbackUrl: `http://127.0.0.1:8095/media/${id}?token=${'a'.repeat(64)}`, size: 2000, mimeType: 'text/html' }), arrayBuffer: jest.fn() };
    global.fetch = jest.fn().mockResolvedValue(head);
    await expect(inspectDriveVideo(`https://drive.google.com/file/d/${fileId}/view`, scope, new AbortController().signal)).rejects.toThrow('vídeo público');
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:8095/media', expect.objectContaining({ method: 'POST', body: JSON.stringify({ fileId, scope }) }));
    expect(head.arrayBuffer).not.toHaveBeenCalled();
});

test('never loads a media URL outside the strict loopback capability returned by the companion', async () => {
    for (const playbackUrl of ['https://evil.invalid/video.mp4', `http://127.0.0.1:8095/media/${id}?token=short`, `http://127.0.0.1:8095/media/${id}?token=${'a'.repeat(64)}&other=1`, `http://127.0.0.1:8095/media/${id}?token=${'a'.repeat(64)}#fragment`, `http://user@127.0.0.1:8095/media/${id}?token=${'a'.repeat(64)}`]) {
        global.fetch = jest.fn().mockResolvedValue(response({ playbackUrl, size: 10000, mimeType: 'video/mp4', lastModified: null }));
        await expect(inspectDriveVideo(`https://drive.google.com/file/d/${fileId}/view`, scope, new AbortController().signal)).rejects.toThrow('Resposta inválida');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    }
});

test('configuration is session-only and refuses a stale session before forwarding a credential', async () => {
    const key = 'test-key-for-this-fixture-only';
    global.fetch = jest.fn().mockResolvedValue(response({ ready: true }));
    await configureDriveTrackingCredential(key, scope, new AbortController().signal);
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:8095/credential', expect.objectContaining({ method: 'POST', body: JSON.stringify({ apiKey: key, scope }) }));
    (assertSessionIdentity as jest.Mock).mockImplementation(() => { throw new Error('Sessão mudou'); });
    (global.fetch as jest.Mock).mockClear();
    await expect(configureDriveTrackingCredential(key, scope, new AbortController().signal)).rejects.toThrow('Sessão');
    expect(global.fetch).not.toHaveBeenCalled();
});

test('aborting a running job stops polling and sends cancellation without media or credentials', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }))
        .mockResolvedValueOnce(response({ id, scope, status: 'running' })).mockResolvedValue(response({ cancelled: true }));
    const run = new AbortController();
    const task = trackDriveVideo(candidate, scope, run.signal);
    const expectation = expect(task).rejects.toThrow();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    run.abort(); await expectation;
    expect(global.fetch).toHaveBeenCalledWith(`http://127.0.0.1:8095/jobs/${id}`, expect.objectContaining({ method: 'DELETE' }));
    expect((global.fetch as jest.Mock).mock.calls.filter(call => call[1]?.method !== 'DELETE')).toHaveLength(2);
});

test('a studio change while POST is in flight captures the job handle and cancels in its original scope', async () => {
    let current = true;
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }))
        .mockImplementationOnce(async () => { current = false; return response({ id, scope, status: 'running' }); })
        .mockResolvedValue(response({ cancelled: true }));
    await expect(trackDriveVideo(candidate, scope, new AbortController().signal, () => current)).rejects.toThrow('contexto');
    expect(global.fetch).toHaveBeenLastCalledWith(`http://127.0.0.1:8095/jobs/${id}`, expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ scope }) }));
    expect((global.fetch as jest.Mock).mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1);
});

test('an aborted POST whose server job id is unknown is not retried or reported as remotely stopped', async () => {
    const run = new AbortController();
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ready: true, provider: 'roboflow', model: 'volleyball_v2/3' }))
        .mockImplementationOnce(async () => { run.abort(); throw new DOMException('Aborted', 'AbortError'); });
    await expect(trackDriveVideo(candidate, scope, run.signal)).rejects.toThrow('pode continuar na nuvem');
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    expect((global.fetch as jest.Mock).mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1);
});

test('health is requested for the current credential owner and a different account cannot start a job with inherited readiness', async () => {
    const other = { ...scope, userId: 'other-coach', org: 'other-org' };
    (getSessionIdentity as jest.Mock).mockReturnValue({ userId: other.userId, generation: 2 });
    global.fetch = jest.fn().mockResolvedValue(response({ ready: false, provider: 'roboflow', model: 'volleyball_v2/3' }));
    expect(await getDriveTrackingHealth(other, new AbortController().signal)).toEqual({ ready: false });
    await expect(trackDriveVideo(candidate, other, new AbortController().signal)).rejects.toThrow('não está configurado');
    expect((global.fetch as jest.Mock).mock.calls.every(call => call[0] === 'http://127.0.0.1:8095/health?userId=other-coach&org=other-org')).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(0);
});
