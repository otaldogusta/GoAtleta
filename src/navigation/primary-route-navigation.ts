import { Platform } from "react-native";
import { requestPendingEditsNavigation } from "./pending-edits-navigation";

type NavigationOptions = { withAnchor?: boolean; dangerouslySingular?: (name: string, params: Record<string, unknown>) => string | undefined };
type RouterLike = {
  push: (href: any, options?: NavigationOptions) => void;
  navigate: (href: any, options?: NavigationOptions) => void;
  replace: (href: any, options?: { withAnchor?: boolean }) => void;
};

type NavigationSnapshot = { index?: number; routes: readonly { key?: string; name: string; params?: object; state?: NavigationSnapshot }[] };
type PrimaryRouteNavigationOptions = {
  router: RouterLike;
  href: any;
  navigationState?: NavigationSnapshot | (() => NavigationSnapshot | undefined);
};

const anchoredNavigationOptions = { withAnchor: true } as const;

/** SDK 57's public root state includes ExpoRoot's generated __root navigator. */
export function resolveAppNavigationSnapshot(navigationState: PrimaryRouteNavigationOptions["navigationState"]) {
  let snapshot = typeof navigationState === "function" ? navigationState() : navigationState;
  while (snapshot) {
    const active = snapshot.routes[snapshot.index ?? 0];
    if (active?.name !== "__root" || !active.state) break;
    snapshot = active.state;
  }
  return snapshot;
}

/** Resource identity includes every query/context field, not only the path ID. */
export function getCanonicalRouteIdentity(name: string, params?: object): string | undefined {
  try {
    return JSON.stringify([name, params ?? {}], (_key, value: unknown) => {
      if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" ||
        (typeof value === "number" && !Number.isFinite(value))) throw new Error("Non-serializable route context");
      return value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
        : value;
    });
  } catch { return undefined; }
}

function reusableBranch({ href, navigationState }: PrimaryRouteNavigationOptions) {
  const path = typeof href === "string" ? href : href?.pathname;
  const name = typeof path === "string" ? /^\/(prof|coord|student|family)(?:\/|$)/.exec(path)?.[1] : undefined;
  const snapshot = resolveAppNavigationSnapshot(navigationState);
  if (!name || window.location.pathname.split("/")[1] === name ||
    snapshot?.routes.filter(route => route.name === name).length !== 1) return undefined;
  return (routeName: string) => `workspace:${routeName}`;
}

/** Back may preserve a calendar's local state only when its complete URL context matches. */
export function previousRouteMatchesDestination(navigationState: NavigationSnapshot | undefined, href: { pathname: string; params?: object }) {
  const snapshot = resolveAppNavigationSnapshot(navigationState);
  let route = snapshot?.routes[(snapshot.index ?? 0) - 1];
  const names: string[] = [];
  while (route) {
    names.push(route.name);
    const nested = route.state;
    if (!nested) break;
    route = nested.routes[nested.index ?? 0];
  }
  const target = href.pathname.replace(/^\//, "");
  const identity = route && getCanonicalRouteIdentity(target, route.params);
  return names.join("/") === target && identity !== undefined && identity === getCanonicalRouteIdentity(target, href.params);
}

/** Return to the exact origin screen, whose selected date may live only in state. */
export function navigateBackToCalendar({ router, href, navigationState, originKey }: {
  router: Pick<RouterLike, "replace"> & { back: () => void };
  href: { pathname: string; params?: object };
  navigationState: NavigationSnapshot | undefined;
  originKey?: unknown;
}) {
  let matches = false;
  if (originKey !== undefined) {
    const snapshot = resolveAppNavigationSnapshot(navigationState);
    let route = snapshot?.routes[(snapshot.index ?? 0) - 1];
    const names: string[] = [];
    while (route) {
      names.push(route.name);
      const nested = route.state;
      if (!nested) break;
      route = nested.routes[nested.index ?? 0];
    }
    matches = typeof originKey === "string" && originKey.length > 0 &&
      names.join("/") === href.pathname.replace(/^\//, "") && route?.key === originKey;
  } else {
    // Preserve the conservative behavior of links made before origin keys.
    matches = previousRouteMatchesDestination(navigationState, href);
  }
  if (Platform.OS === "web" && matches) router.back();
  else router.replace(href, anchoredNavigationOptions);
}

function hasBrowserNavigationState() {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.location?.pathname === "string"
  );
}

/**
 * Expo owns browser entries and IDs. Web Tabs fullHistory and the root Stack
 * history adapter record visits while preserving reusable screen instances.
 */
export function navigateToPrimaryRoute({
  router,
  href,
  navigationState,
}: PrimaryRouteNavigationOptions) {
  requestPendingEditsNavigation(() => performPrimaryNavigation({ router, href, navigationState }));
}

function performPrimaryNavigation({ router, href, navigationState }: PrimaryRouteNavigationOptions) {
  if (!hasBrowserNavigationState()) {
    router.push(href);
    return;
  }

  const singular = reusableBranch({ router, href, navigationState });
  if (singular) router.push(href, { dangerouslySingular: singular });
  else router.push(href);
}

/** Called only after the workspace action's pending-edit guard releases its setters. */
export function replaceWorkspaceRoute({ router, href, navigationState }: PrimaryRouteNavigationOptions) {
  const singular = hasBrowserNavigationState() ? reusableBranch({ router, href, navigationState }) : undefined;
  if (singular) router.navigate(href, { dangerouslySingular: singular });
  else router.replace(href);
}

/** Reuse one identical detail without removing a different resource or context. */
export function navigateToDetailRoute({ router, href, navigationState }: PrimaryRouteNavigationOptions) {
  requestPendingEditsNavigation(() => {
    const name = typeof href?.pathname === "string" ? href.pathname.replace(/^\//, "") : undefined;
    const identity = name ? getCanonicalRouteIdentity(name, href.params) : undefined;
    const snapshot = resolveAppNavigationSnapshot(navigationState);
    const matches = identity ? snapshot?.routes.filter(route => getCanonicalRouteIdentity(route.name, route.params) === identity) : undefined;
    if (hasBrowserNavigationState() && matches?.length === 1) {
      router.push(href, { dangerouslySingular: getCanonicalRouteIdentity });
    } else router.push(href);
  });
}
