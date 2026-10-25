import { Platform } from "react-native";
import { getCanonicalRouteIdentity, navigateToDetailRoute, navigateToPrimaryRoute, replaceWorkspaceRoute } from "../primary-route-navigation";
import { fixture, route, scoutingCallback, stack, tabState } from "./sdk-root-history-fixture";

const platform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const browser = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeEach(() => Object.defineProperty(Platform, "OS", { configurable: true, value: "web" }));
afterEach(() => {
  Object.defineProperty(Platform, "OS", platform);
  if (browser) Object.defineProperty(globalThis, "window", browser); else Reflect.deleteProperty(globalThis, "window");
});
const keys = (state: any) => state.routes.map((value: any) => value.key);
const historyKeys = (state: any) => state.history.map((value: any) => value.key);
const focused = (state: any) => state.routes[state.index];
const assertIds = (harness: ReturnType<typeof fixture>) => {
  const native = harness.browser.entries.map(entry => entry.state?.id);
  const memory = harness.memory().entries.map((entry: any) => entry?.id);
  expect(native.every(Boolean)).toBe(true); expect(new Set(native).size).toBe(native.length);
  expect(memory).toEqual(native); expect(harness.memory().index).toBe(harness.browser.index());
};
const prof = () => ({ ...route("prof-retained", "prof"), state: tabState("prof", "calendar", { date: "2026-10-27", unit: "Unit A" }) });

test("composed installed SDK PUSH reuses one root screen and appends a browser visit with its own ID", async () => {
  const params = { id: "C001", date: "2026-10-27", plan: "plan-2", fromEvent: "event-1", unit: "Unit A" };
  const h = fixture(stack([prof(), route("class", "class/[id]", params)])); const original = h.browser.current();
  navigateToPrimaryRoute({ router: h.imperative, href: "/prof/calendar", navigationState: () => h.rootState() }); await h.sync();
  expect(keys(h.state())).toEqual(["class", "prof-retained"]); expect(historyKeys(h.state())).toEqual(["prof-retained", "class", "prof-retained"]);
  expect(h.browser.entries).toHaveLength(2); expect(h.browser.win.history.pushState).toHaveBeenCalledTimes(1);
  expect(h.browser.win.history.replaceState).not.toHaveBeenCalled(); assertIds(h);
  const outerKey = h.rootState().key; const childKey = h.state().routes.at(-1).state.key;
  for (let repeat = 0; repeat < 3; repeat++) {
    await h.back(); expect(h.browser.current()).toBe(original); expect(focused(h.state()).key).toBe("class");
    expect(focused(h.state()).params).toEqual(params); assertIds(h);
    await h.forward(); expect(h.browser.current()).toContain("/prof/calendar"); expect(focused(h.state()).key).toBe("prof-retained");
    expect(focused(h.state()).state.key).toBe(childKey); expect(h.rootState().key).toBe(outerKey); assertIds(h);
  }
});

test("workspace NAVIGATE replaces the last visit, drops the old current screen and restores unique prefixes on POP", async () => {
  const origin = prof(); const h = fixture(stack([origin, route("class", "class/[id]", { id: "C001" }), route("coord", "coord")]));
  replaceWorkspaceRoute({ router: h.imperative, href: "/prof/calendar", navigationState: () => h.rootState() }); await h.sync();
  expect(h.imperative.navigate).toHaveBeenCalled(); expect(h.imperative.replace).not.toHaveBeenCalled();
  expect(keys(h.state())).toEqual(["class", "prof-retained"]); expect(historyKeys(h.state())).toEqual(["prof-retained", "class", "prof-retained"]);
  expect(h.browser.entries).toHaveLength(1); expect(h.browser.win.history.pushState).not.toHaveBeenCalled();
  h.action({ type: "GO_BACK" }); await h.sync();
  expect(keys(h.state())).toEqual(["prof-retained", "class"]); expect(historyKeys(h.state())).toEqual(["prof-retained", "class"]);
  h.action({ type: "POP", payload: { count: 1 } }); await h.sync();
  expect(keys(h.state())).toEqual(["prof-retained"]); expect(historyKeys(h.state())).toEqual(["prof-retained"]);
  expect(focused(h.state()).state).toEqual(origin.state);
  expect(h.browser.current()).toContain("date=2026-10-27"); expect(h.browser.current()).toContain("unit=Unit%20A");
  expect(h.router.getStateForAction(h.state(), { type: "GO_BACK" }, h.options)).toBeNull();
});

test("complete browser Back/Forward restores removed workspace routes, nested tab keys, dates and return URLs", async () => {
  const origin = prof(); const h = fixture(stack([origin]));
  const params = { id: "C001", date: "2026-10-27", returnTo: "/events/E001?day=2026-10-27&unit=Unit A" };
  navigateToDetailRoute({ router: h.imperative, href: { pathname: "/class/[id]", params }, navigationState: () => h.rootState() }); await h.sync();
  const classKey = focused(h.state()).key;
  navigateToPrimaryRoute({ router: h.imperative, href: "/coord/dashboard", navigationState: () => h.rootState() }); await h.sync();
  replaceWorkspaceRoute({ router: h.imperative, href: "/prof/home", navigationState: () => h.rootState() }); await h.sync();
  const currentTabs = focused(h.state()).state;
  expect(keys(h.state())).toEqual([classKey, origin.key]); expect(historyKeys(h.state())).toEqual([origin.key, classKey, origin.key]);
  for (let repeat = 0; repeat < 2; repeat++) {
    await h.back(); expect(focused(h.state()).key).toBe(classKey); expect(focused(h.state()).params).toEqual(params); assertIds(h);
    await h.back(); expect(focused(h.state()).key).toBe(origin.key); expect(focused(h.state()).state).toEqual(origin.state); assertIds(h);
    await h.forward(); expect(focused(h.state()).key).toBe(classKey); expect(focused(h.state()).params).toEqual(params); assertIds(h);
    await h.forward(); expect(focused(h.state()).key).toBe(origin.key); expect(focused(h.state()).state).toEqual(currentTabs);
    expect(h.browser.current()).toBe("/prof/home"); assertIds(h);
  }
});

test("one mounted root with two visits can go back once while preserving its route key and nested state", async () => {
  const initial = prof(); const h = fixture(stack([initial, route("coord", "coord")]));
  replaceWorkspaceRoute({ router: h.imperative, href: "/prof/calendar", navigationState: () => h.rootState() }); await h.sync();
  expect(keys(h.state())).toEqual([initial.key]); expect(historyKeys(h.state())).toEqual([initial.key, initial.key]);
  expect(h.router.getStateForAction(h.state(), { type: "GO_BACK" }, h.options)).not.toBeNull();
  h.action({ type: "GO_BACK" }); await h.sync();
  expect(keys(h.state())).toEqual([initial.key]); expect(focused(h.state()).state.key).toBe(initial.state.key);
  expect(historyKeys(h.state())).toEqual([initial.key]); expect(h.router.getStateForAction(h.state(), { type: "GO_BACK" }, h.options)).toBeNull();
});

test("exact details include all URL context; a different date is retained and Back/Forward restore the full snapshot", async () => {
  const params = { id: "C001", date: "2026-10-27", plan: "plan-2", calendarOriginKey: "calendar-route", calendarUnit: "Unit A" };
  const h = fixture(stack([route("class", "class/[id]", params), route("court", "class/[id]/visual-tech", { id: "C001" })]));
  const href = { pathname: "/class/[id]", params: { ...params } };
  navigateToDetailRoute({ router: h.imperative, href, navigationState: () => h.rootState() }); await h.sync();
  expect(h.imperative.push.mock.calls[0][1].dangerouslySingular).toBe(getCanonicalRouteIdentity);
  expect(keys(h.state())).toEqual(["court", "class"]); expect(h.state().history).toHaveLength(3);
  const firstUrl = h.browser.current();
  navigateToDetailRoute({ router: h.imperative, href: { ...href, params: { ...params, date: "2026-10-29" } }, navigationState: () => h.rootState() }); await h.sync();
  expect(h.state().routes.filter((value: any) => value.name === "class/[id]")).toHaveLength(2);
  const secondKey = focused(h.state()).key; await h.back();
  expect(h.browser.current()).toBe(firstUrl); expect(focused(h.state()).key).toBe("class"); expect(focused(h.state()).params).toEqual(params);
  await h.forward(); expect(focused(h.state()).key).toBe(secondKey); expect(focused(h.state()).params.date).toBe("2026-10-29"); assertIds(h);
});

test("missing primary uses a normal SDK PUSH and missing workspace uses REPLACE without application history writes", async () => {
  const h = fixture(stack([route("class", "class/[id]", { id: "C001" })]));
  navigateToPrimaryRoute({ router: h.imperative, href: "/prof/home", navigationState: () => h.rootState() }); await h.sync();
  expect(h.imperative.push).toHaveBeenCalledWith("/prof/home"); expect(h.state().history).toHaveLength(2); expect(h.browser.entries).toHaveLength(2);
  replaceWorkspaceRoute({ router: h.imperative, href: "/coord/dashboard", navigationState: () => h.rootState() }); await h.sync();
  expect(h.imperative.replace).toHaveBeenCalledWith("/coord/dashboard"); expect(h.state().history).toHaveLength(2); expect(h.browser.entries).toHaveLength(2);
  await h.back(); expect(focused(h.state()).key).toBe("class"); await h.forward(); expect(focused(h.state()).name).toBe("coord"); assertIds(h);
});

test("the actual Scouting callback reuses only the same complete resource and reads current public state", async () => {
  const h = fixture(stack([route("class", "class/[id]", { id: "C001" }),
    route("scout", "class/[id]/scouting", { id: "C001" }), route("court", "class/[id]/visual-tech", { id: "C001" })]));
  const navigation = { getState: jest.fn(() => h.rootState()) };
  const open = scoutingCallback({ cls: { id: "C001" }, router: h.imperative, navigation });
  open(); await h.sync(); expect(focused(h.state()).key).toBe("scout");
  expect(h.state().routes.filter((value: any) => value.name === "class/[id]/scouting")).toHaveLength(1);
  scoutingCallback({ cls: { id: "C002" }, router: h.imperative, navigation })(); await h.sync();
  navigateToDetailRoute({ router: h.imperative, href: { pathname: "/class/[id]/scouting", params: { id: "C001", date: "2026-10-29" } },
    navigationState: () => h.rootState() }); await h.sync(); open(); await h.sync();
  expect(focused(h.state()).key).toBe("scout"); expect(navigation.getState).toHaveBeenCalledTimes(3);
  expect(h.state().routes.filter((value: any) => value.name === "class/[id]/scouting")).toHaveLength(3);
  await h.back(); expect(focused(h.state()).params).toEqual({ id: "C001", date: "2026-10-29" });
  await h.forward(); expect(focused(h.state()).key).toBe("scout"); assertIds(h);
});

test("the original unsynchronized memory index corrupts a real reactive Forward snapshot, while the installed patch preserves it", async () => {
  const h = fixture(stack([prof(), route("class", "class/[id]", { id: "C001", date: "2026-10-27" })]), true);
  navigateToPrimaryRoute({ router: h.imperative, href: "/prof/calendar", navigationState: () => h.rootState() }); await h.sync();
  await h.back(); await h.forward();
  expect(h.memory().entries.map((entry: any) => entry?.id)).not.toEqual(h.browser.entries.map(entry => entry.state?.id));
});
