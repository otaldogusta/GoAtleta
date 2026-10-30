import React, { useState } from "react";
import { AccessibilityInfo, Platform, ScrollView } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { CalendarTimePicker, CalendarTimeWheels } from "../CalendarTimePicker";

const mockModalVisibility = jest.fn();
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => { mockModalVisibility(visible); return visible ? children : null; } }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));

const eventAt = (index: number) => ({ nativeEvent: { contentOffset: { x: 0, y: index * 44 } } });
let scrollTo: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
  scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
  mockModalVisibility.mockClear();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

async function open(value = "09:00", callbacks: { onConfirm?: jest.Mock; onClose?: jest.Mock } = {}) {
  const confirm = callbacks.onConfirm ?? jest.fn(), close = callbacks.onClose ?? jest.fn();
  const view = render(React.createElement(CalendarTimePicker, { value, onConfirm: confirm, onClose: close }));
  await act(async () => {});
  const hours = view.getByTestId("time-wheel-Horas"), minutes = view.getByTestId("time-wheel-Minutos");
  fireEvent(hours, "contentSizeChange", 100, 3256);
  fireEvent(minutes, "contentSizeChange", 100, 8008);
  return { view, hours, minutes, confirm, close };
}

test("scroll selection is used immediately on confirmation, including reversed movement", async () => {
  const { view, hours, minutes, confirm } = await open();
  for (const value of [10, 18, 7, 17]) fireEvent.scroll(hours, eventAt(24 + value));
  fireEvent.scroll(minutes, eventAt(60 + 45));
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("17:45");
});

test("backward and forward loops retain one-minute precision without recentering during a drag", async () => {
  const { view, minutes, confirm } = await open("09:00");
  scrollTo.mockClear();
  fireEvent(minutes, "scrollBeginDrag", eventAt(60));
  fireEvent.scroll(minutes, eventAt(59));
  expect(view.getByLabelText("Minutos").props.accessibilityValue.now).toBe(59);
  act(() => jest.advanceTimersByTime(500));
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent(minutes, "scrollEndDrag", eventAt(59));
  fireEvent(minutes, "momentumScrollEnd", eventAt(59));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 119 * 44, animated: false });
  fireEvent.scroll(minutes, eventAt(120));
  fireEvent(minutes, "momentumScrollEnd", eventAt(120));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 60 * 44, animated: false });
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("09:00");
});

test("partial scroll snaps to a row before recentering and new movement cancels the pending settle", async () => {
  const { hours } = await open();
  scrollTo.mockClear();
  fireEvent.scroll(hours, eventAt(48.4));
  act(() => jest.advanceTimersByTime(119));
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent(hours, "scrollBeginDrag", eventAt(48.4));
  act(() => jest.advanceTimersByTime(200));
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent(hours, "scrollEndDrag", eventAt(48.4));
  fireEvent(hours, "momentumScrollEnd", eventAt(48.4));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 48 * 44, animated: true });
  fireEvent.scroll(hours, eventAt(48));
  fireEvent(hours, "momentumScrollEnd", eventAt(48));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 24 * 44, animated: false });
});

test("tapping a neighbor slides toward its nearest cycle instead of jumping", async () => {
  const { view, confirm } = await open("23:59");
  scrollTo.mockClear();
  fireEvent.press(view.getByLabelText("Hora 00"));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 48 * 44, animated: true });
  fireEvent.press(view.getByLabelText("Minuto 00"));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 120 * 44, animated: true });
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("00:00");
});

test.each([[0, 0, "00:00"], [23, 59, "23:59"]])("all hours and minutes are selectable: %s:%s", async (hour, minute, expected) => {
  const { view, confirm } = await open();
  fireEvent.press(view.getByLabelText(`Hora ${String(hour).padStart(2, "0")}`));
  fireEvent.press(view.getByLabelText(`Minuto ${String(minute).padStart(2, "0")}`));
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith(expected);
});

test("cancel never confirms temporary changes and reopening resets from the supplied value", async () => {
  const { view, confirm, close } = await open();
  fireEvent.press(view.getByLabelText("Hora 18"));
  fireEvent.press(view.getByLabelText("Cancelar horário"));
  expect(close).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
  view.rerender(React.createElement(CalendarTimePicker, { value: "09:00", visible: false, onConfirm: confirm, onClose: close }));
  expect(mockModalVisibility).toHaveBeenLastCalledWith(false);
  expect(view.queryByLabelText("Horas")).toBeNull();
  view.rerender(React.createElement(CalendarTimePicker, { value: "07:16", visible: true, onConfirm: confirm, onClose: close }));
  await act(async () => {});
  expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(7);
  expect(view.getByLabelText("Minutos").props.accessibilityValue.now).toBe(16);
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("07:16");
});

test("reduced motion keeps the same selection without animated tap scrolling", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  const { view, confirm } = await open();
  scrollTo.mockClear();
  fireEvent.press(view.getByLabelText("Hora 10"));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 34 * 44, animated: false });
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("10:00");
});

test("inline wheels report immediately and stay disabled while saving", async () => {
  const changed = jest.fn();
  function Controlled({ disabled = false }: { disabled?: boolean }) {
    const [value, setValue] = useState("09:00");
    return React.createElement(CalendarTimeWheels, { value, disabled, onChange: next => { changed(next); setValue(next); } });
  }
  const view = render(React.createElement(Controlled));
  await act(async () => {});
  fireEvent.press(view.getByLabelText("Minuto 01"));
  expect(changed).toHaveBeenLastCalledWith("09:01");
  expect(view.getByLabelText("Minutos").props.accessibilityValue.now).toBe(1);
  view.rerender(React.createElement(Controlled, { disabled: true }));
  changed.mockClear();
  fireEvent.press(view.getByLabelText("Minuto 02"));
  expect(changed).not.toHaveBeenCalled();
  expect(view.getByTestId("time-wheel-Minutos").props.scrollEnabled).toBe(false);
});

test("external controlled values realign the wheel without reporting a new edit", async () => {
  const changed = jest.fn();
  const view = render(React.createElement(CalendarTimeWheels, { value: "09:00", onChange: changed }));
  await act(async () => {});
  fireEvent(view.getByTestId("time-wheel-Horas"), "contentSizeChange", 100, 3256);
  fireEvent(view.getByTestId("time-wheel-Minutos"), "contentSizeChange", 100, 8008);
  scrollTo.mockClear();
  view.rerender(React.createElement(CalendarTimeWheels, { value: "14:37", onChange: changed }));
  expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(14);
  expect(view.getByLabelText("Minutos").props.accessibilityValue.now).toBe(37);
  expect(scrollTo).toHaveBeenCalledWith({ y: (24 + 14) * 44, animated: false });
  expect(scrollTo).toHaveBeenCalledWith({ y: (60 + 37) * 44, animated: false });
  expect(changed).not.toHaveBeenCalled();
});

test("web keyboard wraps the wheel, keeps clones out of tab order and exposes one logical label", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  const { view, confirm } = await open("00:00");
  const preventDefault = jest.fn();
  fireEvent(view.getByLabelText("Horas"), "keyDown", { key: "ArrowUp", preventDefault });
  expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(23);
  fireEvent(view.getByLabelText("Minutos"), "keyDown", { key: "ArrowUp", preventDefault });
  expect(view.getByLabelText("Minutos").props.accessibilityValue.now).toBe(59);
  expect(view.getAllByLabelText("Hora 09")).toHaveLength(1);
  expect(view.getByLabelText("Hora 09").props.tabIndex).toBe(-1);
  expect(view.getByTestId("time-wheel-Horas").props.tabIndex).toBe(-1);
  expect(view.getByLabelText("Horas").props.tabIndex).toBe(0);
  expect(view.getByLabelText("Minutos").props.tabIndex).toBe(0);
  fireEvent.press(view.getByLabelText("Confirmar horário"));
  expect(confirm).toHaveBeenCalledWith("23:59");
});
