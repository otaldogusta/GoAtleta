import {
  orderWebSidebarItems,
  shouldUseHardWebSidebarNavigation,
} from "../web-sidebar-navigation";

describe("web sidebar navigation", () => {
  it("orders the professor navigation by the daily workflow", () => {
    const items = [
      { key: "home" },
      { key: "classes" },
      { key: "planning" },
      { key: "reports" },
      { key: "consultation" },
      { key: "students" },
      { key: "calendar" },
      { key: "absence" },
      { key: "nfc" },
      { key: "exercises" },
      { key: "periodization" },
      { key: "regulation-history" },
      { key: "assistant" },
    ];

    expect(orderWebSidebarItems("prof", items).map((item) => item.key)).toEqual([
      "home",
      "planning",
      "classes",
      "students",
      "calendar",
      "nfc",
      "absence",
      "exercises",
      "periodization",
      "reports",
      "consultation",
      "assistant",
      "regulation-history",
    ]);
  });

  it("keeps permitted subsets ordered without reintroducing hidden items", () => {
    const items = [{ key: "reports" }, { key: "home" }, { key: "students" }];

    expect(orderWebSidebarItems("prof", items).map((item) => item.key)).toEqual([
      "home",
      "students",
      "reports",
    ]);
  });

  it("preserves the existing order for other roles", () => {
    const items = [{ key: "classes" }, { key: "dashboard" }, { key: "events" }];

    expect(orderWebSidebarItems("coord", items)).toEqual(items);
  });

  it("uses a hard web transition only when leaving a class periodization route", () => {
    expect(
      shouldUseHardWebSidebarNavigation("/class/c_123/periodization")
    ).toBe(true);
    expect(
      shouldUseHardWebSidebarNavigation("/class/c_123/periodization/")
    ).toBe(true);
    expect(shouldUseHardWebSidebarNavigation("/class/c_123")).toBe(false);
    expect(shouldUseHardWebSidebarNavigation("/prof/periodization")).toBe(false);
    expect(shouldUseHardWebSidebarNavigation("/prof/home")).toBe(false);
  });
});
