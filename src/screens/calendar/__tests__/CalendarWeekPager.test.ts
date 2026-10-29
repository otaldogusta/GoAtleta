import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { CalendarWeekPager } from "../CalendarWeekPager";
import { Platform, Text, View } from "react-native";
const mockScrollTo = jest.fn();
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const ReactRuntime = jest.requireActual("react");
  return { Platform: actual.Platform, View: actual.View, Text: actual.Text, ScrollView: ReactRuntime.forwardRef((props: object, ref: unknown) => {
    ReactRuntime.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return ReactRuntime.createElement(actual.View, props);
  }) };
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("selects the snapped week after horizontal scrolling and ignores the current page", async () => {
  jest.useFakeTimers();
  const changed = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarWeekPager, { rows: [0,1,2,3,4,5].map(index => React.createElement(Text, { key: index }, index)), selectedRow: 3, onChange: changed })); });
    act(() => renderer.root.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    act(() => { const pager = renderer.root.findByProps({ testID: "calendar-week-pager" }); pager.props.onScrollBeginDrag(); pager.props.onScroll({ nativeEvent: { contentOffset: { x: 1050 } } }); pager.props.onScrollEndDrag({ nativeEvent: { contentOffset: { x: 1050 } } }); jest.advanceTimersByTime(150); });
    expect(changed).not.toHaveBeenCalled();
    act(() => { const pager = renderer.root.findByProps({ testID: "calendar-week-pager" }); pager.props.onScrollBeginDrag(); pager.props.onScroll({ nativeEvent: { contentOffset: { x: 1400 } } }); pager.props.onScrollEndDrag({ nativeEvent: { contentOffset: { x: 1400 } } }); jest.advanceTimersByTime(150); });
    expect(changed).toHaveBeenCalledWith(4);
  } finally {
    if (renderer) act(() => renderer.unmount());
    jest.useRealTimers();
  }
});

it("realigns the selected week after native content dimensions become available", async () => {
  mockScrollTo.mockClear();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarWeekPager, { rows: [0,1,2,3,4,5].map(i => React.createElement(Text, { key: i }, i)), selectedRow: 3, onChange: jest.fn() })); });
  act(() => renderer.root.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
  mockScrollTo.mockClear();
  act(() => renderer.root.findByProps({ testID: "calendar-week-pager" }).props.onContentSizeChange(2100, 59));
  expect(mockScrollTo).toHaveBeenCalledWith({ x: 1050, animated: false });
  act(() => renderer.unmount());
});

it("ignores automatic mount/alignment scrolls and changes date only after a user swipe settles", async () => {
  jest.useFakeTimers();
  const changed = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarWeekPager, { rows: [0,1,2,3,4,5], selectedRow: 3, onChange: changed })); });
    act(() => renderer.root.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    const pager = renderer.root.findByProps({ testID: "calendar-week-pager" });
    expect(pager.props.contentOffset).toEqual({ x: 1050, y: 0 });
    act(() => { pager.props.onScroll({ nativeEvent: { contentOffset: { x: 0 } } }); jest.advanceTimersByTime(200); });
    expect(changed).not.toHaveBeenCalled();
    act(() => { pager.props.onScrollBeginDrag(); pager.props.onScroll({ nativeEvent: { contentOffset: { x: 1400 } } }); });
    expect(changed).not.toHaveBeenCalled();
    act(() => pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 1400 } } }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(4);
    act(() => { pager.props.onScroll({ nativeEvent: { contentOffset: { x: 0 } } }); jest.advanceTimersByTime(200); });
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    if (renderer) act(() => renderer.unmount());
    jest.useRealTimers();
  }
});

it("retains web pointer paging while ignoring programmatic scrolls", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const changed = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarWeekPager, { rows: [0,1,2,3,4,5], selectedRow: 3, onChange: changed })); });
    act(() => renderer.root.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    const pager = renderer.root.findByProps({ testID: "calendar-week-pager" });
    act(() => { pager.props.onScroll({ nativeEvent: { contentOffset: { x: 0 } } }); jest.advanceTimersByTime(200); });
    expect(changed).not.toHaveBeenCalled();
    act(() => { pager.props.onPointerDown(); pager.props.onScroll({ nativeEvent: { contentOffset: { x: 1400 } } }); jest.advanceTimersByTime(200); });
    expect(changed).toHaveBeenCalledWith(4);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("reports readiness only after selected-week alignment, without selecting a new date", async () => {
  mockScrollTo.mockClear();
  const order: string[] = [];
  mockScrollTo.mockImplementation(() => { order.push("aligned"); });
  const ready = jest.fn((value: boolean) => { order.push(value ? "ready" : "waiting"); });
  const changed = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(CalendarWeekPager, { rows: [0, 1, 2, 3, 4], selectedRow: 3, onChange: changed, onReady: ready })); });
    expect(ready).toHaveBeenLastCalledWith(false);
    act(() => renderer.root.findAllByType(View).find(node => node.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 960, animated: false });
    expect(order.slice(-2)).toEqual(["aligned", "ready"]);
    expect(changed).not.toHaveBeenCalled();
  } finally {
    if (renderer) act(() => renderer.unmount());
    mockScrollTo.mockReset();
  }
});
