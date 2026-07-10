export type ResponsiveTier =
  | "mobile"
  | "tablet"
  | "desktop"
  | "wide"
  | "ultrawide";

export type ResponsivePageVariant = "content" | "dashboard";

export type ResponsiveLayout = {
  tier: ResponsiveTier;
  gutter: number;
  maxContentWidth: number;
  contentWidth: number;
  isDesktop: boolean;
};

export const responsiveBreakpoints = {
  tablet: 768,
  desktop: 1200,
  wide: 1440,
  ultrawide: 1600,
} as const;

const gutterByTier: Record<ResponsiveTier, number> = {
  mobile: 16,
  tablet: 24,
  desktop: 24,
  wide: 32,
  ultrawide: 32,
};

const maxContentWidthByVariant: Record<ResponsivePageVariant, number> = {
  content: 1440,
  dashboard: 1600,
};

const normalizeWidth = (width: number) =>
  Number.isFinite(width) ? Math.max(0, width) : 0;

export function resolveResponsiveTier(width: number): ResponsiveTier {
  const safeWidth = normalizeWidth(width);
  if (safeWidth < responsiveBreakpoints.tablet) return "mobile";
  if (safeWidth < responsiveBreakpoints.desktop) return "tablet";
  if (safeWidth < responsiveBreakpoints.wide) return "desktop";
  if (safeWidth < responsiveBreakpoints.ultrawide) return "wide";
  return "ultrawide";
}

export function resolveResponsiveLayout(
  viewportWidth: number,
  variant: ResponsivePageVariant = "content"
): ResponsiveLayout {
  const safeWidth = normalizeWidth(viewportWidth);
  const tier = resolveResponsiveTier(safeWidth);
  const gutter = gutterByTier[tier];
  const maxContentWidth = maxContentWidthByVariant[variant];
  const contentWidth = Math.max(
    0,
    Math.min(safeWidth - gutter * 2, maxContentWidth)
  );

  return {
    tier,
    gutter,
    maxContentWidth,
    contentWidth,
    isDesktop: safeWidth >= responsiveBreakpoints.desktop,
  };
}
