import { orderWebSidebarItems } from "../web-sidebar-navigation";

describe("web sidebar navigation", () => {
  it("orders the professor navigation by the daily workflow", () => {
    const items = [
      { key: "home" },
      { key: "classes" },
      { key: "planning" },
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
      "classes",
      "students",
      "planning",
      "calendar",
      "nfc",
      "absence",
      "exercises",
      "periodization",
      "consultation",
      "assistant",
      "regulation-history",
    ]);
  });

  it("keeps permitted subsets ordered without reintroducing hidden items", () => {
    const items = [{ key: "consultation" }, { key: "home" }, { key: "students" }];

    expect(orderWebSidebarItems("prof", items).map((item) => item.key)).toEqual([
      "home",
      "students",
      "consultation",
    ]);
  });

  it("prioritizes the coordination daily workflow", () => {
    const items = [
      { key: "planning" },
      { key: "calendar" },
      { key: "management" },
      { key: "finance" },
      { key: "events" },
      { key: "students" },
      { key: "classes" },
      { key: "dashboard" },
    ];

    expect(orderWebSidebarItems("coord", items).map((item) => item.key)).toEqual([
      "dashboard",
      "classes",
      "students",
      "planning",
      "calendar",
      "management",
      "finance",
      "events",
    ]);
  });
});
