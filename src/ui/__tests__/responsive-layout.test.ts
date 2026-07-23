import {
  canSplitResponsiveGrid,
  resolveResponsiveLayout,
  resolveResponsiveNavigation,
  resolveResponsiveTier,
  resolveResponsiveViewportWidth,
} from "../responsive-layout";

describe("responsive layout", () => {
  test.each([
    [390, "mobile"],
    [767, "mobile"],
    [768, "tablet"],
    [834, "tablet"],
    [959, "tablet"],
    [960, "tablet"],
    [1024, "tablet"],
    [1099, "tablet"],
    [1100, "desktop"],
    [1199, "desktop"],
    [1200, "desktop"],
    [1439, "desktop"],
    [1440, "wide"],
    [1599, "wide"],
    [1600, "ultrawide"],
  ] as const)("resolves %i as %s", (width, tier) => {
    expect(resolveResponsiveTier(width)).toBe(tier);
  });

  test.each([
    [390, false, false, false, false, false, 16],
    [767, false, false, false, false, false, 16],
    [768, true, true, false, false, false, 24],
    [834, true, true, false, false, false, 24],
    [959, true, true, false, false, false, 24],
    [960, true, true, true, false, false, 24],
    [1024, true, true, true, false, false, 24],
    [1099, true, true, true, false, false, 24],
    [1100, true, true, true, true, false, 24],
    [1439, true, true, true, true, false, 24],
    [1440, true, true, true, true, true, 32],
    [1600, true, true, true, true, true, 32],
  ] as const)(
    "resolves semantic capabilities at %i pixels",
    (
      width,
      usesWorkspaceShell,
      expectedWorkspace,
      supportsSplitView,
      canExpandSidebar,
      supportsDenseGrid,
      gutter
    ) => {
      const layout = resolveResponsiveLayout(width);
      expect(layout.isMobile).toBe(!usesWorkspaceShell);
      expect(layout.usesWorkspaceShell).toBe(expectedWorkspace);
      expect(layout.supportsSplitView).toBe(supportsSplitView);
      expect(layout.canExpandSidebar).toBe(canExpandSidebar);
      expect(layout.supportsDenseGrid).toBe(supportsDenseGrid);
      expect(layout.gutter).toBe(gutter);
    }
  );

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
        isMobile: false,
        usesWorkspaceShell: true,
      })
    );
  });

  it("normalizes invalid and negative widths", () => {
    const invalid = resolveResponsiveLayout(Number.NaN);
    const negative = resolveResponsiveLayout(-20);
    expect(invalid.contentWidth).toBe(0);
    expect(invalid.tier).toBe("mobile");
    expect(invalid.isMobile).toBe(true);
    expect(negative.contentWidth).toBe(0);
    expect(negative.usesWorkspaceShell).toBe(false);
  });

  it("uses the web layout viewport when desktop-site mode scales the visual viewport", () => {
    expect(resolveResponsiveViewportWidth(412, 980)).toBe(980);
    expect(resolveResponsiveLayout(resolveResponsiveViewportWidth(412, 980))).toEqual(
      expect.objectContaining({
        isMobile: false,
        usesWorkspaceShell: true,
        supportsSplitView: true,
      })
    );
  });

  it("falls back to the measured width when the web layout viewport is unavailable", () => {
    expect(resolveResponsiveViewportWidth(412, null)).toBe(412);
    expect(resolveResponsiveViewportWidth(412, 0)).toBe(412);
    expect(resolveResponsiveViewportWidth(412, Number.NaN)).toBe(412);
  });

  it("shows exactly one primary navigation model for each width", () => {
    expect(resolveResponsiveNavigation(resolveResponsiveLayout(767))).toEqual({
      showBottomNavigation: true,
      showSidebar: false,
      allowExpandedSidebar: false,
    });
    expect(resolveResponsiveNavigation(resolveResponsiveLayout(768))).toEqual({
      showBottomNavigation: false,
      showSidebar: true,
      allowExpandedSidebar: false,
    });
    expect(resolveResponsiveNavigation(resolveResponsiveLayout(1100))).toEqual({
      showBottomNavigation: false,
      showSidebar: true,
      allowExpandedSidebar: true,
    });
  });

  it("splits a grid only when viewport and container have real capacity", () => {
    const compactViewport = resolveResponsiveLayout(959);
    const splitViewport = resolveResponsiveLayout(1024);
    expect(canSplitResponsiveGrid(compactViewport, 900)).toBe(false);
    expect(canSplitResponsiveGrid(splitViewport, 719)).toBe(false);
    expect(canSplitResponsiveGrid(splitViewport, 720)).toBe(true);
    expect(canSplitResponsiveGrid(splitViewport, Number.NaN)).toBe(false);
  });
});
