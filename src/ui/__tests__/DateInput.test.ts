import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Platform, TextInput } from "react-native";
import {
  DateInput,
  formatDateInput,
  formatShortDate,
  parseDateInputToIso,
} from "../DateInput";

jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {}, mode: "dark" }) }));
jest.mock("../icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../Pressable", () => ({ Pressable: jest.requireActual<typeof import("react-native")>("react-native").Pressable }));


describe("DateInput date conversion", () => {
  it("formats the stored local ISO date for Brazilian display", () => {
    expect(formatShortDate("2026-07-01")).toBe("01/07/2026");
  });

  it("keeps a full replacement stable while the user types", () => {
    expect(formatDateInput("29072026")).toBe("29/07/2026");
  });

  it("converts a valid Brazilian date back to the local ISO key", () => {
    expect(parseDateInputToIso("29/07/2026")).toBe("2026-07-29");
  });

  it("does not commit incomplete or impossible dates", () => {
    expect(parseDateInputToIso("29/07/202")).toBeNull();
    expect(parseDateInputToIso("31/02/2026")).toBeNull();
  });
});


describe("DateInput editing and calendar", () => {
  let view: ReactTestRenderer;
  const originalPlatform = Platform.OS;
  const change = jest.fn();
  const showPicker = jest.fn();
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    change.mockClear(); showPicker.mockClear();
    act(() => { view = create(React.createElement(DateInput, {
      value: "2026-10-01", onChange: change, accessibilityLabel: "Data inicial",
    }), { createNodeMock: (element) => element.type === "input" ? { showPicker } : null }); });
  });
  afterEach(() => {
    act(() => view.unmount());
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  });
  it("preserves an incomplete month edit until blur, then commits the date", () => {
    act(() => view.root.findByType(TextInput).props.onChangeText("01/1/2026"));
    expect(view.root.findByType(TextInput).props.value).toBe("01/1/2026");
    expect(change).not.toHaveBeenCalled();
    act(() => view.root.findByType(TextInput).props.onChangeText("01/11/2026"));
    act(() => view.root.findByType(TextInput).props.onBlur({}));
    expect(change).toHaveBeenCalledWith("2026-11-01");
  });
  it("opens the browser calendar and accepts a selected date", () => {
    act(() => view.root.findByProps({ accessibilityLabel: "Abrir calendário: Data inicial" }).props.onPress());
    expect(showPicker).toHaveBeenCalledTimes(1);
    act(() => view.root.findByType("input").props.onChange({ currentTarget: { value: "2026-09-15" } }));
    expect(change).toHaveBeenCalledWith("2026-09-15");
    expect(view.root.findByType(TextInput).props.value).toBe("15/09/2026");
  });
  it("preserves an explicitly supplied calendar and synchronizes external changes", () => {
    const open = jest.fn();
    act(() => view.update(React.createElement(DateInput, { value: "2026-12-25", onChange: change, onOpenCalendar: open })));
    expect(view.root.findByType(TextInput).props.value).toBe("25/12/2026");
    expect(view.root.findAllByType("input")).toHaveLength(0);
    act(() => view.root.findByProps({ accessibilityLabel: "Abrir calendário: Selecione a data" }).props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    expect(showPicker).not.toHaveBeenCalled();
  });
  it("keeps DOM calendar controls out of native rendering", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    act(() => view.update(React.createElement(DateInput, { value: "2026-10-01", onChange: change })));
    expect(view.root.findAllByType("input")).toHaveLength(0);
  });
  it("restores impossible dates and formats a pasted numeric date only on commit", () => {
    act(() => view.root.findByType(TextInput).props.onChangeText("31/02/2026"));
    act(() => view.root.findByType(TextInput).props.onBlur({}));
    expect(change).not.toHaveBeenCalled();
    expect(view.root.findByType(TextInput).props.value).toBe("01/10/2026");
    act(() => view.root.findByType(TextInput).props.onChangeText("15112026"));
    act(() => view.root.findByType(TextInput).props.onSubmitEditing());
    expect(change).toHaveBeenCalledWith("2026-11-15");
  });
});
