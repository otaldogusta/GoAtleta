import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { useRefreshTransition } from "../../../ui/useRefreshTransition";

describe("refresh transition", () => {
  afterEach(() => jest.restoreAllMocks());
  it("keeps the shimmer until fade completion and cancels interrupted transitions", () => {
    const completions: ((result: { finished: boolean }) => void)[] = [];
    const stops: jest.Mock[] = [];
    jest.spyOn(Animated, "timing").mockImplementation(() => {
      const stop = jest.fn(); stops.push(stop);
      return { start: (callback: any) => completions.push(callback), stop, reset: jest.fn() };
    });
    const { result, rerender, unmount } = renderHook(({ refreshing }) => useRefreshTransition(refreshing), { initialProps: { refreshing: true } });
    expect(result.current.visible).toBe(true);
    rerender({ refreshing: false });
    expect(stops[0]).toHaveBeenCalled();
    expect(result.current.visible).toBe(true);
    act(() => completions[1]({ finished: true }));
    expect(result.current.visible).toBe(false);
    rerender({ refreshing: true });
    expect(result.current.visible).toBe(true);
    unmount();
    expect(stops[2]).toHaveBeenCalled();
  });
  it("removes motion when accessibility requests it", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const timing = jest.spyOn(Animated, "timing").mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    renderHook(() => useRefreshTransition(true));
    await waitFor(() => expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 0, isInteraction: false })));
  });
});
