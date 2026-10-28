import { courtPlaybackLayout, mobileCourtChrome, mobileCourtOverlayLayout } from "../court-overlay-layout";

describe("mobile court overlay placement", () => {
  it.each([319, 320, 360, 393, 477, 600, 617, 650, 700])("keeps utilities vertical at a fixed dock offset when the wider transport needs the space at %ipx", width => {
    const layout = mobileCourtOverlayLayout(width, 0, .8);
    expect(layout.zoomVertical).toBe(true);
    expect(layout.zoomWidth).toBe(40);
    expect(layout.zoomBottom).toBe(layout.transportBottom);
    const playback = courtPlaybackLayout(width, .8);
    const playbackRight = (width + playback.width * .8) / 2;
    expect(width - (10 + layout.zoomWidth) * .8 - playbackRight).toBeGreaterThanOrEqual(6);
  });
  it.each([720, 834, 946])("aligns horizontal utilities with playback when they fit at %ipx", width => {
    const scale = .8;
    const layout = mobileCourtOverlayLayout(width, 0, scale);
    expect(layout.zoomBottom).toBe(layout.transportBottom);
    expect(layout.zoomVertical).toBe(false);
    const playbackRight = (width + courtPlaybackLayout(width, scale).width * scale) / 2;
    expect(width - (10 + layout.zoomWidth) * scale - playbackRight).toBeGreaterThanOrEqual(6);
  });
  it.each([319, 320, 360, 375, 393, 477, 600, 617, 700])("keeps the grip, zoom and playback separate at %ipx", width => {
    const height = 704;
    for (const scale of [.8, 1]) {
    for (const safeBottom of [0, 34]) {
      const layout = mobileCourtOverlayLayout(width, safeBottom, scale);
      const playback = courtPlaybackLayout(width, scale);
      const grip = { left: (width - mobileCourtChrome.gripWidth) / 2, right: (width + mobileCourtChrome.gripWidth) / 2, top: height - layout.panelBottom - mobileCourtChrome.gripHeight, bottom: height - layout.panelBottom };
      const zoom = { left: width - (10 + layout.zoomWidth) * scale, right: width - 10 * scale, top: height - layout.zoomBottom - mobileCourtChrome.zoomHeight * scale, bottom: height - layout.zoomBottom };
      const playbackTop = height - layout.transportBottom - layout.transportHeight;
      const overlaps = grip.left < zoom.right && grip.right > zoom.left && grip.top < zoom.bottom && grip.bottom > zoom.top;
      expect(overlaps).toBe(false);
      expect(zoom.left).toBeGreaterThanOrEqual(0);
      expect(zoom.right).toBeLessThanOrEqual(width);
      expect(grip.bottom).toBeLessThanOrEqual(playbackTop - 8);
      if (layout.zoomVertical) {
        const playbackRight = (width + playback.width * scale) / 2;
        expect(zoom.left - playbackRight).toBeGreaterThanOrEqual(6);
      }
      expect(layout.transportHeight).toBe(playback.height * scale);
      expect(layout.panelBottom).toBe(layout.transportBottom + layout.transportHeight + 8);
      expect(playbackTop + layout.transportHeight).toBeLessThanOrEqual(height - safeBottom);
      expect(playbackTop - grip.bottom).toBeLessThanOrEqual(12);
    }
    }
  });

  it("keeps web controls on one row and preserves the native stacked height", () => {
    for (const scale of [.8, 1]) {
      expect(courtPlaybackLayout(319, scale).height).toBe(78);
      expect(courtPlaybackLayout(319, scale, false).height).toBe(116);
      expect(courtPlaybackLayout(319, scale).stacked).toBe(true);
      expect(courtPlaybackLayout(617, scale).height).toBe(78);
      expect(courtPlaybackLayout(617, scale).stacked).toBe(false);
      expect(courtPlaybackLayout(946, scale).width).toBe(550);
    }
    expect(courtPlaybackLayout(946, .8).width * .8).toBe(440);
  });

  it.each([
    [460, .8, true], [461, .8, false],
    [575, 1, true], [576, 1, false],
  ] as const)("fits the lower row using usable logical width at %ipx and scale %s", (width, scale, stacked) => {
    const playback = courtPlaybackLayout(width, scale);
    expect(playback.stacked).toBe(stacked);
    expect(playback.height).toBe(78);
    if (!stacked) expect(playback.width).toBeGreaterThanOrEqual(460);
  });
});
