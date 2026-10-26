import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderToString } from "react-dom/server";
import { NavigationContext } from "expo-router/react-navigation";
import { Animated, Modal, Platform, TextInput } from "react-native";

import { ModalSheet } from "../ModalSheet";
import { createWebPortal } from "../web-portal";

jest.mock("../web-portal", () => ({ createWebPortal: jest.fn((children: React.ReactNode) => children) }));
jest.mock("../use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const descriptor = (target: object, key: PropertyKey) => Object.getOwnPropertyDescriptor(target, key);
const originals = {
  document: descriptor(globalThis, "document"), platform: descriptor(Platform, "OS"),
  scrollY: descriptor(window, "scrollY"), innerWidth: descriptor(window, "innerWidth"),
  getComputedStyle: descriptor(window, "getComputedStyle"), scrollTo: descriptor(window, "scrollTo"),
};
const restore = (target: object, key: PropertyKey, previous: PropertyDescriptor | undefined) => {
  if (previous) Object.defineProperty(target, key, previous); else Reflect.deleteProperty(target, key);
};
const set = (target: object, key: PropertyKey, value: unknown) => Object.defineProperty(target, key, { configurable: true, writable: true, value });
const navigation = (initial = true) => {
  let focused = initial;
  const handlers = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  const cleanups: jest.Mock[] = [];
  const nav = {
    isFocused: jest.fn(() => focused),
    addListener: jest.fn((event: "focus" | "blur", notify: () => void) => {
      handlers[event].add(notify);
      const cleanup = jest.fn(() => { handlers[event].delete(notify); }); cleanups.push(cleanup); return cleanup;
    }),
  };
  return { nav, handlers, cleanups, emit(value: boolean) {
    focused = value; for (const notify of [...handlers[value ? "focus" : "blur"]]) notify();
  } };
};
type Nav = ReturnType<typeof navigation>;
const close = jest.fn();
let view: ReactTestRenderer | undefined;
let body: { style: Record<string, string> };
let html: { style: Record<string, string>; clientWidth: number };
let root: { style: Record<string, string> };
let keydowns: Set<(event: { key: string; preventDefault: () => void }) => void>;
let timings: { config: { toValue: unknown; duration?: number }; stop: jest.Mock; finish?: (result: { finished: boolean }) => void }[];
const initialBody = {
  overflow: "auto", overscrollBehavior: "contain", position: "relative", top: "3px", width: "80%",
  boxSizing: "content-box", scrollbarGutter: "stable", paddingRight: "4px",
};
const initialHtml = { overflow: "scroll", overscrollBehavior: "auto" };
const initialRoot = { overflow: "auto", height: "90%", overscrollBehavior: "contain" };
function Caller({ visible = true }: { visible?: boolean }) {
  const [title, setTitle] = useState("Original");
  return React.createElement(ModalSheet, { visible, onClose: close, cardStyle: {} },
    React.createElement(TextInput, { testID: "retained-draft", value: title, onChangeText: setTitle }));
}
const contents = (nav?: Nav, visible = true) => nav
  ? React.createElement(NavigationContext.Provider, { value: nav.nav as never }, React.createElement(Caller, { visible }))
  : React.createElement(Caller, { visible });
const mount = (nav?: Nav, visible = true) => act(() => { view = create(contents(nav, visible)); });
const update = (nav?: Nav, visible = true) => act(() => view!.update(contents(nav, visible)));
const emit = (nav: Nav, focused: boolean) => act(() => nav.emit(focused));
const escape = () => {
  const event = { key: "Escape", preventDefault: jest.fn() };
  act(() => { for (const handler of [...keydowns]) handler(event); }); return event;
};
const expectUnlocked = () => {
  expect(body.style).toEqual(initialBody); expect(html.style).toEqual(initialHtml); expect(root.style).toEqual(initialRoot);
};

beforeEach(() => {
  jest.clearAllMocks(); timings = []; keydowns = new Set();
  set(Platform, "OS", "web"); body = { style: { ...initialBody } };
  html = { style: { ...initialHtml }, clientWidth: 980 }; root = { style: { ...initialRoot } };
  set(globalThis, "document", {
    body, documentElement: html, getElementById: (id: string) => id === "root" ? root : null,
    addEventListener: jest.fn((name: string, handler: (event: { key: string; preventDefault: () => void }) => void) => {
      if (name === "keydown") keydowns.add(handler);
    }),
    removeEventListener: jest.fn((name: string, handler: (event: { key: string; preventDefault: () => void }) => void) => {
      if (name === "keydown") keydowns.delete(handler);
    }),
  });
  set(window, "scrollY", 42); set(window, "innerWidth", 1000);
  set(window, "getComputedStyle", jest.fn(() => ({ paddingRight: "4px" })));
  set(window, "scrollTo", jest.fn());
  jest.mocked(createWebPortal).mockImplementation(children => children);
  jest.spyOn(Animated, "timing").mockImplementation((_value, config) => {
    const entry = { config, stop: jest.fn(), finish: undefined as ((result: { finished: boolean }) => void) | undefined };
    timings.push(entry);
    return { start: jest.fn(callback => { entry.finish = callback; }), stop: entry.stop, reset: jest.fn() };
  });
});
afterEach(() => {
  act(() => { view?.unmount(); view = undefined; }); jest.restoreAllMocks();
  restore(globalThis, "document", originals.document); restore(Platform, "OS", originals.platform);
  restore(window, "scrollY", originals.scrollY); restore(window, "innerWidth", originals.innerWidth);
  restore(window, "getComputedStyle", originals.getComputedStyle); restore(window, "scrollTo", originals.scrollTo);
});

test("a hidden sheet does not subscribe to navigation or create DOM effects", () => {
  const nav = navigation(false); mount(nav, false);
  expect(nav.nav.addListener).not.toHaveBeenCalled(); expect(nav.nav.isFocused).not.toHaveBeenCalled();
  expect(view!.toJSON()).toBeNull(); expect(createWebPortal).not.toHaveBeenCalled();
  expect(timings).toHaveLength(0); expect(keydowns.size).toBe(0); expectUnlocked();
});

test("a focused visible sheet subscribes once to focus and blur, acquires its locks and handles Escape", () => {
  const nav = navigation(); mount(nav);
  expect(nav.nav.addListener.mock.calls.map(([event]) => event)).toEqual(["focus", "blur"]);
  expect(body.style.overflow).toBe("hidden"); expect(html.style.overflow).toBe("hidden");
  expect(root.style.height).toBe("100%"); expect(body.style.paddingRight).toBe("24px");
  expect(keydowns.size).toBe(1); expect(escape().preventDefault).toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

test("a retained but initially unfocused sheet subscribes without opening a portal or locking the page", () => {
  const nav = navigation(false); mount(nav);
  expect(nav.nav.addListener).toHaveBeenCalledTimes(2); expect(view!.toJSON()).toBeNull();
  expect(createWebPortal).not.toHaveBeenCalled(); expect(keydowns.size).toBe(0); expect(close).not.toHaveBeenCalled(); expectUnlocked();
});

test("blur removes the portal immediately, releases Escape and scroll locks, and preserves the caller draft on refocus", () => {
  const nav = navigation(); mount(nav);
  act(() => view!.root.findByProps({ testID: "retained-draft" }).props.onChangeText("Rascunho local"));
  emit(nav, false);
  expect(view!.toJSON()).toBeNull(); expectUnlocked(); expect(keydowns.size).toBe(0);
  expect(timings.filter(item => item.config.toValue === 0)).toHaveLength(0); escape(); expect(close).not.toHaveBeenCalled();
  emit(nav, true);
  expect(view!.root.findByProps({ testID: "retained-draft" }).props.value).toBe("Rascunho local");
  expect(body.style.overflow).toBe("hidden"); expect(keydowns.size).toBe(1);
  expect(nav.nav.addListener).toHaveBeenCalledTimes(2); expect(close).not.toHaveBeenCalled();
});

test("explicit hiding unsubscribes and preserves its normal 180 ms noninteractive exit", () => {
  const nav = navigation(); mount(nav); update(nav, false);
  expect(nav.cleanups).toHaveLength(2); nav.cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledTimes(1));
  expect(nav.handlers.focus.size + nav.handlers.blur.size).toBe(0); expect(keydowns.size).toBe(0); expectUnlocked();
  const exit = timings.find(item => item.config.toValue === 0)!; expect(exit.config.duration).toBe(180);
  expect(view!.root.findAll(node => node.props.pointerEvents === "none").length).toBeGreaterThan(0);
  act(() => exit.finish!({ finished: true })); expect(view!.toJSON()).toBeNull();
  update(nav, true); expect(nav.nav.addListener).toHaveBeenCalledTimes(4); expect(body.style.overflow).toBe("hidden");
});

test("unmount releases each subscription, animation and scroll state exactly once", () => {
  const nav = navigation(); mount(nav); const entering = timings[0];
  act(() => { view!.unmount(); view = undefined; });
  nav.cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledTimes(1)); expect(entering.stop).toHaveBeenCalledTimes(1);
  expect(keydowns.size).toBe(0); expectUnlocked(); expect(window.scrollTo).toHaveBeenCalledWith(0, 42);
  expect(close).not.toHaveBeenCalled();
});

test("replacing the navigation provider detaches the old emitter and follows only the new route", () => {
  const previous = navigation(); const next = navigation(); mount(previous); update(next);
  previous.cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledTimes(1)); expect(next.nav.addListener).toHaveBeenCalledTimes(2);
  emit(previous, false); expect(view!.toJSON()).not.toBeNull();
  emit(next, false); expect(view!.toJSON()).toBeNull(); expectUnlocked();
});

test("global confirmations outside NavigationContext keep their visible fallback and close interaction", () => {
  mount(); expect(view!.toJSON()).not.toBeNull(); expect(keydowns.size).toBe(1);
  expect(body.style.overflow).toBe("hidden"); escape(); expect(close).toHaveBeenCalledTimes(1);
});

test.each(["android", "ios"])("%s retains native visibility without reading or subscribing to route focus", platform => {
  set(Platform, "OS", platform); Reflect.deleteProperty(globalThis, "document");
  const nav = navigation(false); mount(nav);
  expect(view!.root.findByType(Modal).props.visible).toBe(true);
  expect(nav.nav.addListener).not.toHaveBeenCalled(); expect(nav.nav.isFocused).not.toHaveBeenCalled();
  expect(createWebPortal).not.toHaveBeenCalled(); expect(keydowns.size).toBe(0);
  act(() => view!.root.findByType(Modal).props.onRequestClose()); expect(close).toHaveBeenCalledTimes(1);
});

test("the last remaining global sheet keeps the page locked when a route-owned sheet blurs", () => {
  const nav = navigation();
  act(() => { view = create(React.createElement(React.Fragment, null, contents(nav), contents())); });
  expect(keydowns.size).toBe(2); emit(nav, false);
  expect(keydowns.size).toBe(1); expect(body.style.overflow).toBe("hidden");
  act(() => view!.update(React.createElement(React.Fragment, null, contents(nav), contents(undefined, false))));
  expectUnlocked(); expect(keydowns.size).toBe(0); expect(close).not.toHaveBeenCalled();
});

test("SSR uses the stable visible server snapshot without touching the client navigation emitter", () => {
  const nav = navigation(false); jest.mocked(createWebPortal).mockReturnValueOnce(null);
  expect(renderToString(contents(nav))).toBe("");
  expect(createWebPortal).toHaveBeenCalledTimes(1); expect(nav.nav.isFocused).not.toHaveBeenCalled();
  expect(nav.nav.addListener).not.toHaveBeenCalled(); expect(keydowns.size).toBe(0); expect(timings).toHaveLength(0); expectUnlocked();
});
