import { spacing } from "../../theme/tokens";

const MOBILE_BOTTOM_NAVIGATION_CLEARANCE = 104;

export function resolveHomeFloatingNoticeBottom({
  isMobile,
  safeAreaBottom,
}: {
  isMobile: boolean;
  safeAreaBottom: number;
}) {
  return isMobile
    ? Math.max(0, safeAreaBottom) + MOBILE_BOTTOM_NAVIGATION_CLEARANCE
    : spacing.lg;
}
