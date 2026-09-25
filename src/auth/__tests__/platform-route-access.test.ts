import { resolvePlatformRouteAccess } from "../platform-route-access";

describe("platform route access", () => {
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
