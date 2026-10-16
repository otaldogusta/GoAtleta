/** Physical CSS pixels: reserve only the current, single-row playback dock. */
export const mobileCourtChrome = { transportHeight: 42, zoomWidth: 148, zoomHeight: 40, gripWidth: 48, gripHeight: 28 } as const;

export function mobileCourtOverlayLayout(width: number, safeBottom = 0) {
  const transportBottom = safeBottom + 14;
  const panelBottom = transportBottom + mobileCourtChrome.transportHeight + 8;
  const zoomLeft = width - 10 - mobileCourtChrome.zoomWidth;
  const gripRight = (width + mobileCourtChrome.gripWidth) / 2;
  // At very narrow widths, separate utilities vertically instead of wrapping
  // the four zoom buttons or letting them cover the centered panel handle.
  const zoomBottom = panelBottom + (zoomLeft < gripRight + 8 ? mobileCourtChrome.gripHeight + 8 : 0);
  return { transportBottom, panelBottom, zoomBottom, zoomWidth: mobileCourtChrome.zoomWidth };
}
