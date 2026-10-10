import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text, Pressable, Platform } from "react-native";
import { StaffInviteEntryProvider, useStaffInviteEntry } from "../staff-invite-entry";

let mockPathname = "/staff-invite";
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));
const originalWindow = global.window;
const originalOS = Platform.OS;
const hash = `#code=TEST-CODE&token_hash=${"a".repeat(64)}&type=magiclink`;
function Entry() {
  const { proof, clear } = useStaffInviteEntry();
  return React.createElement(Pressable, { onPress: clear }, React.createElement(Text, null, proof?.code ?? "unavailable"));
}
function Harness({ mounted = true }: { mounted?: boolean }) {
  return React.createElement(StaffInviteEntryProvider, null, mounted ? React.createElement(Entry) : null);
}
beforeEach(() => {
  mockPathname = "/staff-invite";
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  Object.defineProperty(global, "window", { configurable: true, value: { location: { pathname: mockPathname, hash } } });
});
afterEach(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
  Object.defineProperty(global, "window", { configurable: true, value: originalWindow });
});
it("preserves proof through session-gate remounts after URL cleanup", () => {
  const view = render(React.createElement(Harness));
  expect(screen.getByText("TEST-CODE")).toBeTruthy();
  window.location.hash = "";
  view.rerender(React.createElement(Harness, { mounted: false }));
  view.rerender(React.createElement(Harness));
  expect(screen.getByText("TEST-CODE")).toBeTruthy();
});
it("clears proof on completion and does not restore it from the cleaned URL", () => {
  const view = render(React.createElement(Harness));
  window.location.hash = "";
  fireEvent.press(screen.getByText("TEST-CODE"));
  view.rerender(React.createElement(Harness, { mounted: false }));
  view.rerender(React.createElement(Harness));
  expect(screen.getByText("unavailable")).toBeTruthy();
});
it("does not retain credentials when leaving and returning to a bare route", () => {
  const view = render(React.createElement(Harness));
  window.location.hash = "";
  mockPathname = "/login";
  view.rerender(React.createElement(Harness));
  mockPathname = "/staff-invite";
  view.rerender(React.createElement(Harness));
  expect(screen.getByText("unavailable")).toBeTruthy();
});
it("does not treat a bare code as authentication proof", () => {
  window.location.hash = "#code=TEST-CODE";
  render(React.createElement(Harness));
  expect(screen.getByText("unavailable")).toBeTruthy();
});
