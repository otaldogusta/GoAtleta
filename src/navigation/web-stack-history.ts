import type { StackNavigationState } from "expo-router";
import type { NavigationAction, ParamListBase, Router } from "expo-router/react-navigation";

type StackState = StackNavigationState<ParamListBase>;
type StackRoute = StackState["routes"][number];
type Visit = { type: "route"; key: string; route: StackRoute };

function visit(route: StackRoute): Visit {
  return { type: "route", key: route.key, route };
}

/** Public navigation history stores immutable route snapshots, never screen/editor data. */
function visits(state: StackState): Visit[] {
  const focused = state.routes[state.index];
  const history = state.history;
  if (history?.length && history.every((entry): entry is Visit => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Partial<Visit>;
    return item.type === "route" && typeof item.key === "string" &&
      item.route?.key === item.key && state.routeNames.includes(item.route.name);
  }) && history[history.length - 1].key === focused?.key) {
    // Nested tab navigation may have updated the active route since the last root action.
    return [...history.slice(0, -1), visit(focused)];
  }
  return state.routes.slice(0, state.index + 1).map(visit);
}

function stamp(state: StackState, history = visits(state)): StackState {
  return { ...state, history };
}

function restore(state: StackState, history: Visit[]): StackState {
  const unique = new Map<string, StackRoute>();
  for (const entry of history) {
    unique.delete(entry.key);
    unique.set(entry.key, entry.route);
  }
  const routes = [...unique.values()];
  return { ...state, routes, index: routes.length - 1, history };
}

function replaceLast(history: Visit[], route: StackRoute) {
  return [...history.slice(0, -1), visit(route)];
}

/**
 * Web-only Stack override, composed after Expo's router by the pinned SDK patch.
 * Screen reuse and browser visits have separate counts, as they do in Tabs fullHistory.
 */
export function withWebStackHistory<Action extends NavigationAction>(
  original: Router<StackState, Action>,
): Partial<Router<StackState, Action>> {
  return {
    getInitialState(options) {
      return stamp(original.getInitialState(options));
    },
    getRehydratedState(partialState, options) {
      return stamp(original.getRehydratedState(partialState, options));
    },
    getStateForRouteNamesChange(state, options) {
      const next = original.getStateForRouteNamesChange(state, options);
      const allowed = visits(state).filter(entry => next.routeNames.includes(entry.route.name) &&
        !options.routeKeyChanges.includes(entry.route.name));
      const target = next.routes[next.index];
      return stamp(next, allowed[allowed.length - 1]?.key === target.key
        ? replaceLast(allowed, target) : [...allowed, visit(target)]);
    },
    getStateForRouteFocus(state, key) {
      const next = original.getStateForRouteFocus(state, key);
      return next === state ? state : stamp(next, replaceLast(visits(state), next.routes[next.index]));
    },
    getStateForAction(state, action, options) {
      if (action.target && action.target !== state.key) {
        return original.getStateForAction(state, action, options);
      }
      const history = visits(state);
      const current = state.routes[state.index];
      const payload = action.payload as { count?: unknown; name?: unknown; singular?: unknown } | undefined;
      if ((action.type === "GO_BACK" || action.type === "POP") &&
        (!action.source || action.source === current.key)) {
        const count = action.type === "GO_BACK" ? 1 : payload?.count;
        if (typeof count === "number" && Number.isInteger(count) && count > 0) {
          if (history.length <= 1) return null;
          return restore(state, history.slice(0, Math.max(1, history.length - count)));
        }
      }

      const result = original.getStateForAction(state, action, options);
      // RESET may intentionally return a partial state; Expo will rehydrate it through
      // getRehydratedState before it becomes a keyed Stack navigation state.
      if (!result || result === state || result.stale !== false) return result;
      let next: StackState = result;
      if (action.type === "RESET") return stamp(next);
      const target = next.routes[next.index];
      if (action.type === "PUSH") return stamp(next, [...history, visit(target)]);

      const workspaceReplace = action.type === "NAVIGATE" &&
        typeof payload?.singular === "function" && typeof payload.name === "string" &&
        ["prof", "coord", "student", "family"].includes(payload.name);
      if (workspaceReplace && current.key !== target.key) {
        // The public NAVIGATE action reuses the target; workspace switching still replaces
        // its former current screen, matching the application's original REPLACE contract.
        const routes = next.routes.filter(route => route.key !== current.key);
        next = { ...next, routes, index: routes.findIndex(route => route.key === target.key) };
      }
      if (action.type === "REPLACE" || action.type === "NAVIGATE") {
        return stamp(next, replaceLast(history, target));
      }
      if ((action.type === "POP" || action.type === "GO_BACK") && action.source && action.source !== current.key) {
        const retained = new Set(next.routes.map(route => route.key));
        const removed = new Set(state.routes.filter(route => !retained.has(route.key)).map(route => route.key));
        return stamp(next, replaceLast(history.filter(entry => !removed.has(entry.key)), target));
      }
      if (["POP_TO", "POP_TO_TOP", "GO_BACK", "POP"].includes(action.type)) {
        const index = history.findLastIndex(entry => entry.key === target.key);
        return index >= 0 ? restore(next, replaceLast(history.slice(0, index + 1), target)) : stamp(next);
      }
      return stamp(next, replaceLast(history, target));
    },
  };
}
