import {
  resolveResponsiveLayout,
  resolveResponsiveTier,
} from "../responsive-layout";

describe("responsive layout", () => {
  test.each([
    [767, "mobile"],
    [768, "tablet"],
    [1199, "tablet"],
    [1200, "desktop"],
    [1439, "desktop"],
    [1440, "wide"],
    [1599, "wide"],
    [1600, "ultrawide"],
  ] as const)("resolves %i as %s", (width, tier) => {
    expect(resolveResponsiveTier(width)).toBe(tier);
  });

  it("keeps the content variant within 1440 pixels", () => {
    expect(resolveResponsiveLayout(2000, "content")).toEqual(
      expect.objectContaining({
        tier: "ultrawide",
        gutter: 32,
        maxContentWidth: 1440,
        contentWidth: 1440,
      })
    );
  });

  it("keeps the dashboard variant within 1600 pixels", () => {
    expect(resolveResponsiveLayout(2000, "dashboard")).toEqual(
      expect.objectContaining({
        maxContentWidth: 1600,
        contentWidth: 1600,
      })
    );
  });

  it("subtracts both gutters before resolving content width", () => {
    expect(resolveResponsiveLayout(834, "content")).toEqual(
      expect.objectContaining({
        tier: "tablet",
        gutter: 24,
        contentWidth: 786,
        isDesktop: false,
      })
    );
  });

  it("normalizes invalid and negative widths", () => {
    expect(resolveResponsiveLayout(Number.NaN).contentWidth).toBe(0);
    expect(resolveResponsiveLayout(-20).contentWidth).toBe(0);
  });
});
