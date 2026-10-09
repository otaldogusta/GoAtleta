/** @jest-environment jsdom */
import React from "react";
import { act, render } from "@testing-library/react-native";
import { Keyboard, Modal, Platform, View } from "react-native";
import { ModalSheet } from "../ModalSheet";

jest.mock("../web-portal", () => ({ createWebPortal: (children: React.ReactNode) => children }));
jest.mock("../use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

it("dismisses an open native keyboard before requesting draft discard", () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  const visible = jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
  const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
  const close = jest.fn();
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  try {
    const screen = render(React.createElement(ModalSheet, { visible: true, avoidKeyboard: true, onClose: close, cardStyle: {} } as React.ComponentProps<typeof ModalSheet>, React.createElement(View)));
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    visible.mockReturnValue(false);
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(close).toHaveBeenCalledTimes(1);
    screen.unmount();
  } finally {
    visible.mockRestore(); dismiss.mockRestore(); scrollTo.mockRestore();
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
  }
});

it("keeps the opt-in sheet inside the visible keyboard viewport and cleans listeners", () => {
  const originalOS = Platform.OS;
  const originalViewport = window.visualViewport;
  const listeners = new Map<string, () => void>();
  const viewport = { height: 844, offsetTop: 0, addEventListener: jest.fn((name, fn) => listeners.set(name, fn)), removeEventListener: jest.fn() };
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  try {
    const screen = render(React.createElement(ModalSheet, { visible: true, avoidKeyboard: true, position: "center", onClose: () => {}, cardStyle: {} } as React.ComponentProps<typeof ModalSheet>, React.createElement(View)));
    viewport.height = 380;
    viewport.offsetTop = 30;
    act(() => listeners.get("resize")?.());
    expect(screen.UNSAFE_getAllByType(View).some(node => node.props.style?.height === 380 && node.props.style?.top === 30)).toBe(true);
    screen.unmount();
    expect(viewport.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(viewport.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
  } finally {
    scrollTo.mockRestore();
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: originalViewport });
  }
});
