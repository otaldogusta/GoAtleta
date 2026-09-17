export type RefreshFeedback = { refreshing: boolean; pull: number };
export type RefreshFeedbackEntries = Record<string, RefreshFeedback>;

/** The overlay has discrete states, not a pixel-driven animation. Keep gesture
 * distances in the control's ref and avoid root updates for every touch event. */
export function updateRefreshFeedback(
  current: RefreshFeedbackEntries,
  id: string,
  value: RefreshFeedback | null,
): RefreshFeedbackEntries {
  const next = value?.refreshing
    ? { refreshing: true, pull: 0 }
    : value && value.pull > 8
      ? { refreshing: false, pull: 100 }
      : null;
  if (!next) {
    if (!(id in current)) return current;
    const result = { ...current };
    delete result[id];
    return result;
  }
  if (current[id]?.refreshing === next.refreshing && current[id]?.pull === next.pull) return current;
  return { ...current, [id]: next };
}
