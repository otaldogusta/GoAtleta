export type PlatformRouteAccessDecision = {
  blockRender: boolean;
  redirectTo: string | null;
};

type PlatformRouteAccessInput = {
  pathname: string;
  hasSession: boolean;
  accessLoading: boolean;
  hasPlatformAccess: boolean;
  authenticatedFallback: string;
  isDesignPreview?: boolean;
};

export function resolvePlatformRouteAccess({
  pathname,
  hasSession,
  accessLoading,
  hasPlatformAccess,
  authenticatedFallback,
  isDesignPreview = false,
}: PlatformRouteAccessInput): PlatformRouteAccessDecision {
  const isLegacyLoginRoute = pathname === "/platform/login";
  const isPlatformRoute =
    pathname === "/platform" || pathname.startsWith("/platform/");

  if (!isPlatformRoute || isDesignPreview) {
    return { blockRender: false, redirectTo: null };
  }

  if (isLegacyLoginRoute) {
    if (!hasSession) {
      return { blockRender: true, redirectTo: "/login" };
    }
    if (accessLoading) {
      return { blockRender: true, redirectTo: null };
    }
    return {
      blockRender: true,
      redirectTo: hasPlatformAccess ? "/platform" : authenticatedFallback,
    };
  }

  if (!hasSession) {
    return {
      blockRender: true,
      redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
    };
  }

  if (accessLoading) {
    return { blockRender: true, redirectTo: null };
  }

  if (!hasPlatformAccess) {
    return { blockRender: true, redirectTo: authenticatedFallback };
  }

  return { blockRender: false, redirectTo: null };
}
