import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderToString } from "react-dom/server";
import { NavigationContext } from "expo-router/react-navigation";
import { Animated, Dimensions, Modal, Platform, StyleSheet, TextInput, type StyleProp, type ViewStyle } from "react-native";

import { ModalSheet } from "../ModalSheet";
import { createWebPortal } from "../web-portal";

jest.mock("../web-portal", () => ({ createWebPortal: jest.fn((children: React.ReactNode) => children) }));
jest.mock("../use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const descriptor = (target: object, key: PropertyKey) => Object.getOwnPropertyDescriptor(target, key);
const originals = {
  nativeDimensions: Dimensions.get("window"),
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
function Caller({ visible = true, reduceMotion = false, onExited }: { visible?: boolean; reduceMotion?: boolean; onExited?: () => void }) {
  const [title, setTitle] = useState("Original");
  return React.createElement(ModalSheet, { visible, reduceMotion, onExited, onClose: close, cardStyle: {} },
    React.createElement(TextInput, { testID: "retained-draft", value: title, onChangeText: setTitle }));
}
const contents = (nav?: Nav, visible = true, reduceMotion = false, onExited?: () => void) => nav
  ? React.createElement(NavigationContext.Provider, { value: nav.nav as never }, React.createElement(Caller, { visible, reduceMotion, onExited }))
  : React.createElement(Caller, { visible, reduceMotion, onExited });
const mount = (nav?: Nav, visible = true, reduceMotion = false, onExited?: () => void) => act(() => { view = create(contents(nav, visible, reduceMotion, onExited)); });
const update = (nav?: Nav, visible = true, reduceMotion = false, onExited?: () => void) => act(() => view!.update(contents(nav, visible, reduceMotion, onExited)));
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
  Dimensions.set({ window: { width: 1000, height: 800, scale: 1, fontScale: 1 } });
  jest.mocked(createWebPortal).mockImplementation(children => children);
  jest.spyOn(Animated, "timing").mockImplementation((_value, config) => {
    const entry = { config, stop: jest.fn(), finish: undefined as ((result: { finished: boolean }) => void) | undefined };
    timings.push(entry);
    return { start: jest.fn(callback => { entry.finish = callback; }), stop: entry.stop, reset: jest.fn() };
  });
});
afterEach(() => {
  act(() => { view?.unmount(); view = undefined; }); jest.restoreAllMocks();
  Dimensions.set({ window: originals.nativeDimensions });
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
  expect(timings[0].config.duration).toBe(240);
  expect(nav.cleanups).toHaveLength(2); nav.cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledTimes(1));
  expect(nav.handlers.focus.size + nav.handlers.blur.size).toBe(0); expect(keydowns.size).toBe(0); expectUnlocked();
  const exit = timings.find(item => item.config.toValue === 0)!; expect(exit.config.duration).toBe(180);
  expect(view!.root.findAll(node => node.props.pointerEvents === "none").length).toBeGreaterThan(0);
  act(() => exit.finish!({ finished: true })); expect(view!.toJSON()).toBeNull();
  update(nav, true); expect(nav.nav.addListener).toHaveBeenCalledTimes(4); expect(body.style.overflow).toBe("hidden");
});

test("reduced motion opens fully visible, closes without motion and resets on reopening", () => {
  const nav = navigation(); mount(nav, true, true);
  const progress = jest.mocked(Animated.timing).mock.calls[0][0] as unknown as { __getValue: () => number };
  expect(progress.__getValue()).toBe(1);
  expect(timings[0].config).toMatchObject({ toValue: 1, duration: 0 });
  expect(body.style.overflow).toBe("hidden");
  update(nav, false, true);
  expect(progress.__getValue()).toBe(0);
  const exit = timings.find(item => item.config.toValue === 0)!;
  expect(exit.config.duration).toBe(0);
  expectUnlocked();
  act(() => exit.finish!({ finished: true }));
  expect(view!.toJSON()).toBeNull();
  update(nav, true, true);
  expect(progress.__getValue()).toBe(1);
  expect(timings[timings.length - 1].config).toMatchObject({ toValue: 1, duration: 0 });
});

test("native reduced motion also suppresses the platform modal fade", () => {
  set(Platform, "OS", "android"); Reflect.deleteProperty(globalThis, "document");
  mount(undefined, true, true);
  expect(view!.root.findByType(Modal).props.animationType).toBe("none");
  expect(timings[0].config.duration).toBe(0);
});

test.each([false, true])("onExited uses the current callback exactly once after a completed exit, reduced=%s", reduced => {
  const nav = navigation(), previous = jest.fn(), latest = jest.fn();
  mount(nav, true, reduced, previous);
  expect(previous).not.toHaveBeenCalled();
  update(nav, false, reduced, previous);
  const exit = timings.find(item => item.config.toValue === 0)!;
  update(nav, false, reduced, latest);
  expect(latest).not.toHaveBeenCalled();
  expect(exit.stop).not.toHaveBeenCalled();
  act(() => exit.finish!({ finished: true }));
  expect(view!.toJSON()).toBeNull();
  expect(previous).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
  act(() => exit.finish!({ finished: true }));
  expect(latest).toHaveBeenCalledTimes(1);
});

test("onExited ignores interrupted cleanup, reopening and stale completion after unmount", () => {
  const nav = navigation(), exited = jest.fn();
  mount(nav, true, false, exited);
  update(nav, false, false, exited);
  const firstExit = timings.find(item => item.config.toValue === 0)!;
  update(nav, true, false, exited);
  expect(firstExit.stop).toHaveBeenCalledTimes(1);
  act(() => firstExit.finish!({ finished: true }));
  expect(exited).not.toHaveBeenCalled();
  expect(view!.toJSON()).not.toBeNull();
  update(nav, false, false, exited);
  const secondExit = timings[timings.length - 1];
  act(() => secondExit.finish!({ finished: false }));
  expect(exited).not.toHaveBeenCalled();
  act(() => { view!.unmount(); view = undefined; });
  act(() => secondExit.finish!({ finished: true }));
  expect(exited).not.toHaveBeenCalled();
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

type CalendarOptions = { visible?: boolean; reduceMotion?: boolean; onExited?: () => void; position?: "center" | "right"; cardStyle?: StyleProp<ViewStyle> };
const calendarContents = ({ visible = true, reduceMotion = false, onExited, position = "center", cardStyle = { maxWidth: 440 } }: CalendarOptions = {}, nav?: Nav) => {
  const sheet = React.createElement(ModalSheet, { visible, reduceMotion, onExited, position, cardStyle, onClose: close, transition: "calendar" },
    React.createElement(TextInput, { testID: "calendar-draft", value: "Evento" }));
  return nav ? React.createElement(NavigationContext.Provider, { value: nav.nav as never }, sheet) : sheet;
};
const calendarProgress = () => jest.mocked(Animated.timing).mock.calls[0][0] as Animated.Value;
const progressValue = () => (calendarProgress() as unknown as { __getValue: () => number }).__getValue();
const cardMotion = () => {
  const node = view!.root.findAll(item => Array.isArray(item.props.style) && Boolean(StyleSheet.flatten(item.props.style)?.transform))[0];
  return StyleSheet.flatten(node.props.style) as { opacity: number; transform: { translateX: { __getValue: () => number } }[] };
};

test("calendar transition keeps the card opaque across intermediate horizontal frames", () => {
  act(() => { view = create(calendarContents()); });
  expect(timings[0].config).toMatchObject({ toValue: 1, duration: 260 });
  const entering = jest.mocked(Animated.timing).mock.calls[0][1];
  expect(entering.easing!(0.5)).toBeCloseTo(0.875);
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    act(() => calendarProgress().setValue(fraction));
    const motion = cardMotion();
    expect(motion.opacity).toBe(1);
    expect(motion.transform).toHaveLength(1);
    expect(motion.transform[0].translateX.__getValue()).toBeCloseTo(720 * (1 - fraction));
  }
});

test.each([
  [{ width: 300, maxWidth: 440 }, "center", 650],
  [{ width: "100%", maxWidth: 440 }, "center", 720],
  [{ maxWidth: 1400 }, "center", 1000],
  [{ width: 300 }, "right", 300],
] as const)("calendar offset follows its card width and viewport limit: %s/%s", (cardStyle, position, expected) => {
  act(() => { view = create(calendarContents({ cardStyle, position })); });
  expect(cardMotion().transform[0].translateX.__getValue()).toBe(expected);
});

test("calendar reversals preserve partial progress and ignore the interrupted exit callback", () => {
  const exited = jest.fn();
  act(() => { view = create(calendarContents({ onExited: exited })); });
  act(() => calendarProgress().setValue(0.6));
  act(() => view!.update(calendarContents({ visible: false, onExited: exited })));
  const oldExit = timings[timings.length - 1];
  expect(oldExit.config).toMatchObject({ toValue: 0, duration: 240 });
  const exiting = jest.mocked(Animated.timing).mock.calls.at(-1)![1];
  expect(exiting.easing!(0.5)).toBeCloseTo(0.875);
  expect(progressValue()).toBe(0.6);
  act(() => calendarProgress().setValue(0.35));
  act(() => view!.update(calendarContents({ visible: true, onExited: exited })));
  expect(progressValue()).toBe(0.35);
  act(() => oldExit.finish!({ finished: true }));
  expect(exited).not.toHaveBeenCalled();
  expect(view!.toJSON()).not.toBeNull();
  expect(progressValue()).toBe(0.35);
});

test("calendar holds its scroll lock and pointer barrier until the final exit finishes", () => {
  const exited = jest.fn();
  act(() => { view = create(calendarContents({ onExited: exited })); });
  act(() => calendarProgress().setValue(1));
  act(() => view!.update(calendarContents({ visible: false, onExited: exited })));
  expect(body.style.overflow).toBe("hidden");
  expect(keydowns.size).toBe(0);
  const backdrop = view!.root.findAll(node => node.props.style?.position === "absolute" && node.props.pointerEvents === "auto")[0];
  expect(backdrop).toBeTruthy();
  expect(backdrop.props.onPress).toBeUndefined();
  const exit = timings[timings.length - 1];
  act(() => exit.finish!({ finished: true }));
  expect(view!.toJSON()).toBeNull();
  expectUnlocked();
  expect(exited).toHaveBeenCalledTimes(1);
  act(() => exit.finish!({ finished: true }));
  expect(exited).toHaveBeenCalledTimes(1);
  act(() => view!.update(calendarContents({ visible: true, onExited: exited })));
  expect(progressValue()).toBe(0);
});

test("calendar resets after route blur but not when reduced motion is turned off while open", () => {
  const nav = navigation();
  act(() => { view = create(calendarContents({ reduceMotion: true }, nav)); });
  expect(progressValue()).toBe(1);
  expect(timings[0].config.duration).toBe(0);
  act(() => view!.update(calendarContents({ reduceMotion: false }, nav)));
  expect(progressValue()).toBe(1);
  emit(nav, false);
  expect(view!.toJSON()).toBeNull();
  expectUnlocked();
  emit(nav, true);
  expect(progressValue()).toBe(0);
  expect(body.style.overflow).toBe("hidden");
});

test("calendar suppresses the additional native fade without enabling reduced motion", () => {
  set(Platform, "OS", "android"); Reflect.deleteProperty(globalThis, "document");
  act(() => { view = create(calendarContents()); });
  expect(view!.root.findByType(Modal).props.animationType).toBe("none");
  expect(timings[0].config.duration).toBe(260);
});
