import { Platform } from "react-native";

import { getCanonicalRouteIdentity, navigateToDetailRoute, navigateToPrimaryRoute, previousRouteMatchesDestination, replaceWorkspaceRoute } from "../primary-route-navigation";
import { registerPendingEditsNavigation } from "../pending-edits-navigation";

const mockRouter = () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn() });

describe("navigateToPrimaryRoute", () => {
  const originalPlatformOS = Platform.OS;
  let historyState: unknown;
  const pushState = jest.fn();
  const replaceState = jest.fn((state: unknown) => {
    historyState = state;
  });

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
    historyState = null;
    pushState.mockClear();
    replaceState.mockClear();
    Object.defineProperty(window, "history", {
      configurable: true,
      value: {
        get state() {
          return historyState;
        },
        pushState,
        replaceState,
      },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/coord/dashboard",
        search: "",
        hash: "",
      },
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: undefined,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("lets the SDK record tab visits without manually copying browser IDs", () => {
    const router = mockRouter();
    historyState = { key: "dashboard" };

    navigateToPrimaryRoute({ router, href: "/coord/planning" });

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/coord/planning");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("uses router push when no React Navigation history state is available", () => {
    const router = mockRouter();
    historyState = null;

    navigateToPrimaryRoute({ router, href: "/coord/planning" });

    expect(router.push).toHaveBeenCalledWith("/coord/planning");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not treat React Native's global window as a browser", () => {
    const router = mockRouter();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    navigateToPrimaryRoute({ router, href: "/coord/classes" });

    expect(router.push).toHaveBeenCalledWith("/coord/classes");
    expect(router.replace).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("reuses exactly one existing root branch while retaining the previous browser entry", () => {
    historyState = { id: "event-entry" };
    Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/events/event-1", search: "?date=2026-10-24", hash: "#details" } });
    const router = mockRouter();
    navigateToPrimaryRoute({ router, href: "/prof/calendar", navigationState: { routes: [{ name: "prof" }, { name: "events/[id]", params: { id: "event-1" } }] } });
    expect(pushState).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/prof/calendar", { dangerouslySingular: expect.any(Function) });
    const identify = router.push.mock.calls[0][1].dangerouslySingular;
    expect(identify("prof", { screen: "home" })).toBe(identify("prof", { screen: "calendar" }));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([[[]], [[{ name: "prof" }, { name: "prof" }]]])("does not prune missing or ambiguous root branches", routes => {
    historyState = { id: "entry" }; const router = mockRouter();
    navigateToPrimaryRoute({ router, href: "/prof/calendar", navigationState: { routes } });
    expect(router.push).toHaveBeenCalledWith("/prof/calendar"); expect(router.replace).not.toHaveBeenCalled();
  });

  it("uses public tab navigation without anchors or browser-state rewrites", () => {
    historyState = { id: "entry" }; const router = mockRouter();
    navigateToPrimaryRoute({ router, href: "/coord/classes", navigationState: { routes: [{ name: "coord" }] } });
    expect(pushState).not.toHaveBeenCalled(); expect(replaceState).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/coord/classes"); expect(router.replace).not.toHaveBeenCalled();
  });

  it("workspace replacement reuses a root without adding a browser snapshot", () => {
    const router = mockRouter();
    replaceWorkspaceRoute({ router, href: "/prof/home", navigationState: { routes: [{ name: "prof" }, { name: "coord" }] } });
    expect(router.navigate).toHaveBeenCalledWith("/prof/home", { dangerouslySingular: expect.any(Function) }); expect(pushState).not.toHaveBeenCalled();
    router.navigate.mockClear(); replaceWorkspaceRoute({ router, href: "/family/home", navigationState: { routes: [{ name: "coord" }] } });
    expect(router.replace).toHaveBeenCalledWith("/family/home"); expect(router.push).not.toHaveBeenCalled();
  });

  it("detail reuse compares the entire context and delegates visit recording to the SDK", () => {
    historyState = { id: "list-entry" }; const router = mockRouter();
    const params = { id: "class-a", calendarDate: "2026-10-24", calendarUnit: "Unit 1", section: "lesson", extra: { b: ["2", "1"], a: "value" } };
    const href = { pathname: "/class/[id]", params };
    navigateToDetailRoute({ router, href, navigationState: { routes: [{ name: "class/[id]", params: { extra: { a: "value", b: ["2", "1"] }, section: "lesson", calendarUnit: "Unit 1", calendarDate: "2026-10-24", id: "class-a" } }] } });
    expect(pushState).not.toHaveBeenCalled(); expect(router.push).toHaveBeenCalledWith(href, { dangerouslySingular: getCanonicalRouteIdentity });
    expect(getCanonicalRouteIdentity("class/[id]", params)).not.toBe(getCanonicalRouteIdentity("class/[id]", { ...params, calendarUnit: "Unit 2" }));
    expect(getCanonicalRouteIdentity("class/[id]", params)).not.toBe(getCanonicalRouteIdentity("class/[id]", { ...params, id: "class-b" }));
  });

  it.each(["different-resource", "different-context", "ambiguous", "missing"])("ordinary detail push preserves %s instead of removing it", condition => {
    historyState = { id: "entry" }; const router = mockRouter();
    const href = { pathname: "/events/[id]", params: { id: "event-a", source: "calendar" } };
    const routes = condition === "missing" ? [] : condition === "ambiguous" ? [{ name: "events/[id]", params: href.params }, { name: "events/[id]", params: href.params }]
      : [{ name: "events/[id]", params: { ...href.params, ...(condition === "different-resource" ? { id: "event-b" } : { source: "other" }) } }];
    navigateToDetailRoute({ router, href, navigationState: { routes } });
    expect(router.push).toHaveBeenCalledWith(href); expect(pushState).not.toHaveBeenCalled();
  });

  it("a pending-edit cancellation blocks history changes and detail reuse until release", () => {
    historyState = { id: "entry" }; const router = mockRouter();
    let release: (() => void) | undefined; const cleanup = registerPendingEditsNavigation(navigate => { release = navigate; });
    try {
      navigateToPrimaryRoute({ router, href: "/prof/calendar", navigationState: { routes: [{ name: "prof" }] } });
      expect(pushState).not.toHaveBeenCalled(); expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
      release!(); expect(pushState).not.toHaveBeenCalled(); expect(router.push).toHaveBeenCalledTimes(1);
    } finally { cleanup(); }
  });

  it("returns to an existing calendar only when date, unit and all additional context match", () => {
    const href = { pathname: "/prof/calendar", params: { targetDate: "2026-10-24", unit: "Unit 1" } };
    const navigationState = { index: 1, routes: [{ name: "prof", state: { index: 0, routes: [{ name: "calendar", params: href.params }] } }, { name: "class/[id]", params: { id: "a" } }] };
    expect(previousRouteMatchesDestination(navigationState, href)).toBe(true);
    expect(previousRouteMatchesDestination(navigationState, { ...href, params: { ...href.params, unit: "Unit 2" } })).toBe(false);
    expect(previousRouteMatchesDestination(navigationState, { ...href, params: { ...href.params, targetDate: "2026-10-25" } })).toBe(false);
    expect(previousRouteMatchesDestination(navigationState, { ...href, params: { ...href.params, targetClassId: "other" } })).toBe(false);
    expect(previousRouteMatchesDestination({ index: 0, routes: navigationState.routes }, href)).toBe(false);
  });

  it("checks the current root snapshot after a pending guard releases, never a stale unique branch", () => {
    historyState = { id: "entry" }; const router = mockRouter();
    let snapshot = { routes: [{ name: "prof" }] }, release: (() => void) | undefined;
    const current = jest.fn(() => snapshot), cleanup = registerPendingEditsNavigation(navigate => { release = navigate; });
    try {
      navigateToPrimaryRoute({ router, href: "/prof/calendar", navigationState: current });
      expect(current).not.toHaveBeenCalled(); snapshot = { routes: [{ name: "prof" }, { name: "prof" }] };
      release!(); expect(current).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith("/prof/calendar"); expect(router.replace).not.toHaveBeenCalled();
    } finally { cleanup(); }
  });

  it("resolves the SDK generated __root wrapper before matching primary branches and details", () => {
    historyState = { id: "entry" }; const router = mockRouter();
    const appState = { index: 1, routes: [{ name: "prof" }, { name: "class/[id]", params: { id: "class-a" } }] };
    const rootState = { index: 0, routes: [{ name: "__root", state: appState }] };
    navigateToPrimaryRoute({ router, href: "/prof/calendar", navigationState: rootState });
    expect(router.push).toHaveBeenCalledWith("/prof/calendar", { dangerouslySingular: expect.any(Function) });
    router.push.mockClear(); pushState.mockClear();
    navigateToDetailRoute({ router, href: { pathname: "/class/[id]", params: { id: "class-a" } }, navigationState: () => rootState });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/class/[id]", params: { id: "class-a" } }, { dangerouslySingular: getCanonicalRouteIdentity });
    expect(pushState).not.toHaveBeenCalled();
  });
});
