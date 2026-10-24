import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useNativeCalendarGesture } from "../useNativeCalendarGesture.native";

let mockQueueRN = false;
const mockDeferredRN: (() => void)[] = [];
afterEach(() => { mockQueueRN = false; mockDeferredRN.length = 0; });

jest.mock("react-native-gesture-handler", () => ({ Gesture: { Pan: () => {
  const handlers: Record<string, unknown> = {};
  const pan: Record<string, unknown> = { handlers };
  for (const name of ["activeOffsetY", "failOffsetX", "onBegin", "onStart", "onUpdate", "onEnd", "onFinalize"]) {
    pan[name] = (value: unknown) => { handlers[name] = value; return pan; };
  }
  return pan;
} } }));
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => { if (mockQueueRN) mockDeferredRN.push(() => callback(...args)); else callback(...args); } }));
jest.mock("react-native-reanimated", () => {
  const ReactRuntime = jest.requireActual("react");
  return {
    useSharedValue: (initial: unknown) => ReactRuntime.useState(() => ({ value: initial, get() { return this.value; }, set(next: unknown) { this.value = next; } }))[0],
    useAnimatedRef: () => ReactRuntime.useRef(null),
    useReducedMotion: () => false,
    useAnimatedReaction: jest.fn(), scrollTo: jest.fn(), cancelAnimation: jest.fn(),
    withTiming: (target: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return target; },
    withDecay: (config: { clamp: number[] }) => config.clamp[0],
  };
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Drag = { absoluteY: number; translationY: number; velocityY: number };
type Handlers = { onBegin: () => void; onStart: (event: Drag) => void; onUpdate: (event: Drag) => void; onEnd: (event: Drag) => void };

it("keeps the week pager mounted for list-only drags and switches only when the month actually moves", async () => {
  let observed!: ReturnType<typeof useNativeCalendarGesture>;
  const changed = jest.fn();
  function Harness() { observed = useNativeCalendarGesture(true, changed, 295); return null; }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  observed.contentHeight.value = 1000;
  observed.viewportHeight.value = 500;
  const handlers = () => (observed.gesture as unknown as { handlers: Handlers }).handlers;
  const event = (y: number, translationY: number): Drag => ({ absoluteY: y, translationY, velocityY: 0 });

  act(() => handlers().onStart(event(700, -10)));
  expect(observed.interacting).toBe(false);
  act(() => handlers().onUpdate(event(500, -210)));
  expect(observed.position.value).toBe(505);
  expect(observed.interacting).toBe(false);
  act(() => handlers().onEnd(event(500, -210)));
  expect(observed.interacting).toBe(false);

  // A downward drag from the top really opens the month; reversing to the
  // week does not swap its renderer until the finger is released.
  act(() => handlers().onStart(event(710, 0)));
  act(() => handlers().onUpdate(event(750, 40)));
  expect(observed.position.value).toBe(255);
  expect(observed.interacting).toBe(true);
  act(() => handlers().onUpdate(event(690, -20)));
  expect(observed.interacting).toBe(true);
  act(() => handlers().onEnd(event(690, -20)));
  expect(observed.interacting).toBe(false);
  act(() => renderer.unmount());
});

it("discards an old snap completion queued before the next touch starts", async () => {
  let observed!: ReturnType<typeof useNativeCalendarGesture>;
  const changed = jest.fn();
  function Harness() { observed = useNativeCalendarGesture(true, changed, 295); return null; }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  observed.contentHeight.value = 1000;
  observed.viewportHeight.value = 500;
  const handlers = () => (observed.gesture as unknown as { handlers: Handlers }).handlers;
  const event = (absoluteY: number, translationY: number): Drag => ({ absoluteY, translationY, velocityY: 0 });
  act(() => { handlers().onBegin(); handlers().onStart(event(710, 0)); handlers().onUpdate(event(750, 40)); });
  mockQueueRN = true;
  act(() => handlers().onEnd(event(750, 40)));
  act(() => { handlers().onBegin(); handlers().onStart(event(710, 0)); handlers().onUpdate(event(810, 100)); });
  act(() => { for (const callback of mockDeferredRN.splice(0)) callback(); });
  expect(changed).not.toHaveBeenCalled();
  expect(observed.interacting).toBe(true);
  expect(observed.position.value).toBe(195);
  act(() => renderer.unmount());
});
