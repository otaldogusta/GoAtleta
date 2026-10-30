import React, { useState } from "react";
import { AccessibilityInfo, Animated, Platform, ScrollView, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { CalendarInlineTimePicker, CalendarPickerDisclosure } from "../CalendarInlineTimePicker";

jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));

const eventAt = (index: number) => ({ nativeEvent: { contentOffset: { x: 0, y: index * 44 } } });

afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test("closing disables pending wheel movement while its normal exit remains mounted", async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
  const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
  const finishExit: (() => void)[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
    start: callback => {
      if (config.toValue === 0) finishExit.push(() => callback?.({ finished: true }));
      else { (value as Animated.Value).setValue(config.toValue as number); callback?.({ finished: true }); }
    },
    stop: () => {},
    reset: () => {},
  }));
  const changed = jest.fn();
  function Controlled({ open }: { open: boolean }) {
    const [value, setValue] = useState("09:00");
    return React.createElement(CalendarInlineTimePicker, { open, value, targetKey: "startTime", onChange: next => { changed(next); setValue(next); } });
  }
  const view = render(React.createElement(Controlled, { open: true }));
  await act(async () => {});
  const minutes = view.getByTestId("time-wheel-Minutos");
  fireEvent(minutes, "contentSizeChange", 100, 8008);
  fireEvent(minutes, "scrollBeginDrag", eventAt(60));
  fireEvent.scroll(minutes, eventAt(70.4));
  fireEvent(minutes, "scrollEndDrag", eventAt(70.4));
  expect(changed).toHaveBeenLastCalledWith("09:10");
  changed.mockClear();
  scrollTo.mockClear();

  view.rerender(React.createElement(Controlled, { open: false }));
  expect(view.getByTestId("calendar-inline-time-picker", { includeHiddenElements: true })).toBeTruthy();
  fireEvent.scroll(minutes, eventAt(71.4));
  fireEvent(minutes, "momentumScrollEnd", eventAt(72.4));
  act(() => jest.advanceTimersByTime(200));
  expect(changed).not.toHaveBeenCalled();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(minutes.props.scrollEnabled).toBe(false);

  act(() => finishExit.forEach(finish => finish()));
  expect(view.queryByTestId("calendar-inline-time-picker", { includeHiddenElements: true })).toBeNull();
});

test("changing a measured picker height starts from its visible height instead of jumping", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
  const pending: (() => void)[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
    start: callback => pending.push(() => { (value as Animated.Value).setValue(config.toValue as number); callback?.({ finished: true }); }),
    stop: () => {}, reset: () => {},
  }));
  const props = { open: true, testID: "slot", children: React.createElement(View) };
  const view = render(React.createElement(CalendarPickerDisclosure, props));
  await act(async () => {});
  act(() => pending.splice(0).forEach(finish => finish()));
  expect(view.getByTestId("slot")).toHaveStyle({ height: 180 });
  fireEvent(view.getByTestId("slot-content"), "layout", { nativeEvent: { layout: { height: 340 } } });
  expect(view.getByTestId("slot")).toHaveStyle({ height: 180 });
  act(() => pending.splice(0).forEach(finish => finish()));
  expect(view.getByTestId("slot")).toHaveStyle({ height: 340 });
  fireEvent(view.getByTestId("slot-content"), "layout", { nativeEvent: { layout: { height: 150 } } });
  expect(view.getByTestId("slot")).toHaveStyle({ height: 340 });
  act(() => pending.splice(0).forEach(finish => finish()));
  expect(view.getByTestId("slot")).toHaveStyle({ height: 150 });
});

test("reopening ignores the old exit completion and keeps the picker mounted", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
  const pending: { target: unknown; finish: () => void }[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((_value, config) => ({
    start: callback => pending.push({ target: config.toValue, finish: () => callback?.({ finished: true }) }),
    stop: () => {}, reset: () => {},
  }));
  const props = { open: true, testID: "slot", children: React.createElement(View) };
  const view = render(React.createElement(CalendarPickerDisclosure, props));
  await act(async () => {});
  view.rerender(React.createElement(CalendarPickerDisclosure, { ...props, open: false }));
  expect(view.getByTestId("slot", { includeHiddenElements: true }).props.inert).toBe(true);
  const exits = pending.filter(item => item.target === 0);
  view.rerender(React.createElement(CalendarPickerDisclosure, props));
  act(() => exits.forEach(item => item.finish()));
  expect(view.getByTestId("slot")).toBeTruthy();
  expect(view.getByTestId("slot").props.inert).toBe(false);
});
