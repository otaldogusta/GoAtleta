export const WEB_PULL_REFRESH_THRESHOLD = 56;
export const WEB_PULL_REFRESH_MAX_DISTANCE = 92;

export type WebPullGesture = {
  deltaX: number;
  deltaY: number;
};

export function resolveWebPullDistance(
  { deltaX, deltaY }: WebPullGesture,
  resistance = 0.42,
) {
  if (deltaY <= 0 || Math.abs(deltaX) >= deltaY) return 0;

  return Math.min(
    WEB_PULL_REFRESH_MAX_DISTANCE,
    Math.max(0, deltaY * resistance),
  );
}

export function shouldTriggerWebRefresh(distance: number) {
  return distance >= WEB_PULL_REFRESH_THRESHOLD;
}
