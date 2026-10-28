/** Logical control sizes; placement converts them to physical CSS pixels once. */
export const mobileCourtChrome = { transportHeight: 78, zoomWidth: 148, zoomHeight: 40, gripWidth: 48, gripHeight: 28 } as const;

export function courtPlaybackLayout(width: number, scale = 1, singleControlsRow = true) {
  // The centered dock reserves the same column on each side, keeping the
  // right-hand view controls clear without moving them above the timeline.
  const available = width <= 700 ? width - 2 * (10 + 40 + 8) * scale : width - 24;
  const logicalWidth = Math.max(0, Math.min(550, available / scale));
  const stacked = logicalWidth < 460;
  return { width: logicalWidth, height: stacked && !singleControlsRow ? 116 : mobileCourtChrome.transportHeight, stacked };
}

export function mobileCourtOverlayLayout(width: number, safeBottom = 0, scale = 1) {
  const transportBottom = safeBottom + 14;
  const playback = courtPlaybackLayout(width, scale);
  const transportHeight = playback.height * scale;
  const panelBottom = transportBottom + transportHeight + 8;
  const playbackRight = (width + playback.width * scale) / 2;
  const utilitiesLeft = width - (10 + mobileCourtChrome.zoomWidth) * scale;
  const sameRow = utilitiesLeft - playbackRight >= 6;
  const zoomBottom = transportBottom;
  return { transportBottom, transportHeight, panelBottom, zoomBottom, zoomWidth: sameRow ? mobileCourtChrome.zoomWidth : 40, zoomVertical: !sameRow };
}
