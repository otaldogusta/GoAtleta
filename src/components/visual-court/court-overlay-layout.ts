/** Physical CSS pixels: reserve only the current, single-row playback dock. */
export const mobileCourtChrome = { transportHeight: 42, zoomWidth: 148, zoomHeight: 40, gripWidth: 48, gripHeight: 28 } as const;

export function mobileCourtOverlayLayout(width: number, safeBottom = 0, scale = 1) {
  const transportBottom = safeBottom + 14;
  const transportHeight = width <= 400 ? 96 * scale : mobileCourtChrome.transportHeight;
  const panelBottom = transportBottom + transportHeight + 8;
  // Keep narrow-screen utilities in a fixed right-hand column, clear of the grip.
  const playbackRight = (width + Math.min(440, width - 24) * scale) / 2;
  const utilitiesLeft = width - (10 + mobileCourtChrome.zoomWidth) * scale;
  const sameRow = utilitiesLeft - playbackRight >= 6;
  const zoomBottom = transportBottom;
  return { transportBottom, transportHeight, panelBottom, zoomBottom, zoomWidth: sameRow ? mobileCourtChrome.zoomWidth : 40, zoomVertical: !sameRow };
}
