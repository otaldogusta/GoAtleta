import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated } from "react-native";
import { useDisclosureMotion } from "../useDisclosureMotion";

type Options = NonNullable<Parameters<typeof useDisclosureMotion>[1]>;
type Motion = ReturnType<typeof useDisclosureMotion>;
type Pending = { config: Animated.TimingAnimationConfig; stop: jest.Mock; complete: (finished: boolean) => void };

describe("useDisclosureMotion", () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  let latest: Motion;
  let pending: Pending[];
  let onReducedMotion: (value: boolean) => void;

  function Harness({ open, options }: { open: boolean; options?: Options }) {
    latest = useDisclosureMotion(open, options);
    return null;
  }
  const mount = async (open: boolean, options?: Options) => {
    await act(async () => { tree = TestRenderer.create(React.createElement(Harness, { open, options })); });
  };
  const update = (open: boolean, options?: Options) => act(() => tree!.update(React.createElement(Harness, { open, options })));
  beforeEach(() => {
    pending = [];
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_event, callback) => {
      onReducedMotion = callback;
      return { remove: jest.fn() };
    });
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      let callback: ((result: { finished: boolean }) => void) | undefined;
      const stop = jest.fn(() => callback?.({ finished: false }));
      pending.push({ config, stop, complete: finished => { if (finished) value.setValue(config.toValue as number); callback?.({ finished }); } });
      return { start: next => { callback = next; }, stop, reset: jest.fn() };
    });
  });
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  it("preserves the default 160 ms fade and vertical distance", async () => {
    await mount(false);
    update(true);
    expect(pending.at(-1)!.config).toMatchObject({ toValue: 1, duration: 160 });
    expect(latest.style.transform[0]).toHaveProperty("translateY");
    expect(latest.mounted).toBe(true);
    act(() => pending.at(-1)!.complete(true));
    expect(latest.progress.__getValue()).toBe(1);
    update(false);
    expect(latest.mounted).toBe(true);
    act(() => pending.at(-1)!.complete(true));
    expect(latest.mounted).toBe(false);
  });

  it("reverses a closing animation and ignores its stale completion after reopening", async () => {
    const options = { axis: "x", distance: 24, duration: 200 } as const;
    await mount(false, options);
    update(true, options);
    act(() => pending.at(-1)!.complete(true));
    update(false, options);
    const interruptedClose = pending.at(-1)!;
    expect(interruptedClose.config).toMatchObject({ toValue: 0, duration: 200 });
    expect(latest.style.transform[0]).toHaveProperty("translateX");
    update(true, options);
    expect(interruptedClose.stop).toHaveBeenCalledTimes(1);
    act(() => interruptedClose.complete(true));
    expect(latest.mounted).toBe(true);
    update(false, options);
    expect(latest.mounted).toBe(true);
    act(() => pending.at(-1)!.complete(true));
    expect(latest.mounted).toBe(false);
  });

  it("finishes immediately when reduced motion is enabled and cancels an in-flight animation", async () => {
    await mount(false, { axis: "x", distance: 24, duration: 200 });
    update(true, { axis: "x", distance: 24, duration: 200 });
    const interrupted = pending.at(-1)!;
    act(() => onReducedMotion(true));
    expect(interrupted.stop).toHaveBeenCalledTimes(1);
    expect(latest.reduced).toBe(true);
    expect(latest.progress.__getValue()).toBe(1);
    const animationCount = pending.length;
    update(false, { axis: "x", distance: 24, duration: 200 });
    expect(latest.mounted).toBe(false);
    expect(latest.progress.__getValue()).toBe(0);
    expect(pending).toHaveLength(animationCount);
    act(() => interrupted.complete(true));
    expect(latest.mounted).toBe(false);
  });
});
