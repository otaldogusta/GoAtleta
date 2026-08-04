import { resolveBottomTabPress } from "../bottom-tab-navigation";

describe("resolveBottomTabPress", () => {
  it("adds a browser history entry when a different web tab is selected", () => {
    expect(
      resolveBottomTabPress({
        focused: false,
        href: "/prof/classes",
        isWeb: true,
        routeName: "classes",
      })
    ).toEqual({ type: "push", href: "/prof/classes" });
  });

  it("does not duplicate the current web tab in browser history", () => {
    expect(
      resolveBottomTabPress({
        focused: true,
        href: "/prof/home",
        isWeb: true,
        routeName: "home",
      })
    ).toEqual({ type: "none" });
  });

  it("keeps native tab navigation unchanged", () => {
    expect(
      resolveBottomTabPress({
        focused: false,
        href: "/coord/classes",
        isWeb: false,
        routeName: "classes",
      })
    ).toEqual({ type: "navigate", routeName: "classes" });
  });
});
