import { act, renderHook } from "@testing-library/react-native";

import { scheduleEffectTask } from "../schedule-effect-task";
import { useCurrentTime } from "../use-current-time";
import { useUndoHistory } from "../use-undo-history";
import { useActionSignal } from "../use-action-signal";

describe("render lifecycle", () => {
  afterEach(() => jest.useRealTimers());

  it("updates relative time on ticks and releases the clock on unmount", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    const { result, unmount } = renderHook(() => useCurrentTime(1000));
    const initial = result.current;
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe(initial + 1000);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not start an external operation from a discarded effect", () => {
    jest.useFakeTimers();
    const start = jest.fn();
    const cancel = scheduleEffectTask(start);
    cancel();
    scheduleEffectTask(start);
    jest.runAllTicks();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("keeps undo availability in sync with consecutive commands", () => {
    const { result } = renderHook(() => useUndoHistory<string>(2));
    expect(result.current.canUndo).toBe(false);
    act(() => {
      result.current.push("a");
      result.current.push("b");
      result.current.push("c");
    });
    expect(result.current.canUndo).toBe(true);
    act(() => {
      expect(result.current.pop()).toBe("c");
      expect(result.current.pop()).toBe("b");
      expect(result.current.pop()).toBeUndefined();
    });
    expect(result.current.canUndo).toBe(false);
    act(() => { result.current.push("d"); result.current.clear(); });
    expect(result.current.canUndo).toBe(false);
  });

  it("retains exactly one entry with a history limit of one", () => {
    const { result } = renderHook(() => useUndoHistory<number>(1));
    act(() => { result.current.push(1); result.current.push(2); });
    act(() => {
      expect(result.current.pop()).toBe(2);
      expect(result.current.pop()).toBeUndefined();
    });
  });

  it("opens an action once per request, even as callbacks and busy state change", () => {
    jest.useFakeTimers();
    const action = jest.fn();
    const { rerender } = renderHook(({ signal, enabled }) => {
      useActionSignal(signal, enabled, () => action());
    }, { initialProps: { signal: 1, enabled: false } });
    act(() => { jest.runAllTicks(); });
    expect(action).not.toHaveBeenCalled();
    rerender({ signal: 1, enabled: true });
    act(() => { jest.runAllTicks(); });
    rerender({ signal: 1, enabled: false });
    rerender({ signal: 1, enabled: true });
    act(() => { jest.runAllTicks(); });
    expect(action).toHaveBeenCalledTimes(1);
    rerender({ signal: 2, enabled: true });
    act(() => { jest.runAllTicks(); });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
