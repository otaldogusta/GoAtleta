import { updateRefreshFeedback, type RefreshFeedbackEntries } from "../refresh-feedback-state";

describe("refresh feedback render budget", () => {
  it("does not replace state on every pixel of a pull", () => {
    const initial = updateRefreshFeedback({}, "home", { refreshing: false, pull: 9 });
    for (let pull = 10; pull <= 120; pull++) {
      expect(updateRefreshFeedback(initial, "home", { refreshing: false, pull })).toBe(initial);
    }
  });
  it("keeps loading and dismissal distinct and preserves other screens", () => {
    const current: RefreshFeedbackEntries = { other: { refreshing: true, pull: 0 } };
    const pulling = updateRefreshFeedback(current, "home", { refreshing: false, pull: 50 });
    const loading = updateRefreshFeedback(pulling, "home", { refreshing: true, pull: 50 });
    expect(loading.home).toEqual({ refreshing: true, pull: 0 });
    expect(loading.other).toBe(current.other);
    expect(updateRefreshFeedback(loading, "home", null)).toEqual(current);
    expect(updateRefreshFeedback(current, "missing", null)).toBe(current);
  });
  it("ignores movements below the visual threshold", () => {
    const current = {};
    expect(updateRefreshFeedback(current, "home", { refreshing: false, pull: 8 })).toBe(current);
  });
});
