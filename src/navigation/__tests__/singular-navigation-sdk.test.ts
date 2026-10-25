import vm from "node:vm";
import { Platform } from "react-native";
import { actual, extract, sdkConstants, sdkParser, route, stack, wrappedRoot, scoutingCallback } from "./sdk-root-history-fixture";

jest.mock("../pending-edits-navigation", () => ({ requestPendingEditsNavigation: (work: () => void) => work() }));
const platform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
beforeEach(() => Object.defineProperty(Platform, "OS", { configurable: true, value: "web" }));
afterEach(() => Object.defineProperty(Platform, "OS", platform));

// The former flat reducer/manual history snapshot cases are replaced by the
// complete reactive Root Stack roundtrips in web-stack-history-sdk.test.ts.
test("the real app file tree produces INTERNAL_SLOT-wrapped class/court paths", () => {
    expect(actual.keys).toContain("./class/[id].tsx");
    expect(actual.keys).toContain("./class/[id]/visual-tech.tsx");
    expect(actual.keys).toContain("./prof/_layout.tsx");
    expect(actual.keys).toContain("./coord/_layout.tsx");
    expect(actual.keys.length).toBeGreaterThan(100);
    expect(Object.keys(actual.config.screens)).toEqual([sdkConstants.INTERNAL_SLOT_NAME]);
    const state = sdkParser.getStateFromPath("/class/C001/visual-tech?date=2026-10-24&plan=plan-2", actual.config);
    expect(state.routes[0].name).toBe("__root");
    expect(state.routes[0].state.routes.at(-1).name).toBe("class/[id]/visual-tech");
    expect(state.routes[0].state.routes.at(-1).params).toEqual({ id: "C001", date: "2026-10-24", plan: "plan-2" });
    const detail = sdkParser.getStateFromPath("/class/C001?date=2026-10-24&plan=plan-2", actual.config);
    expect(detail.routes[0].state.routes.at(-1).name).toBe("class/[id]");
  });

test("SDK root hook returns the outer wrapper snapshot, while the public local getter sees current class/court stack", () => {
    const initial = { ...stack([route("class-real", "class/[id]", { id: "C001", date: "2026-10-24" }),
      route("court-real", "class/[id]/visual-tech", { id: "C001", date: "2026-10-24" })]),
    routeNames: Object.keys(actual.config.screens.__root.screens) };
    let live = initial;
    let outer = wrappedRoot(live);
    const navigation = { getState: () => live, getParent: (name: string) => name === "__root" ? { getState: () => outer } : undefined };
    const hook = vm.runInNewContext(`${extract("hooks/useRootNavigationState.js", ["useRootNavigationState"])}\nuseRootNavigationState;`, {
      native_1: { useNavigation: () => navigation }, constants_1: sdkConstants,
    });
    const captured = hook();
    expect(captured.routes.map((value: any) => value.name)).toEqual(["__root"]);
    expect(captured.routes[(captured.index ?? 0) - 1]).toBeUndefined(); // old Court condition always takes fallback
    expect(navigation.getState().routes[navigation.getState().index - 1].name).toBe("class/[id]");
    live = { ...initial, routes: [...initial.routes, route("class-new", "class/[id]", { id: "C002" })], index: 2 };
    outer = wrappedRoot(live);
    expect(hook()).not.toBe(captured);
    expect(captured.routes[0].state.routes).toHaveLength(2); // render-time snapshot is not a reactive getter
    expect(navigation.getState().routes).toHaveLength(3);
  });

test("the actual scouting callback is a no-op without a class and keeps native normal PUSH", () => {
    const router = { push: jest.fn(), replace: jest.fn() }, navigation = { getState: jest.fn(() => stack([])) };
    scoutingCallback({ cls: null, router, navigation })();
    expect(router.push).not.toHaveBeenCalled(); expect(navigation.getState).not.toHaveBeenCalled();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    scoutingCallback({ cls: { id: "C001" }, router, navigation })();
    expect(router.push).toHaveBeenCalledWith({ pathname: "/class/[id]/scouting", params: { id: "C001" } });
    expect(router.replace).not.toHaveBeenCalled();
  });
