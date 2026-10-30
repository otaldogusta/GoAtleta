import { resolvePlatformRouteAccess } from "../platform-route-access";

describe("platform route access", () => {
  it.each([false, true])("keeps a cold direct entry in place while restoring auth (session=%s)", hasSession => {
    expect(resolvePlatformRouteAccess({
      pathname: "/platform/accesses",
      hasSession,
      authLoading: true,
      accessLoading: false,
      hasPlatformAccess: false,
      authenticatedFallback: "/prof/home",
    })).toEqual({ blockRender: true, redirectTo: null });
  });

  it("sends an unauthenticated platform visitor to the shared login", () => {
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform/accesses",
        hasSession: false,
        accessLoading: false,
        hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({
      blockRender: true,
      redirectTo: "/login?next=%2Fplatform%2Faccesses",
    });
  });

  it("preserves query and fragment through login for a direct platform link", () => {
    const currentRoute = "/platform/accesses?institution=QA%20Densidade&status=active#account";
    const decision = resolvePlatformRouteAccess({
      pathname: "/platform/accesses",
      currentRoute,
      hasSession: false,
      accessLoading: false,
      hasPlatformAccess: false,
      authenticatedFallback: "/student/home",
    });
    expect(decision.blockRender).toBe(true);
    expect(new URL(decision.redirectTo!, "https://goatleta.local").searchParams.get("next"))
      .toBe(currentRoute);
  });

  it.each(["https://evil.example/platform", "//evil.example/platform", "/\\evil.example", "/login"])(
    "does not use an unsafe platform return target %s",
    currentRoute => {
      expect(resolvePlatformRouteAccess({
        pathname: "/platform/accesses", currentRoute,
        hasSession: false, accessLoading: false, hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
      })).toEqual({ blockRender: true, redirectTo: "/login" });
    },
  );

  it("does not mount platform screens while access is unknown or denied", () => {
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform",
        hasSession: true,
        accessLoading: true,
        hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({ blockRender: true, redirectTo: null });
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform/accesses",
        hasSession: true,
        accessLoading: false,
        hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({ blockRender: true, redirectTo: "/student/home" });
  });

  it("allows an authorized platform administrator", () => {
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform",
        hasSession: true,
        accessLoading: false,
        hasPlatformAccess: true,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({ blockRender: false, redirectTo: null });
  });

  it("keeps a reload on the requested nested route until the admin response settles", () => {
    const entry = {
      pathname: "/platform/accesses",
      hasSession: true,
      authenticatedFallback: "/student/home",
    };
    expect(resolvePlatformRouteAccess({ ...entry, accessLoading: true, hasPlatformAccess: false }))
      .toEqual({ blockRender: true, redirectTo: null });
    expect(resolvePlatformRouteAccess({ ...entry, accessLoading: false, hasPlatformAccess: true }))
      .toEqual({ blockRender: false, redirectTo: null });
    expect(resolvePlatformRouteAccess({ ...entry, accessLoading: false, hasPlatformAccess: false }))
      .toEqual({ blockRender: true, redirectTo: "/student/home" });
  });

  it("retires the old dedicated login without leaving a broken route", () => {
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform/login",
        hasSession: false,
        accessLoading: false,
        hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({ blockRender: true, redirectTo: "/login" });
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform/login",
        hasSession: true,
        accessLoading: false,
        hasPlatformAccess: true,
        authenticatedFallback: "/student/home",
      }),
    ).toEqual({ blockRender: true, redirectTo: "/platform" });
  });

  it("preserves explicitly enabled local design previews", () => {
    expect(
      resolvePlatformRouteAccess({
        pathname: "/platform/accesses",
        hasSession: false,
        accessLoading: false,
        hasPlatformAccess: false,
        authenticatedFallback: "/student/home",
        isDesignPreview: true,
      }),
    ).toEqual({ blockRender: false, redirectTo: null });
  });
});
