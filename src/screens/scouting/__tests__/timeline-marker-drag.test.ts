import { createElement, useLayoutEffect, type RefObject } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTimelineMarkerDrag } from '../video/use-timeline-marker-drag';
import { useTimelineScrub } from '../video/use-timeline-scrub';

let view: ReactTestRenderer;
let bridge: ReturnType<typeof useTimelineMarkerDrag>;
let scrub: ReturnType<typeof useTimelineScrub>;
const onSeek = jest.fn(), beforeDrag = jest.fn();
const owner = { setPointerCapture: jest.fn(), hasPointerCapture: jest.fn(() => true), releasePointerCapture: jest.fn() };
const track = { current: { getBoundingClientRect: () => ({ left: 100, width: 200 }) } } as RefObject<HTMLElement | null>;
type Props = { time: number; start: number; end: number; scope: string };
const initial: Props = { time: 15, start: 10, end: 30, scope: 'recording:a:rally:1' };

function Harness(props: Props) {
    const currentScrub = useTimelineScrub({ ...props, onSeek });
    const currentBridge = useTimelineMarkerDrag({ ...props, trackRef: track, onStart: currentScrub.onPointerDown, onChange: currentScrub.onChange,
        onEnd: currentScrub.onPointerUp, onCancel: currentScrub.onPointerCancel, beforeDrag });
    useLayoutEffect(() => { scrub = currentScrub; bridge = currentBridge; });
    return null;
}
function mount(props = initial) { act(() => { view = create(createElement(Harness, props)); }); }
function pointer(x: number, patch: Partial<Parameters<typeof bridge.onPointerDown>[0]> = {}) {
    return { button: 0, pointerId: 4, currentTarget: owner as unknown as HTMLElement, clientX: x, clientY: 40,
        preventDefault: jest.fn(), stopPropagation: jest.fn(), ...patch };
}
function startDrag() {
    act(() => bridge.onPointerDown(pointer(120)));
    act(() => bridge.onPointerMove(pointer(124, { button: -1 })));
}
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { act(() => view?.unmount()); jest.clearAllTimers(); jest.useRealTimers(); });

test('a click or movement below 4px stays an ordinary marker selection without starting a scrub', () => {
    mount();
    act(() => bridge.onPointerDown(pointer(120)));
    act(() => bridge.onPointerMove(pointer(123.9, { button: -1 })));
    act(() => bridge.onPointerUp(pointer(123.9)));
    expect(scrub.active).toBe(false);expect(onSeek).not.toHaveBeenCalled();expect(beforeDrag).not.toHaveBeenCalled();
    expect(owner.setPointerCapture).not.toHaveBeenCalled();expect(bridge.consumeClick({ detail: 1 })).toBe(false);
});

test('dragging captures the original marker, previews current coordinates and commits exactly once on release', () => {
    mount();startDrag();
    expect(owner.setPointerCapture).toHaveBeenCalledTimes(1);expect(owner.setPointerCapture).toHaveBeenCalledWith(4);expect(beforeDrag).toHaveBeenCalledTimes(1);
    expect(scrub.active).toBe(true);expect(scrub.time).toBeCloseTo(12.4);expect(onSeek).not.toHaveBeenCalled();
    act(() => bridge.onPointerMove(pointer(250, { button: -1, currentTarget: {} as HTMLElement })));
    act(() => view.update(createElement(Harness, { ...initial, time: 16 })));
    expect(scrub.time).toBe(25);expect(beforeDrag).toHaveBeenCalledTimes(1);
    const release = pointer(260);act(() => bridge.onPointerUp(release));
    expect(onSeek).toHaveBeenCalledTimes(1);expect(onSeek).toHaveBeenCalledWith(26);expect(scrub.active).toBe(false);
    act(() => bridge.onLostPointerCapture({ pointerId: 4 }));act(() => bridge.onPointerUp(release));
    expect(onSeek).toHaveBeenCalledTimes(1);expect(owner.releasePointerCapture).toHaveBeenCalledWith(4);
    expect(bridge.consumeClick({ detail: 1 })).toBe(true);expect(bridge.consumeClick({ detail: 1 })).toBe(false);
});

test('drag preview clamps to the available interval and uses the final release coordinate', () => {
    mount();startDrag();
    act(() => bridge.onPointerMove(pointer(0, { button: -1 })));expect(scrub.time).toBe(10);
    act(() => bridge.onPointerMove(pointer(500, { button: -1 })));expect(scrub.time).toBeCloseTo(29.999);
    act(() => bridge.onPointerUp(pointer(150)));expect(onSeek).toHaveBeenCalledTimes(1);expect(onSeek).toHaveBeenCalledWith(15);
});

test.each(['cancel', 'capture', 'scope', 'bounds'] as const)('%s cancellation does not commit or leave the scrub active', reason => {
    mount();startDrag();
    if (reason === 'cancel') act(() => bridge.onPointerCancel({ pointerId: 4 }));
    if (reason === 'capture') act(() => bridge.onLostPointerCapture({ pointerId: 4 }));
    if (reason === 'scope') act(() => view.update(createElement(Harness, { ...initial, scope: 'recording:b:rally:1' })));
    if (reason === 'bounds') act(() => view.update(createElement(Harness, { ...initial, end: 40 })));
    act(() => bridge.onPointerUp(pointer(250)));
    expect(onSeek).not.toHaveBeenCalled();expect(scrub.active).toBe(false);
    expect(owner.releasePointerCapture).toHaveBeenCalledWith(4);
});

test('the next pointer click and keyboard Enter are not mistaken for a drag compatibility click', () => {
    mount();startDrag();act(() => bridge.onPointerUp(pointer(200)));
    expect(bridge.consumeClick({ detail: 0 })).toBe(false);
    startDrag();act(() => bridge.onPointerUp(pointer(220)));
    act(() => bridge.onPointerDown(pointer(120)));act(() => bridge.onPointerUp(pointer(120)));
    expect(bridge.consumeClick({ detail: 1 })).toBe(false);
    startDrag();act(() => bridge.onPointerUp(pointer(220)));act(() => jest.runOnlyPendingTimers());
    expect(bridge.consumeClick()).toBe(false);
});

test('secondary or foreign pointers and missing track geometry cannot start or commit a scrub', () => {
    mount();
    act(() => bridge.onPointerDown(pointer(120, { button: 2 })));
    act(() => bridge.onPointerDown(pointer(120, { isPrimary: false })));
    expect(beforeDrag).not.toHaveBeenCalled();expect(owner.setPointerCapture).not.toHaveBeenCalled();
    startDrag();act(() => bridge.onPointerUp(pointer(200, { pointerId: 9 })));
    expect(onSeek).not.toHaveBeenCalled();expect(scrub.active).toBe(true);
    act(() => bridge.onPointerCancel({ pointerId: 4 }));
    const previous = track.current;track.current = null;
    act(() => bridge.onPointerDown(pointer(120)));act(() => bridge.onPointerMove(pointer(200)));act(() => bridge.onPointerUp(pointer(200)));
    track.current = previous;expect(onSeek).not.toHaveBeenCalled();expect(scrub.active).toBe(false);
});

test('unmount releases a captured pointer without committing a seek', () => {
    mount();startDrag();act(() => view.unmount());
    expect(owner.releasePointerCapture).toHaveBeenCalledWith(4);expect(onSeek).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});
