import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { BallPosition, VideoRally } from '../../../core/scouting-video';
import { VideoTrackingOverlay } from '../video/VideoTrackingOverlay.web';

function drawing(options: { positions: BallPosition[]; cuts?: number[]; timeOffset?: number; corrections?: BallPosition[]; localTime?: number }) {
    const context = { scale: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(), lineTo: jest.fn(), moveTo: jest.fn(), stroke: jest.fn(), arc: jest.fn() };
    const callbacks = new Map<string, () => void>();
    let frame: VideoFrameRequestCallback;
    const video = {
        currentTime: options.localTime ?? 10, paused: true,
        requestVideoFrameCallback: jest.fn(callback => { frame = callback; return 7; }),
        cancelVideoFrameCallback: jest.fn(),
        addEventListener: jest.fn((name, callback) => { callbacks.set(name, callback); }),
        removeEventListener: jest.fn(),
    } as unknown as HTMLVideoElement;
    let view: ReactTestRenderer;
    act(() => { view = create(createElement(VideoTrackingOverlay, {
        video: { current: video }, source: 'blob:original', positions: options.positions,
        corrections: options.corrections ?? [], rallies: [{ id: 'r1', start: 0, winner: null, reviewed: false }] as VideoRally[],
        cuts: options.cuts, timeOffset: options.timeOffset, width: 100, height: 200,
        color: 'green', correctionColor: 'red', visible: true,
    }), { createNodeMock: element => element.type === 'canvas' ? { getContext: () => context } : null }); });
    return { context, callbacks, video, frame: (mediaTime: number) => frame(0, { mediaTime } as VideoFrameCallbackMetadata), dispose: () => act(() => view.unmount()) };
}

const previousRatio = globalThis.devicePixelRatio, previousCancel = globalThis.cancelAnimationFrame;
beforeAll(() => { Object.assign(globalThis, { devicePixelRatio: 1, cancelAnimationFrame: jest.fn() }); });
afterAll(() => { Object.assign(globalThis, { devicePixelRatio: previousRatio, cancelAnimationFrame: previousCancel }); });

test('native frame timestamps select tracking on the aligned YouTube timeline', () => {
    const draw = drawing({ positions: [{ time: 20, x: .2, y: .3 }, { time: 20 + 1 / 30, x: .25, y: .35 }], timeOffset: 10 });
    expect(draw.context.arc).toHaveBeenLastCalledWith(20, 60, 11, 0, Math.PI * 2);
    draw.frame(10 + 1 / 30);
    expect(draw.context.arc).toHaveBeenLastCalledWith(25, 70, 11, 0, Math.PI * 2);
    draw.dispose();
});

test('scene cuts stop the trail even when the current rally spans both shots', () => {
    const draw = drawing({ positions: [{ time: 9.95, x: .2, y: .3 }, { time: 9.98, x: .21, y: .31 }, { time: 10.01, x: .22, y: .32 }], cuts: [10], localTime: 10.01 });
    expect(draw.context.moveTo).toHaveBeenCalledWith(22, 64);
    expect(draw.context.lineTo).not.toHaveBeenCalled();
    draw.dispose();
});

test('does not draw a sample or manual correction from before the current shot', () => {
    const draw = drawing({ positions: [{ time: 9.99, x: .2, y: .3 }], corrections: [{ time: 9.99, x: .3, y: .4 }], cuts: [10], localTime: 10.01 });
    expect(draw.context.arc).not.toHaveBeenCalled();
    draw.dispose();
});

test('paused seeks refresh aligned corrections and unmount removes native callbacks', () => {
    const draw = drawing({ positions: [], corrections: [{ time: 20.2, x: .4, y: .5 }], timeOffset: 10 });
    expect(draw.context.arc).not.toHaveBeenCalled();
    draw.video.currentTime = 10.2;
    draw.callbacks.get('seeked')!();
    expect(draw.context.arc).toHaveBeenLastCalledWith(40, 100, 11, 0, Math.PI * 2);
    draw.dispose();
    expect(draw.video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
    expect(draw.video.removeEventListener).toHaveBeenCalledTimes(3);
    const calls = draw.context.arc.mock.calls.length;
    draw.frame(10.2);
    expect(draw.context.arc).toHaveBeenCalledTimes(calls);
});
