import { mountYouTube, youtubePlayback } from '../video/youtube-player.web';
test.each([1, 2, 5])('seeking preserves playing/paused state %s', state => {
    const player = { getCurrentTime: () => 14, getDuration: () => 60, getPlayerState: () => state, getPlaybackRate: () => 1, setPlaybackRate: jest.fn(), seekTo: jest.fn(), playVideo: jest.fn(), pauseVideo: jest.fn(), destroy: jest.fn() };
    const transport = youtubePlayback(player);
    transport.currentTime = 20;
    expect(player.seekTo).toHaveBeenCalledWith(20, true);
    expect(player.pauseVideo).toHaveBeenCalledTimes(state === 1 ? 0 : 1);
    expect(transport.currentTime).toBe(14);
    expect(transport.paused).toBe(state !== 1);
    transport.playbackRate = .5;
    expect(player.setPlaybackRate).toHaveBeenCalledWith(.5);
});

test('embedded player polls time, reports metadata, and disposes without late callbacks', async () => {
    jest.useFakeTimers();
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    let events: { onReady(): void; onError(event: { data: number }): void };
    const player = { getCurrentTime: () => 14, getDuration: () => 60, getPlayerState: () => 2, getPlaybackRate: () => 1, setPlaybackRate: jest.fn(), seekTo: jest.fn(), playVideo: jest.fn(), pauseVideo: jest.fn(), destroy: jest.fn() };
    const Player = jest.fn().mockImplementation((_element, options) => { events = options.events; return player; });
    Object.assign(globalThis, { window: { YT: { Player }, location: { origin: 'http://localhost:8081' } }, document: { createElement: () => ({}) } });
    const callbacks = { ready: jest.fn(), metadata: jest.fn(), tick: jest.fn(), state: jest.fn(), error: jest.fn() };
    const container = { appendChild: jest.fn(), replaceChildren: jest.fn() } as unknown as HTMLElement;
    try {
        const dispose = mountYouTube(container, 'M7lc1UVf-VE', callbacks);
        await Promise.resolve(); events!.onReady();
        expect(callbacks.metadata).toHaveBeenCalledWith(60);
        jest.advanceTimersByTime(400);
        expect(callbacks.tick).toHaveBeenCalledTimes(3);
        events!.onError({ data: 150 });
        expect(callbacks.error).toHaveBeenCalledWith(expect.stringContaining('incorporar'));
        jest.advanceTimersByTime(400);
        expect(callbacks.tick).toHaveBeenCalledTimes(3);
        dispose(); expect(player.destroy).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(30000);
        expect(callbacks.error).toHaveBeenCalledTimes(1);
    } finally { Object.assign(globalThis, { window: previousWindow, document: previousDocument }); jest.useRealTimers(); }
});
