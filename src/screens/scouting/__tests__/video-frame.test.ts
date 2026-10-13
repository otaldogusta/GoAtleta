import { presentVideoFrames } from '../video/video-frame.web';

function fixture() {
    const events = new Map<string, () => void>(), documentEvents = new Map<string, () => void>();
    const frames = new Map<number, () => void>();
    let id = 0;
    const context = { drawImage: jest.fn(), clearRect: jest.fn() };
    const canvas = { width: 300, height: 150, getContext: () => context };
    const video = {
        readyState: 4, videoWidth: 1202, videoHeight: 676, paused: true,
        addEventListener: (name: string, listener: () => void) => events.set(name, listener),
        removeEventListener: (name: string) => events.delete(name),
        ownerDocument: {
            hidden: false,
            addEventListener: (name: string, listener: () => void) => documentEvents.set(name, listener),
            removeEventListener: (name: string) => documentEvents.delete(name),
        },
        requestVideoFrameCallback: (callback: () => void) => { frames.set(++id, callback); return id; },
        cancelVideoFrameCallback: (handle: number) => frames.delete(handle),
    };
    const bind = () => presentVideoFrames(video as unknown as HTMLVideoElement, canvas as unknown as HTMLCanvasElement);
    return { video, canvas, context, events, documentEvents, frames, bind };
}

test('decoded pixels are presented immediately and refreshed while paused or seeking', () => {
    const f = fixture(), stop = f.bind();
    expect(f.context.drawImage).toHaveBeenLastCalledWith(f.video, 0, 0, 1202, 676);
    for (const event of ['loadeddata', 'seeked', 'pause', 'timeupdate']) f.events.get(event)!();
    expect(f.context.drawImage).toHaveBeenCalledTimes(5);
    f.documentEvents.get('visibilitychange')!();
    expect(f.context.drawImage).toHaveBeenCalledTimes(6);
    stop();
});

test('frame presentation continues on decoded frames and removes every listener and callback on exit', () => {
    const f = fixture(), stop = f.bind(), frame = f.frames.get(1)!;
    f.frames.delete(1); frame();
    expect(f.context.drawImage).toHaveBeenCalledTimes(2);
    expect(f.frames.size).toBe(1);
    stop(); frame();
    expect(f.context.drawImage).toHaveBeenCalledTimes(2);
    expect(f.frames.size).toBe(0);
    expect(f.events.size).toBe(0);
    expect(f.documentEvents.size).toBe(0);
    expect(f.context.clearRect).toHaveBeenCalled();
});

test('source reset clears stale images; loading and transient decode failures do not paint invalid pixels', () => {
    const f = fixture(); f.video.readyState = 1;
    const stop = f.bind();
    expect(f.context.drawImage).not.toHaveBeenCalled();
    f.video.readyState = 4; f.video.videoWidth = 3840; f.video.videoHeight = 2160;
    f.events.get('loadeddata')!();
    expect(f.context.drawImage).toHaveBeenLastCalledWith(f.video, 0, 0, 1920, 1080);
    f.context.drawImage.mockImplementationOnce(() => { throw new Error('Decoder seeking'); });
    expect(() => f.events.get('seeked')!()).not.toThrow();
    expect(f.context.clearRect).not.toHaveBeenCalled();
    for (const event of ['emptied', 'loadstart', 'error']) f.events.get(event)!();
    expect(f.context.clearRect).toHaveBeenCalledTimes(3);
    stop();
});

test('animation fallback draws during playback but not repeatedly while paused', () => {
    const f = fixture();
    Object.assign(f.video, { requestVideoFrameCallback: undefined });
    let callback: FrameRequestCallback | undefined;
    const request = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(fn => { callback = fn; return 42; });
    const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
    try {
        const stop = f.bind(); callback!(0);
        expect(f.context.drawImage).toHaveBeenCalledTimes(1);
        f.video.paused = false; callback!(16);
        expect(f.context.drawImage).toHaveBeenCalledTimes(2);
        stop(); callback!(32);
        expect(cancel).toHaveBeenCalledWith(42);
        expect(f.context.drawImage).toHaveBeenCalledTimes(2);
    } finally { request.mockRestore(); cancel.mockRestore(); }
});
