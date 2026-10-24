import React, { useRef, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, Platform, ScrollView, View } from "react-native";
import { CalendarEventSheet } from "../CalendarEventSheet";
import { CalendarFold } from "../CalendarFold";
import { sheetStop, useEventSheetGesture } from "../useEventSheetGesture";
// These tests exercise the web pointer/wheel adapter. Native worklets run on
// the device; their distance contract is covered separately in calendar-drag.
jest.mock("../useNativeCalendarGesture", () => ({ useNativeCalendarGesture: () => null }));
jest.mock("../NativeCalendarFold", () => ({ NativeCalendarFold: () => null }));
jest.mock("../NativeCalendarEvents", () => ({ NativeCalendarEvents: () => null }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { card: "#172235", border: "#334155", text: "#fff", muted: "#94a3b8" } }) }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function Agenda({ mobile = true }: { mobile?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const motion = useEventSheetGesture(collapsed, setCollapsed, 220, listRef, offsetRef);
  return React.createElement(View, null,
    React.createElement(CalendarFold, { rows: Array.from({ length: 6 }, (_, i) => React.createElement(Text, { key: i }, `Semana ${i}`)), selectedRow: 3, collapsed, progress: motion.progress, rowHeight: 44 }),
    React.createElement(CalendarEventSheet, { mobile, collapsed, onCollapsedChange: setCollapsed, motion, listRef, offsetRef, header: React.createElement(Text, null, "24 de outubro") }, Array.from({ length: 7 }, (_, i) => React.createElement(Text, { key: i }, `Aula ${i + 1}`))));
}
async function createAgenda(mobile = true) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Agenda, { mobile })); });
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
it("shrinks the month by exactly the drag distance without moving an overlay", async () => {
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
    expect(foldHeight()).toBeCloseTo(234);
    act(() => panel.props.onPointerMove(pointer(340)));
    expect(foldHeight()).toBeCloseTo(204);
    act(() => panel.props.onPointerMove(pointer(170)));
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
    expect(foldHeight()).toBeCloseTo(104);
    act(() => bar.props.onPointerMove(pointer(630)));
    expect(foldHeight()).toBeCloseTo(264);
    act(() => bar.props.onPointerUp(pointer(630)));
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
    const panel = renderer.root.findByProps({ testID: "calendar-event-sheet" });
    act(() => panel.props.onWheel({ deltaY: 20 }));
    expect(renderer.root.findByType(CalendarFold).props.progress.__getValue()).toBeCloseTo(20 / 220);
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(false);
    act(() => panel.props.onWheel({ deltaY: 110 }));
    act(() => jest.advanceTimersByTime(150));
    expect(renderer.root.findByProps({ testID: "calendar-event-list" }).props.scrollEnabled).toBe(true);
  } finally {
    if (renderer) act(() => renderer.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
    jest.useRealTimers();
  }
});
