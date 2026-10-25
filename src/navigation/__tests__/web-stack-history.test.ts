import type { StackNavigationState } from "expo-router";
import type { ParamListBase } from "expo-router/react-navigation";
import { StackRouter } from "expo-router/build/react-navigation/routers/StackRouter";
import { withWebStackHistory } from "../web-stack-history";

// Exercise the installed SDK reducer without loading a native navigator or a browser.
type State = StackNavigationState<ParamListBase>;
const options = {
  routeNames: ["prof", "coord", "class/[id]"],
  routeParamList: {},
  routeGetIdList: { prof: () => "prof", coord: () => "coord" },
};
function fixture() {
  const original = StackRouter({ initialRouteName: "prof" });
  const router = { ...original, ...withWebStackHistory(original) };
  return { original, router, state: router.getInitialState(options) as State };
}

test("plain SDK behavior has no root history metadata; the opt-in override seeds immutable route snapshots", () => {
  const { original, router } = fixture();
  const input = original.getInitialState(options);
  expect(input.history).toBeUndefined();
  const result = router.getRehydratedState(input, options);
  expect(result.history).toEqual([{ type: "route", key: input.routes[0].key, route: input.routes[0] }]);
  expect(result.routes).toBe(input.routes);
  expect(input.history).toBeUndefined();
});

test("partial RESET remains partial until the SDK supplies valid route keys", () => {
  const { router, state } = fixture();
  const payload = { index: 0, routes: [{ name: "coord", params: { unit: "unit-b" } }] };
  const partial = router.getStateForAction(state, { type: "RESET", payload }, options);
  expect(partial).toBe(payload);
  expect(partial.history).toBeUndefined();
  const hydrated = router.getRehydratedState(partial, options);
  expect(hydrated.routes[0]).toMatchObject(payload.routes[0]);
  expect(hydrated.history).toEqual([{ type: "route", key: hydrated.routes[0].key, route: hydrated.routes[0] }]);
});

test("foreign targets delegate unchanged, and a scoped stale POP source cannot change root visits", () => {
  const { original, router, state } = fixture();
  const next = router.getStateForAction(state, { type: "PUSH", payload: { name: "coord" } }, options);
  const originalHistory = next.history;
  const foreign = { type: "POP", payload: { count: 1 }, target: "another-navigator" };
  expect(router.getStateForAction(next, foreign, options)).toEqual(original.getStateForAction(next, foreign, options));
  expect(router.getStateForAction(next, { type: "POP", payload: { count: 1 }, source: "removed-screen", target: next.key }, options)).toBeNull();
  expect(next.history).toBe(originalHistory);
});

test("malformed or obsolete history is seeded from current SDK routes, without resurrecting an unknown screen", () => {
  const { router, state } = fixture();
  const malformed = { ...state, history: [{ type: "route", key: "foreign", route: { key: "foreign", name: "private-removed" } }] };
  const hydrated = router.getRehydratedState(malformed, options);
  expect(hydrated.history).toEqual([{ type: "route", key: state.routes[0].key, route: state.routes[0] }]);
  expect(hydrated.routes.map((route: { name: string }) => route.name)).toEqual(["prof"]);
});

test("protected route-name removal also removes those history snapshots", () => {
  const { router, state } = fixture();
  const visited = router.getStateForAction(state, { type: "PUSH", payload: { name: "coord" } }, options);
  const restricted = router.getStateForRouteNamesChange(visited, { ...options, routeNames: ["coord"], routeKeyChanges: [] });
  expect(restricted.routes.map((route: { name: string }) => route.name)).toEqual(["coord"]);
  expect(restricted.history).toHaveLength(1);
  expect(restricted.history[0].route.name).toBe("coord");
  expect(router.getStateForAction(restricted, { type: "GO_BACK" }, options)).toBeNull();
  expect(visited.history).toHaveLength(2);
});

test("parameter changes update only the current visit snapshot and preserve nested context", () => {
  const { router, state } = fixture();
  const context = { screen: "calendar", params: { targetDate: "2026-10-27", unit: "unit-b", extra: ["a", "b"] } };
  const updated = router.getStateForAction(state, { type: "SET_PARAMS", payload: { params: context } }, options);
  expect(updated.history).toHaveLength(1);
  expect(updated.history[0].route.params).toEqual(context);
  expect(state.routes[0].params).toBeUndefined();
  expect(context).toEqual({ screen: "calendar", params: { targetDate: "2026-10-27", unit: "unit-b", extra: ["a", "b"] } });
});

test("POP from an inactive source preserves the SDK removal and never resurrects that screen", () => {
  const { router, state } = fixture();
  const middle = router.getStateForAction(state, { type: "PUSH", payload: { name: "coord" } }, options);
  const focused = router.getStateForAction(middle, { type: "PUSH", payload: { name: "class/[id]", params: { id: "class-a" } } }, options);
  const removedKey = focused.routes[1].key;
  const result = router.getStateForAction(focused, { type: "POP", payload: { count: 1 }, source: removedKey, target: focused.key }, options);
  expect(result.routes.map((route: { name: string }) => route.name)).toEqual(["prof", "class/[id]"]);
  expect(result.history.map((entry: { key: string }) => entry.key)).not.toContain(removedKey);
  const back = router.getStateForAction(result, { type: "GO_BACK" }, options);
  expect(back.routes.map((route: { name: string }) => route.name)).toEqual(["prof"]);
});

test("explicit route-key invalidation removes old snapshots while retaining earlier valid visits", () => {
  const { router, state } = fixture();
  const visited = router.getStateForAction(state, { type: "PUSH", payload: { name: "coord" } }, options);
  const oldCoord = visited.routes[1].key;
  const updated = router.getStateForRouteNamesChange(visited, { ...options, routeKeyChanges: ["coord"] });
  expect(updated.routes.map((route: { name: string }) => route.name)).toEqual(["prof"]);
  expect(updated.history.map((entry: { key: string }) => entry.key)).not.toContain(oldCoord);
  expect(updated.history).toHaveLength(1);
  expect(router.getStateForAction(updated, { type: "GO_BACK" }, options)).toBeNull();
  const profInvalidated = router.getStateForRouteNamesChange(state, { ...options, routeKeyChanges: ["prof"] });
  expect(profInvalidated.routes[0].key).not.toBe(state.routes[0].key);
  expect(profInvalidated.history[0].key).toBe(profInvalidated.routes[0].key);
});

test("a regenerated active key keeps earlier valid visits that are no longer live screens", () => {
  const { router, state } = fixture();
  const first = router.getStateForAction(state, { type: "PUSH", payload: { name: "coord" } }, options);
  const oldCoordKey = first.routes[1].key;
  const second = router.getStateForAction(first, { type: "PUSH", payload: { name: "prof" } }, options);
  const third = router.getStateForAction(second, { type: "PUSH", payload: { name: "coord" } }, options);
  const replaced = router.getStateForAction(third, { type: "NAVIGATE", payload: { name: "prof", singular: () => "workspace" } }, options);
  expect(replaced.routes.map((route: { name: string }) => route.name)).toEqual(["prof"]);
  const changed = router.getStateForRouteNamesChange(replaced, { ...options, routeKeyChanges: ["prof"] });
  expect(changed.history.map((entry: { route: { name: string } }) => entry.route.name)).toEqual(["coord", "prof"]);
  const back = router.getStateForAction(changed, { type: "GO_BACK" }, options);
  expect(back.routes[back.index].key).toBe(oldCoordKey);
});
