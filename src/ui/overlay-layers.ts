export const overlayLayers = {
  modal: 1_000,
  floatingList: 50_000,
} as const;

export function resolveFloatingListZIndex(requestedZIndex: number) {
  return Math.max(requestedZIndex, overlayLayers.floatingList);
}
