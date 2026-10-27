import { mobileCourtChrome, mobileCourtOverlayLayout } from "../court-overlay-layout";

describe("mobile court overlay placement", () => {
  it.each([320, 360, 393, 477, 600])("keeps narrow utilities vertical at a fixed dock offset at %ipx", width => {
    const layout = mobileCourtOverlayLayout(width, 0, .8);
    expect(layout.zoomVertical).toBe(true);
    expect(layout.zoomWidth).toBe(40);
    expect(layout.zoomBottom).toBe(layout.transportBottom);
    expect(width - (10 + layout.zoomWidth) * .8).toBeGreaterThan((width + mobileCourtChrome.gripWidth) / 2 + 8);
  });
  it.each([617, 650, 700])("aligns scaled utilities with playback when they fit at %ipx", width => {
    const scale = .8;
    const layout = mobileCourtOverlayLayout(width, 0, scale);
    expect(layout.zoomBottom).toBe(layout.transportBottom);
    const playbackRight = (width + 440 * scale) / 2;
    expect(width - (10 + layout.zoomWidth) * scale - playbackRight).toBeGreaterThanOrEqual(6);
  });
  it.each([320, 360, 375, 393, 477, 600, 700])("keeps the grip, zoom and playback separate at %ipx", width => {
    const height = 704;
    for (const safeBottom of [0, 34]) {
      const layout = mobileCourtOverlayLayout(width, safeBottom, .8);
      const grip = { left: (width - mobileCourtChrome.gripWidth) / 2, right: (width + mobileCourtChrome.gripWidth) / 2, top: height - layout.panelBottom - mobileCourtChrome.gripHeight, bottom: height - layout.panelBottom };
      const zoom = { left: width - 10 - layout.zoomWidth, right: width - 10, top: height - layout.zoomBottom - mobileCourtChrome.zoomHeight, bottom: height - layout.zoomBottom };
      const playbackTop = height - layout.transportBottom - layout.transportHeight;
      const overlaps = grip.left < zoom.right && grip.right > zoom.left && grip.top < zoom.bottom && grip.bottom > zoom.top;
      expect(overlaps).toBe(false);
      expect(zoom.left).toBeGreaterThanOrEqual(0);
      expect(zoom.right).toBeLessThanOrEqual(width);
      expect(grip.bottom).toBeLessThanOrEqual(playbackTop - 8);
      if (layout.zoomVertical) {
        const playbackRight = (width + Math.min(440, width - (width <= 400 ? 36 : 24)) * .8) / 2;
        expect(width - (10 + layout.zoomWidth) * .8 - playbackRight).toBeGreaterThanOrEqual(6);
      }
      expect(playbackTop + layout.transportHeight).toBeLessThanOrEqual(height - safeBottom);
      // The closed grip stays near the dock rather than retaining the old
      // two-row timeline's empty reserved band.
      expect(playbackTop - grip.bottom).toBeLessThanOrEqual(12);
    }
  });
});
