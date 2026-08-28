import { Platform } from "react-native";

import { navigateToPrimaryRoute } from "../primary-route-navigation";

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

  it("preserves the current browser entry before switching primary routes", () => {
    const router = { push: jest.fn(), replace: jest.fn() };
    historyState = { key: "dashboard" };

    navigateToPrimaryRoute({ router, href: "/coord/planning" });

    expect(pushState).toHaveBeenCalledWith(
      { key: "dashboard" },
      "",
      "/coord/dashboard"
    );
    expect(router.replace).toHaveBeenCalledWith("/coord/planning", {
      withAnchor: true,
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("uses router push when no React Navigation history state is available", () => {
    const router = { push: jest.fn(), replace: jest.fn() };
    historyState = null;

    navigateToPrimaryRoute({ router, href: "/coord/planning" });

    expect(router.push).toHaveBeenCalledWith("/coord/planning", {
      withAnchor: true,
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not treat React Native's global window as a browser", () => {
    const router = { push: jest.fn(), replace: jest.fn() };
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
});
