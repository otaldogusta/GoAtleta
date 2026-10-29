import React, { useLayoutEffect, useRef, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated, Text, Platform, ScrollView, View } from "react-native";
import { CalendarEventSheet } from "../CalendarEventSheet";
import { CalendarFold } from "../CalendarFold";
import { sheetStop, useCalendarWheel, useEventSheetGesture } from "../useEventSheetGesture";
// These tests exercise the web pointer/wheel adapter. Native worklets run on
// the device; their distance contract is covered separately in calendar-drag.
jest.mock("../useNativeCalendarGesture", () => ({ useNativeCalendarGesture: () => null }));
jest.mock("../NativeCalendarFold", () => ({ NativeCalendarFold: () => null }));
jest.mock("../NativeCalendarEvents", () => ({ NativeCalendarEvents: () => null }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { card: "#172235", border: "#334155", text: "#fff", muted: "#94a3b8" } }) }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
// Resolve the lazy native module before the first asynchronous React act.
// These web tests exercise pointer/wheel handlers, not native responder dispatch.
jest.requireActual("react-native/Libraries/Interaction/PanResponder");
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function Agenda({ mobile = true, travel = 220, initiallyCollapsed = false }: { mobile?: boolean; travel?: number; initiallyCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const listRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const motion = useEventSheetGesture(collapsed, setCollapsed, travel, listRef, offsetRef);
  // react-test-renderer's native View ref is not a DOM node. Supply the web
  // target separately so these tests exercise the actual non-passive adapter.
  const wheelRef = useRef(wheelNode as unknown as View);
  useCalendarWheel(wheelRef, motion.wheel);
  return React.createElement(View, null,
    React.createElement(CalendarFold, { rows: Array.from({ length: 6 }, (_, i) => React.createElement(Text, { key: i }, `Semana ${i}`)), selectedRow: 3, collapsed, progress: motion.progress, rowHeight: 44 }),
    React.createElement(CalendarEventSheet, { mobile, collapsed, onCollapsedChange: setCollapsed, motion, listRef, offsetRef, header: React.createElement(Text, null, "24 de outubro"), footer: React.createElement(Text, { testID: "quick-add-footer" }, "Adicionar evento") }, Array.from({ length: 7 }, (_, i) => React.createElement(Text, { key: i }, `Aula ${i + 1}`))));
}
let wheelListener: ((event: WheelEvent) => void) | null = null;
const wheelNode = {
  clientHeight: 330,
  addEventListener: jest.fn((_type: string, listener: (event: WheelEvent) => void) => { wheelListener = listener; }),
  removeEventListener: jest.fn(() => { wheelListener = null; }),
};
function dispatchWheel(deltaY: number, extras: Partial<WheelEvent> = {}) {
  const event = { deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, cancelable: true, preventDefault: jest.fn(), currentTarget: wheelNode, ...extras } as unknown as WheelEvent;
  act(() => wheelListener?.(event));
  return event;
}
async function createAgenda(mobile = true, travel = 220, initiallyCollapsed = false) {
  wheelListener = null;
  wheelNode.addEventListener.mockClear(); wheelNode.removeEventListener.mockClear();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Agenda, { mobile, travel, initiallyCollapsed })); });
  const list = renderer.root.findByProps({ testID: "calendar-event-list" });
  act(() => {
    list.props.onLayout({ nativeEvent: { layout: { height: initiallyCollapsed ? 330 : 330 - travel } } });
    list.props.onContentSizeChange(350, 830);
  });
  return renderer;
}
it("folds the month to a week in normal flow and retains every event", async () => {
  const renderer = await createAgenda();
  const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
  const originalList = renderer.root.findByProps({ testID: "calendar-event-list" });
  expect(panel.props.style.position).toBeUndefined();
  act(() => renderer.root.findByProps({ accessibilityLabel: "Recolher calendário" }).props.onPress());
  expect(originalList.props.scrollEnabled).toBe(true);
  expect(renderer.root.findAllByType(Text).map(node => node.props.children)).toContain("Aula 7");
  act(() => renderer.root.findByProps({ accessibilityLabel: "Expandir calendário" }).props.onPress());
  expect(originalList.props.scrollEnabled).toBe(false);
  expect(renderer.root.findByProps({ testID: "calendar-event-list" })).toBe(originalList);
  act(() => renderer.unmount());
});
it("keeps desktop events scrollable without the mobile handle", async () => {
  const renderer = await createAgenda(false);
  expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Recolher calendário" })).toHaveLength(0);
  act(() => renderer.unmount());
});
it("uses half finger gain while folding without moving an overlay", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const originalList = renderer.root.findByProps({ testID: "calendar-event-list" });
    const foldHeight = () => renderer.root.findByType(CalendarFold).props.progress.interpolate({ inputRange: [0, 1], outputRange: [264, 44] }).__getValue();
    const target = { setPointerCapture: jest.fn() };
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: target, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    act(() => panel.props.onPointerDown(pointer(400)));
    expect(target.setPointerCapture).not.toHaveBeenCalled();
    act(() => panel.props.onPointerMove(pointer(370)));
    expect(foldHeight()).toBeCloseTo(249);
    act(() => panel.props.onPointerMove(pointer(340)));
    expect(foldHeight()).toBeCloseTo(234);
    act(() => panel.props.onPointerMove(pointer(-60)));
    expect(foldHeight()).toBeCloseTo(44);
    act(() => panel.props.onPointerUp());
    expect(originalList.props.scrollEnabled).toBe(true);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" })).toBe(originalList);
    const click = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    act(() => panel.props.onClickCapture(click));
    expect(click.stopPropagation).toHaveBeenCalled();
    const bar = renderer.root.findByProps({ accessibilityLabel: "Expandir calendário" });
    act(() => bar.props.onPointerDown(pointer(400)));
    act(() => bar.props.onPointerMove(pointer(460)));
    expect(foldHeight()).toBeCloseTo(74);
    act(() => bar.props.onPointerMove(pointer(860)));
    expect(foldHeight()).toBeCloseTo(264);
    act(() => bar.props.onPointerUp(pointer(860)));
    expect(originalList.props.scrollEnabled).toBe(false);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});
it("uses position for a slow release and direction for a quick flick", () => {
  expect(sheetStop(0.2, 0)).toBe(false);
  expect(sheetStop(0.7, 0)).toBe(true);
  expect(sheetStop(0.2, -0.8)).toBe(true);
  expect(sheetStop(0.8, 0.8)).toBe(false);
});
it("folds the calendar incrementally with the wheel", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    expect(wheelNode.addEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    const first = dispatchWheel(20);
    expect(first.preventDefault).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBeCloseTo(10 / 220);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(false);
    dispatchWheel(240);
    act(() => jest.advanceTimersByTime(400));
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("transfers a desktop crossing wheel remainder to the list and back to the month", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(false);
    const progress = () => renderer.root.findByType(CalendarFold).props.progress.__getValue();
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    expect(renderer.root.findByProps({ testID: "calendar-event-sheet" }).props.onWheel).toBeUndefined();
    expect(renderer.root.findByProps({ testID: "calendar-event-sheet" }).props.onPointerDown).toBeUndefined();
    const crossing = dispatchWheel(520);
    expect(progress()).toBe(1);
    expect(crossing.preventDefault).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(150));
    expect(dispatchWheel(20).preventDefault).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(100);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } }));
    expect(dispatchWheel(-180).preventDefault).toHaveBeenCalledTimes(1);
    expect(progress()).toBeCloseTo(190 / 220);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(0);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(dispatchWheel(-30).preventDefault).toHaveBeenCalledTimes(1);
    expect(progress()).toBeCloseTo(175 / 220);
    dispatchWheel(-600);
    expect(progress()).toBe(0);
    expect(dispatchWheel(-20).preventDefault).not.toHaveBeenCalled();
  } finally {
    if (renderer) act(() => renderer.unmount());
    expect(wheelNode.removeEventListener).toHaveBeenCalledWith("wheel", expect.any(Function));
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("normalizes wheel units and keeps rapid direction changes incremental", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(false);
    const progress = () => renderer.root.findByType(CalendarFold).props.progress.__getValue();
    dispatchWheel(2, { deltaMode: 1 });
    expect(progress()).toBeCloseTo(16 / 220);
    dispatchWheel(-12);
    expect(progress()).toBeCloseTo(10 / 220);
    dispatchWheel(0.5, { deltaMode: 2 });
    expect(progress()).toBeCloseTo(92.5 / 220);
    for (const event of [dispatchWheel(0), dispatchWheel(30, { ctrlKey: true }), dispatchWheel(5, { deltaX: 30 }), dispatchWheel(10, { cancelable: false })]) expect(event.preventDefault).not.toHaveBeenCalled();
    expect(progress()).toBeCloseTo(92.5 / 220);
    act(() => jest.advanceTimersByTime(150));
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("attaches to a target mounted after loading and cleans up without duplicate listeners", () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const wheel = jest.fn();
  wheelNode.addEventListener.mockClear(); wheelNode.removeEventListener.mockClear();
  function LateTarget({ mounted }: { mounted: boolean }) {
    const target = useRef<View | null>(null);
    useLayoutEffect(() => { target.current = mounted ? wheelNode as unknown as View : null; }, [mounted]);
    useCalendarWheel(target, wheel);
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(React.createElement(LateTarget, { mounted: false })); });
    expect(wheelNode.addEventListener).not.toHaveBeenCalled();
    act(() => renderer.update(React.createElement(LateTarget, { mounted: true })));
    expect(wheelNode.addEventListener).toHaveBeenCalledTimes(1);
    act(() => renderer.update(React.createElement(LateTarget, { mounted: true })));
    expect(wheelNode.addEventListener).toHaveBeenCalledTimes(1);
    act(() => renderer.update(React.createElement(LateTarget, { mounted: false })));
    expect(wheelNode.removeEventListener).toHaveBeenCalledTimes(1);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});

it("cancels a pending wheel stop when a pointer drag starts before the idle timeout", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    dispatchWheel(40);
    act(() => jest.advanceTimersByTime(50));
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() });
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => panel.props.onPointerMove(pointer(370)));
    const progress = renderer.root.findByType(CalendarFold).props.progress;
    expect(progress.__getValue()).toBeCloseTo(35 / 220);
    act(() => jest.advanceTimersByTime(500));
    expect(progress.__getValue()).toBeCloseTo(35 / 220);
    expect(renderer.root.findByType(CalendarEventSheet).props.motion.interacting).toBe(true);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(false);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("uses one settle animation and ignores its old completion after a new drag", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const completions: ((result: { finished: boolean }) => void)[] = [];
  const timing = jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: callback => { if (callback) completions.push(callback); }, stop: jest.fn(), reset: jest.fn() }));
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    timing.mockClear();
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() });
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => panel.props.onPointerMove(pointer(250)));
    act(() => panel.props.onPointerUp());
    expect(timing).toHaveBeenCalledTimes(1);
    expect(completions).toHaveLength(1);
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => panel.props.onPointerMove(pointer(430)));
    const progress = renderer.root.findByType(CalendarFold).props.progress;
    const current = progress.__getValue();
    act(() => completions[0]({ finished: true }));
    expect(progress.__getValue()).toBe(current);
    expect(renderer.root.findByType(CalendarEventSheet).props.motion.interacting).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    timing.mockRestore();
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});

it("enables the mobile list at the endpoint before the next wheel and keeps rapid inversions incremental", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    const progress = () => renderer.root.findByType(CalendarFold).props.progress.__getValue();
    dispatchWheel(520);
    expect(progress()).toBe(1);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
    expect(dispatchWheel(20).preventDefault).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(100);
    dispatchWheel(-100);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(0);
    let distance = 220;
    for (const delta of [-20, 10, -30, 15, -60, 25, -40, 30, -50]) {
      dispatchWheel(delta);
      distance += delta * 0.5;
      expect(progress()).toBeCloseTo(distance / 220);
      act(() => jest.advanceTimersByTime(10));
    }
    dispatchWheel(-600);
    expect(progress()).toBe(0);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(false);
    act(() => jest.advanceTimersByTime(500));
    expect(progress()).toBe(0);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("accumulates small wheel steps separated by 200ms and settles only after the idle pause", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda();
    const progress = () => renderer.root.findByType(CalendarFold).props.progress.__getValue();
    for (let step = 1; step <= 24; step += 1) {
      dispatchWheel(12);
      expect(progress()).toBeCloseTo(step * 6 / 220);
      act(() => jest.advanceTimersByTime(200));
      expect(progress()).toBeCloseTo(step * 6 / 220);
    }
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(false);
    act(() => jest.advanceTimersByTime(600));
    expect(progress()).toBe(1);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("keeps quick creation outside the scrolling list and the drag target", async () => {
 const renderer = await createAgenda();
 expect(renderer.root.findByProps({ testID: "quick-add-footer" })).toBeTruthy();
 expect(renderer.root.findByProps({ testID: "calendar-event-list" }).findAllByProps({ testID: "quick-add-footer" })).toHaveLength(0);
 expect(renderer.root.findByProps({ testID: "calendar-event-sheet" }).findAllByProps({ testID: "quick-add-footer" })).toHaveLength(0);
 act(() => renderer.unmount());
});

it("returns pointer control to the month in the same drag and reverses without a new touch", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(true, 200, true);
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() });
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 60 } } }));
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => panel.props.onPointerMove(pointer(500)));
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBeCloseTo(180 / 200);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(0);
    act(() => panel.props.onPointerMove(pointer(450)));
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBe(1);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(10);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});

it("caps list offset at 500, reverses immediately after saturation and clamps shrinking content", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(true, 200, true);
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() });
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 500 } } }));
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => panel.props.onPointerMove(pointer(-600)));
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(500);
    expect(renderer.root.findByType(CalendarEventSheet).props.motion.interacting).toBe(false);
    act(() => panel.props.onPointerMove(pointer(-500)));
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(400);
    act(() => list.props.onContentSizeChange(350, 630));
    act(() => panel.props.onPointerMove(pointer(-510)));
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(300);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});

it("keeps the month collapsed when releasing a quick downward drag inside the list", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(true, 200, true);
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() });
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } }));
    act(() => panel.props.onPointerDown(pointer(400)));
    act(() => jest.advanceTimersByTime(5));
    act(() => panel.props.onPointerMove(pointer(500)));
    act(() => panel.props.onPointerUp());
    act(() => jest.advanceTimersByTime(600));
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBe(1);
    expect(renderer.root.findByType(CalendarEventSheet).props.offsetRef.current).toBe(100);
    expect(list.props.scrollEnabled).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("uses fresh DOM dimensions for crossing remainder and ignores a backlogged scroll snapshot", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(false, 184);
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    const sheet = renderer.root.findByType(CalendarEventSheet);
    // An old layout callback can combine a previous height with current progress.
    act(() => list.props.onLayout({ nativeEvent: { layout: { height: 1000 } } }));
    const node = { clientHeight: 200, scrollHeight: 495, scrollTop: 0 };
    const scrollTo = jest.fn(({ y }: { y: number }) => { node.scrollTop = y; });
    sheet.props.listRef.current = { getScrollableNode: () => node, scrollTo } as unknown as ScrollView;
    dispatchWheel(400);
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBe(1);
    expect(sheet.props.offsetRef.current).toBe(32);
    expect(node.scrollTop).toBe(32);
    node.clientHeight = 384;
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(sheet.props.offsetRef.current).toBe(32);
    dispatchWheel(200);
    expect(node.scrollTop).toBe(111);
    node.scrollHeight = 450;
    dispatchWheel(20);
    expect(sheet.props.offsetRef.current).toBe(66);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  }
});

it("resets list offset when explicitly opening the month and starts the next wheel at fold zero", async () => {
  jest.useFakeTimers();
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    renderer = await createAgenda(true, 200, true);
    const list = renderer.root.findByProps({ testID: "calendar-event-list" });
    const sheet = renderer.root.findByType(CalendarEventSheet);
    const node = { clientHeight: 330, scrollHeight: 830, scrollTop: 100 };
    const scrollTo = jest.fn(({ y }: { y: number }) => { node.scrollTop = y; });
    sheet.props.listRef.current = { getScrollableNode: () => node, scrollTo } as unknown as ScrollView;
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }));
    act(() => renderer.root.findByProps({ accessibilityLabel: "Expandir calendário" }).props.onPress());
    act(() => jest.advanceTimersByTime(600));
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    expect(node.scrollTop).toBe(0);
    expect(sheet.props.offsetRef.current).toBe(0);
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBe(0);
    node.clientHeight = 130;
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }));
    dispatchWheel(20);
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBeCloseTo(10 / 200);
    expect(sheet.props.offsetRef.current).toBe(0);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});

it("does not toggle back when the handle releases a click after dragging", async () => {
 const original = Platform.OS;
 Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
 let renderer!: TestRenderer.ReactTestRenderer;
 try {
  renderer = await createAgenda();
  const bar = renderer.root.findByProps({ accessibilityLabel: "Recolher calendário" });
  const pointer = (clientY: number) => ({ pointerId: 1, clientY, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn(), stopPropagation: jest.fn() });
  act(() => bar.props.onPointerDown(pointer(400)));
  act(() => bar.props.onPointerMove(pointer(160)));
  act(() => bar.props.onPointerUp(pointer(160)));
  const collapsed = renderer.root.findByProps({ accessibilityLabel: "Expandir calendário" });
  act(() => collapsed.props.onPress());
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Expandir calendário" })).not.toHaveLength(0);
 } finally { if (renderer) act(() => renderer.unmount()); Object.defineProperty(Platform, "OS", { configurable: true, value: original }); }
});
