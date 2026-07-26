import { stripExpoRouterInternalParams } from "../web-route-state";

describe("web route state", () => {
  it("removes the internal Expo Router anchor parameter", () => {
    expect(
      stripExpoRouterInternalParams("/prof/planning?initial=false")
    ).toBe("/prof/planning");
  });

  it("preserves application query params and hashes", () => {
    expect(
      stripExpoRouterInternalParams(
        "/prof/planning?initial=false&source=sidebar#today"
      )
    ).toBe("/prof/planning?source=sidebar#today");
  });

  it("leaves unrelated URLs unchanged", () => {
    expect(stripExpoRouterInternalParams("/prof/planning")).toBe(
      "/prof/planning"
    );
    expect(
      stripExpoRouterInternalParams("/prof/planning?initial=true")
    ).toBe("/prof/planning?initial=true");
  });
});
