import { overlayLayers, resolveFloatingListZIndex } from "../overlay-layers";

describe("overlay layers", () => {
  it("keeps portaled lists above ordinary modal and menu layers", () => {
    expect(resolveFloatingListZIndex(5_301)).toBe(overlayLayers.floatingList);
    expect(overlayLayers.floatingList).toBeGreaterThan(overlayLayers.modal);
  });

  it("preserves an explicitly higher layer", () => {
    expect(resolveFloatingListZIndex(60_000)).toBe(60_000);
  });
});
