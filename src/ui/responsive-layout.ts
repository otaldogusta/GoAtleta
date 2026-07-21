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
  isMobile: boolean;
  usesWorkspaceShell: boolean;
  supportsSplitView: boolean;
  canExpandSidebar: boolean;
  supportsDenseGrid: boolean;
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
    isMobile: safeWidth < responsiveBreakpoints.workspace,
    usesWorkspaceShell: safeWidth >= responsiveBreakpoints.workspace,
    supportsSplitView: safeWidth >= responsiveBreakpoints.splitView,
    canExpandSidebar: safeWidth >= responsiveBreakpoints.expandedSidebar,
    supportsDenseGrid: safeWidth >= responsiveBreakpoints.wide,
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
