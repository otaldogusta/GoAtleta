import { compactUiMetrics } from "../theme/compact-ui-metrics";

export type ResponsiveTier =
  | "mobile"
  | "tablet"
  | "desktop"
  | "wide"
  | "ultrawide";

export type ResponsivePageVariant = "content" | "dashboard";

export type ResponsiveDensity = {
  pageTitleFontSize: number;
  pageTitleLineHeight: number;
  sectionTitleFontSize: number;
  cardTitleFontSize: number;
  bodyFontSize: number;
  metadataFontSize: number;
  pageGap: number;
  sectionGap: number;
  cardPadding: number;
};

export type ResponsiveLayout = {
  tier: ResponsiveTier;
  gutter: number;
  maxContentWidth: number;
  contentWidth: number;
  isMobile: boolean;
  usesWorkspaceShell: boolean;
  supportsSplitView: boolean;
  canExpandSidebar: boolean;
  canPersistExpandedSidebar: boolean;
  supportsDenseGrid: boolean;
  density: ResponsiveDensity;
};

export const responsiveBreakpoints = {
  workspace: 768,
  splitView: 960,
  expandedSidebar: 1100,
  tablet: 768,
  desktop: 1100,
  wide: 1440,
  ultrawide: 1600,
} as const;

export const responsiveContainerBreakpoints = {
  splitGrid: 720,
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

const workspaceDensity: ResponsiveDensity = {
  pageTitleFontSize: 20,
  pageTitleLineHeight: 26,
  sectionTitleFontSize: compactUiMetrics.titleFontSize,
  cardTitleFontSize: compactUiMetrics.bodyFontSize,
  bodyFontSize: compactUiMetrics.bodyFontSize,
  metadataFontSize: compactUiMetrics.metadataFontSize,
  pageGap: 12,
  sectionGap: compactUiMetrics.gap,
  cardPadding: 12,
};

const densityByTier: Record<ResponsiveTier, ResponsiveDensity> = {
  mobile: { ...workspaceDensity, pageTitleFontSize: 18, pageTitleLineHeight: 24, cardPadding: 10 },
  tablet: workspaceDensity,
  desktop: workspaceDensity,
  wide: workspaceDensity,
  ultrawide: workspaceDensity,
};

const normalizeWidth = (width: number) =>
  Number.isFinite(width) ? Math.max(0, width) : 0;

export function resolveResponsiveViewportWidth(
  measuredWidth: number,
  webLayoutViewportWidth?: number | null
) {
  const layoutWidth = normalizeWidth(webLayoutViewportWidth ?? 0);
  return layoutWidth > 0 ? layoutWidth : normalizeWidth(measuredWidth);
}

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
    isMobile: safeWidth < responsiveBreakpoints.workspace,
    usesWorkspaceShell: safeWidth >= responsiveBreakpoints.workspace,
    supportsSplitView: safeWidth >= responsiveBreakpoints.splitView,
    canExpandSidebar: safeWidth >= responsiveBreakpoints.workspace,
    canPersistExpandedSidebar:
      safeWidth >= responsiveBreakpoints.expandedSidebar,
    supportsDenseGrid: safeWidth >= responsiveBreakpoints.wide,
    density: densityByTier[tier],
  };
}

export type ResponsiveNavigation = {
  showBottomNavigation: boolean;
  showSidebar: boolean;
  allowExpandedSidebar: boolean;
};

export function resolveResponsiveNavigation(
  layout: Pick<ResponsiveLayout, "usesWorkspaceShell" | "canExpandSidebar">
): ResponsiveNavigation {
  return {
    showBottomNavigation: !layout.usesWorkspaceShell,
    showSidebar: layout.usesWorkspaceShell,
    allowExpandedSidebar: layout.usesWorkspaceShell && layout.canExpandSidebar,
  };
}

export function canSplitResponsiveGrid(
  layout: Pick<ResponsiveLayout, "supportsSplitView">,
  containerWidth: number
) {
  return (
    layout.supportsSplitView &&
    normalizeWidth(containerWidth) >= responsiveContainerBreakpoints.splitGrid
  );
}
