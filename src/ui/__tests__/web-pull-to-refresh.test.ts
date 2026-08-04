import {
  resolveWebPullDistance,
  shouldTriggerWebRefresh,
  WEB_PULL_REFRESH_MAX_DISTANCE,
  WEB_PULL_REFRESH_THRESHOLD,
} from "../web-pull-to-refresh";

describe("web pull to refresh", () => {
  it("ignores upward and horizontal gestures", () => {
    expect(resolveWebPullDistance({ deltaX: 0, deltaY: -20 })).toBe(0);
    expect(resolveWebPullDistance({ deltaX: 40, deltaY: 30 })).toBe(0);
  });

  it("adds resistance and caps the indicator distance", () => {
    expect(resolveWebPullDistance({ deltaX: 4, deltaY: 100 })).toBe(42);
    expect(resolveWebPullDistance({ deltaX: 0, deltaY: 1000 })).toBe(
      WEB_PULL_REFRESH_MAX_DISTANCE,
    );
  });

  it("refreshes only after the threshold", () => {
    expect(shouldTriggerWebRefresh(WEB_PULL_REFRESH_THRESHOLD - 1)).toBe(false);
    expect(shouldTriggerWebRefresh(WEB_PULL_REFRESH_THRESHOLD)).toBe(true);
  });
});
