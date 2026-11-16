import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SettingsRow } from "../SettingsRow";

jest.mock("../icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {
  card: "#162238", border: "#2A3951", text: "#F8FAFC", muted: "#94A3B8",
  secondaryBg: "#101827",
} }) }));

test("announces and updates a setting's on/off state without changing its action", () => {
  const onPress = jest.fn();
  const props = { icon: "darkMode" as const, iconBg: "transparent", label: "Modo escuro", onPress };
  const screen = render(React.createElement(SettingsRow, { ...props, checked: false }));
  fireEvent.press(screen.getByRole("switch", { name: "Modo escuro", checked: false }));
  expect(onPress).toHaveBeenCalledTimes(1);
  screen.rerender(React.createElement(SettingsRow, { ...props, checked: true }));
  expect(screen.getByRole("switch", { name: "Modo escuro", checked: true })).toBeTruthy();
});

test("keeps navigation as a button and noninteractive information out of controls", () => {
  const props = { icon: "nfc" as const, iconBg: "transparent", label: "Presença NFC" };
  const onPress = jest.fn();
  const screen = render(React.createElement(SettingsRow, { ...props, onPress }));
  fireEvent.press(screen.getByRole("button", { name: "Presença NFC" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("switch")).toBeNull();
  screen.rerender(React.createElement(SettingsRow, props));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("Presença NFC")).toBeTruthy();
});

test("forwards the controlled checked state to the web renderer", () => {
  jest.replaceProperty(Platform, "OS", "web");
  try {
    const props = { icon: "darkMode" as const, iconBg: "transparent", label: "Modo escuro", onPress: jest.fn() };
    const screen = render(React.createElement(SettingsRow, { ...props, checked: false }));
    expect(screen.getByRole("button").props["aria-pressed"]).toBe(false);
    screen.rerender(React.createElement(SettingsRow, { ...props, checked: true }));
    expect(screen.getByRole("button").props["aria-pressed"]).toBe(true);
  } finally {
    jest.restoreAllMocks();
  }
});
