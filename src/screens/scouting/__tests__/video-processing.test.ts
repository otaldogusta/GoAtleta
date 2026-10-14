import { processScoutingVideo, processScoutingVideoUrl } from '../video/video-processing.web';

const driveUrl = 'https://drive.usercontent.google.com/download?id=drive_file_123456&export=download&confirm=t';
const gatewayUrl = `http://127.0.0.1:8095/media/12345678-1234-1234-1234-123456789abc?token=${'a'.repeat(64)}`;
const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
let workers: FakeWorker[], videos: FakeVideo[], canvases: FakeCanvas[];
let onSeek: (() => void) | undefined, onLoad: (() => void) | undefined, readPixels: (() => void) | undefined;
let reportedDuration: number, reportedWidth: number, reportedHeight: number;

class FakeVideo {
    crossOrigin = ''; preload = ''; muted = false; playsInline = false;
    duration = reportedDuration; videoWidth = reportedWidth; videoHeight = reportedHeight;
    source = ''; loadedSource = ''; originAtSource = ''; position = 0;
    error: { code: number } | null = null;
    seeks: number[] = [];
    listeners = new Map<string, Set<() => void>>();
    load = jest.fn();
    get src() { return this.source; }
    set src(value: string) { this.source = value; this.loadedSource = value; this.originAtSource = this.crossOrigin; queueMicrotask(() => { onLoad?.(); this.emit('loadeddata'); }); }
    get currentTime() { return this.position; }
    set currentTime(value: number) { this.position = value; this.seeks.push(value); onSeek?.(); queueMicrotask(() => this.emit('seeked')); }
    addEventListener(name: string, callback: () => void) {
        const entries = this.listeners.get(name) ?? new Set(); entries.add(callback); this.listeners.set(name, entries);
    }
    removeEventListener(name: string, callback: () => void) { this.listeners.get(name)?.delete(callback); }
    removeAttribute(name: string) { if (name === 'src') this.source = ''; }
    emit(name: string) { [...(this.listeners.get(name) ?? [])].forEach(callback => callback()); }
}
class FakeCanvas {
    width = 0; height = 0;
    getContext() {
        const pixels = new Uint8ClampedArray(this.width * this.height * 4);
        return { drawImage: jest.fn(), getImageData: () => { readPixels?.(); return { data: pixels }; } };
    }
}
class FakeWorker {
    onmessage: ((event: { data: object }) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = jest.fn();
    messages: { type: string; model?: string; input?: Float32Array }[] = [];
    postMessage(message: { type: string; model?: string; input?: Float32Array }) {
        this.messages.push(message);
        const data = message.type === 'init' ? { type: 'ready', model: message.model, frames: 9, backend: 'wasm',
            width: message.model === 'v4c' ? 512 : 768, height: message.model === 'v4c' ? 288 : 432 } :
            { type: 'result', predictions: Array.from({ length: 9 }, () => ({ x: .1, y: .2, score: .9 })) };
        queueMicrotask(() => this.onmessage?.({ data }));
    }
}

beforeEach(() => {
    workers = []; videos = []; canvases = []; onSeek = undefined; onLoad = undefined; readPixels = undefined; reportedDuration = .1; reportedWidth = 1200; reportedHeight = 600;
    Object.assign(globalThis, {
        Worker: jest.fn(() => { const worker = new FakeWorker(); workers.push(worker); return worker; }),
        document: { createElement: jest.fn((tag: string) => {
            if (tag === 'video') { const video = new FakeVideo(); videos.push(video); return video; }
            const canvas = new FakeCanvas(); canvases.push(canvas); return canvas;
        }) },
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:original-file') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
});
afterAll(() => {
    Object.assign(globalThis, { document: originalDocument, Worker: originalWorker });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeUrl });
});

test('Drive streaming reuses the default V2b worker without creating or saving a File/Blob', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    const progress = jest.fn();
    const analysis = await processScoutingVideoUrl(driveUrl, .1, new AbortController().signal, progress);
    expect(analysis).toEqual({ model: 'vballnet-v2b-browser-1', sampledFps: 30, cuts: [],
        positions: [{ time: 0, x: .1, y: .2 }, { time: 1 / 30, x: .1, y: .2 }, { time: 2 / 30, x: .1, y: .2 }] });
    expect(workers[0].messages[0]).toEqual({ type: 'init', model: 'v2b' });
    expect(workers[0].messages[1].input).toHaveLength(9 * 768 * 432);
    expect(videos[0].originAtSource).toBe('anonymous');
    expect(videos[0].preload).toBe('metadata');
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled(); fetcher.mockRestore();
    expect(progress.mock.calls[0][2]).toContain('neste aparelho');
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(videos[0].source).toBe(''); expect(videos[0].load).toHaveBeenCalled();
    expect(canvases.every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true);
});

test('local File processing retains its existing contract and revokes only the owned blob URL', async () => {
    const file = { name: 'partida.mp4' } as File;
    const analysis = await processScoutingVideo(file, .1, new AbortController().signal, jest.fn(), { model: 'v4c' });
    expect(analysis.model).toBe('vballnet-v4c-browser-1');
    expect(workers[0].messages[0].model).toBe('v4c');
    expect(workers[0].messages[1].input).toHaveLength(9 * 512 * 288);
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:original-file');
});

test('accepts only the exact temporary gateway capability and reuses the same decoder without File/Blob', async () => {
    const analysis = await processScoutingVideoUrl(gatewayUrl, .1, new AbortController().signal, jest.fn());
    expect(analysis.model).toBe('vballnet-v2b-browser-1');
    expect(videos[0].loadedSource).toBe(gatewayUrl); expect(videos[0].originAtSource).toBe('anonymous');
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(workers[0].terminate).toHaveBeenCalledTimes(1); expect(videos[0].source).toBe('');
});

test.each([
    gatewayUrl.replace(':8095/', ':8094/'), gatewayUrl.replace(':8095/', '/'),
    gatewayUrl.replace('http:', 'https:'), gatewayUrl.replace('127.0.0.1', 'localhost'),
    gatewayUrl.replace('127.0.0.1', '127.0.0.1.evil.example'), gatewayUrl.replace('127.0.0.1', 'user:password@127.0.0.1'),
    gatewayUrl.replace('/media/', '/jobs/'), gatewayUrl.replace('/media/', '/media/download/'),
    gatewayUrl.replace('12345678-1234-1234-1234-123456789abc', 'not-a-uuid'),
    gatewayUrl.replace('?token=', '/?token='), gatewayUrl.replace('?token=', '?key='),
    gatewayUrl.replace('a'.repeat(64), 'a'.repeat(63)), gatewayUrl.replace('a'.repeat(64), `${'a'.repeat(63)}g`),
    `${gatewayUrl}&token=${'b'.repeat(64)}`, `${gatewayUrl}&redirect=https://evil.example`, `${gatewayUrl}#private`,
])('rejects malformed or broadened gateway access %s', async url => {
    await expect(processScoutingVideoUrl(url, .1, new AbortController().signal, jest.fn())).rejects.toThrow('Drive');
    expect(workers).toHaveLength(0); expect(videos).toHaveLength(0); expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test.each([
    'https://drive.google.com/file/d/drive_file_123456/view',
    'http://drive.usercontent.google.com/download?id=drive_file_123456&export=download&confirm=t',
    'https://drive.usercontent.google.com.evil.example/download?id=drive_file_123456&export=download&confirm=t',
    'https://drive.usercontent.google.com/preview?id=drive_file_123456&export=download&confirm=t',
    'https://drive.usercontent.google.com:443/download?id=drive_file_123456&export=download&confirm=t#private',
    'https://user:password@drive.usercontent.google.com/download?id=drive_file_123456&export=download&confirm=t',
    `${driveUrl}&redirect=https://evil.example`, `${driveUrl}&id=second_file_123456`,
    driveUrl.replace('confirm=t', 'confirm=other'), driveUrl.replace('drive_file_123456', 'short'),
    'blob:original-file', 'javascript:alert(1)', 'https://example.com/video.mp4',
])('rejects untrusted/noncanonical stream URLs before decoding %s', async url => {
    await expect(processScoutingVideoUrl(url, .1, new AbortController().signal, jest.fn())).rejects.toThrow('Drive');
    expect(workers).toHaveLength(0); expect(videos).toHaveLength(0); expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test.each([0, -1, NaN, Infinity, 1800.1])('rejects invalid duration %s before starting a worker', async duration => {
    await expect(processScoutingVideoUrl(driveUrl, duration, new AbortController().signal, jest.fn())).rejects.toThrow('30 minutos');
    expect(workers).toHaveLength(0);
});

test('an already aborted stream does not start a worker or request decoded frames', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(processScoutingVideoUrl(driveUrl, .1, controller.signal, jest.fn())).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(0);
});

test('cancelling a seek terminates worker and detaches the remote media without saving it', async () => {
    const controller = new AbortController(); onSeek = () => controller.abort();
    await expect(processScoutingVideoUrl(driveUrl, .1, controller.signal, jest.fn())).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminate).toHaveBeenCalledTimes(1); expect(videos[0].source).toBe('');
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect([...videos[0].listeners.values()].every(listeners => listeners.size === 0)).toBe(true);
});

test('a browser refusing pixel access never produces partial analysis and releases the media', async () => {
    readPixels = () => { throw new DOMException('Cross-origin image', 'SecurityError'); };
    await expect(processScoutingVideoUrl(driveUrl, .1, new AbortController().signal, jest.fn())).rejects.toMatchObject({ name: 'SecurityError' });
    expect(workers[0].terminate).toHaveBeenCalledTimes(1); expect(videos[0].source).toBe('');
});

test('changed remote media metadata is rejected before reading any frame', async () => {
    reportedDuration = 60; readPixels = jest.fn();
    await expect(processScoutingVideoUrl(driveUrl, .1, new AbortController().signal, jest.fn())).rejects.toThrow('vídeo mudou');
    expect(readPixels).not.toHaveBeenCalled(); expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(videos[0].source).toBe('');
});

test('an explicit resume key keeps only completed batches after abort, accepts a fresh URL and clears after completion', async () => {
    reportedDuration = .6;
    const resumeKey = '1'.repeat(64), controller = new AbortController();
    await expect(processScoutingVideoUrl(gatewayUrl, .6, controller.signal, done => { if (done === 9) controller.abort(); }, { resumeKey }))
        .rejects.toMatchObject({ name: 'AbortError' });
    expect(videos[0].seeks).toHaveLength(9);
    const progress = jest.fn(), freshUrl = gatewayUrl.replace('a'.repeat(64), 'b'.repeat(64));
    const analysis = await processScoutingVideoUrl(freshUrl, .6, new AbortController().signal, progress, { resumeKey });
    expect(videos[1].loadedSource).toBe(freshUrl);
    expect(videos[1].seeks).toHaveLength(9); expect(videos[1].seeks[0]).toBeCloseTo(9.1 / 30);
    expect(progress).toHaveBeenCalledWith(9, 18, 'Retomando tracking neste aparelho…');
    expect(analysis.positions.map(point => point.time)).toEqual(Array.from({ length: 18 }, (_, frame) => frame / 30));
    expect(workers[1].messages.filter(message => message.type === 'run')).toHaveLength(1);
    await processScoutingVideoUrl(freshUrl, .6, new AbortController().signal, jest.fn(), { resumeKey });
    expect(videos[2].seeks).toHaveLength(18); expect(videos[2].seeks[0]).toBeCloseTo(.1 / 30);
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

test('a partial read error does not contaminate scene history, and another scoped key starts independently', async () => {
    reportedDuration = .6;
    const resumeKey = '2'.repeat(64); let reads = 0;
    // Nine completed frames, then one decoded-but-uncommitted scene in batch 2.
    readPixels = () => { if (++reads === 21) throw new DOMException('Frame unavailable', 'SecurityError'); };
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey }))
        .rejects.toMatchObject({ name: 'SecurityError' });
    expect(videos[0].seeks).toHaveLength(11);
    readPixels = undefined;
    await processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey: '3'.repeat(64) });
    expect(videos[1].seeks).toHaveLength(18); expect(videos[1].seeks[0]).toBeCloseTo(.1 / 30);
    const analysis = await processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey });
    expect(videos[2].seeks).toHaveLength(9); expect(videos[2].seeks[0]).toBeCloseTo(9.1 / 30);
    expect(analysis.cuts).toEqual([]); expect(analysis.positions).toHaveLength(18);
});

test('reusing a key with another duration, model or image size invalidates the saved work', async () => {
    for (const change of ['duration', 'model', 'dimensions'] as const) {
        reportedDuration = .6; reportedWidth = 1200; reportedHeight = 600;
        const resumeKey = '4'.repeat(64), controller = new AbortController();
        await expect(processScoutingVideoUrl(gatewayUrl, .6, controller.signal, done => { if (done === 9) controller.abort(); }, { resumeKey }))
            .rejects.toMatchObject({ name: 'AbortError' });
        if (change === 'duration') reportedDuration = .9;
        if (change === 'dimensions') { reportedWidth = 640; reportedHeight = 360; }
        await expect(processScoutingVideoUrl(gatewayUrl, reportedDuration, new AbortController().signal, jest.fn(), { resumeKey, model: change === 'model' ? 'v4c' : 'v2b' }))
            .rejects.toThrow('mídia ou o modelo');
        reportedDuration = .6; reportedWidth = 1200; reportedHeight = 600;
        await processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey });
        expect(videos.at(-1)!.seeks).toHaveLength(18); expect(videos.at(-1)!.seeks[0]).toBeCloseTo(.1 / 30);
    }
});

test('a temporary network interruption resumes the completed batch automatically without duplicate samples', async () => {
    reportedDuration = .6;
    const progress = jest.fn();
    onSeek = () => {
        const video = videos.at(-1)!;
        if (workers.length === 1 && video.seeks.length === 11) { video.error = { code: 2 }; video.emit('error'); }
    };
    const analysis = await processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, progress, { resumeKey: '5'.repeat(64) });
    expect(workers).toHaveLength(2); expect(videos[0].seeks).toHaveLength(11); expect(videos[1].seeks).toHaveLength(9);
    expect(videos[1].seeks[0]).toBeCloseTo(9.1 / 30);
    expect(progress).toHaveBeenCalledWith(9, 18, 'Trecho interrompido; retomando…');
    const resumedAt = progress.mock.calls.findIndex(([, , stage]) => stage === 'Trecho interrompido; retomando…');
    expect(progress.mock.calls.slice(resumedAt).every(([done]) => done >= 9)).toBe(true);
    expect(analysis.positions.map(point => point.time)).toEqual(Array.from({ length: 18 }, (_, frame) => frame / 30));
    expect(analysis.cuts).toEqual([]); expect(workers.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

test('three network failures stop with a useful error; abort and non-network failures never retry', async () => {
    reportedDuration = .6;
    onSeek = () => { const video = videos.at(-1)!; video.error = { code: 2 }; video.emit('error'); };
    const progress = jest.fn();
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, progress, { resumeKey: '6'.repeat(64) }))
        .rejects.toThrow('falhou três vezes');
    expect(workers).toHaveLength(3);
    expect(progress.mock.calls.filter(([, , stage]) => stage === 'Trecho interrompido; retomando…')).toHaveLength(2);
    const controller = new AbortController(); onSeek = () => controller.abort();
    await expect(processScoutingVideoUrl(gatewayUrl, .6, controller.signal, jest.fn(), { resumeKey: '7'.repeat(64) }))
        .rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(4);
    onSeek = () => { const video = videos.at(-1)!; video.error = { code: 4 }; video.emit('error'); };
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey: '8'.repeat(64) }))
        .rejects.toThrow('ler os quadros');
    expect(workers).toHaveLength(5);
    onSeek = undefined; readPixels = () => { throw new DOMException('Cross-origin image', 'SecurityError'); };
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey: '9'.repeat(64) }))
        .rejects.toMatchObject({ name: 'SecurityError' });
    expect(workers).toHaveLength(6);
    readPixels = undefined; reportedDuration = 60;
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey: 'a'.repeat(64) }))
        .rejects.toThrow('vídeo mudou');
    expect(workers).toHaveLength(7);
    reportedDuration = .6;
    onLoad = () => { const video = videos.at(-1)!; video.error = { code: 2 }; video.emit('error'); };
    await expect(processScoutingVideoUrl(gatewayUrl, .6, new AbortController().signal, jest.fn(), { resumeKey: 'b'.repeat(64) }))
        .rejects.toThrow('ler os quadros');
    expect(workers).toHaveLength(8); // Initial access/CORS failure is never retried.
});
