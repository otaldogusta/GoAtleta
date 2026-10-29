import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated, Platform, View } from "react-native";
import { CalendarFold } from "../CalendarFold";
import { CalendarWeekPager } from "../CalendarWeekPager";

const mockScrollTo = jest.fn();
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const ReactRuntime = jest.requireActual("react");
  return { Animated: actual.Animated, AccessibilityInfo: actual.AccessibilityInfo, PanResponder: actual.PanResponder, Platform: actual.Platform, View: actual.View, ScrollView: ReactRuntime.forwardRef((props: object, ref: unknown) => {
    ReactRuntime.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return ReactRuntime.createElement(actual.View, props);
  }) };
});
jest.mock("../NativeCalendarFold", () => ({ NativeCalendarFold: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps month and week representations mounted through stops and reversals without an empty selected week", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const progress = new Animated.Value(1);
  const rows = [0, 1, 2, 3, 4, 5].map(index => React.createElement(View, { key: index, testID: `row-${index}` }));
  const onWeekChange = jest.fn();
  const props = { rows, selectedRow: 3, rowHeight: 44, collapsed: true, progress, onWeekChange, weekActive: true };
  const numeric = (value: number | { __getValue: () => number }) => typeof value === "number" ? value : value.__getValue();
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarFold, props)); });
    const month = renderer.root.findByProps({ testID: "calendar-web-month" });
    const week = renderer.root.findByProps({ testID: "calendar-web-week" });
    const pager = renderer.root.findByType(CalendarWeekPager);
    const selectedMonthRow = month.findByProps({ testID: "row-3" });
    // Before layout, the translated month supplies the selected week.
    expect(numeric(month.props.style.opacity)).toBe(1);
    expect(numeric(week.props.style.opacity)).toBe(0);
    expect(numeric(month.props.style.transform[0].translateY)).toBe(-132);
    act(() => pager.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 1050, animated: false });
    const scroll = pager.findByProps({ testID: "calendar-week-pager" });
    for (const value of [0.8, 0, 0.4, 0.99, 1, 0.6, 1]) {
      act(() => {
        progress.setValue(value);
        renderer.update(React.createElement(CalendarFold, { ...props, collapsed: value >= 1, weekActive: value >= 1 }));
      });
      expect(renderer.root.findByProps({ testID: "calendar-web-month" })).toBe(month);
      expect(renderer.root.findByProps({ testID: "calendar-web-week" })).toBe(week);
      expect(renderer.root.findByType(CalendarWeekPager)).toBe(pager);
      expect(pager.findByProps({ testID: "calendar-week-pager" })).toBe(scroll);
      expect(month.findByProps({ testID: "row-3" })).toBe(selectedMonthRow);
      expect(numeric(month.props.style.opacity) + numeric(week.props.style.opacity)).toBeCloseTo(1);
      expect(month.props.accessibilityElementsHidden).toBe(value >= 1);
      expect(week.props.accessibilityElementsHidden).toBe(value < 1);
      expect(month.props.inert).toBe(value >= 1);
      expect(week.props.inert).toBe(value < 1);
    }
    expect(onWeekChange).not.toHaveBeenCalled();
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});
