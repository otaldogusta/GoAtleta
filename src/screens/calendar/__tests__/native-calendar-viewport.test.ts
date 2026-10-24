import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View } from "react-native";
import { NativeCalendarFold } from "../NativeCalendarFold.native";
import type { NativeCalendarMotion } from "../useNativeCalendarGesture";

let mockPagerMounts = 0;
jest.mock("../CalendarWeekPager", () => {
  const ReactRuntime = jest.requireActual("react");
  const NativeView = jest.requireActual("react-native").View;
  return { CalendarWeekPager: () => {
    ReactRuntime.useEffect(() => { mockPagerMounts += 1; }, []);
    return ReactRuntime.createElement(NativeView, { testID: "persistent-week-pager" });
  } };
});
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useAnimatedStyle: (style: () => object) => style(),
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps the same pager and month views mounted through folding, settling and reversal", async () => {
  mockPagerMounts = 0;
  const position = { value: 295 };
  const motion = { position, travel: 295 } as unknown as NativeCalendarMotion;
  const rows = [0,1,2,3,4,5].map(i => React.createElement(View, { key: i, testID: `month-row-${i}` }));
  const props = { rows, selectedRow: 3, rowHeight: 59, motion, onWeekChange: jest.fn(), weekActive: true };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(NativeCalendarFold, props)); });
  const pager = renderer.root.findByProps({ testID: "persistent-week-pager" });
  const month = renderer.root.findByProps({ testID: "month-row-3" });
  for (const distance of [180, 0, 160, 294, 295, 310, 295]) {
    position.value = distance;
    act(() => renderer.update(React.createElement(NativeCalendarFold, { ...props, weekActive: distance >= 295 })));
    expect(renderer.root.findByProps({ testID: "persistent-week-pager" })).toBe(pager);
    expect(renderer.root.findByProps({ testID: "month-row-3" })).toBe(month);
  }
  expect(mockPagerMounts).toBe(1);
  act(() => renderer.unmount());
});
