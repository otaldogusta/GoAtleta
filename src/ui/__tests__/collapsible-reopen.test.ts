import { renderHook } from "@testing-library/react-native";
import { Animated } from "react-native";
import { useCollapsibleAnimation } from "../use-collapsible";

it("resets a reopened animation and stops the previous run", () => {
  const reset = jest.spyOn(Animated.Value.prototype, "setValue");
  const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation");
  const timing = jest.spyOn(Animated, "timing").mockReturnValue({
    start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
  });
  const { rerender, unmount } = renderHook(({ open }) => useCollapsibleAnimation(open), {
    initialProps: { open: false },
  });
  rerender({ open: true });
  expect(reset).toHaveBeenLastCalledWith(0);
  rerender({ open: false });
  expect(stop).toHaveBeenCalled();
  reset.mockClear();
  rerender({ open: true });
  expect(reset).toHaveBeenCalledWith(0);
  unmount();
  timing.mockRestore(); reset.mockRestore(); stop.mockRestore();
});
