import {
  orderWebSidebarItems,
  shouldNavigateAcrossWebShell,
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

  it("places coordination students beside classes", () => {
    const items = [
      { key: "reports" },
      { key: "events" },
      { key: "students" },
      { key: "classes" },
      { key: "dashboard" },
    ];

    expect(orderWebSidebarItems("coord", items).map((item) => item.key)).toEqual([
      "dashboard",
      "classes",
      "students",
      "reports",
      "events",
    ]);
  });

  it("navigates across web shells when leaving a class workspace route", () => {
    expect(shouldNavigateAcrossWebShell("/class/c_123")).toBe(true);
    expect(shouldNavigateAcrossWebShell("/class/c_123/")).toBe(true);
    expect(shouldNavigateAcrossWebShell("/class/c_123/attendance")).toBe(
      true
    );
    expect(
      shouldNavigateAcrossWebShell("/class/c_123/periodization")
    ).toBe(true);
    expect(
      shouldNavigateAcrossWebShell("/class/c_123/periodization/")
    ).toBe(true);
    expect(shouldNavigateAcrossWebShell("/class")).toBe(false);
    expect(shouldNavigateAcrossWebShell("/classes")).toBe(false);
    expect(shouldNavigateAcrossWebShell("/prof/periodization")).toBe(false);
    expect(shouldNavigateAcrossWebShell("/prof/home")).toBe(false);
  });
});
