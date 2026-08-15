import { stripExpoRouterInternalParams } from "./web-route-state";

type RouterLike = {
  push: (href: any, options?: { withAnchor?: boolean }) => void;
  replace: (href: any, options?: { withAnchor?: boolean }) => void;
};

type PrimaryRouteNavigationOptions = {
  router: RouterLike;
  href: any;
};

const anchoredNavigationOptions = { withAnchor: true } as const;

function scheduleAnchoredUrlCleanup() {
  if (
    typeof window === "undefined" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const sanitizedHref = stripExpoRouterInternalParams(currentHref);
      const currentState = window.history.state;

      if (sanitizedHref === currentHref || currentState == null) return;
      window.history.replaceState(currentState, "", sanitizedHref);
    });
  });
}

/**
 * Preserves browser Back semantics when switching between Expo Router tab
 * routes. React Navigation treats a tab switch as a replacement on web, so we
 * first snapshot the current entry and then replace only the new top entry.
 */
export function navigateToPrimaryRoute({
  router,
  href,
}: PrimaryRouteNavigationOptions) {
  if (typeof window === "undefined") {
    router.push(href);
    return;
  }

  try {
    const currentState = window.history.state;
    if (currentState == null) {
      router.push(href, anchoredNavigationOptions);
      scheduleAnchoredUrlCleanup();
      return;
    }

    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState(currentState, "", currentHref);
    router.replace(href, anchoredNavigationOptions);
    scheduleAnchoredUrlCleanup();
  } catch {
    router.push(href, anchoredNavigationOptions);
    scheduleAnchoredUrlCleanup();
  }
}
