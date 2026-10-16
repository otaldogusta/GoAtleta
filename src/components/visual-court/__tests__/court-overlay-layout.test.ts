import { mobileCourtChrome, mobileCourtOverlayLayout } from "../court-overlay-layout";

describe("mobile court overlay placement", () => {
  it.each([320, 360, 375, 393, 477, 600, 700])("keeps the grip, zoom and playback separate at %ipx", width => {
    const height = 704;
    for (const safeBottom of [0, 34]) {
      const layout = mobileCourtOverlayLayout(width, safeBottom);
      const grip = { left: (width - mobileCourtChrome.gripWidth) / 2, right: (width + mobileCourtChrome.gripWidth) / 2, top: height - layout.panelBottom - mobileCourtChrome.gripHeight, bottom: height - layout.panelBottom };
      const zoom = { left: width - 10 - layout.zoomWidth, right: width - 10, top: height - layout.zoomBottom - mobileCourtChrome.zoomHeight, bottom: height - layout.zoomBottom };
      const playbackTop = height - layout.transportBottom - mobileCourtChrome.transportHeight;
      const overlaps = grip.left < zoom.right && grip.right > zoom.left && grip.top < zoom.bottom && grip.bottom > zoom.top;
      expect(overlaps).toBe(false);
      expect(zoom.left).toBeGreaterThanOrEqual(0);
      expect(zoom.right).toBeLessThanOrEqual(width);
      expect(Math.max(grip.bottom, zoom.bottom)).toBeLessThanOrEqual(playbackTop - 8);
      expect(playbackTop + mobileCourtChrome.transportHeight).toBeLessThanOrEqual(height - safeBottom);
      // The closed grip stays near the dock rather than retaining the old
      // two-row timeline's empty reserved band.
      expect(playbackTop - grip.bottom).toBeLessThanOrEqual(12);
    }
  });
});
